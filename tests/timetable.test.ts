import { beforeAll, afterAll, it, expect } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { capabilitiesFor, type Viewer } from '../shared/contracts.js';
import {
  timetableCommand,
  type TimetableDocument,
  type LessonChange,
} from '../shared/timetable.js';
process.env.NODE_ENV = 'test';
process.env.BETTER_AUTH_SECRET = 'test-only-secret-that-is-more-than-32-characters';
process.env.APP_ORIGIN = 'http://localhost:5173';
process.env.DEMO_MODE = 'true';
process.env.DATABASE_URL = process.env.TEST_TIMETABLE_DATABASE_URL ?? 'pglite://';
const { database, db } = await import('../server/db/client.js');
const { seedDemo } = await import('../server/db/seed-data.js');
const s = await import('../server/db/schema.js');
const { fixtureId: id } = await import('../server/db/fixtures.js');
const services = await import('../server/modules/timetable.js');
const engine = await import('../server/modules/timetable-engine.js');
const { buildApp } = await import('../server/app.js');
const { schoolToday } = await import('../server/modules/operations.js');
const app = await buildApp(false);
const viewer = (
  role: keyof typeof import('../shared/contracts.js').roleLabels,
  personId = id(1),
  userId = 'demo-director',
): Viewer => ({
  id: userId,
  personId,
  name: 'ტესტი',
  roles: [role],
  capabilities: capabilitiesFor([role]),
});
const admin = viewer('director'),
  teacher = viewer('teacher', id(2), 'demo-teacher'),
  student = viewer('student', id(100), 'demo-student'),
  guardian = viewer('guardian', id(3), 'demo-parent');
const act = (v: Viewer, c: unknown) =>
  services.changeTimetable(v, 'timetable-test', timetableCommand.parse(c));
const week = (v = admin, from = '2026-10-05', extra = {}) =>
  services.timetableWeek(v, { from, days: 7, ...extra });
let base: TimetableDocument;
const draft = async (document = base, start = '2026-10-06', end = '2026-10-13') => {
  const d = await act(admin, {
    action: 'draft.create',
    yearId: id(10),
    name: 'სატესტო განრიგი',
    startsOn: start,
    endsOn: end,
  });
  await act(admin, { action: 'draft.save', id: d.id, revision: 1, document });
  return services.timetableDraft(admin, d.id);
};
const change = (o: Awaited<ReturnType<typeof week>>['items'][number]): LessonChange => ({
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
});
beforeAll(async () => {
  await database.migrate();
  await seedDemo();
  base = (await services.timetableDraft(admin, id(1600))).document;
});
afterAll(async () => {
  await app.close();
  await database.close();
});
it('migrates and seeds without duplicating or replacing existing records', async () => {
  const before = await db.select().from(s.timetableVersion);
  await seedDemo();
  await database.migrate();
  expect(await db.select().from(s.timetableVersion)).toEqual(before);
  expect((await db.select().from(s.student)).length).toBe(44);
});
it('resolves Monday–Friday, valid disjoint split groups and combined sections', async () => {
  const w = await week();
  expect(w.items.filter((o) => base.lessons.some((l) => l.id === o.lessonId))).toHaveLength(13);
  expect(w.items).toHaveLength(99);
  expect(w.conflicts).toEqual([]);
  expect(
    w.items.filter(
      (o) =>
        o.targetDate === '2026-10-06' && o.number === 3 && [id(1411), id(1412)].includes(o.groupId),
    ),
  ).toHaveLength(2);
  expect(w.items.find((o) => o.groupId === id(1413))!.sectionIds).toHaveLength(2);
});
it('scopes students to own split/elective lessons and guardians to linked children', async () => {
  const own = await week(student);
  expect(own.items.some((o) => o.groupId === id(1411))).toBe(true);
  expect(own.items.some((o) => o.groupId === id(1412))).toBe(false);
  expect(own.items.some((o) => o.groupId === id(1414))).toBe(true);
  await expect(week(student, '2026-10-05', { studentId: id(201) })).rejects.toMatchObject({
    statusCode: 404,
  });
  await expect(week(guardian, '2026-10-05', { studentId: id(203) })).rejects.toMatchObject({
    statusCode: 404,
  });
  const parent = await week(guardian, '2026-10-05', { studentId: id(201) });
  expect(parent.items.every((o) => [id(1413), id(1414)].includes(o.groupId))).toBe(true);
  expect(JSON.stringify(parent)).not.toContain('studentIds');
});
it('revoked academic guardian links remove access without altering finance flags', async () => {
  await db
    .update(s.guardianLink)
    .set({ academicAccess: false })
    .where(eq(s.guardianLink.id, id(400)));
  await expect(week(guardian, '2026-10-05', { studentId: id(200) })).rejects.toMatchObject({
    statusCode: 404,
  });
  await db
    .update(s.guardianLink)
    .set({ academicAccess: true })
    .where(eq(s.guardianLink.id, id(400)));
});
it('teacher sees own timetable and actual substitute sees only relevant lessons', async () => {
  expect((await week(teacher)).items.every((o) => o.teacherId === id(2))).toBe(true);
  const sub = viewer('teacher', id(4), 'demo-director');
  const w = await week(sub, '2026-09-28');
  expect(w.items.some((o) => o.id === `${id(1600)}:${id(1503)}:2026-09-30`)).toBe(true);
  expect(
    (await week(teacher, '2026-09-28')).items.some(
      (o) => o.id === `${id(1600)}:${id(1503)}:2026-09-30`,
    ),
  ).toBe(false);
});
it('draft data is private and founders office receives only explicit timetable powers', async () => {
  const d = await draft();
  await expect(services.timetableDraft(student, d.id)).rejects.toMatchObject({ statusCode: 403 });
  const founder = viewer('founders_office');
  expect(founder.capabilities).not.toContain('access:manage');
  expect(founder.capabilities).not.toContain('students:school');
  expect((await services.timetableDraft(founder, d.id)).id).toBe(d.id);
  for (const r of ['administrator', 'principal', 'vice_principal'] as const)
    expect(capabilitiesFor([r])).toContain('timetable:publish');
});
it('whole-section/subgroup collisions use actual students, plus teacher and room conflicts', async () => {
  const document = structuredClone(base);
  document.lessons.push({ ...base.lessons[0]!, id: randomUUID(), weekday: 2, periodId: id(1402) });
  const d = await draft(document);
  expect(d.conflicts.some((c) => c.kind === 'student')).toBe(true);
  expect(d.conflicts.some((c) => c.kind === 'teacher')).toBe(true);
  expect(d.conflicts.some((c) => c.kind === 'room')).toBe(true);
  await expect(
    act(admin, { action: 'draft.publish', id: d.id, revision: d.revision, overrides: [] }),
  ).rejects.toMatchObject({ code: 'TIMETABLE_CONFLICT' });
});
it('cross-section elective members collide with another required lesson', async () => {
  const document = structuredClone(base);
  document.lessons.find((l) => l.groupId === id(1414))!.periodId = id(1400);
  const d = await draft(document);
  expect(d.conflicts.some((c) => c.kind === 'student')).toBe(true);
});
it('no co-teaching, invalid room or nonteaching period can be saved', async () => {
  const d = await draft();
  expect(
    timetableCommand.safeParse({
      action: 'draft.save',
      id: d.id,
      revision: d.revision,
      document: { ...base, lessons: [{ ...base.lessons[0], teacherIds: [id(2), id(4)] }] },
    }).success,
  ).toBe(false);
  const doc = structuredClone(base);
  doc.periods[0]!.teaching = false;
  await expect(
    act(admin, { action: 'draft.save', id: d.id, revision: d.revision, document: doc }),
  ).rejects.toMatchObject({ statusCode: 409 });
});
it('concurrent draft edits reject stale revisions', async () => {
  const d = await draft();
  const results = await Promise.allSettled(
    [1, 2].map(() =>
      act(admin, { action: 'draft.save', id: d.id, revision: d.revision, document: base }),
    ),
  );
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason.code).toBe(
    'STALE_VERSION',
  );
});
it('unavailability causes explicit conflicts; invalid staff is never overridable', async () => {
  const a = await act(admin, {
    action: 'availability.create',
    availability: {
      teacherId: id(2),
      startsOn: '2026-10-06',
      endsOn: '2026-10-08',
      weekdays: [2],
      periodNumbers: [1],
    },
    reason: 'სატესტო მიუწვდომლობა',
  });
  const d = await draft();
  expect(d.conflicts.some((c) => c.kind === 'availability')).toBe(true);
  await db.delete(s.timetableAvailability).where(eq(s.timetableAvailability.id, a.id));
  const doc = structuredClone(base);
  doc.lessons[0]!.teacherId = id(1);
  const invalid = await draft(doc);
  expect(invalid.conflicts.some((c) => !c.overridable)).toBe(true);
});
it('authorized exact conflict overrides require reasons and are audited at publication', async () => {
  const doc = structuredClone(base);
  doc.lessons.push({ ...base.lessons[0]!, id: randomUUID() });
  const d = await draft(doc);
  const overrides = d.conflicts.map((c) => ({
    key: c.key,
    reason: 'სატესტო ერთობლივი გამონაკლისი',
  }));
  await expect(
    act(teacher, { action: 'draft.publish', id: d.id, revision: d.revision, overrides }),
  ).rejects.toMatchObject({ statusCode: 403 });
  expect(
    timetableCommand.safeParse({
      action: 'draft.publish',
      id: d.id,
      revision: d.revision,
      overrides: [{ key: overrides[0]!.key, reason: '' }],
    }).success,
  ).toBe(false);
  await act(admin, { action: 'draft.publish', id: d.id, revision: d.revision, overrides });
  const w = await week();
  expect(w.items.some((o) => o.versionId === d.id)).toBe(true);
  expect((await week(student)).conflicts).toEqual([]);
  const events = await db.select().from(s.auditEvent).where(eq(s.auditEvent.objectId, d.id));
  expect(
    events.some(
      (e) =>
        e.action === 'timetable.draft.publish' &&
        JSON.stringify(e.metadata).includes(overrides[0]!.key),
    ),
  ).toBe(true);
  await expect(
    db.update(s.timetableVersion).set({ name: 'შეცვლა' }).where(eq(s.timetableVersion.id, d.id)),
  ).rejects.toThrow();
});
it('future publication changes effective schedule without rewriting historical labels', async () => {
  const old = await week(admin, '2026-09-21');
  const d = await draft(base, '2026-10-12', '2026-10-19');
  await act(admin, { action: 'draft.publish', id: d.id, revision: d.revision, overrides: [] });
  expect((await week(admin, '2026-10-12')).items.every((o) => o.versionId === d.id)).toBe(true);
  expect((await week(admin, '2026-09-21')).items).toEqual(old.items);
});
it('holidays suppress normal lessons and exceptional dates require explicit action', async () => {
  expect((await services.timetableWeek(admin, { from: '2026-10-14', days: 1 })).items).toHaveLength(
    0,
  );
  const o = (await week(admin, '2026-10-12')).items.find((o) => o.targetDate === '2026-10-13')!;
  const c = { ...change(o), targetDate: '2026-10-14' };
  await expect(
    act(admin, {
      action: 'exception.apply',
      changes: [c],
      reason: 'სადღესასწაულო გადატანა',
      overrides: [],
    }),
  ).rejects.toMatchObject({ statusCode: 409 });
  await act(admin, {
    action: 'exception.apply',
    changes: [{ ...c, exceptionalDay: true }],
    reason: 'სადღესასწაულო გადატანა',
    overrides: [],
  });
  expect(
    (await services.timetableWeek(student, { from: '2026-10-14', days: 1 })).items.some(
      (o) => o.exceptionalDay,
    ),
  ).toBe(true);
});
it('one-off room/time change, cancellation and revisions preserve master schedule', async () => {
  const o = (await week(admin, '2026-10-12')).items.find(
    (o) => o.targetDate === '2026-10-15' && o.number === 1,
  )!;
  const c = { ...change(o), roomId: id(1302), start: '08:00', end: '08:45' };
  await act(admin, {
    action: 'exception.apply',
    changes: [c],
    reason: 'სატესტო ოთახის ცვლილება',
    overrides: [],
  });
  await expect(
    act(admin, {
      action: 'exception.apply',
      changes: [c],
      reason: 'მოძველებული ცვლილება',
      overrides: [],
    }),
  ).rejects.toMatchObject({ code: 'STALE_VERSION' });
  const updated = (await week(admin, '2026-10-12')).items.find((x) => x.id === o.id)!;
  expect(updated.room).toBe('201');
  await act(admin, {
    action: 'exception.apply',
    changes: [{ ...change(updated), cancelled: true }],
    reason: 'სატესტო გაკვეთილის გაუქმება',
    overrides: [],
  });
  expect((await week(student, '2026-10-12')).items.find((x) => x.id === o.id)!.cancelled).toBe(
    true,
  );
  const master = await services.timetableDraft(admin, o.versionId);
  expect(master.document.lessons.find((l) => l.id === o.lessonId)!.roomId).toBe(id(1300));
});
it('substitutions allow active unassigned staff but reject disabled/departed staff and collisions', async () => {
  const o = (await week(admin, '2026-10-12')).items.find(
    (o) => o.targetDate === '2026-10-16' && o.number === 1,
  )!;
  await db.update(s.user).set({ disabled: true }).where(eq(s.user.id, 'demo-director'));
  await expect(
    act(admin, {
      action: 'exception.apply',
      changes: [{ ...change(o), teacherId: id(1) }],
      reason: 'გამორთული შემცვლელი',
      overrides: [],
    }),
  ).rejects.toMatchObject({ statusCode: 409 });
  await db.update(s.user).set({ disabled: false }).where(eq(s.user.id, 'demo-director'));
  await act(admin, {
    action: 'exception.apply',
    changes: [{ ...change(o), teacherId: id(1) }],
    reason: 'მოქმედი დროებითი შემცვლელი',
    overrides: [],
  });
  expect((await week(admin, '2026-10-12')).items.find((x) => x.id === o.id)!.teacherId).toBe(id(1));
});
it('teacher requests are scoped and denial requires reason', async () => {
  const own = (await week(teacher, '2026-10-19')).items[0]!,
    other = (await week(admin, '2026-10-19')).items.find((o) => o.teacherId === id(4))!;
  await expect(
    act(teacher, {
      action: 'request.create',
      changes: [change(other)],
      absence: null,
      reason: 'უცხო გაკვეთილის მოთხოვნა',
    }),
  ).rejects.toMatchObject({ statusCode: 403 });
  const r = await act(teacher, {
    action: 'request.create',
    changes: [{ ...change(own), roomId: id(1302) }],
    absence: null,
    reason: 'ოთახის შეცვლის მოთხოვნა',
  });
  await act(admin, {
    action: 'request.decide',
    id: r.id,
    revision: 1,
    approve: false,
    reason: 'მოცემულ დროს ცვლილება არ დასტურდება',
    changes: [],
    overrides: [],
  });
  expect((await services.timetableRequests(teacher)).items.find((x) => x.id === r.id)!.state).toBe(
    'denied',
  );
  expect((await services.timetableRequests(viewer('teacher', id(4)))).items).toHaveLength(0);
});
it('approval applies exceptions atomically; already-decided and stale requests are rejected', async () => {
  const o = (await week(teacher, '2026-10-19')).items[1]!,
    c = { ...change(o), roomId: id(1302) };
  const r = await act(teacher, {
    action: 'request.create',
    changes: [c],
    absence: null,
    reason: 'ერთჯერადი ცვლილების მოთხოვნა',
  });
  await act(admin, {
    action: 'request.decide',
    id: r.id,
    revision: 1,
    approve: true,
    reason: 'ცვლილება შეთანხმებულია ადმინისტრაციასთან',
    changes: [c],
    overrides: [],
  });
  await expect(
    act(admin, {
      action: 'request.decide',
      id: r.id,
      revision: 1,
      approve: true,
      reason: 'განმეორებული დამტკიცება',
      changes: [c],
      overrides: [],
    }),
  ).rejects.toMatchObject({ statusCode: 409 });
  const r2 = await act(teacher, {
    action: 'request.create',
    changes: [{ ...change((await week(teacher, '2026-10-19')).items[2]!), cancelled: true }],
    absence: null,
    reason: 'სატესტო გაუქმების მოთხოვნა',
  });
  const stored = (await services.timetableRequests(teacher)).items.find((x) => x.id === r2.id)!;
  await act(admin, {
    action: 'exception.apply',
    changes: stored.changes,
    reason: 'პირდაპირი ცვლილების გადაწყვეტილება',
    overrides: [],
  });
  await expect(
    act(admin, {
      action: 'request.decide',
      id: r2.id,
      revision: 1,
      approve: true,
      reason: 'ძველი მოთხოვნის დამტკიცება',
      changes: stored.changes,
      overrides: [],
    }),
  ).rejects.toMatchObject({ code: 'STALE_VERSION' });
});
it('two-day absence resolves all affected lessons in one audited decision', async () => {
  const absence = {
    teacherId: id(2),
    startsOn: '2026-11-02',
    endsOn: '2026-11-04',
    weekdays: null,
    periodNumbers: [],
  };
  const affected = await services.timetableAffected(teacher, absence);
  expect(affected.items.length).toBeGreaterThan(1);
  const r = await act(teacher, {
    action: 'request.create',
    absence,
    changes: [],
    reason: 'ორი დღით სკოლაში ვერ მოვალ',
  });
  await expect(
    act(admin, {
      action: 'request.decide',
      id: r.id,
      revision: 1,
      approve: true,
      reason: 'არასრული განხილვის მცდელობა',
      changes: [],
      overrides: [],
    }),
  ).rejects.toMatchObject({ statusCode: 409 });
  const changes = affected.items.map((o) => ({ ...change(o), teacherId: id(1) }));
  await act(admin, {
    action: 'request.decide',
    id: r.id,
    revision: 1,
    approve: true,
    reason: 'შემცვლელი შეთანხმებულია ორი დღისთვის',
    changes,
    overrides: [],
  });
  expect(
    (await services.timetableWeek(teacher, { from: absence.startsOn, days: 2 })).items,
  ).toHaveLength(0);
  expect(
    (await services.timetableAvailabilityList(teacher)).items.some(
      (a) => a.startsOn === absence.startsOn,
    ),
  ).toBe(true);
});
it('changed underlying versions invalidate pending absence requests', async () => {
  const absence = {
    teacherId: id(2),
    startsOn: '2026-11-09',
    endsOn: '2026-11-11',
    weekdays: null,
    periodNumbers: [],
  };
  const r = await act(teacher, {
    action: 'request.create',
    absence,
    changes: [],
    reason: 'მომავალი დროებითი მიუწვდომლობა',
  });
  const d = await draft(base, '2026-11-09', '2026-11-16');
  await act(admin, { action: 'draft.publish', id: d.id, revision: d.revision, overrides: [] });
  await expect(
    act(admin, {
      action: 'request.decide',
      id: r.id,
      revision: 1,
      approve: true,
      reason: 'მოძველებული ვერსიის განხილვა',
      changes: [],
      overrides: [],
    }),
  ).rejects.toMatchObject({ code: 'STALE_REQUEST' });
});
it('transport denies anonymous and unrelated roles, keeps trusted origin protection', async () => {
  expect((await app.inject({ url: '/api/timetable/setup' })).statusCode).toBe(401);
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    headers: { origin: 'http://localhost:5173' },
    payload: { email: 'student@demo.aia.local', password: 'AiaDemo-2026!' },
  });
  expect(login.statusCode).toBe(200);
  const cookie = login.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  expect(
    (await app.inject({ url: `/api/timetable/drafts/${id(1600)}`, headers: { cookie } }))
      .statusCode,
  ).toBe(403);
  expect(
    (
      await app.inject({
        method: 'POST',
        url: '/api/timetable/actions',
        headers: { cookie, origin: 'https://evil.example' },
        payload: { action: 'room.create', number: '999' },
      })
    ).statusCode,
  ).toBe(403);
  await expect(services.timetableSetup(viewer('it_admin'))).rejects.toMatchObject({
    statusCode: 403,
  });
});
it('date-only engine uses school weekday semantics independent of UTC instant', () => {
  expect(engine.weekday('2026-09-29')).toBe(2);
  expect(engine.addDays('2026-12-31', 1)).toBe('2027-01-01');
  expect(schoolToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});
it('published exception and audit rows are append-only', async () => {
  await expect(
    db.delete(s.timetableException).where(eq(s.timetableException.id, id(1620))),
  ).rejects.toThrow();
  expect(
    (await db.execute(sql`select count(*)::int n from timetable_version where status='published'`))
      .rows.length,
  ).toBe(1);
});
it('creates an explicit extra weekend lesson and preserves the original weekday', async () => {
  const o = await services.timetableTemplate(admin, id(22000), id(1501), '2026-11-21');
  await act(admin, {
    action: 'exception.apply',
    changes: [{ ...change(o), exceptionalDay: true }],
    reason: 'დამატებითი სასწავლო შაბათი',
    overrides: [],
  });
  const saturday = await services.timetableWeek(student, { from: '2026-11-21', days: 1 });
  expect(saturday.items).toHaveLength(1);
  expect(saturday.items[0]!.exceptionalDay).toBe(true);
  expect(
    (await services.timetableWeek(student, { from: '2026-11-30', days: 1 })).items.some(
      (o) => o.lessonId === id(1501),
    ),
  ).toBe(true);
});
it('substitute collision and stale override decisions are revalidated server-side', async () => {
  const o = (await week(admin, '2026-11-23')).items.find((o) => o.number === 1)!;
  const c = { ...change(o), teacherId: id(4), start: '09:55', end: '10:40' };
  const p = await services.timetableChangePreview(admin, [c]);
  expect(p.conflicts.some((c) => c.kind === 'teacher')).toBe(true);
  await expect(
    act(admin, {
      action: 'exception.apply',
      changes: [c],
      reason: 'შემცვლელი სხვა გაკვეთილზეა',
      overrides: [],
    }),
  ).rejects.toMatchObject({ code: 'TIMETABLE_CONFLICT' });
  await expect(
    act(admin, {
      action: 'exception.apply',
      changes: [{ ...c, start: '08:00', end: '08:45' }],
      reason: 'შეცვლილი კონფლიქტის შემოწმება',
      overrides: p.conflicts.map((c) => ({ key: c.key, reason: 'წინასწარი გადაწყვეტილება' })),
    }),
  ).rejects.toMatchObject({ code: 'STALE_OVERRIDE' });
});
it('historical rosters follow effective enrollment rather than current section labels', async () => {
  const before = await services.timetableWeek(student, { from: '2026-09-21', days: 1 });
  await db
    .update(s.enrollment)
    .set({ endsOn: '2026-12-01' })
    .where(eq(s.enrollment.id, id(300)));
  await db.insert(s.enrollment).values({
    studentId: id(200),
    sectionId: id(33),
    startsOn: '2026-12-01',
    endsOn: '2027-06-16',
  });
  expect(
    (await services.timetableWeek(student, { from: '2026-12-01', days: 1 })).items,
  ).toHaveLength(0);
  expect((await services.timetableWeek(student, { from: '2026-09-21', days: 1 })).items).toEqual(
    before.items,
  );
});
it('move preview is read-only, scoped and revision-bound; the mutation still validates', async () => {
  const d = await draft(base, '2026-12-07', '2026-12-14');
  const lesson = d.document.lessons[0]!;
  const result = await services.timetableMovePreview(
    admin,
    d.id,
    d.revision,
    lesson.id,
    2,
    id(1402),
  );
  expect(result.conflicts.some((c) => c.kind === 'student')).toBe(true);
  expect((await services.timetableDraft(admin, d.id)).document).toEqual(d.document);
  await expect(
    services.timetableMovePreview(teacher, d.id, d.revision, lesson.id, 2, id(1402)),
  ).rejects.toMatchObject({ statusCode: 403 });
  await act(admin, { action: 'draft.save', id: d.id, revision: d.revision, document: d.document });
  await expect(
    services.timetableMovePreview(admin, d.id, d.revision, lesson.id, 2, id(1402)),
  ).rejects.toMatchObject({ statusCode: 409 });
  await expect(
    act(admin, { action: 'draft.save', id: d.id, revision: d.revision, document: d.document }),
  ).rejects.toMatchObject({ statusCode: 409 });
  const current = await services.timetableDraft(admin, d.id);
  const invalid = structuredClone(current.document);
  invalid.lessons[0]!.periodId = randomUUID();
  await expect(
    act(admin, { action: 'draft.save', id: d.id, revision: current.revision, document: invalid }),
  ).rejects.toBeDefined();
});
it('active non-teaching substitute receives only actual lesson visibility and loses it when replaced', async () => {
  const { resolveViewer, studentScope } = await import('../server/modules/access.js');
  const o = (await week(admin, '2026-12-14')).items.find((o) => o.teacherId === id(2))!;
  await act(admin, {
    action: 'exception.apply',
    changes: [{ ...change(o), teacherId: id(1) }],
    reason: 'აქტიური თანამშრომლის დროებითი ჩანაცვლება',
    overrides: [],
  });
  const original = await db
    .select()
    .from(s.roleGrant)
    .where(eq(s.roleGrant.userId, 'demo-director'));
  await db.delete(s.roleGrant).where(eq(s.roleGrant.userId, 'demo-director'));
  await db.insert(s.roleGrant).values({ userId: 'demo-director', role: 'it_admin' });
  try {
    const sub = await resolveViewer({ id: 'demo-director', name: 'ტესტი' });
    expect(sub.capabilities).toContain('timetable:own');
    expect(sub.capabilities).not.toContain('timetable:manage');
    expect((await week(sub, '2026-12-14')).items.map((x) => x.id)).toEqual([o.id]);
    expect(await db.select().from(s.student).where(studentScope(sub))).toHaveLength(0);
    const latest = (await week(admin, '2026-12-14')).items.find((x) => x.id === o.id)!;
    await act(admin, {
      action: 'exception.apply',
      changes: [{ ...change(latest), teacherId: id(2) }],
      reason: 'ძირითადი მასწავლებელი დაბრუნდა',
      overrides: [],
    });
    expect((await week(sub, '2026-12-14')).items).toHaveLength(0);
  } finally {
    await db.delete(s.roleGrant).where(eq(s.roleGrant.userId, 'demo-director'));
    await db.insert(s.roleGrant).values(original);
  }
});
it('published bell context aligns empty periods without exposing private document rosters', async () => {
  const result = await week(student, '2026-09-28');
  expect(result.days).toHaveLength(7);
  expect(result.days[0]!.periods).toHaveLength(7);
  expect(result.days[0]!.periods[0]).toMatchObject({ number: 1, start: '09:00', end: '09:45' });
  expect(Object.keys(result.days[0]!).sort()).toEqual(['date', 'endsOn', 'periods', 'startsOn']);
  expect(result.versions).toEqual([]);
  expect(JSON.stringify(result.days)).not.toContain('studentIds');
});
