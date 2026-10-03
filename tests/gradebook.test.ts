import { beforeAll, afterAll, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { capabilitiesFor, type Role, type Viewer } from '../shared/contracts.js';
import { currentAssessmentPolicy, gradebookCommand } from '../shared/gradebook.js';
const privateFiles = await mkdtemp(join(tmpdir(), 'gradebook-files-'));
process.env.PRIVATE_STORAGE_DIR = privateFiles;
process.env.NODE_ENV = 'test';
process.env.DEMO_MODE = 'true';
process.env.BETTER_AUTH_SECRET = 'test-only-secret-that-is-more-than-32-characters';
process.env.DATABASE_URL = process.env.TEST_GRADEBOOK_DATABASE_URL ?? 'pglite://';
const { database, db } = await import('../server/db/client.js');
const { seedDemo } = await import('../server/db/seed-data.js');
const s = await import('../server/db/schema.js');
const { fixtureId: id } = await import('../server/db/fixtures.js');
const g = await import('../server/modules/gradebook/assessments.js');
const viewer = (role: Role, personId = id(1), userId = 'demo-director'): Viewer => ({
  id: userId,
  personId,
  name: 'ტესტი',
  roles: [role],
  capabilities: capabilitiesFor([role]),
});
const admin = viewer('director'),
  teacher = viewer('teacher', id(2), 'demo-teacher'),
  student = viewer('student', id(100), 'demo-student'),
  guardian = viewer('guardian', id(3), 'demo-parent'),
  founder = viewer('founders_office');
const now = new Date('2026-10-06T08:00:00Z');
const act = (v: Viewer, c: object, at = now) =>
  g.changeGradebook(
    v,
    'gradebook-test',
    gradebookCommand.parse({ commandId: randomUUID(), ...c }),
    at,
  );
async function policy(
  offeringId = id(610),
  semesterId = id(11),
  mode = 'policy_default',
  revision = 0,
) {
  return act(admin, {
    action: 'policy.revise',
    offeringId,
    semesterId,
    revision,
    policy: currentAssessmentPolicy,
    offeringMode: mode,
    requiredSummatives: 2,
    requirementBasis: 'demo',
    reason: 'სატესტო შეფასების წესი',
  });
}
async function create(extra: object = {}) {
  return act(teacher, {
    action: 'assessment.create',
    scope: { kind: 'offering', offeringId: id(610) },
    semesterId: id(11),
    date: '2026-10-06',
    title: 'ტექსტის გააზრება',
    category: 'summative',
    criteriaId: null,
    ...extra,
  });
}
async function published(extra: object = {}) {
  const created = await create(extra);
  const detail = await g.assessmentDetail(teacher, created.id, now);
  const entries = detail.entries.map((e) => ({
    studentId: e.studentId,
    value: { kind: 'numeric', score: 8 },
  }));
  const saved = await act(teacher, {
    action: 'assessment.save',
    id: created.id,
    revision: created.revision,
    rosterToken: detail.rosterToken,
    entries,
  });
  const pub = await act(teacher, {
    action: 'assessment.publish',
    ...saved,
    rosterToken: detail.rosterToken,
  });
  return { ...pub, entries };
}
beforeAll(async () => {
  await database.migrate();
  await seedDemo();
  await policy();
});
afterAll(async () => {
  await database.close();
  await rm(privateFiles, { recursive: true, force: true });
});
it('keeps drafts private, saves explicitly and publishes one exact-roster batch', async () => {
  const created = await create();
  const draft = await g.assessmentDetail(teacher, created.id, now);
  expect(draft.entries).toHaveLength(3);
  expect(draft.entries.every((e) => e.value.kind === 'state')).toBe(true);
  for (const v of [guardian, student, founder, admin])
    await expect(g.assessmentDetail(v, created.id, now)).rejects.toMatchObject({ statusCode: 404 });
  const count = (await db.select().from(s.outboxJob)).length;
  await expect(
    act(teacher, {
      action: 'assessment.save',
      ...created,
      rosterToken: draft.rosterToken,
      entries: draft.entries.slice(1),
    }),
  ).rejects.toMatchObject({ code: 'ROSTER_CONFLICT' });
  expect((await g.assessmentDetail(teacher, created.id, now)).revision).toBe(1);
  const saved = await act(teacher, {
    action: 'assessment.save',
    ...created,
    rosterToken: draft.rosterToken,
    entries: draft.entries.map((e) => ({ ...e, value: { kind: 'numeric', score: 9 } })),
  });
  expect((await db.select().from(s.outboxJob)).length).toBe(count);
  const command = gradebookCommand.parse({
    action: 'assessment.publish',
    commandId: randomUUID(),
    ...saved,
    rosterToken: draft.rosterToken,
  });
  const result = await g.changeGradebook(teacher, 'test', command, now);
  expect(await g.changeGradebook(teacher, 'test', command, now)).toEqual(result);
  const own = await g.assessmentDetail(student, created.id, now);
  expect(own.roster.map((r) => r.studentId)).toEqual([id(200)]);
  expect(own.entries).toHaveLength(1);
  expect((await g.assessmentDetail(guardian, created.id, now)).entries).toHaveLength(1);
  expect((await db.select().from(s.outboxJob)).length).toBe(count + 3);
  expect(
    await db.select().from(s.gradebookRevision).where(eq(s.gradebookRevision.objectId, created.id)),
  ).toHaveLength(1);
});
it('denies Founders, homeroom-only, substitute and unrelated grading; separates academic policy management', async () => {
  for (const v of [
    founder,
    viewer('homeroom_teacher', id(2), 'demo-teacher'),
    viewer('teacher', id(15001)),
  ]) {
    await expect(
      act(v, {
        action: 'assessment.create',
        scope: { kind: 'offering', offeringId: id(610) },
        semesterId: id(11),
        date: '2026-10-06',
        title: 'სატესტო შეფასება',
        category: 'classwork',
        criteriaId: null,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  }
  for (const v of [founder, viewer('administrator')])
    await expect(
      act(v, {
        action: 'policy.revise',
        offeringId: id(610),
        semesterId: id(11),
        revision: 1,
        policy: currentAssessmentPolicy,
        offeringMode: 'policy_default',
        requiredSummatives: 2,
        requirementBasis: 'demo',
        reason: 'სატესტო ცვლილება',
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
});
it('rejects missing policy, wrong grade band, zero/decimal and mismatched category', async () => {
  await expect(
    create({ scope: { kind: 'offering', offeringId: id(16100) } }),
  ).rejects.toMatchObject({ code: 'POLICY_REQUIRED' });
  await policy(id(16100));
  const created = await create({ scope: { kind: 'offering', offeringId: id(16100) } });
  const draft = await g.assessmentDetail(teacher, created.id, now);
  await expect(
    act(teacher, {
      action: 'assessment.save',
      ...created,
      rosterToken: draft.rosterToken,
      entries: draft.entries.map((e) => ({ ...e, value: { kind: 'numeric', score: 8 } })),
    }),
  ).rejects.toMatchObject({ code: 'RESULT' });
  for (const score of [0, 8.5])
    expect(() =>
      gradebookCommand.parse({
        action: 'assessment.save',
        commandId: randomUUID(),
        ...created,
        rosterToken: draft.rosterToken,
        entries: draft.entries.map((e) => ({ ...e, value: { kind: 'numeric', score } })),
      }),
    ).toThrow();
});
it('requires correction reason, protects append-only history and hides internal reasons from families', async () => {
  const p = await published();
  const corrected = await act(teacher, {
    action: 'assessment.correct',
    id: p.id,
    revision: p.revision,
    entries: p.entries.map((e) => ({ ...e, value: { kind: 'numeric', score: 7 } })),
    reason: 'შეყვანის შეცდომა გასწორდა',
  });
  expect(corrected.revision).toBe(p.revision + 1);
  expect(JSON.stringify(await g.assessmentDetail(guardian, p.id, now))).not.toContain(
    'შეყვანის შეცდომა',
  );
  const history = await db
    .select()
    .from(s.gradebookRevision)
    .where(eq(s.gradebookRevision.objectId, p.id));
  expect(history).toHaveLength(2);
  await expect(
    db.delete(s.gradebookRevision).where(eq(s.gradebookRevision.id, history[0]!.id)),
  ).rejects.toThrow();
  await expect(
    db
      .update(s.gradebookAssessment)
      .set({ revision: corrected.revision + 1, title: 'ფარული ცვლილება' })
      .where(eq(s.gradebookAssessment.id, p.id)),
  ).rejects.toThrow();
  await expect(
    act(founder, {
      action: 'assessment.correct',
      id: p.id,
      revision: corrected.revision,
      entries: p.entries,
      reason: 'დაუშვებელი ცვლილება',
    }),
  ).rejects.toMatchObject({ statusCode: 403 });
});
it('detects stale saves, concurrent publish, and policy changes before publication', async () => {
  const created = await create();
  const d = await g.assessmentDetail(teacher, created.id, now);
  const input = { action: 'assessment.publish', ...created, rosterToken: d.rosterToken };
  const results = await Promise.allSettled([act(teacher, input), act(teacher, input)]);
  expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
  const stale = await create();
  const before = await g.assessmentDetail(teacher, stale.id, now);
  await policy(id(610), id(11), 'policy_default', 1);
  await expect(
    act(teacher, { action: 'assessment.publish', ...stale, rosterToken: before.rosterToken }),
  ).rejects.toMatchObject({ code: 'ROSTER_CONFLICT' });
});
it('retains published policy/name/roster when live configuration changes', async () => {
  const p = await published();
  const before = await g.assessmentDetail(student, p.id, now);
  const subject = (
    await db
      .select()
      .from(s.subject)
      .where(eq(s.subject.id, id(600)))
  )[0]!;
  await db.update(s.subject).set({ name: 'ახალი დასახელება' }).where(eq(s.subject.id, subject.id));
  expect((await g.assessmentDetail(student, p.id, now)).labels).toEqual(before.labels);
  await db.update(s.subject).set({ name: subject.name }).where(eq(s.subject.id, subject.id));
  const policyRow = (await db.select().from(s.assessmentPolicyVersion))[0]!;
  await expect(
    db.delete(s.assessmentPolicyVersion).where(eq(s.assessmentPolicyVersion.id, policyRow.id)),
  ).rejects.toThrow();
});
it('enforces the ten-calendar-day recovery boundary without zero or double-counting', async () => {
  const created = await create({ date: '2026-09-21' });
  const d = await g.assessmentDetail(teacher, created.id, now);
  const pub = await act(teacher, {
    action: 'assessment.publish',
    ...created,
    rosterToken: d.rosterToken,
  });
  const entries = d.entries.map((e) => ({ ...e, value: { kind: 'numeric', score: 7 } }));
  await expect(
    act(teacher, { action: 'assessment.correct', ...pub, entries, reason: 'დაგვიანებული აღდგენა' }),
  ).rejects.toMatchObject({ code: 'RECOVERY_LOCK' });
  await act(admin, {
    action: 'assessment.correct',
    ...pub,
    entries,
    reason: 'ისტორიული ჩანაწერი დადასტურდა',
  });
  expect((await g.assessmentDetail(student, pub.id, now)).entries[0]!.value).toEqual({
    kind: 'numeric',
    score: 7,
  });
  expect(
    await db.select().from(s.gradebookAssessment).where(eq(s.gradebookAssessment.id, pub.id)),
  ).toHaveLength(1);
});
it('denies revoked guardian academic access independently of finance', async () => {
  const p = await published();
  await db.execute(
    sql`update guardian_link set academic_access=false where guardian_person_id=${id(3)} and student_id=${id(200)}`,
  );
  await expect(g.assessmentDetail(guardian, p.id, now)).rejects.toMatchObject({ statusCode: 404 });
  await db.execute(
    sql`update guardian_link set academic_access=true where guardian_person_id=${id(3)} and student_id=${id(200)}`,
  );
});
it('routes expired summative recovery from student to reasoned administrative approval and back to teacher', async () => {
  const created = await create({ date: '2026-09-21' });
  const draft = await g.assessmentDetail(teacher, created.id, now);
  const pub = await act(teacher, {
    action: 'assessment.publish',
    ...created,
    rosterToken: draft.rosterToken,
  });
  await expect(
    act(guardian, {
      action: 'recovery.request',
      assessmentId: pub.id,
      reason: 'აღდგენის დამატებითი ვადა',
    }),
  ).rejects.toMatchObject({ statusCode: 403 });
  const request = await act(student, {
    action: 'recovery.request',
    assessmentId: pub.id,
    reason: 'მჭირდება დამატებითი აღდგენის დრო',
  });
  const decision = {
    action: 'recovery.decide',
    ...request,
    status: 'approved',
    physicalFollowUp: false,
    extendedUntil: '2026-10-08',
    reason: 'მოსწავლესთან პირადი განხილვა შედგა',
  };
  await expect(act(admin, decision)).rejects.toMatchObject({ code: 'APPROVAL' });
  await expect(act(founder, { ...decision, physicalFollowUp: true })).rejects.toMatchObject({
    statusCode: 403,
  });
  await act(admin, { ...decision, physicalFollowUp: true });
  const entries = draft.entries.map((e) =>
    e.studentId === id(200) ? { ...e, value: { kind: 'numeric', score: 8 } } : e,
  );
  await act(teacher, {
    action: 'assessment.correct',
    ...pub,
    entries,
    reason: 'შემაჯამებელი აღდგა დამატებით ვადაში',
  });
  expect(
    (
      await db
        .select()
        .from(s.gradebookRecoveryRequest)
        .where(eq(s.gradebookRecoveryRequest.id, request.id))
    )[0]?.status,
  ).toBe('completed');
  expect(
    await db.select().from(s.gradebookRevision).where(eq(s.gradebookRevision.objectId, request.id)),
  ).toHaveLength(3);
});
it('publishes versioned narratives and guardian-only comments without leaking to students or Founders', async () => {
  const { canReadWriting } = await import('../server/modules/gradebook/writings.js');
  const saved = await act(teacher, {
    action: 'writing.save',
    revision: 0,
    kind: 'guardian_note',
    yearId: id(10),
    offeringId: id(610),
    studentId: id(200),
    body: 'კითხვის უნარი უმჯობესდება; მნიშვნელოვანია ყოველდღიური ვარჯიში.',
  });
  await act(teacher, { action: 'writing.publish', ...saved });
  const item = (
    await db.select().from(s.gradebookWriting).where(eq(s.gradebookWriting.id, saved.id))
  )[0]!;
  for (const [v, allowed] of [
    [guardian, true],
    [student, false],
    [founder, false],
    [admin, true],
  ] as const)
    expect(await db.transaction((tx) => canReadWriting(tx, v, item, now))).toBe(allowed);
  expect(() => act(teacher, { action: 'writing.save', ...item, actionIgnored: true })).toThrow();
  const edit = {
    action: 'writing.save',
    id: item.id,
    revision: item.revision,
    kind: item.kind,
    yearId: item.yearId,
    offeringId: item.offeringId,
    studentId: item.studentId,
    body: 'დაზუსტებული სასწავლო რეკომენდაცია.',
  };
  await expect(act(teacher, edit)).rejects.toMatchObject({ code: 'REASON' });
  await act(teacher, { ...edit, reason: 'რეკომენდაციის დაზუსტება' });
  const narrative = await act(teacher, {
    action: 'writing.save',
    revision: 0,
    kind: 'narrative',
    yearId: id(10),
    offeringId: id(610),
    studentId: id(200),
    body: 'პროგრესი: კითხულობს გამართულად. მიღწევა: ტექსტის ანალიზი. მხარდაჭერა: წერითი არგუმენტაცია.',
  });
  await act(teacher, { action: 'writing.publish', ...narrative });
  const published = (
    await db.select().from(s.gradebookWriting).where(eq(s.gradebookWriting.id, narrative.id))
  )[0]!;
  expect(await db.transaction((tx) => canReadWriting(tx, student, published, now))).toBe(true);
});
it('scopes journal, progress reports and history before projection with no peer/draft leakage', async () => {
  const { journal, assessmentHistory, progressReport } =
    await import('../server/modules/gradebook/reads.js');
  const p = await published();
  const view = await journal(student, id(10), id(11), id(610), undefined, now);
  expect(view.pupils.map((p) => p.id)).toEqual([id(200)]);
  expect(
    view.items.every(
      (i) => i.status !== 'draft' && i.entries.every((e) => e.studentId === id(200)),
    ),
  ).toBe(true);
  expect(
    (await progressReport(student, id(10), id(11), id(610), undefined, now)).rows.map(
      (r) => r.pupil.id,
    ),
  ).toEqual([id(200)]);
  await expect(journal(student, id(10), id(11), id(610), id(204), now)).rejects.toMatchObject({
    statusCode: 404,
  });
  const history = await assessmentHistory(student, p.id, now);
  expect(history.every((r) => !r.reason && r.after.every((e) => e.studentId === id(200)))).toBe(
    true,
  );
  const school = await journal(founder, id(10), id(11), id(610), undefined, now);
  expect(school.pupils).toHaveLength(3);
  expect(school.items.every((i) => i.status !== 'draft')).toBe(true);
});
it('keeps criteria PDFs private, version-pinned and independently scoped from filename/content claims', async () => {
  const f = await import('../server/modules/gradebook/files.js');
  const bytes = Buffer.from(
    '%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n',
  );
  const upload = await f.uploadCriteria(
    admin,
    'file-test',
    bytes,
    '../../შეფასება.pdf',
    'application/pdf',
  );
  expect(upload.name).not.toContain('/');
  await expect(
    f.uploadCriteria(founder, 'file-test', bytes, 'rubric.pdf', 'application/pdf'),
  ).rejects.toMatchObject({ statusCode: 403 });
  await expect(
    f.uploadCriteria(
      admin,
      'file-test',
      Buffer.from('<script>bad</script>'),
      'fake.pdf',
      'application/pdf',
    ),
  ).rejects.toMatchObject({ code: 'FILE_CONTENT' });
  expect(() =>
    f.validateCriteriaFile(Buffer.alloc(f.criteriaFileLimit + 1), 'big.pdf', 'application/pdf'),
  ).toThrow();
  await expect(f.downloadCriteria(student, 'file-test', upload.id, now)).rejects.toMatchObject({
    statusCode: 404,
  });
  const criteria = await act(admin, {
    action: 'criteria.revise',
    subjectId: id(600),
    yearId: id(10),
    revision: 0,
    text: 'ტექსტის გააზრება და არგუმენტირება',
    fileId: upload.id,
    reason: 'საგნობრივი კრიტერიუმი დამტკიცდა',
  });
  expect((await f.downloadCriteria(teacher, 'file-test', upload.id, now)).data.equals(bytes)).toBe(
    true,
  );
  await expect(f.downloadCriteria(student, 'file-test', upload.id, now)).rejects.toMatchObject({
    statusCode: 404,
  });
  const p = await published({ criteriaId: criteria.id });
  expect((await f.downloadCriteria(student, 'file-test', upload.id, now)).data.equals(bytes)).toBe(
    true,
  );
  await act(admin, {
    action: 'criteria.revise',
    subjectId: id(600),
    yearId: id(10),
    revision: criteria.revision,
    text: 'განახლებული კრიტერიუმი მომავალი შეფასებისთვის',
    fileId: null,
    reason: 'საგნობრივი კრიტერიუმის დაზუსტება',
  });
  expect((await g.assessmentDetail(student, p.id, now)).criteriaId).toBe(criteria.id);
  await db.execute(
    sql`update guardian_link set academic_access=false where guardian_person_id=${id(3)} and student_id=${id(200)}`,
  );
  await expect(f.downloadCriteria(guardian, 'file-test', upload.id, now)).rejects.toMatchObject({
    statusCode: 404,
  });
  await db.execute(
    sql`update guardian_link set academic_access=true where guardian_person_id=${id(3)} and student_id=${id(200)}`,
  );
});
it('allows formative homework in Grade V while rejecting numeric homework and pins publication identity', async () => {
  await policy(id(16200), id(12));
  const later = new Date('2027-02-01T08:00:00Z');
  const input = {
    action: 'assessment.create',
    scope: { kind: 'offering', offeringId: id(16200) },
    semesterId: id(12),
    date: '2027-02-01',
    title: 'კითხვის დავალება',
    category: 'homework',
    criteriaId: null,
  };
  await expect(act(teacher, input, later)).rejects.toMatchObject({ code: 'CATEGORY' });
  const created = await act(teacher, { ...input, formative: true }, later);
  const draft = await g.assessmentDetail(teacher, created.id, later);
  const saved = await act(
    teacher,
    {
      action: 'assessment.save',
      ...created,
      rosterToken: draft.rosterToken,
      entries: draft.entries.map((e) => ({
        ...e,
        value: { kind: 'formative', text: 'ტექსტს გააზრებულად კითხულობს.' },
      })),
    },
    later,
  );
  const pub = await act(
    teacher,
    { action: 'assessment.publish', ...saved, rosterToken: draft.rosterToken },
    later,
  );
  await expect(
    db
      .update(s.gradebookAssessment)
      .set({ date: '2027-02-02', revision: pub.revision + 1 })
      .where(eq(s.gradebookAssessment.id, pub.id)),
  ).rejects.toThrow();
});
it('requires deliberate draft reconciliation after policy changes and preserves published roster identity', async () => {
  const c = await create();
  const before = await g.assessmentDetail(teacher, c.id, now);
  const latest = (
    await db
      .select()
      .from(s.assessmentPolicyVersion)
      .where(eq(s.assessmentPolicyVersion.offeringId, id(610)))
  ).reduce((max, p) => Math.max(max, p.revision), 0);
  await policy(id(610), id(11), 'policy_default', latest);
  const changed = await g.assessmentDetail(teacher, c.id, now);
  expect(changed.reconciliation?.policyChanged).toBe(true);
  await expect(
    act(teacher, { action: 'assessment.publish', ...c, rosterToken: before.rosterToken }),
  ).rejects.toMatchObject({ code: 'ROSTER_CONFLICT' });
  const reconciled = await act(teacher, {
    action: 'assessment.reconcile',
    ...c,
    rosterToken: changed.reconciliation!.rosterToken,
  });
  const fresh = await g.assessmentDetail(teacher, c.id, now);
  expect(fresh.reconciliation).toBeNull();
  await act(teacher, {
    action: 'assessment.publish',
    ...reconciled,
    rosterToken: fresh.rosterToken,
  });
});
it('runs each bounded report family with scoped rows and denies family cohort analytics', async () => {
  const { academicReport, reportKind } = await import('../server/modules/gradebook/reports.js');
  for (const kind of reportKind.options) {
    const report = await academicReport(founder, kind, id(10), id(11), id(610), undefined, now);
    expect(report.kind).toBe(kind);
    expect(JSON.stringify(report)).not.toContain('კითხვის უნარი უმჯობესდება');
  }
  for (const kind of ['matrix', 'distribution', 'publication', 'narratives'] as const)
    await expect(
      academicReport(student, kind, id(10), id(11), id(610), undefined, now),
    ).rejects.toMatchObject({ statusCode: 403 });
  const family = await academicReport(
    student,
    'summatives',
    id(10),
    id(11),
    id(610),
    undefined,
    now,
  );
  expect('rows' in family && family.rows?.every((r) => r.pupil.id === id(200))).toBe(true);
});
it('keeps writing revision bodies scoped, private reasons internal and editing server-derived', async () => {
  const { writings, writingHistory } = await import('../server/modules/gradebook/reads.js');
  const w = await act(teacher, {
    action: 'writing.save',
    revision: 0,
    kind: 'guardian_note',
    yearId: id(10),
    offeringId: id(610),
    studentId: id(200),
    body: 'ახალი პირადი აკადემიური რეკომენდაცია.',
  });
  expect(
    (await writings(teacher, id(10), undefined, now)).find((x) => x.id === w.id)?.canEdit,
  ).toBe(true);
  await expect(writingHistory(guardian, w.id, now)).rejects.toMatchObject({ statusCode: 404 });
  const pub = await act(teacher, { action: 'writing.publish', ...w });
  await act(teacher, {
    action: 'writing.save',
    ...pub,
    kind: 'guardian_note',
    yearId: id(10),
    offeringId: id(610),
    studentId: id(200),
    body: 'დაზუსტებული რეკომენდაცია მშობლისთვის.',
    reason: 'შიდა აკადემიური განხილვის შედეგი',
  });
  const history = await writingHistory(guardian, w.id, now);
  expect(history).toHaveLength(2);
  expect(history[1]?.before).toBe('ახალი პირადი აკადემიური რეკომენდაცია.');
  expect(history.every((x) => x.reason === null)).toBe(true);
  expect(
    (await writings(guardian, id(10), undefined, now)).find((x) => x.id === w.id)?.canEdit,
  ).toBe(false);
  for (const role of [student, founder])
    await expect(writingHistory(role, w.id, now)).rejects.toMatchObject({ statusCode: 404 });
  expect((await writingHistory(admin, w.id, now))[1]?.reason).toBe(
    'შიდა აკადემიური განხილვის შედეგი',
  );
});
it('gives leadership aggregate draft counts without private draft contents', async () => {
  const { academicOverview } = await import('../server/modules/gradebook/overview.js');
  const draft = await create({ title: 'დამალული სატესტო პირადი მონახაზი' });
  for (const role of [admin, founder]) {
    const overview = await academicOverview(role, id(10), id(11), now);
    expect(overview.draft).toBeGreaterThan(0);
    expect(overview.courses.find((c) => c.id === id(610))?.draft).toBeGreaterThan(0);
    expect(JSON.stringify(overview)).not.toContain(draft.id);
    expect(JSON.stringify(overview)).not.toContain('დამალული სატესტო პირადი მონახაზი');
  }
  for (const role of [teacher, guardian, student])
    await expect(academicOverview(role, id(10), id(11), now)).rejects.toMatchObject({
      statusCode: 403,
    });
});
it('projects publication notices only to current family scope and hides guardian-only note events from pupils', async () => {
  const { gradebookNotifications } = await import('../server/modules/gradebook/notifications.js');
  const parent = await gradebookNotifications(guardian, now);
  const pupil = await gradebookNotifications(student, now);
  expect(parent.some((n) => n.kind === 'writing')).toBe(true);
  expect(
    pupil
      .filter((n) => n.kind === 'writing')
      .every((n) => n.title === 'წლიური განმავითარებელი შეფასება'),
  ).toBe(true);
  expect(pupil.some((n) => n.kind === 'assessment')).toBe(true);
  expect(await gradebookNotifications(founder, now)).toEqual([]);
  const link = (await db.select().from(s.guardianLink)).find(
    (l) => l.guardianPersonId === id(3) && l.studentId === id(200),
  )!;
  await db
    .update(s.guardianLink)
    .set({ endsOn: '2026-10-06' })
    .where(eq(s.guardianLink.id, link.id));
  const revoked = await gradebookNotifications(guardian, now);
  expect(revoked.every((n) => !n.path.includes('assessment='))).toBe(true);
  await db
    .update(s.guardianLink)
    .set({ endsOn: link.endsOn })
    .where(eq(s.guardianLink.id, link.id));
});
it('uses exact split and combined-group rosters and keeps homeroom read/comment separate from subject writing', async () => {
  for (const [group, size] of [
    [1411, 1],
    [1412, 2],
  ] as const) {
    const a = await create({
      scope: { kind: 'group', versionId: id(1600), groupId: id(group) },
      date: '2026-09-30',
    });
    expect((await g.assessmentDetail(teacher, a.id, now)).roster).toHaveLength(size);
  }
  await policy(id(611));
  await policy(id(1310));
  const math = viewer('teacher', id(4));
  const a = await act(math, {
    action: 'assessment.create',
    scope: { kind: 'group', versionId: id(1600), groupId: id(1413) },
    semesterId: id(11),
    date: '2026-09-30',
    title: 'ერთიანი მათემატიკური მსჯელობა',
    category: 'classwork',
    criteriaId: null,
  });
  const detail = await g.assessmentDetail(math, a.id, now);
  expect(detail.roster).toHaveLength(6);
  const saved = await act(math, {
    action: 'assessment.save',
    ...a,
    rosterToken: detail.rosterToken,
    entries: detail.entries.map((e) => ({ ...e, value: { kind: 'numeric', score: 9 } })),
  });
  const pub = await act(math, {
    action: 'assessment.publish',
    ...saved,
    rosterToken: detail.rosterToken,
  });
  const home = viewer('homeroom_teacher', id(2), 'demo-teacher');
  expect((await g.assessmentDetail(home, a.id, now)).roster).toHaveLength(3);
  await expect(
    act(home, {
      action: 'assessment.correct',
      ...pub,
      entries: detail.entries,
      reason: 'დაუშვებელი საგნობრივი შესწორება',
    }),
  ).rejects.toMatchObject({ statusCode: 403 });
  await act(home, {
    action: 'writing.save',
    revision: 0,
    kind: 'homeroom_note',
    yearId: id(10),
    offeringId: null,
    studentId: id(200),
    body: 'დამრიგებლის ზოგადი რეკომენდაცია მშობელს.',
  });
  await expect(
    act(home, {
      action: 'writing.save',
      revision: 0,
      kind: 'homeroom_note',
      yearId: id(10),
      offeringId: null,
      studentId: id(13000),
      body: 'სხვა კლასის დაუშვებელი კომენტარი.',
    }),
  ).rejects.toMatchObject({ statusCode: 403 });
});
