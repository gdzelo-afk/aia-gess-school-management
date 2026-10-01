import { eq } from 'drizzle-orm';
import { db } from './client.js';
import * as s from './schema.js';
import { fixtureId as id } from './fixtures.js';
import { config } from '../config.js';
import { capabilitiesFor, type Viewer } from '../../shared/contracts.js';
import { attendanceLesson, attendanceRange, changeAttendance } from '../modules/attendance.js';
import { attendanceCommand, schoolInstant } from '../../shared/attendance.js';
/** Small, explicitly fictional historical sample; never fills current/future roll calls. */
export async function seedAttendance() {
  if (config.NODE_ENV === 'production' || !config.DEMO_MODE)
    throw new Error('Attendance sample requires local demo mode');
  if (
    (
      await db
        .select()
        .from(s.auditEvent)
        .where(eq(s.auditEvent.id, id(1700)))
    ).length
  )
    return;
  if (Date.now() < schoolInstant('2026-09-26', '00:00')) return;
  const admin: Viewer = {
    id: 'demo-director',
    personId: id(1),
    name: 'თამარ ჯაფარიძე',
    roles: ['director'],
    capabilities: capabilitiesFor(['director']),
  };
  const history = await attendanceRange(
    admin,
    '2026-09-21',
    5,
    undefined,
    new Date(schoolInstant('2026-09-26', '12:00')),
  );
  let index = 0;
  for (const item of history.items) {
    const now = new Date(schoolInstant(item.occurrence.targetDate, '16:00'));
    const detail = await attendanceLesson(admin, item.occurrence.id, now);
    if (detail.revision) {
      index++;
      continue;
    }
    const entries = detail.roster.map((r, i) => {
      const variant = (index + i) % 9;
      const status =
        variant === 1
          ? 'late'
          : variant === 2
            ? 'absent'
            : variant === 3
              ? 'authorized'
              : 'present';
      const minutes = (t: string, n: number) => {
        const m = Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) + n;
        return `${Math.floor(m / 60)
          .toString()
          .padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}`;
      };
      return {
        studentId: r.studentId,
        status,
        arrival: status === 'late' ? minutes(item.occurrence.start, 12) : null,
        departure: variant === 4 ? minutes(item.occurrence.end, -10) : null,
        timeSource: 'estimated',
      };
    });
    await changeAttendance(
      admin,
      'demo-attendance-seed',
      attendanceCommand.parse({
        action: 'submit',
        commandId: id(1720 + index),
        occurrenceId: item.occurrence.id,
        expectedToken: detail.expectedToken,
        revision: 0,
        entries,
        reason: 'გამოგონილი სადემონსტრაციო ისტორია',
      }),
      now,
    );
    index++;
  }
  const guardian: Viewer = {
    id: 'demo-parent',
    personId: id(3),
    name: 'ნინო მაისურაძე',
    roles: ['guardian'],
    capabilities: capabilitiesFor(['guardian']),
  };
  const explanation = await changeAttendance(
    guardian,
    'demo-attendance-seed',
    attendanceCommand.parse({
      action: 'explanation.create',
      commandId: id(1760),
      studentId: id(200),
      startsOn: '2026-09-23',
      endsOn: '2026-09-24',
      reason: 'გამოგონილი მაგალითი: წინასწარ შეთანხმებული ოჯახური საქმე',
    }),
    new Date(schoolInstant('2026-09-22', '16:00')),
  );
  await changeAttendance(
    admin,
    'demo-attendance-seed',
    attendanceCommand.parse({
      action: 'explanation.decide',
      commandId: id(1761),
      id: explanation.id,
      revision: 1,
      approve: true,
      reason: 'გამოგონილი სადემონსტრაციო განმარტების დადასტურება',
    }),
    new Date(schoolInstant('2026-09-25', '16:00')),
  );
  await db
    .insert(s.auditEvent)
    .values({
      id: id(1700),
      actorUserId: admin.id,
      action: 'demo.attendance.seed',
      objectType: 'attendance',
      objectId: 'fictional-history',
      metadata: { fictional: true },
    })
    .onConflictDoNothing();
}
