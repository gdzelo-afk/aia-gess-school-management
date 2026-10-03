import { afterAll, beforeAll, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
process.env.NODE_ENV = 'test';
process.env.DEMO_MODE = 'true';
process.env.BETTER_AUTH_SECRET = 'test-only-secret-that-is-more-than-32-characters';
process.env.APP_ORIGIN = 'http://localhost:5173';
process.env.DATABASE_URL = process.env.TEST_GRADEBOOK_DEMO_DATABASE_URL ?? 'pglite://';
const { db, database } = await import('../server/db/client.js');
const { seedDemo } = await import('../server/db/seed-data.js');
const { seedSchoolExpansion, expandedDemo } = await import('../server/db/school-demo-expansion.js');
const s = await import('../server/db/schema.js');
const { fixtureId: id } = await import('../server/db/fixtures.js');
const { loadContext, resolveRange, conflictsFor, groupStudents } =
  await import('../server/modules/timetable-engine.js');
beforeAll(async () => {
  await database.migrate();
  await seedDemo();
});
afterAll(async () => database.close());
it('adds a coherent dense/formative/transition school without replacing published history', async () => {
  const prior = await db
    .select()
    .from(s.timetableVersion)
    .where(eq(s.timetableVersion.id, id(1600)));
  const exceptions = await db.select().from(s.timetableException);
  const people = await db.select().from(s.person);
  await seedSchoolExpansion();
  expect(
    (
      await db
        .select()
        .from(s.timetableVersion)
        .where(eq(s.timetableVersion.id, id(1600)))
    )[0],
  ).toEqual(prior[0]);
  expect(await db.select().from(s.timetableException)).toEqual(exceptions);
  for (const p of people)
    expect((await db.select().from(s.person).where(eq(s.person.id, p.id)))[0]).toEqual(p);
  expect(await db.select().from(s.student)).toHaveLength(44);
  expect(await db.select().from(s.subject)).toHaveLength(17);
  const ctx = await db.transaction((tx) => loadContext(tx, id(10)));
  const versions = await db.select().from(s.timetableVersion);
  const original = resolveRange(ctx, versions, exceptions, '2026-09-21', '2026-09-26');
  expect(original.every((o) => o.versionId === id(1600))).toBe(true);
  const future = resolveRange(ctx, versions, exceptions, '2026-10-05', '2026-10-10');
  expect(future.every((o) => o.versionId === expandedDemo.timetableId)).toBe(true);
  expect(conflictsFor(ctx, future)).toEqual([]);
  const v = versions.find((v) => v.id === expandedDemo.timetableId)!;
  expect(
    groupStudents(
      ctx,
      v.document.groups.find((g) => g.id === id(19000))!,
      '2026-10-05',
    ),
  ).toHaveLength(20);
  expect(
    groupStudents(
      ctx,
      v.document.groups.find((g) => g.id === id(19100))!,
      '2026-10-05',
    ),
  ).toHaveLength(6);
  expect(
    groupStudents(
      ctx,
      v.document.groups.find((g) => g.id === id(19200))!,
      '2026-10-05',
    ),
  ).toHaveLength(6);
  expect(
    groupStudents(
      ctx,
      v.document.groups.find((g) => g.id === id(19016))!,
      '2026-10-05',
    ),
  ).toEqual([id(200), id(13000), id(13001)].sort());
  expect(new Set(future.map((o) => o.subject)).size).toBeGreaterThanOrEqual(14);
});
it('is repeatable and never overwrites later administrator edits', async () => {
  await db
    .update(s.subject)
    .set({ name: 'ადმინისტრატორის რედაქცია' })
    .where(eq(s.subject.id, id(10000)));
  const versions = await db.select().from(s.timetableVersion),
    students = await db.select().from(s.student);
  await seedSchoolExpansion();
  expect(await db.select().from(s.timetableVersion)).toEqual(versions);
  expect(await db.select().from(s.student)).toEqual(students);
  expect(
    (
      await db
        .select()
        .from(s.subject)
        .where(eq(s.subject.id, id(10000)))
    )[0]?.name,
  ).toBe('ადმინისტრატორის რედაქცია');
});
it('seeds real Gradebook lifecycle examples repeatably without rewriting existing records', async () => {
  const { seedGradebook } = await import('../server/db/gradebook-seed.js');
  await seedGradebook({ complete: false });
  const assessments = await db.select().from(s.gradebookAssessment);
  expect(assessments.length).toBeGreaterThanOrEqual(14);
  expect(assessments.some((a) => a.roster.length === 20 && a.status === 'published')).toBe(true);
  expect(assessments.some((a) => a.mode === 'pass_fail')).toBe(true);
  expect(assessments.some((a) => a.mode === 'formative_only')).toBe(true);
  expect(assessments.some((a) => a.status === 'draft')).toBe(true);
  expect(
    (await db.select().from(s.gradebookRecoveryRequest)).some((r) => r.status === 'completed'),
  ).toBe(true);
  const history = await db.select().from(s.gradebookRevision);
  // Simulate interruption after commands succeeded but before the final marker.
  await seedGradebook();
  expect(await db.select().from(s.gradebookAssessment)).toEqual(assessments);
  expect(await db.select().from(s.gradebookRevision)).toEqual(history);
});

it('retains the departed pupil in the historical Gradebook and locks normal teacher correction', async () => {
  const { assessmentDetail, changeGradebook } =
    await import('../server/modules/gradebook/assessments.js');
  const { capabilitiesFor } = await import('../shared/contracts.js');
  const { gradebookCommand } = await import('../shared/gradebook.js');
  const teacher = {
    id: 'demo-teacher',
    personId: id(2),
    name: 'მასწავლებელი',
    roles: ['teacher'] as const,
    capabilities: capabilitiesFor(['teacher']),
  };
  const v = { ...teacher, roles: [...teacher.roles] };
  const a = (await db.select().from(s.gradebookAssessment)).find(
    (a) => a.title === 'გამართული კითხვა',
  )!;
  const detail = await assessmentDetail(v, a.id, new Date('2026-10-03T08:00:00Z'));
  expect(detail.roster).toHaveLength(6);
  expect(detail.roster.find((p) => p.studentId === id(13025))?.canEdit).toBe(false);
  await expect(
    changeGradebook(
      v,
      'test',
      gradebookCommand.parse({
        action: 'assessment.correct',
        commandId: crypto.randomUUID(),
        id: a.id,
        revision: a.revision,
        reason: 'ისტორიული შეფასების ცვლილება',
        entries: a.entries.map((e) =>
          e.studentId === id(13025)
            ? { ...e, value: { kind: 'formative', text: 'დაუშვებელი ცვლილება' } }
            : e,
        ),
      }),
      new Date('2026-10-03T08:00:00Z'),
    ),
  ).rejects.toMatchObject({ code: 'TRANSFER_LOCK' });
});
