import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { config } from '../config.js';
import { db } from './client.js';
import * as s from './schema.js';
import { fixtureId as id } from './fixtures.js';
import { capabilitiesFor, type Viewer } from '../../shared/contracts.js';
import {
  currentAssessmentPolicy,
  gradebookCommand,
  type ResultValue,
} from '../../shared/gradebook.js';
import { changeGradebook } from '../modules/gradebook/assessments.js';

const marker = id(23999);
const commandId = (key: string) => {
  const hash = createHash('sha256').update(`fictional-gradebook-v1:${key}`).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
};
// Demo commands have stable identities. An interrupted seed can resume without replacing
// teacher edits or duplicating publications; a finished marker leaves all records alone.
export async function seedGradebook(options: { complete?: boolean } = {}) {
  if (!config.DEMO_MODE || config.NODE_ENV === 'production') return;
  if ((await db.select().from(s.auditEvent).where(eq(s.auditEvent.id, marker))).length) return;
  const admin: Viewer = {
    id: 'demo-director',
    personId: id(1),
    name: 'თამარ ჯაფარიძე',
    roles: ['director'],
    capabilities: capabilitiesFor(['director']),
  };
  const teacher: Viewer = {
    id: 'demo-teacher',
    personId: id(2),
    name: 'მასწავლებელი',
    roles: ['teacher'],
    capabilities: capabilitiesFor(['teacher']),
  };
  const act = async (v: Viewer, key: string, data: object, date = '2026-10-03') => {
    const command = gradebookCommand.parse({ commandId: commandId(key), ...data });
    return changeGradebook(
      v,
      'fictional-gradebook-seed',
      command,
      new Date(`${date}T12:00:00+04:00`),
    );
  };
  const offers = await db.select().from(s.courseOffering);
  const subjects = await db.select().from(s.subject);
  const terms = await db
    .select()
    .from(s.semester)
    .where(eq(s.semester.yearId, id(10)));
  const sections = await db
    .select()
    .from(s.section)
    .where(eq(s.section.yearId, id(10)));
  for (const offer of offers.filter((o) => sections.some((sec) => sec.id === o.sectionId)))
    for (const term of terms) {
      const existing = (
        await db
          .select()
          .from(s.assessmentPolicyVersion)
          .where(eq(s.assessmentPolicyVersion.offeringId, offer.id))
      ).find((p) => p.semesterId === term.id);
      if (existing) continue;
      const code = subjects.find((s) => s.id === offer.subjectId)?.code;
      await act(admin, `policy:${offer.id}:${term.id}`, {
        action: 'policy.revise',
        offeringId: offer.id,
        semesterId: term.id,
        revision: 0,
        policy: currentAssessmentPolicy,
        offeringMode: ['PE', 'ROAD', 'CHESS'].includes(code ?? '') ? 'pass_fail' : 'policy_default',
        requiredSummatives: 2,
        requirementBasis: 'demo',
        reason: 'გამოგონილი დემოს წესი; ადმინისტრაციამ უნდა დააკონფიგურიროს',
      });
    }
  const criteria = await act(admin, 'criteria-georgian', {
    action: 'criteria.revise',
    subjectId: id(600),
    yearId: id(10),
    revision: 0,
    text: 'სადემონსტრაციო კრიტერიუმები: ტექსტის გაგება; არგუმენტის დასაბუთება; ენობრივი სიზუსტე. შეფასება ასახავს მთლიან ნამუშევარს 1–10 სკალაზე. ეს არ არის დამტკიცებული სასკოლო პოლიტიკა.',
    fileId: null,
    reason: 'გამოგონილი დემოს საგნობრივი კრიტერიუმი',
  });
  async function assessment(
    key: string,
    offer: number,
    date: string,
    title: string,
    category: 'classwork' | 'homework' | 'summative',
    values: (i: number) => ResultValue,
    publish = true,
    semester = 11,
    formative = false,
    actor = teacher,
  ) {
    const clock = date > '2026-10-03' ? date : '2026-10-03';
    const created = await act(
      actor,
      `${key}:create`,
      {
        action: 'assessment.create',
        scope: { kind: 'offering', offeringId: id(offer) },
        semesterId: id(semester),
        date,
        title,
        category,
        formative,
        description: 'მხოლოდ გამოგონილი სასწავლო დემო.',
        activity: 'სასწავლო მაგალითი',
        criteriaId:
          category === 'summative' && [610, 16000, 16100, 16200].includes(offer)
            ? criteria.id
            : null,
      },
      clock,
    );
    const draft = (
      await db.select().from(s.gradebookAssessment).where(eq(s.gradebookAssessment.id, created.id))
    )[0]!;
    const entries = draft.roster.map((p, i) => ({ studentId: p.studentId, value: values(i) }));
    const saved = await act(
      actor,
      `${key}:save`,
      { action: 'assessment.save', ...created, rosterToken: draft.rosterToken, entries },
      clock,
    );
    const result = publish
      ? await act(
          actor,
          `${key}:publish`,
          { action: 'assessment.publish', ...saved, rosterToken: draft.rosterToken },
          clock,
        )
      : saved;
    return { ...result, entries };
  }
  const numeric =
    (offset: number) =>
    (i: number): ResultValue => ({ kind: 'numeric', score: 5 + ((i + offset) % 6) });
  for (const [i, date] of [
    '2026-09-17',
    '2026-09-21',
    '2026-09-24',
    '2026-09-28',
    '2026-10-01',
  ].entries())
    await assessment(
      `dense-${i}`,
      16000,
      date,
      [
        'მთავარი აზრი',
        'არგუმენტირებული წერილი',
        'ლექსიკური სავარჯიშო',
        'პერსონაჟის ანალიზი',
        'ტექსტის ინტერპრეტაცია',
      ][i]!,
      i === 2 ? 'homework' : i === 3 ? 'summative' : 'classwork',
      numeric(i),
    );
  const missing = await assessment(
    'dense-recovery',
    16000,
    '2026-10-02',
    'შემაჯამებელი · წერითი მსჯელობა',
    'summative',
    (i) => (i < 3 ? { kind: 'state', state: 'recovery_required' } : numeric(3)(i)),
  );
  await act(teacher, 'dense-recovered', {
    action: 'assessment.correct',
    id: missing.id,
    revision: missing.revision,
    entries: missing.entries.map((e, i) =>
      i === 1 ? { ...e, value: { kind: 'numeric', score: 8 } } : e,
    ),
    reason: 'მოსწავლემ შემაჯამებელი აღადგინა ჩვეულებრივ ვადაში',
  });
  await assessment(
    'dense-draft',
    16000,
    '2026-10-03',
    'მონახაზი · არგუმენტაცია',
    'classwork',
    numeric(2),
    false,
  );
  await assessment(
    'primary-formative',
    16100,
    '2026-09-29',
    'გამართული კითხვა',
    'classwork',
    () => ({
      kind: 'formative',
      text: 'კითხულობს გამართულად; შემდეგი ნაბიჯია აზრის საკუთარი სიტყვებით გადმოცემა.',
    }),
  );
  await assessment(
    'fifth-first',
    16200,
    '2026-09-30',
    'პერსონაჟის აღწერა',
    'homework',
    () => ({
      kind: 'formative',
      text: 'ამოიცნო მთავარი თვისებები; აღწერას დაურთოს ტექსტის მაგალითი.',
    }),
    true,
    11,
    true,
  );
  await assessment(
    'fifth-second',
    16200,
    '2027-02-01',
    'II სემესტრის რიცხვითი მაგალითი · მონახაზი',
    'classwork',
    numeric(1),
    false,
    12,
  );
  await assessment(
    'fifth-homework',
    16200,
    '2027-02-02',
    'II სემესტრი · განმავითარებელი საშინაო',
    'homework',
    () => ({ kind: 'formative', text: 'დავალება გააზრებულია. დასაბუთებას სჭირდება დაზუსტება.' }),
    false,
    12,
    true,
  );
  const sports: Viewer = { ...teacher, id: admin.id, personId: id(15013), name: 'ლაშა გეგეჭკორი' };
  await assessment(
    'sports-passfail',
    16013,
    '2026-09-30',
    'მოძრაობითი უნარები',
    'classwork',
    (i) => ({ kind: 'pass_fail', passed: i !== 3 }),
    true,
    11,
    false,
    sports,
  );
  const old = await assessment(
    'family-expired',
    610,
    '2026-09-17',
    'შემაჯამებელი · ტექსტის გაგება',
    'summative',
    (i) => (i === 0 ? { kind: 'state', state: 'recovery_required' } : numeric(1)(i)),
  );
  const student: Viewer = {
    id: 'demo-student',
    personId: id(100),
    name: 'ანდრია მაისურაძე',
    roles: ['student'],
    capabilities: capabilitiesFor(['student']),
  };
  const request = await act(student, 'family-request', {
    action: 'recovery.request',
    assessmentId: old.id,
    reason: 'დამატებით ვადაში მსურს შემაჯამებლის აღდგენა.',
  });
  await act(admin, 'family-approval', {
    action: 'recovery.decide',
    ...request,
    status: 'approved',
    physicalFollowUp: true,
    extendedUntil: '2026-10-09',
    reason: 'სადემონსტრაციო პირადი განხილვა; აღდგენის დრო შეთანხმებულია.',
  });
  await act(teacher, 'family-recovered', {
    action: 'assessment.correct',
    id: old.id,
    revision: old.revision,
    entries: old.entries.map((e) =>
      e.studentId === id(200) ? { ...e, value: { kind: 'numeric', score: 8 } } : e,
    ),
    reason: 'შემაჯამებელი აღდგა დამტკიცებულ დამატებით ვადაში.',
  });
  await assessment(
    'family-open-recovery',
    610,
    '2026-09-18',
    'შემაჯამებელი · წერითი დავალება',
    'summative',
    (i) => (i === 0 ? { kind: 'state', state: 'recovery_required' } : numeric(2)(i)),
  );
  await assessment('family-score', 610, '2026-09-29', 'ზეპირი მსჯელობა', 'classwork', numeric(4));
  for (const [key, kind, studentId, offeringId, body, publish] of [
    [
      'primary-narrative',
      'narrative',
      id(13020),
      id(16100),
      'პროგრესი: კითხულობს გამართულად. მიღწევა: აზრის გადმოცემა. მხარდაჭერა: სიტყვათა მარაგის გაფართოება. სადემონსტრაციო წლიური ტექსტი, არა ოფიციალური ანგარიში.',
      true,
    ],
    [
      'primary-narrative-draft',
      'narrative',
      id(13021),
      id(16100),
      'პროგრესი: დამოუკიდებლად კითხულობს. მიღწევა: ტექსტის გააზრება. მხარდაჭერა: წერითი გამართულობა.',
      false,
    ],
    [
      'family-note',
      'guardian_note',
      id(200),
      id(610),
      'ანდრია უფრო თავდაჯერებულად მსჯელობს. გთხოვთ, ხელი შეუწყოთ ყოველდღიური კითხვის ჩვევას.',
      true,
    ],
    [
      'homeroom-note',
      'homeroom_note',
      id(200),
      null,
      'სასწავლო რუტინა უმჯობესდება; ყურადღება მიაქციეთ დავალებების გეგმას.',
      true,
    ],
  ] as const) {
    const actor =
      kind === 'homeroom_note'
        ? { ...teacher, capabilities: capabilitiesFor(['teacher', 'homeroom_teacher']) }
        : teacher;
    const writing = await act(actor, `${key}:save`, {
      action: 'writing.save',
      revision: 0,
      kind,
      yearId: id(10),
      offeringId,
      studentId,
      body,
    });
    if (publish) await act(actor, `${key}:publish`, { action: 'writing.publish', ...writing });
  }
  // A fictional pupil left after the published IV-class assessment. Keep the original
  // roster snapshot; do not backfill a changed roster into published results.
  await db.transaction(async (tx) => {
    const transferMarker = id(23998);
    if ((await tx.select().from(s.auditEvent).where(eq(s.auditEvent.id, transferMarker))).length)
      return;
    const year = (
      await tx
        .select()
        .from(s.academicYear)
        .where(eq(s.academicYear.id, id(10)))
    )[0]!;
    const enrollment = (
      await tx
        .select()
        .from(s.enrollment)
        .where(and(eq(s.enrollment.studentId, id(13025)), eq(s.enrollment.sectionId, id(11001))))
    )[0];
    if (enrollment?.endsOn === year.endsOn) {
      await tx
        .update(s.enrollment)
        .set({ endsOn: '2026-10-02' })
        .where(eq(s.enrollment.id, enrollment.id));
      await tx.insert(s.auditEvent).values({
        id: transferMarker,
        actorUserId: admin.id,
        requestId: 'fictional-gradebook-seed',
        action: 'seed.gradebook.historical_departure',
        objectType: 'student',
        objectId: id(13025),
        metadata: { fictional: true, effectiveOn: '2026-10-02', priorEndsOn: year.endsOn },
      });
    }
  });
  if (options.complete === false) return;
  await db
    .insert(s.auditEvent)
    .values({
      id: marker,
      actorUserId: admin.id,
      requestId: 'fictional-gradebook-seed',
      action: 'seed.gradebook.v1',
      objectType: 'demo',
      objectId: marker,
      metadata: { fictional: true, officialPolicy: false },
    })
    .onConflictDoNothing();
}
