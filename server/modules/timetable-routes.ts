import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { dateOnly } from '../../shared/stage1a.js';
import { timetableCommand, exceptionSchema, availabilitySchema } from '../../shared/timetable.js';
import {
  timetableSetup,
  timetableDraft,
  timetableWeek,
  changeTimetable,
  timetableChangePreview,
  timetableAffected,
  timetableRequests,
  timetableAvailabilityList,
  timetableTemplate,
  timetableMovePreview,
} from './timetable.js';
export async function timetableRoutes(app: FastifyInstance) {
  app.get('/api/timetable/setup', async (req) => {
    const q = z.object({ yearId: z.uuid().optional() }).strict().parse(req.query);
    return timetableSetup(req.viewer, q.yearId);
  });
  app.get('/api/timetable/drafts/:id', async (req) =>
    timetableDraft(req.viewer, z.object({ id: z.uuid() }).parse(req.params).id),
  );
  app.post('/api/timetable/move-preview', async (req) => {
    const q = z
      .object({
        id: z.uuid(),
        revision: z.number().int().positive(),
        lessonId: z.uuid(),
        weekday: z.number().int().min(1).max(5),
        periodId: z.uuid(),
      })
      .strict()
      .parse(req.body);
    return timetableMovePreview(req.viewer, q.id, q.revision, q.lessonId, q.weekday, q.periodId);
  });
  app.get('/api/timetable/week', async (req) =>
    timetableWeek(
      req.viewer,
      z
        .object({
          from: dateOnly,
          days: z.coerce.number().int().min(1).max(14).default(7),
          yearId: z.uuid().optional(),
          studentId: z.uuid().optional(),
          teacherId: z.uuid().optional(),
          roomId: z.uuid().optional(),
          groupId: z.uuid().optional(),
          sectionId: z.uuid().optional(),
        })
        .strict()
        .parse(req.query),
    ),
  );
  app.post('/api/timetable/actions', { bodyLimit: 524288 }, async (req) =>
    changeTimetable(req.viewer, req.id, timetableCommand.parse(req.body)),
  );
  app.post('/api/timetable/preview', async (req) =>
    timetableChangePreview(
      req.viewer,
      z
        .object({ changes: z.array(exceptionSchema).min(1).max(30) })
        .strict()
        .parse(req.body).changes,
    ),
  );
  app.post('/api/timetable/affected', async (req) =>
    timetableAffected(req.viewer, availabilitySchema.parse(req.body)),
  );
  app.get('/api/timetable/template', async (req) => {
    const q = z
      .object({ versionId: z.uuid(), lessonId: z.uuid(), date: dateOnly })
      .strict()
      .parse(req.query);
    return timetableTemplate(req.viewer, q.versionId, q.lessonId, q.date);
  });
  app.get('/api/timetable/requests', async (req) => timetableRequests(req.viewer));
  app.get('/api/timetable/availability', async (req) => timetableAvailabilityList(req.viewer));
}
