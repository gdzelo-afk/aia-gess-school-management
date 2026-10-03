import { gradebookNotifications } from './gradebook/notifications.js';
import { academicOverview, gradebookPulse } from './gradebook/overview.js';
import { gradebookYears, criteriaLibrary, criteriaDetail, policySetup } from './gradebook/setup.js';
import { academicReport, reportKind } from './gradebook/reports.js';
import { recoveryQueue } from './gradebook/reads.js';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { gradebookCommand } from '../../shared/gradebook.js';
import { assessmentDetail, changeGradebook } from './gradebook/assessments.js';
import { assessmentHistory, journal, writings, writingHistory } from './gradebook/reads.js';
import { criteriaFileLimit, downloadCriteria, uploadCriteria } from './gradebook/files.js';
const idParams = z.object({ id: z.uuid() }).strict();
const lens = z
  .object({
    yearId: z.uuid(),
    semesterId: z.uuid(),
    offeringId: z.uuid().optional(),
    studentId: z.uuid().optional(),
  })
  .strict();
export async function gradebookRoutes(app: FastifyInstance) {
  app.get('/api/gradebook/pulse', async (req) => gradebookPulse(req.viewer));
  app.get('/api/gradebook/notifications', async (req) => gradebookNotifications(req.viewer));
  app.get('/api/gradebook/overview', async (req) => {
    const q = z.object({ yearId: z.uuid(), semesterId: z.uuid() }).strict().parse(req.query);
    return academicOverview(req.viewer, q.yearId, q.semesterId);
  });
  app.get('/api/gradebook/setup', async (req) => {
    const q = z.object({ yearId: z.uuid(), semesterId: z.uuid() }).strict().parse(req.query);
    return policySetup(req.viewer, q.yearId, q.semesterId);
  });
  app.get('/api/gradebook/years', async (req) => gradebookYears(req.viewer));
  app.get('/api/gradebook/criteria', async (req) => {
    const q = z
      .object({ yearId: z.uuid(), subjectId: z.uuid().optional() })
      .strict()
      .parse(req.query);
    return criteriaLibrary(req.viewer, q.yearId, q.subjectId);
  });
  app.get('/api/gradebook/criteria/:id', async (req) =>
    criteriaDetail(req.viewer, idParams.parse(req.params).id),
  );
  app.get('/api/gradebook/reports/:kind', async (req) => {
    const { kind } = z.object({ kind: reportKind }).strict().parse(req.params);
    const q = lens.extend({ offeringId: z.uuid() }).parse(req.query);
    return academicReport(req.viewer, kind, q.yearId, q.semesterId, q.offeringId, q.studentId);
  });
  app.get('/api/gradebook/recovery', async (req) => {
    const q = z.object({ yearId: z.uuid() }).strict().parse(req.query);
    return recoveryQueue(req.viewer, q.yearId);
  });
  app.get('/api/gradebook/journal', async (req) => {
    const q = lens.parse(req.query);
    return journal(req.viewer, q.yearId, q.semesterId, q.offeringId, q.studentId);
  });
  app.get('/api/gradebook/assessments/:id', async (req) =>
    assessmentDetail(req.viewer, idParams.parse(req.params).id),
  );
  app.get('/api/gradebook/assessments/:id/history', async (req) =>
    assessmentHistory(req.viewer, idParams.parse(req.params).id),
  );
  app.get('/api/gradebook/writings/:id/history', async (req) =>
    writingHistory(req.viewer, idParams.parse(req.params).id),
  );
  app.get('/api/gradebook/writings', async (req) => {
    const q = z
      .object({ yearId: z.uuid(), studentId: z.uuid().optional() })
      .strict()
      .parse(req.query);
    return writings(req.viewer, q.yearId, q.studentId);
  });
  app.post('/api/gradebook/actions', { bodyLimit: 1024 * 1024 }, async (req) =>
    changeGradebook(req.viewer, req.id, gradebookCommand.parse(req.body)),
  );
  await app.register(async (files) => {
    files.addContentTypeParser(
      'application/pdf',
      { parseAs: 'buffer', bodyLimit: criteriaFileLimit },
      (_req, body, done) => done(null, body),
    );
    files.post('/api/gradebook/criteria/files', { bodyLimit: criteriaFileLimit }, async (req) => {
      const q = z
        .object({ name: z.string().min(1).max(250) })
        .strict()
        .parse(req.query);
      return uploadCriteria(
        req.viewer,
        req.id,
        z.instanceof(Buffer).parse(req.body),
        q.name,
        req.headers['content-type'] ?? '',
      );
    });
    files.get('/api/gradebook/criteria/files/:id', async (req, reply) => {
      const result = await downloadCriteria(req.viewer, req.id, idParams.parse(req.params).id);
      return reply
        .header('Cache-Control', 'private, no-store')
        .header('X-Content-Type-Options', 'nosniff')
        .header('Content-Security-Policy', "default-src 'none'; sandbox")
        .header(
          'Content-Disposition',
          `attachment; filename="criteria.pdf"; filename*=UTF-8''${encodeURIComponent(result.file.originalName)}`,
        )
        .type('application/pdf')
        .send(result.data);
    });
  });
}
