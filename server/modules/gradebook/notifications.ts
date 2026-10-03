import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import * as s from '../../db/schema.js';
import type { Viewer } from '../../../shared/contracts.js';
import { schoolDateAt } from '../../../shared/attendance.js';
import { familyIds, requireReader, visiblePupils } from './context.js';
import { canReadWriting } from './writings.js';

export async function gradebookNotifications(v: Viewer, now = new Date()) {
  requireReader(v);
  return db.transaction(async (tx) => {
    const ids = await familyIds(tx, v, schoolDateAt(now));
    if (!ids.length) return [];
    const events = await tx
      .select()
      .from(s.outboxJob)
      .where(
        and(
          inArray(s.outboxJob.kind, [
            'gradebook.published',
            'gradebook.corrected',
            'gradebook.narrative',
            'gradebook.guardian_note',
            'gradebook.homeroom_note',
          ]),
          sql`${s.outboxJob.payload}->>'studentId' in (${sql.join(
            ids.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        ),
      )
      .orderBy(sql`${s.outboxJob.createdAt} desc`)
      .limit(60);
    const result = [];
    const seen = new Set<string>();
    for (const event of events) {
      const studentId = String(event.payload.studentId),
        objectId = String(event.payload.objectId);
      const key = `${objectId}:${studentId}`;
      if (seen.has(key)) continue;
      if (['gradebook.published', 'gradebook.corrected'].includes(event.kind)) {
        const item = (
          await tx
            .select()
            .from(s.gradebookAssessment)
            .where(eq(s.gradebookAssessment.id, objectId))
        )[0];
        if (
          !item ||
          item.status !== 'published' ||
          !(await visiblePupils(tx, v, item, now)).includes(studentId)
        )
          continue;
        const pupil = item.roster.find((p) => p.studentId === studentId)!;
        result.push({
          id: event.id,
          at: event.createdAt,
          student: pupil.name,
          title: item.title,
          kind: 'assessment',
          path: `/gradebook?course=${pupil.offeringIds[0]}&assessment=${item.id}`,
        });
      } else {
        const item = (
          await tx.select().from(s.gradebookWriting).where(eq(s.gradebookWriting.id, objectId))
        )[0];
        if (!item || !(await canReadWriting(tx, v, item, now))) continue;
        result.push({
          id: event.id,
          at: event.createdAt,
          student: item.snapshot.student,
          title:
            item.kind === 'narrative' ? 'წლიური განმავითარებელი შეფასება' : 'აკადემიური კომენტარი',
          kind: 'writing',
          path: '/gradebook?tab=writings',
        });
      }
      seen.add(key);
    }
    return result.slice(0, 20);
  });
}
