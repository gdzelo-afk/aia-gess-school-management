import { beforeAll, afterAll, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { capabilitiesFor, type Viewer, type Role } from '../shared/contracts.js';
import {
  attendanceCommand,
  attendanceSummary,
  attendanceWindow,
  approximateLateness,
  schoolDateAt,
  schoolInstant,
} from '../shared/attendance.js';
import { timetableCommand, type LessonChange } from '../shared/timetable.js';
process.env.NODE_ENV = 'test';
process.env.BETTER_AUTH_SECRET = 'test-only-secret-that-is-more-than-32-characters';
process.env.APP_ORIGIN = 'http://localhost:5173';
process.env.DEMO_MODE = 'true';
process.env.DATABASE_URL = process.env.TEST_ATTENDANCE_DATABASE_URL ?? 'pglite://';
const { database, db } = await import('../server/db/client.js');
const { seedDemo } = await import('../server/db/seed-data.js');
const s = await import('../server/db/schema.js');
const { fixtureId: id } = await import('../server/db/fixtures.js');
const a = await import('../server/modules/attendance.js');
const t = await import('../server/modules/timetable.js');
const { buildApp } = await import('../server/app.js');
const app = await buildApp(false);
const viewer = (role: Role, personId = id(1), userId = 'demo-director'): Viewer => ({
  id: userId,
  personId,
  name: 'ტესტი',
  roles: [role],
  capabilities: capabilitiesFor([role]),
});
const admin = viewer('director'),
  teacher = viewer('teacher', id(2), 'demo-teacher'),
  guardian = viewer('guardian', id(3), 'demo-parent'),
  student = viewer('student', id(100), 'demo-student'),
  founder = viewer('founders_office');
const at = (date: string, time = '09:10') => new Date(schoolInstant(date, time));
const lesson = (date: string, lessonId = 1501) => `${id(1600)}:${id(lessonId)}:${date}`;
const act = (v: Viewer, c: unknown, now = at('2026-10-05')) =>
  a.changeAttendance(
    v,
    'attendance-test',
    attendanceCommand.parse({ commandId: randomUUID(), ...(c as object) }),
    now,
  );
async function input(v: Viewer, occurrenceId: string, now: Date) {
  const x = await a.attendanceLesson(v, occurrenceId, now);
  return {
    occurrenceId,
    expectedToken: x.expectedToken,
    revision: x.revision,
    entries: x.roster.map((r) => ({
      studentId: r.studentId,
      status: 'present' as const,
      arrival: null as string | null,
      departure: null as string | null,
      timeSource: 'reported' as const,
    })),
    reconcileRoster: false,
  };
}
const tt = (c: unknown) =>
  t.changeTimetable(admin, 'attendance-timetable-test', timetableCommand.parse(c));
const change = async (occurrenceId: string, updates: Partial<LessonChange>) => {
  const [versionId, lessonId, date] = occurrenceId.split(':');
  const o = await t.timetableTemplate(admin, versionId!, lessonId!, date!);
  const c = {
    occurrenceId: o.id,
    expectedRevision: o.revision,
    date: o.date,
    targetDate: o.targetDate,
    teacherId: o.teacherId,
    roomId: o.roomId,
    groupId: o.groupId,
    periodId: o.periodId,
    start: o.start,
    end: o.end,
    cancelled: o.cancelled,
    exceptionalDay: o.exceptionalDay,
    ...updates,
  };
  return tt({
    action: 'exception.apply',
    changes: [c],
    reason: 'სატესტო განრიგის ცვლილება',
    overrides: [],
  });
};
beforeAll(async () => {
  await database.migrate();
  await seedDemo();
});
afterAll(async () => {
  await app.close();
  await database.close();
});
it('migrates repeatedly and leaves roll calls unresolved until an explicit submission', async () => {
  await database.migrate();
  await seedDemo();
  const x = await a.attendanceLesson(teacher, lesson('2026-10-05'), at('2026-10-05'));
  expect(x.entries).toEqual([]);
  expect(x.roster).toHaveLength(3);
  expect(x.revision).toBe(0);
  expect(await db.select().from(s.attendanceSession)).toHaveLength(0);
});
it('uses Tbilisi start/+15/end+24 boundaries, with crisp deadline and midnight semantics', () => {
  expect(schoolDateAt(new Date('2026-10-04T20:00:00Z'))).toBe('2026-10-05');
  const o = { targetDate: '2026-10-05', start: '09:00', end: '09:45' } as Parameters<
    typeof attendanceWindow
  >[0];
  expect(attendanceWindow(o, at('2026-10-05', '08:59')).started).toBe(false);
  expect(attendanceWindow(o, at('2026-10-05', '09:15')).overdue).toBe(false);
  expect(attendanceWindow(o, at('2026-10-05', '09:16')).overdue).toBe(true);
  expect(attendanceWindow(o, at('2026-10-06', '09:44')).locked).toBe(false);
  expect(attendanceWindow(o, at('2026-10-06', '09:45')).locked).toBe(true);
  expect(approximateLateness('09:00', '09:18')).toBe(18);
});
it('rejects early attendance, incomplete rosters and unrelated writers without partial writes', async () => {
  const x = await input(teacher, lesson('2026-10-05'), at('2026-10-05'));
  await expect(
    act(teacher, { action: 'submit', ...x }, at('2026-10-05', '08:59')),
  ).rejects.toMatchObject({ code: 'NOT_STARTED' });
  await expect(
    act(teacher, { action: 'submit', ...x, entries: x.entries.slice(1) }),
  ).rejects.toMatchObject({ code: 'ROSTER_CONFLICT' });
  await expect(act(founder, { action: 'submit', ...x })).rejects.toMatchObject({ statusCode: 403 });
  await expect(act(viewer('teacher', id(4)), { action: 'submit', ...x })).rejects.toMatchObject({
    statusCode: 404,
  });
  expect(await db.select().from(s.attendanceSession)).toHaveLength(0);
});
it('atomically submits exceptions, records overdue truth and replays only an identical idempotency command', async () => {
  const now = at('2026-10-05', '09:30'),
    x = await input(teacher, lesson('2026-10-05'), now);
  const entries = x.entries.map((r, i) =>
    i === 0
      ? { ...r, status: 'late', arrival: '09:18', departure: '09:25', timeSource: 'estimated' }
      : i === 1
        ? { ...r, status: 'absent' }
        : r,
  );
  const c = { action: 'submit', ...x, entries, commandId: randomUUID() };
  const result = await act(teacher, c, now);
  expect(await act(teacher, c, now)).toEqual(result);
  await expect(act(teacher, { ...c, entries: x.entries }, now)).rejects.toMatchObject({
    code: 'IDEMPOTENCY_CONFLICT',
  });
  const saved = await a.attendanceLesson(teacher, x.occurrenceId, now);
  expect(saved.submittedOverdue).toBe(true);
  expect(saved.revision).toBe(1);
  expect(saved.history).toHaveLength(1);
  expect(await db.select().from(s.outboxJob)).toHaveLength(3);
});
it('requires deliberate correction reason and rejects stale/concurrent revisions', async () => {
  const now = at('2026-10-05', '09:35'),
    x = await input(teacher, lesson('2026-10-05'), now);
  await expect(act(teacher, { action: 'submit', ...x }, now)).rejects.toMatchObject({
    code: 'REASON_REQUIRED',
  });
  const results = await Promise.allSettled([
    act(teacher, { action: 'submit', ...x, reason: 'შესწორება შემოწმების შემდეგ' }, now),
    act(admin, { action: 'submit', ...x, reason: 'ადმინისტრაციული შესწორება' }, now),
  ]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  const saved = await a.attendanceLesson(teacher, x.occurrenceId, now);
  expect(saved.revision).toBe(2);
  expect(saved.history).toHaveLength(2);
  expect(saved.history[1]!.before!.entries.some((r) => r.status === 'absent')).toBe(true);
});
it('locks routine writes at lesson end plus 24h and permits reasoned administrative correction', async () => {
  const now = at('2026-10-06', '09:45'),
    x = await input(teacher, lesson('2026-10-05'), now);
  await expect(
    act(teacher, { action: 'submit', ...x, reason: 'ჩანაწერის შესწორება' }, now),
  ).rejects.toMatchObject({ code: 'LOCKED' });
  await expect(act(admin, { action: 'submit', ...x }, now)).rejects.toMatchObject({
    code: 'REASON_REQUIRED',
  });
  await act(admin, { action: 'submit', ...x, reason: 'ისტორიული ჩანაწერის შესწორება' }, now);
});
it('approves a locked teacher request transactionally and preserves the decision', async () => {
  const now = at('2026-10-07'),
    x = await input(teacher, lesson('2026-10-05'), now);
  const r = await act(
    teacher,
    { action: 'request.create', proposal: x, reason: 'მოსწავლის სტატუსის შემოწმება' },
    now,
  );
  await expect(
    act(
      founder,
      {
        action: 'request.decide',
        id: r.id,
        revision: 1,
        approve: true,
        reason: 'დადასტურებულია შემოწმებით',
      },
      now,
    ),
  ).rejects.toMatchObject({ statusCode: 403 });
  await act(
    admin,
    {
      action: 'request.decide',
      id: r.id,
      revision: 1,
      approve: true,
      reason: 'დადასტურებულია შემოწმებით',
    },
    now,
  );
  expect((await a.attendanceQueues(teacher, now)).requests[0]!.state).toBe('approved');
  await expect(
    act(
      admin,
      {
        action: 'request.decide',
        id: r.id,
        revision: 2,
        approve: false,
        reason: 'განმეორებითი მოქმედება',
      },
      now,
    ),
  ).rejects.toMatchObject({ code: 'CONFLICT' });
});
it('rejects invalid late/early status combinations, future times and unauthorized authorization', async () => {
  const now = at('2026-10-06'),
    x = await input(teacher, lesson('2026-10-06', 1502), now);
  const first = x.entries[0]!;
  for (const bad of [
    { ...first, status: 'late' },
    { ...first, status: 'absent', departure: '09:05' },
  ]) {
    expect(
      attendanceCommand.safeParse({
        action: 'submit',
        commandId: randomUUID(),
        ...x,
        entries: [bad, ...x.entries.slice(1)],
      }).success,
    ).toBe(false);
  }
  await expect(
    act(
      teacher,
      {
        action: 'submit',
        ...x,
        entries: [{ ...first, status: 'late', arrival: '09:30' }, ...x.entries.slice(1)],
      },
      now,
    ),
  ).rejects.toMatchObject({ code: 'TIME' });
  await expect(
    act(
      teacher,
      {
        action: 'submit',
        ...x,
        entries: [{ ...first, status: 'authorized' }, ...x.entries.slice(1)],
      },
      now,
    ),
  ).rejects.toMatchObject({ code: 'AUTHORIZATION_REQUIRED' });
});
it('keeps future approved explanations separate from attendance and converts only actual absence', async () => {
  const now = at('2026-10-06'),
    x = await input(teacher, lesson('2026-10-06', 1502), now);
  const childId = (await a.attendanceRange(guardian, '2026-10-06', 1, undefined, now)).children[0]!
    .studentId;
  const request = await act(
    guardian,
    {
      action: 'explanation.create',
      studentId: childId,
      startsOn: '2026-10-06',
      endsOn: '2026-10-08',
      reason: 'პირადი ოჯახის განმარტება',
    },
    at('2026-10-05'),
  );
  await act(
    admin,
    {
      action: 'explanation.decide',
      id: request.id,
      revision: 1,
      approve: true,
      reason: 'სკოლის მიერ დადასტურებულია',
    },
    at('2026-10-05'),
  );
  expect((await a.attendanceLesson(teacher, x.occurrenceId, now)).entries).toEqual([]);
  await act(teacher, { action: 'submit', ...x }, now);
  expect(
    (await a.attendanceLesson(student, x.occurrenceId, now)).entries.every(
      (r) => r.status === 'present',
    ),
  ).toBe(true);
  const tomorrow = at('2026-10-07'),
    y = await input(teacher, lesson('2026-10-07', 1503), tomorrow);
  await act(
    teacher,
    {
      action: 'submit',
      ...y,
      entries: y.entries.map((r) => (r.studentId === childId ? { ...r, status: 'absent' } : r)),
    },
    tomorrow,
  );
  expect((await a.attendanceLesson(student, y.occurrenceId, tomorrow)).entries[0]!.status).toBe(
    'authorized',
  );
  expect(
    await db
      .select()
      .from(s.outboxJob)
      .where(eq(s.outboxJob.deduplicationKey, `attendance:absence:${childId}:2026-10-07`)),
  ).toHaveLength(0);
});
it('past approval appends revisions, keeps Present unchanged and does not repeat notification events', async () => {
  const now = at('2026-10-08'),
    x = await input(teacher, lesson('2026-10-08', 1504), now);
  const childId = (await a.attendanceRange(guardian, '2026-10-08', 1, undefined, now)).children[0]!
    .studentId;
  await act(
    teacher,
    { action: 'submit', ...x, entries: x.entries.map((r) => ({ ...r, status: 'absent' })) },
    now,
  );
  const count = (await db.select().from(s.outboxJob)).length;
  const request = await act(
    guardian,
    {
      action: 'explanation.create',
      studentId: childId,
      startsOn: '2026-10-08',
      endsOn: '2026-10-09',
      reason: 'ოჯახის პირადი განმარტება',
    },
    now,
  );
  await act(
    admin,
    {
      action: 'explanation.decide',
      id: request.id,
      revision: 1,
      approve: true,
      reason: 'შემოწმებულია ადმინისტრაციის მიერ',
    },
    now,
  );
  const result = await a.attendanceLesson(admin, x.occurrenceId, now);
  expect(result.entries.find((r) => r.studentId === childId)!.status).toBe('authorized');
  expect(result.history.at(-1)!.action).toBe('explanation.authorized');
  expect((await db.select().from(s.outboxJob)).length).toBe(count);
  expect(JSON.stringify(await a.attendanceLesson(teacher, x.occurrenceId, now))).not.toContain(
    'ოჯახის პირადი',
  );
});
it('deduplicates separate absence/late/early child-day events across multiple lessons and corrections', async () => {
  const now = at('2026-10-09', '11:00'),
    x = await input(teacher, lesson('2026-10-09', 1505), now);
  await act(
    teacher,
    { action: 'submit', ...x, entries: x.entries.map((r) => ({ ...r, status: 'absent' })) },
    now,
  );
  const y = await input(admin, lesson('2026-10-09', 1515), now);
  await act(
    admin,
    {
      action: 'submit',
      ...y,
      entries: y.entries.map((r) => ({ ...r, status: 'absent' })),
      reason: 'ადმინისტრაციის მიერ შევსება',
    },
    now,
  );
  const jobs = await db.select().from(s.outboxJob);
  for (const r of x.entries)
    expect(
      jobs.filter((j) => j.deduplicationKey === `attendance:absence:${r.studentId}:2026-10-09`),
    ).toHaveLength(1);
  const z = await input(teacher, x.occurrenceId, now);
  const entries = z.entries.map((r) => ({
    ...r,
    status: 'late',
    arrival: '09:10',
    departure: '09:30',
  }));
  await act(teacher, { action: 'submit', ...z, entries, reason: 'მოსვლა და ადრე გასვლა' }, now);
  const z2 = await input(teacher, x.occurrenceId, now);
  await act(teacher, { action: 'submit', ...z2, entries, reason: 'დროის გადამოწმება' }, now);
  const final = await db.select().from(s.outboxJob);
  for (const r of x.entries)
    for (const kind of ['absence', 'late', 'early'])
      expect(
        final.filter((j) => j.deduplicationKey === `attendance:${kind}:${r.studentId}:2026-10-09`),
      ).toHaveLength(1);
});
it('derives percentages and day completeness without treating missing work as absence or presence', () => {
  const r = {
    studentId: id(200),
    status: 'present' as const,
    arrival: null,
    departure: null,
    timeSource: 'reported' as const,
  };
  expect(
    attendanceSummary(
      [
        r,
        { ...r, status: 'late', arrival: '09:10', departure: '09:20' },
        { ...r, status: 'absent' },
        { ...r, status: 'authorized' },
      ],
      4,
    ),
  ).toMatchObject({ percentage: 50, state: 'partial', missing: 0, early: 1 });
  expect(attendanceSummary([r], 2)).toMatchObject({
    percentage: 100,
    provisional: true,
    missing: 1,
    state: 'incomplete',
  });
  expect(attendanceSummary([], 0)).toMatchObject({ percentage: null, state: 'no_lessons' });
  expect(attendanceSummary([{ ...r, status: 'authorized' }], 1).state).toBe('absent');
  expect(attendanceSummary([{ ...r, status: 'late', arrival: '09:10' }], 1).state).toBe('present');
});
it('scopes histories, guessed IDs and private explanations for all family/read-only personas', async () => {
  const now = at('2026-10-09', '12:00');
  const own = await a.attendanceRange(student, '2026-10-05', 5, undefined, now);
  expect(own.items.every((i) => i.roster.every((r) => r.studentId === id(200)))).toBe(true);
  expect(own.items.every((i) => i.window === null && i.overdue === null)).toBe(true);
  await expect(a.attendanceRange(student, '2026-10-05', 5, id(205), now)).rejects.toMatchObject({
    statusCode: 404,
  });
  await expect(
    act(
      guardian,
      {
        action: 'explanation.create',
        studentId: id(205),
        startsOn: '2026-10-09',
        endsOn: '2026-10-10',
        reason: 'სხვა მოსწავლის განმარტება',
      },
      now,
    ),
  ).rejects.toMatchObject({ statusCode: 404 });
  expect((await a.attendanceQueues(student, now)).explanations).toEqual([]);
  expect((await a.attendanceQueues(teacher, now)).explanations).toEqual([]);
  expect((await a.attendanceQueues(founder, now)).explanations).toEqual([]);
  expect((await a.attendanceLesson(student, lesson('2026-10-05'), now)).history).toEqual([]);
  expect((await a.attendanceRange(founder, '2026-10-05', 5, undefined, now)).school).toBe(true);
  for (const role of ['director', 'principal', 'vice_principal', 'administrator'] as const)
    expect(capabilitiesFor([role])).toContain('attendance:manage');
  expect(capabilitiesFor(['founders_office'])).not.toContain('attendance:manage');
  expect(capabilitiesFor(['founders_office'])).not.toContain('students:school');
});
it('derives exact split and combined/elective rosters using the existing occurrence engine', async () => {
  const now = at('2026-10-13', '12:00');
  const whole = await a.attendanceLesson(admin, lesson('2026-10-13', 1502), now);
  const one = await a.attendanceLesson(admin, lesson('2026-10-13', 1521), now);
  const two = await a.attendanceLesson(admin, lesson('2026-10-13', 1522), now);
  expect(one.roster.length + two.roster.length).toBe(whole.roster.length);
  expect(one.roster.some((r) => two.roster.some((t) => t.studentId === r.studentId))).toBe(false);
  const combined = await a.attendanceLesson(admin, lesson('2026-10-13', 1512), now);
  expect(combined.roster).toHaveLength(6);
  expect(new Set(combined.roster.map((r) => r.studentId)).size).toBe(6);
  const elective = (await a.attendanceRange(admin, '2026-10-12', 5, undefined, now)).items.find(
    (i) => i.occurrence.groupId === id(1414),
  )!;
  expect(elective.roster).toHaveLength(2);
});
it('excludes drafts, holidays and cancellations, respects moved and exceptional Saturday occurrences', async () => {
  const now = at('2026-10-17', '12:00');
  const draft = await tt({
    action: 'draft.create',
    yearId: id(10),
    name: 'სატესტო პირადი ვერსია',
    startsOn: '2026-11-02',
    endsOn: '2026-11-09',
    copyId: id(1600),
  });
  await expect(
    a.attendanceLesson(admin, `${draft.id}:${id(1501)}:2026-11-02`, now),
  ).rejects.toMatchObject({ statusCode: 404 });
  await change(lesson('2026-10-12'), { cancelled: true });
  await expect(a.attendanceLesson(teacher, lesson('2026-10-12'), now)).rejects.toMatchObject({
    statusCode: 404,
  });
  expect(
    (await a.attendanceRange(admin, '2026-10-12', 1, undefined, now)).items.some(
      (i) => i.occurrence.id === lesson('2026-10-12'),
    ),
  ).toBe(false);
  await change(lesson('2026-10-16', 1505), { targetDate: '2026-10-17', exceptionalDay: true });
  const moved = await input(teacher, lesson('2026-10-16', 1505), now);
  await act(teacher, { action: 'submit', ...moved }, now);
  expect((await a.attendanceLesson(teacher, moved.occurrenceId, now)).occurrence.targetDate).toBe(
    '2026-10-17',
  );
  expect((await a.attendanceRange(admin, '2026-12-30', 1, undefined, now)).items).toEqual([]);
});
it('snapshots survive changed teaching rosters and require deliberate administrative reconciliation', async () => {
  const date = '2026-10-19',
    now = at(date),
    x = await input(teacher, lesson(date), now);
  await act(teacher, { action: 'submit', ...x }, now);
  const enrollment = (
    await db.select().from(s.enrollment).where(eq(s.enrollment.studentId, x.entries[0]!.studentId))
  )[0]!;
  await db.update(s.enrollment).set({ endsOn: date }).where(eq(s.enrollment.id, enrollment.id));
  const after = await a.attendanceLesson(admin, lesson(date), now);
  expect(after.roster).toHaveLength(3);
  expect(after.entries).toHaveLength(3);
  expect(after.discrepancy).toBe(true);
  await expect(
    act(
      teacher,
      {
        action: 'submit',
        ...x,
        revision: after.revision,
        expectedToken: after.expectedToken,
        reason: 'სიის ცვლილების შესწორება',
      },
      now,
    ),
  ).rejects.toMatchObject({ code: 'HISTORY_DISCREPANCY' });
  await act(
    admin,
    {
      action: 'submit',
      ...x,
      revision: after.revision,
      expectedToken: after.expectedToken,
      entries: x.entries.slice(1),
      reconcileRoster: true,
      reason: 'ისტორიული ჩარიცხვის გადამოწმება',
    },
    now,
  );
  const reconciled = await a.attendanceLesson(admin, lesson(date), now);
  expect(reconciled.entries).toHaveLength(2);
  expect(reconciled.history.at(-1)!.before!.snapshot.roster).toHaveLength(3);
  await db
    .update(s.enrollment)
    .set({ endsOn: enrollment.endsOn })
    .where(eq(s.enrollment.id, enrollment.id));
});
it('protects revision/receipt/decision history at the database boundary', async () => {
  await expect(db.execute(sql`update attendance_revision set reason='tampered'`)).rejects.toThrow();
  await expect(db.execute(sql`delete from attendance_revision`)).rejects.toThrow();
  await expect(db.execute(sql`delete from attendance_receipt`)).rejects.toThrow();
  await expect(
    db.execute(sql`update attendance_explanation set reason='tampered'`),
  ).rejects.toThrow();
  await expect(db.execute(sql`delete from attendance_request`)).rejects.toThrow();
});
it('supports forgotten locked roll calls through requests; stale approvals fail and denial changes no attendance', async () => {
  const now = at('2026-10-28'),
    occurrenceId = lesson('2026-10-26'),
    x = await input(teacher, occurrenceId, now);
  const request = await act(
    teacher,
    { action: 'request.create', proposal: x, reason: 'გამოტოვებული დასწრების შევსება' },
    now,
  );
  await act(
    admin,
    { action: 'submit', ...x, reason: 'მონაცემების დამოუკიდებლად გადამოწმება' },
    now,
  );
  await expect(
    act(
      admin,
      {
        action: 'request.decide',
        id: request.id,
        revision: 1,
        approve: true,
        reason: 'მოთხოვნის დადასტურება',
      },
      now,
    ),
  ).rejects.toMatchObject({ code: 'STALE_VERSION' });
  expect(
    (await a.attendanceQueues(teacher, now)).requests.find((r) => r.id === request.id)!.state,
  ).toBe('pending');
  await act(
    admin,
    {
      action: 'request.decide',
      id: request.id,
      revision: 1,
      approve: false,
      reason: 'მონაცემები უკვე შევსებულია',
    },
    now,
  );
  expect((await a.attendanceLesson(admin, occurrenceId, now)).revision).toBe(1);
  const second = await input(teacher, lesson('2026-10-27', 1502), at('2026-10-29'));
  const r = await act(
    teacher,
    { action: 'request.create', proposal: second, reason: 'გამოტოვებული გაკვეთილის აღდგენა' },
    at('2026-10-29'),
  );
  await act(
    admin,
    {
      action: 'request.decide',
      id: r.id,
      revision: 1,
      approve: true,
      reason: 'ჟურნალით დადასტურებულია',
    },
    at('2026-10-29'),
  );
  expect((await a.attendanceLesson(teacher, second.occurrenceId, at('2026-10-29'))).revision).toBe(
    1,
  );
});
it('revalidates roster and effective lesson after a stale preview', async () => {
  const now = at('2026-11-03', '12:00'),
    occurrenceId = lesson('2026-11-03', 1502),
    x = await input(teacher, occurrenceId, now);
  await change(occurrenceId, { roomId: id(1302) });
  await expect(act(teacher, { action: 'submit', ...x }, now)).rejects.toMatchObject({
    code: 'STALE_OCCURRENCE',
  });
  expect((await a.attendanceLesson(teacher, occurrenceId, now)).entries).toEqual([]);
});
it('concurrent guardian approval and roll call converge without fabricated attendance or lost revisions', async () => {
  const now = at('2026-11-04'),
    occurrenceId = lesson('2026-11-04', 1503),
    x = await input(teacher, occurrenceId, now);
  const e = await act(
    guardian,
    {
      action: 'explanation.create',
      studentId: id(200),
      startsOn: '2026-11-04',
      endsOn: '2026-11-05',
      reason: 'ოჯახის განმარტება მიღებულია',
    },
    now,
  );
  await Promise.all([
    act(
      teacher,
      {
        action: 'submit',
        ...x,
        entries: x.entries.map((r) => (r.studentId === id(200) ? { ...r, status: 'absent' } : r)),
      },
      now,
    ),
    act(
      admin,
      {
        action: 'explanation.decide',
        id: e.id,
        revision: 1,
        approve: true,
        reason: 'დადასტურებულია სკოლის მიერ',
      },
      now,
    ),
  ]);
  expect((await a.attendanceLesson(student, occurrenceId, now)).entries[0]!.status).toBe(
    'authorized',
  );
  const jobs = await db
    .select()
    .from(s.outboxJob)
    .where(eq(s.outboxJob.deduplicationKey, `attendance:absence:${id(200)}:2026-11-04`));
  expect(jobs.length).toBeLessThanOrEqual(1);
});
it('revoked academic guardian access removes explanation/history access while finance rights remain independent', async () => {
  const link = (
    await db
      .select()
      .from(s.guardianLink)
      .where(eq(s.guardianLink.studentId, id(200)))
  )[0]!;
  await db
    .update(s.guardianLink)
    .set({ academicAccess: false })
    .where(eq(s.guardianLink.id, link.id));
  const now = at('2026-11-05');
  await expect(a.attendanceRange(guardian, '2026-10-05', 5, id(200), now)).rejects.toMatchObject({
    statusCode: 404,
  });
  await expect(
    act(
      guardian,
      {
        action: 'explanation.create',
        studentId: id(200),
        startsOn: '2026-11-05',
        endsOn: '2026-11-06',
        reason: 'გაუმჟღავნებელი განმარტება',
      },
      now,
    ),
  ).rejects.toMatchObject({ statusCode: 404 });
  expect(
    (await a.attendanceQueues(guardian, now)).explanations.some((e) => e.studentId === id(200)),
  ).toBe(false);
  await db
    .update(s.guardianLink)
    .set({ academicAccess: link.academicAccess })
    .where(eq(s.guardianLink.id, link.id));
});
it('non-teaching substitute has actual-lesson attendance rights without directory access', async () => {
  const personId = randomUUID(),
    userId = `sub-${randomUUID()}`;
  await db.insert(s.user).values({
    id: userId,
    name: 'სატესტო შემცვლელი',
    email: `${userId}@demo.local`,
    emailVerified: true,
  });
  await db.insert(s.person).values({ id: personId, userId, fullName: 'სატესტო შემცვლელი' });
  await db.insert(s.staff).values({ personId, title: 'შემცვლელი', startsOn: '2026-09-01' });
  const occurrenceId = lesson('2026-11-09');
  await change(occurrenceId, { teacherId: personId });
  const { resolveViewer, studentScope } = await import('../server/modules/access.js');
  const sub = await resolveViewer({ id: userId, name: 'სატესტო შემცვლელი' });
  expect(sub.capabilities).toContain('attendance:write');
  expect(sub.capabilities).not.toContain('students:assigned');
  expect(await db.select().from(s.student).where(studentScope(sub))).toEqual([]);
  const now = at('2026-11-09'),
    x = await input(sub, occurrenceId, now);
  await act(sub, { action: 'submit', ...x }, now);
  await expect(a.attendanceLesson(sub, lesson('2026-11-10', 1502), now)).rejects.toMatchObject({
    statusCode: 404,
  });
  await expect(act(teacher, { action: 'submit', ...x }, now)).rejects.toMatchObject({
    statusCode: 404,
  });
});
it('protects actual HTTP transport, family fields and account lifecycle without test auth bypasses', async () => {
  expect((await app.inject({ url: '/api/attendance/range?from=2026-10-05' })).statusCode).toBe(401);
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    headers: { origin: 'http://localhost:5173' },
    payload: { email: 'student@demo.aia.local', password: 'AiaDemo-2026!' },
  });
  expect(login.statusCode).toBe(200);
  const cookie = login.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  const range = await app.inject({
    url: '/api/attendance/range?from=2026-10-05&days=5',
    headers: { cookie },
  });
  expect(range.statusCode).toBe(200);
  expect(JSON.stringify(range.json())).not.toContain('პირადი ოჯახის');
  const x = await input(teacher, lesson('2026-11-10', 1502), at('2026-11-10'));
  const payload = attendanceCommand.parse({ action: 'submit', commandId: randomUUID(), ...x });
  expect(
    (
      await app.inject({
        method: 'POST',
        url: '/api/attendance/actions',
        headers: { cookie, origin: 'https://untrusted.example' },
        payload,
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (
      await app.inject({
        method: 'POST',
        url: '/api/attendance/actions',
        headers: { cookie, origin: 'http://localhost:5173' },
        payload,
      })
    ).statusCode,
  ).toBe(403);
  await db
    .update(s.person)
    .set({ archivedAt: new Date() })
    .where(eq(s.person.id, id(100)));
  expect(
    (await app.inject({ url: '/api/attendance/range?from=2026-10-05', headers: { cookie } }))
      .statusCode,
  ).toBe(403);
  await db
    .update(s.person)
    .set({ archivedAt: null })
    .where(eq(s.person.id, id(100)));
});
it('preserves administrative authorization during teacher corrections without leaking private reasons', async () => {
  const occurrenceId = lesson('2026-11-16'),
    now = at('2026-11-16', '09:30');
  const x = await input(admin, occurrenceId, now);
  const authorizedEntries = x.entries.map((e, i) => (i === 0 ? { ...e, status: 'authorized' } : e));
  await act(
    admin,
    {
      action: 'submit',
      ...x,
      entries: authorizedEntries,
      reason: 'პირადი ადმინისტრაციული ჩანაწერი',
    },
    now,
  );
  const read = await a.attendanceLesson(teacher, occurrenceId, now);
  expect(read.roster[0]!.authorized).toBe(true);
  expect(read.history[0]!.reason).toBeNull();
  const correction = await input(teacher, occurrenceId, now);
  correction.entries = read.entries as typeof correction.entries;
  await act(
    teacher,
    { action: 'submit', ...correction, reason: 'არსებული მონაცემების გადამოწმება' },
    now,
  );
  expect((await a.attendanceLesson(admin, occurrenceId, now)).entries[0]!.status).toBe(
    'authorized',
  );
  expect(
    (await a.attendanceLesson(founder, occurrenceId, now)).history.every(
      (h) => h.reason === null || h.action === 'teacher.corrected',
    ),
  ).toBe(true);
});
it('keeps a pending correction request understandable after the source lesson is cancelled', async () => {
  const occurrenceId = lesson('2026-11-17', 1502),
    now = at('2026-11-19');
  const x = await input(teacher, occurrenceId, now);
  const request = await act(
    teacher,
    { action: 'request.create', proposal: x, reason: 'გაკვეთილის ძველი ჩანაწერის შევსება' },
    now,
  );
  await change(occurrenceId, { cancelled: true });
  const queued = (await a.attendanceQueues(admin, now)).requests.find((r) => r.id === request.id)!;
  expect(queued.occurrence.targetDate).toBe('2026-11-17');
  expect(queued.roster).toHaveLength(3);
  expect(queued.originalEntries).toEqual([]);
  expect(queued.snapshot?.academic?.instructionalMinutes).toBeGreaterThan(0);
  expect(queued.snapshot?.academic?.subjectId).toBeTruthy();
  await expect(
    act(
      admin,
      {
        action: 'request.decide',
        id: request.id,
        revision: 1,
        approve: true,
        reason: 'გადამოწმებულია ადმინისტრაციის მიერ',
      },
      now,
    ),
  ).rejects.toBeDefined();
  await act(
    admin,
    {
      action: 'request.decide',
      id: request.id,
      revision: 1,
      approve: false,
      reason: 'გაკვეთილი გაუქმდა და დასწრება აღარ მოითხოვება',
    },
    now,
  );
});
it('seeds fictional attendance idempotently without filling current or future roll calls', async () => {
  const { seedAttendance } = await import('../server/db/attendance-seed.js');
  await seedAttendance();
  const before = await db.select().from(s.attendanceSession);
  await seedAttendance();
  expect(await db.select().from(s.attendanceSession)).toHaveLength(before.length);
  expect(before.some((r) => r.snapshot.occurrence.targetDate === '2026-09-21')).toBe(true);
  const future = await a.attendanceRange(
    student,
    '2026-12-07',
    1,
    undefined,
    at('2026-12-07', '08:00'),
  );
  expect(future.totals.expected).toBe(0);
});
it('scopes minimal in-app event notices to current guardian rights and hides private content', async () => {
  const now = at('2026-10-05', '12:00');
  const notices = await a.attendanceNotifications(guardian, now);
  expect(notices.length).toBeGreaterThan(0);
  expect(notices.every((n) => [id(200), id(201)].includes(n.studentId))).toBe(true);
  expect(JSON.stringify(notices)).not.toContain('reason');
  expect(await a.attendanceNotifications(student, now)).toEqual([]);
  expect((await a.attendanceQueues(teacher, now)).requests.every((r) => r.decision === null)).toBe(
    true,
  );
  const links = await db
    .select()
    .from(s.guardianLink)
    .where(eq(s.guardianLink.guardianPersonId, guardian.personId!));
  await db
    .update(s.guardianLink)
    .set({ academicAccess: false })
    .where(eq(s.guardianLink.guardianPersonId, guardian.personId!));
  expect(await a.attendanceNotifications(guardian, now)).toEqual([]);
  for (const link of links)
    await db
      .update(s.guardianLink)
      .set({ academicAccess: link.academicAccess })
      .where(eq(s.guardianLink.id, link.id));
});
