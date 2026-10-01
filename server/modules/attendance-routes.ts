import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { dateOnly } from '../../shared/stage1a.js';
import { occurrenceId, attendanceCommand } from '../../shared/attendance.js';
import {
  attendanceLesson,
  attendanceNotifications,
  attendanceRange,
  attendanceQueues,
  changeAttendance,
} from './attendance.js';
export async function attendanceRoutes(app: FastifyInstance) {
  app.get('/api/attendance/range', async (req) => {
    const q = z
      .object({
        from: dateOnly,
        days: z.coerce.number().int().min(1).max(62).default(1),
        studentId: z.uuid().optional(),
      })
      .strict()
      .parse(req.query);
    return attendanceRange(req.viewer, q.from, q.days, q.studentId);
  });
  app.get('/api/attendance/lesson', async (req) => {
    const q = z.object({ occurrenceId }).strict().parse(req.query);
    return attendanceLesson(req.viewer, q.occurrenceId);
  });
  app.get('/api/attendance/notifications', async (req) => attendanceNotifications(req.viewer));
  app.get('/api/attendance/queues', async (req) => attendanceQueues(req.viewer));
  app.post('/api/attendance/actions', { bodyLimit: 131072 }, async (req) =>
    changeAttendance(req.viewer, req.id, attendanceCommand.parse(req.body)),
  );
}
