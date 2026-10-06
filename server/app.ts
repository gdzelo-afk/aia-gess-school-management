import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import staticFiles from '@fastify/static';
import { fromNodeHeaders } from 'better-auth/node';
import { z, ZodError } from 'zod';
import { sql, eq } from 'drizzle-orm';
import { user as appUser } from './db/schema.js';
import { gradebookRoutes } from './modules/gradebook-routes.js';
import { attendanceRoutes } from './modules/attendance-routes.js';
import { timetableRoutes } from './modules/timetable-routes.js';
import { stage1aRoutes } from './modules/stage1a-routes.js';
import { DomainError } from './modules/operations.js';
import { activate, requestRecovery, localDeliveryAvailable } from './modules/onboarding.js';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { auth } from './auth/index.js';
import { db } from './db/client.js';
import { config } from './config.js';
import { resolveViewer } from './modules/access.js';
import { listStudents, findStudent, overview, canSeeChildFinance } from './modules/foundation.js';
import { recordAudit } from './infrastructure/audit.js';
import { hasPreviewAccess } from './preview-access.js';
import type { Viewer } from '../shared/contracts.js';
declare module 'fastify' {
  interface FastifyRequest {
    viewer: Viewer;
  }
}
export async function buildApp(logging = true) {
  const app = Fastify({
    logger: logging
      ? {
          redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
          level: 'info',
        }
      : false,
    bodyLimit: 65536,
  });
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: config.NODE_ENV === 'production' ? [] : null,
      },
    },
    hsts: config.NODE_ENV === 'production',
  });
  await app.register(rateLimit, {
    max: 180,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: { code: 'RATE_LIMIT', message: 'ძალიან ბევრი მოთხოვნაა. ცოტა ხანში სცადეთ.' },
    }),
  });
  app.addHook('onRequest', async (req, reply) => {
    if (req.url.startsWith('/api')) reply.header('Cache-Control', 'no-store');
    const requestPath = new URL(req.url, config.APP_ORIGIN).pathname;
    let decodedPath = requestPath;
    try {
      decodedPath = decodeURIComponent(requestPath);
    } catch {
      // A malformed path simply remains unmatched below.
    }
    if (config.PREVIEW_MODE && requestPath !== '/api/health') {
      if (
        !hasPreviewAccess(
          req.headers.authorization,
          config.PREVIEW_ACCESS_USERNAME!,
          config.PREVIEW_ACCESS_PASSWORD!,
        )
      ) {
        reply.header('WWW-Authenticate', 'Basic realm="AIA-GESS preview", charset="UTF-8"');
        reply.header('Cache-Control', 'no-store');
        return reply
          .code(401)
          .type('text/plain; charset=utf-8')
          .send('გთხოვთ, შეიყვანოთ წინასწარი ნახვის კოდი.');
      }
    }
    if (config.PREVIEW_MODE && /^\/design-lab(?:\/|$)/.test(decodedPath))
      return reply
        .code(404)
        .send({ error: { code: 'NOT_FOUND', message: 'გვერდი ვერ მოიძებნა.' } });
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      req.headers.origin !== config.APP_ORIGIN
    )
      return reply.code(403).send({
        error: { code: 'ORIGIN_DENIED', message: 'მოთხოვნა უარყოფილია.', requestId: req.id },
      });
  });
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof DomainError)
      return reply
        .code(err.statusCode)
        .send({ error: { code: err.code, message: err.message, requestId: req.id } });
    if (err instanceof ZodError)
      return reply.code(400).send({
        error: {
          code: 'VALIDATION',
          message: 'შეამოწმეთ შეყვანილი მონაცემები.',
          requestId: req.id,
        },
      });
    const status =
      typeof err === 'object' && err && 'statusCode' in err ? Number(err.statusCode) : 500;
    if (status >= 500)
      req.log.error(
        { requestId: req.id, errorType: err instanceof Error ? err.name : 'Unknown' },
        'Request failed',
      );
    return reply.code(status >= 400 && status < 600 ? status : 500).send({
      error: {
        code: status === 429 ? 'RATE_LIMIT' : status === 400 ? 'BAD_REQUEST' : 'INTERNAL',
        message:
          status === 429
            ? 'ძალიან ბევრი მოთხოვნაა. ცოტა ხანში სცადეთ.'
            : 'მოთხოვნა ვერ შესრულდა. სცადეთ ხელახლა.',
        requestId: req.id,
      },
    });
  });
  app.get('/api/health', async () => {
    await db.execute(sql`select 1`);
    return { status: 'ok' };
  });
  app.get('/api/config', async () => ({
    demo: config.DEMO_MODE,
    localDelivery: localDeliveryAvailable,
    designLab: !config.PREVIEW_MODE,
  }));
  app.post(
    '/api/onboarding/activate',
    { config: { rateLimit: { max: 6, timeWindow: '1 minute' } } },
    async (req) => {
      const input = z
        .object({
          token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
          password: z.string().min(12).max(128),
        })
        .strict()
        .parse(req.body);
      return activate(input.token, input.password, req.id);
    },
  );
  app.post(
    '/api/onboarding/recovery',
    { config: { rateLimit: { max: 3, timeWindow: '1 minute' } } },
    async (req) => {
      const input = z
        .object({ email: z.email().max(200) })
        .strict()
        .parse(req.body);
      return requestRecovery(input.email);
    },
  );
  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    handler: async (req, reply) => {
      const headers = fromNodeHeaders(req.headers);
      headers.set('x-aia-client-ip', req.ip);
      const response = await auth.handler(
        new Request(new URL(req.url, config.APP_ORIGIN), {
          method: req.method,
          headers,
          ...(req.body ? { body: JSON.stringify(req.body) } : {}),
        }),
      );
      reply.code(response.status);
      response.headers.forEach((value, key) => {
        if (key !== 'set-cookie') reply.header(key, value);
      });
      const cookies = response.headers.getSetCookie();
      if (cookies.length) reply.header('set-cookie', cookies);
      return reply.send(response.body ? await response.text() : null);
    },
  });
  await app.register(async (protectedApp) => {
    protectedApp.addHook('preHandler', async (req, reply) => {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      if (!session)
        return reply.code(401).send({
          error: {
            code: 'UNAUTHENTICATED',
            message: 'გთხოვთ, შეხვიდეთ სისტემაში.',
            requestId: req.id,
          },
        });
      const account = (
        await db
          .select({ disabled: appUser.disabled })
          .from(appUser)
          .where(eq(appUser.id, session.user.id))
      )[0];
      if (!account || account.disabled)
        return reply.code(401).send({
          error: { code: 'ACCOUNT_DISABLED', message: 'ანგარიში გამორთულია.', requestId: req.id },
        });
      req.viewer = await resolveViewer(session.user);
    });
    await stage1aRoutes(protectedApp);
    await timetableRoutes(protectedApp);
    await attendanceRoutes(protectedApp);
    await gradebookRoutes(protectedApp);
    protectedApp.get('/api/me', async (req) => req.viewer);
    protectedApp.get('/api/foundation/overview', async (req) => overview(req.viewer));
    protectedApp.get('/api/foundation/students', async (req) => {
      const input = z
        .object({
          q: z.string().max(100).default(''),
          limit: z.coerce.number().int().min(1).max(100).default(6),
          offset: z.coerce.number().int().min(0).max(100000).default(0),
          sort: z.enum(['asc', 'desc']).default('asc'),
          section: z.string().max(30).optional(),
          status: z.enum(['active', 'archived', 'all']).default('active'),
        })
        .strict()
        .parse(req.query);
      return listStudents(req.viewer, input);
    });
    protectedApp.get('/api/foundation/students/:id', async (req, reply) => {
      const { id } = z.object({ id: z.uuid() }).parse(req.params);
      const result = await findStudent(req.viewer, id);
      if (!result)
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'ჩანაწერი ვერ მოიძებნა.', requestId: req.id },
        });
      await recordAudit({
        actorUserId: req.viewer.id,
        action: 'student.view',
        objectType: 'student',
        objectId: id,
        requestId: req.id,
      });
      return result;
    });
    protectedApp.get('/api/foundation/finance-summary', async (req, reply) => {
      if (!req.viewer.capabilities.includes('finance:school'))
        return reply.code(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'ამ მონაცემებზე წვდომა შეზღუდულია.',
            requestId: req.id,
          },
        });
      return { status: 'planned', message: 'ფინანსური მოდული დაგეგმილია.' };
    });
    protectedApp.get('/api/foundation/students/:id/finance-preview', async (req, reply) => {
      const { id } = z.object({ id: z.uuid() }).parse(req.params);
      if (!(await canSeeChildFinance(req.viewer, id)))
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'ჩანაწერი ვერ მოიძებნა.', requestId: req.id },
        });
      // Explicit example, not a billing record. Never emitted in non-demo mode.
      return config.DEMO_MODE
        ? {
            demo: true,
            currency: 'GEL',
            invoiceNumber: 'მაგალითი / 2026-09',
            amountTetri: 65000,
            status: 'example',
          }
        : { demo: false, status: 'planned' };
    });
  });
  if (existsSync(resolve('dist/web/index.html'))) {
    await app.register(staticFiles, { root: resolve('dist/web'), wildcard: false });
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith('/api/')
        ? reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'გვერდი ვერ მოიძებნა.' } })
        : reply.sendFile('index.html'),
    );
  }
  return app;
}
