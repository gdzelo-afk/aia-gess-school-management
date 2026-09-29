import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { academicCommand, peopleCommand, accountCommand, dateOnly } from '../../shared/stage1a.js';
import { academicSetup, changeAcademics, offeringRoster } from './academics.js';
import {
  personHistory,
  personOptions,
  listPeople,
  changePeople,
  studentAdministration,
} from './people.js';
import { accounts, changeAccount } from './onboarding.js';
export async function stage1aRoutes(app: FastifyInstance) {
  app.get('/api/academics', async (req) => {
    const q = z.object({ yearId: z.uuid().optional() }).strict().parse(req.query);
    return academicSetup(req.viewer, q.yearId);
  });
  app.post('/api/academics/actions', async (req) =>
    changeAcademics(req.viewer, req.id, academicCommand.parse(req.body)),
  );
  app.get('/api/academics/offerings/:id/roster', async (req) => {
    const { id } = z.object({ id: z.uuid() }).parse(req.params);
    const q = z
      .object({ on: dateOnly, offset: z.coerce.number().int().min(0).max(100000).default(0) })
      .strict()
      .parse(req.query);
    return offeringRoster(req.viewer, id, q.on, q.offset);
  });
  app.get('/api/people/options', async (req) => {
    const q = z
      .object({
        kind: z.enum(['staff', 'guardian', 'person', 'student']),
        q: z.string().max(100).default(''),
      })
      .strict()
      .parse(req.query);
    return personOptions(req.viewer, q.kind, q.q);
  });
  app.get('/api/people', async (req) =>
    listPeople(
      req.viewer,
      z
        .object({
          q: z.string().max(100).default(''),
          kind: z.enum(['staff', 'guardian', 'person']),
          status: z.enum(['active', 'archived', 'all', 'departed']).default('active'),
          offset: z.coerce.number().int().min(0).max(100000).default(0),
        })
        .strict()
        .parse(req.query),
    ),
  );
  app.get('/api/people/:id/history', async (req) => {
    const { id } = z.object({ id: z.uuid() }).parse(req.params);
    const { kind } = z
      .object({ kind: z.enum(['staff', 'guardian']) })
      .strict()
      .parse(req.query);
    return personHistory(req.viewer, id, kind);
  });
  app.post('/api/people/actions', async (req) =>
    changePeople(req.viewer, req.id, peopleCommand.parse(req.body)),
  );
  app.get('/api/people/students/:id', async (req) => {
    const { id } = z.object({ id: z.uuid() }).parse(req.params);
    return studentAdministration(req.viewer, id);
  });
  app.get('/api/accounts', async (req) => {
    const q = z
      .object({
        q: z.string().max(100).default(''),
        offset: z.coerce.number().int().min(0).max(100000).default(0),
      })
      .strict()
      .parse(req.query);
    return accounts(req.viewer, q.q, q.offset);
  });
  app.post('/api/accounts/actions', async (req) =>
    changeAccount(req.viewer, req.id, accountCommand.parse(req.body)),
  );
}
