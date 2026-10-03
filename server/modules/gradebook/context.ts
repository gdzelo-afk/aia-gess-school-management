import { and, eq, desc, inArray, or, sql } from 'drizzle-orm';
import type { Viewer } from '../../../shared/contracts.js';
import type { TeachingGroup } from '../../../shared/timetable.js';
import { schoolDateAt } from '../../../shared/attendance.js';
import {
  type GradebookScope,
  type AcademicPolicySnapshot,
  resolveAssessmentPolicy,
} from '../../../shared/gradebook.js';
import * as s from '../../db/schema.js';
import { fail, found, type Transaction } from '../operations.js';
import {
  activeStaff,
  contains,
  fingerprint,
  groupStudents,
  loadContext,
  resolveRange,
  addDays,
  type Context,
} from '../timetable-engine.js';

export type Assessment = typeof s.gradebookAssessment.$inferSelect;
export const schoolReader = (v: Viewer) => v.capabilities.includes('gradebook:school');
export const corrector = (v: Viewer) => v.capabilities.includes('gradebook:correct');
export function requireReader(v: Viewer) {
  if (!v.personId || !v.capabilities.some((c) => c.startsWith('gradebook:')))
    fail('ჟურნალის ნახვის უფლება არ გაქვთ.', 'FORBIDDEN', 403);
}
export const offeringGroup = (offeringId: string): TeachingGroup => ({
  id: offeringId,
  name: '',
  sources: [{ offeringId, studentIds: null }],
});
export function assigned(ctx: Context, v: Viewer, offeringId: string, date: string) {
  return (
    !!v.personId &&
    v.capabilities.includes('gradebook:own') &&
    activeStaff(ctx, v.personId, date) &&
    ctx.assignments.some(
      (a) => a.staffPersonId === v.personId && a.offeringId === offeringId && contains(a, date),
    )
  );
}
export function requireWriter(
  ctx: Context,
  v: Viewer,
  offeringIds: string[],
  date: string,
  today: string,
) {
  if (
    !offeringIds.length ||
    !offeringIds.every((id) => assigned(ctx, v, id, date) && assigned(ctx, v, id, today))
  )
    fail('შეფასების ჩაწერა მხოლოდ კურსის მოქმედ მასწავლებელს შეუძლია.', 'FORBIDDEN', 403);
}
export function homeroomIds(ctx: Context, v: Viewer, today: string) {
  if (
    !v.capabilities.includes('gradebook:homeroom') ||
    !v.personId ||
    !activeStaff(ctx, v.personId, today)
  )
    return [];
  const sections = ctx.assignments
    .filter((a) => a.staffPersonId === v.personId && a.kind === 'homeroom' && contains(a, today))
    .map((a) => a.sectionId);
  return ctx.enrollments
    .filter((e) => sections.includes(e.sectionId) && contains(e, today))
    .map((e) => e.studentId);
}
export async function familyIds(tx: Transaction, v: Viewer, today: string, guardianOnly = false) {
  if (!v.personId) return [];
  return (
    await tx
      .select({ id: s.student.id })
      .from(s.student)
      .innerJoin(s.person, eq(s.person.id, s.student.personId))
      .where(
        and(
          sql`${s.person.archivedAt} is null`,
          or(
            !guardianOnly && v.capabilities.includes('gradebook:self')
              ? eq(s.student.personId, v.personId)
              : sql`false`,
            v.capabilities.includes('gradebook:children')
              ? sql`exists(select 1 from guardian_link g where g.student_id=${s.student.id} and g.guardian_person_id=${v.personId} and g.academic_access and g.starts_on<=${today} and (g.ends_on is null or g.ends_on>${today}))`
              : sql`false`,
          ),
        ),
      )
  ).map((x) => x.id);
}
export async function assessmentContext(
  tx: Transaction,
  scope: GradebookScope,
  semesterId: string,
  date: string,
) {
  const semester = found(
    (await tx.select().from(s.semester).where(eq(s.semester.id, semesterId)))[0],
  );
  if (!contains(semester, date))
    fail('შეფასების თარიღი სემესტრის ფარგლებში უნდა იყოს.', 'DATE', 400);
  const ctx = await loadContext(tx, semester.yearId);
  let group: TeachingGroup;
  if (scope.kind === 'offering') group = offeringGroup(scope.offeringId);
  else {
    const version = found(
      (
        await tx
          .select()
          .from(s.timetableVersion)
          .where(
            and(
              eq(s.timetableVersion.id, scope.versionId),
              eq(s.timetableVersion.status, 'published'),
            ),
          )
      )[0],
    );
    if (version.yearId !== semester.yearId || !contains(version, date))
      fail('ჯგუფის ვერსია ამ თარიღისთვის მიუწვდომელია.');
    const effective = (
      await tx
        .select()
        .from(s.timetableVersion)
        .where(
          and(
            eq(s.timetableVersion.yearId, semester.yearId),
            eq(s.timetableVersion.status, 'published'),
            sql`${s.timetableVersion.startsOn}<=${date} and ${s.timetableVersion.endsOn}>${date}`,
          ),
        )
        .orderBy(desc(s.timetableVersion.startsOn))
    )[0];
    if (effective?.id !== version.id) fail('აირჩიეთ თარიღზე მოქმედი ჯგუფი.', 'STALE_SCOPE');
    group = found(version.document.groups.find((g) => g.id === scope.groupId));
  }
  const offers = group.sources.map((src) =>
    found(
      ctx.offerings.find(
        (o) =>
          o.id === src.offeringId &&
          contains(o, date) &&
          ctx.sections.some((sec) => sec.id === o.sectionId),
      ),
    ),
  );
  if (!offers.length || new Set(offers.map((o) => o.subjectId)).size !== 1)
    fail('აირჩიეთ ერთი საგნის კურსი.');
  const policies: AcademicPolicySnapshot[] = [];
  for (const offer of offers) {
    const p = (
      await tx
        .select()
        .from(s.assessmentPolicyVersion)
        .where(
          and(
            eq(s.assessmentPolicyVersion.offeringId, offer.id),
            eq(s.assessmentPolicyVersion.semesterId, semesterId),
          ),
        )
        .orderBy(desc(s.assessmentPolicyVersion.revision))
    )[0];
    if (!p) fail('ჯერ განსაზღვრეთ კურსის შეფასების წესი.', 'POLICY_REQUIRED');
    const grade = found(ctx.sections.find((sec) => sec.id === offer.sectionId)).gradeLevel;
    const mode = p.offeringMode as 'policy_default' | 'formative_only' | 'pass_fail';
    const ordinal = semester.ordinal as 1 | 2;
    policies.push({
      policyId: p.id,
      offeringId: offer.id,
      gradeLevel: grade,
      semesterOrdinal: ordinal,
      ...resolveAssessmentPolicy(p.policy, grade, ordinal, mode),
      policy: p.policy,
      requiredSummatives: p.requiredSummatives,
      requirementBasis: p.requirementBasis as 'configured' | 'demo',
    });
  }
  if (new Set(policies.map((p) => p.mode)).size !== 1)
    fail('ჯგუფში შეფასების განსხვავებული რეჟიმებია.');
  const roster = groupStudents(ctx, group, date).map((studentId) => {
    const student = found(ctx.students.find((st) => st.id === studentId));
    const person = found(ctx.people.find((p) => p.id === student.personId));
    const enrollment = found(
      ctx.enrollments.find(
        (e) =>
          e.studentId === studentId &&
          contains(e, date) &&
          offers.some((o) => o.sectionId === e.sectionId),
      ),
    );
    return {
      studentId,
      name: person.fullName,
      number: student.number,
      sectionId: enrollment.sectionId,
      section: found(ctx.sections.find((sec) => sec.id === enrollment.sectionId)).name,
      offeringIds: offers
        .filter((o) => groupStudents(ctx, offeringGroup(o.id), date).includes(studentId))
        .map((o) => o.id)
        .sort(),
    };
  });
  if (!roster.length) fail('ამ თარიღზე ჯგუფის სია ცარიელია.', 'EMPTY_ROSTER');
  // Stable semantic token; JSONB key ordering and changing labels cannot fabricate roster conflicts.
  const rosterToken = fingerprint([
    roster.map((r) => [r.studentId, r.sectionId, r.offeringIds]).sort(),
    policies.map((p) => [p.offeringId, p.policyId]).sort(),
  ]);
  return { ctx, semester, policies, roster, rosterToken, offers, group };
}
export async function validateOccurrence(
  tx: Transaction,
  data: Awaited<ReturnType<typeof assessmentContext>>,
  occurrenceId: string | null,
  date: string,
) {
  if (!occurrenceId) return;
  const versions = await tx
    .select()
    .from(s.timetableVersion)
    .where(
      and(
        eq(s.timetableVersion.yearId, data.ctx.year.id),
        eq(s.timetableVersion.status, 'published'),
      ),
    );
  const exceptions = versions.length
    ? await tx
        .select()
        .from(s.timetableException)
        .where(
          inArray(
            s.timetableException.versionId,
            versions.map((v) => v.id),
          ),
        )
    : [];
  const occurrence = resolveRange(data.ctx, versions, exceptions, date, addDays(date, 1)).find(
    (o) => o.id === occurrenceId && !o.cancelled,
  );
  if (
    !occurrence ||
    occurrence.studentIds.slice().sort().join() !==
      data.roster
        .map((r) => r.studentId)
        .sort()
        .join() ||
    !occurrence.document.groups
      .find((g) => g.id === occurrence.groupId)
      ?.sources.every((src) => data.offers.some((o) => o.id === src.offeringId))
  )
    fail('გაკვეთილი და შეფასების ჯგუფი არ ემთხვევა.', 'OCCURRENCE', 400);
}
export async function visiblePupils(tx: Transaction, v: Viewer, item: Assessment, now: Date) {
  requireReader(v);
  const today = schoolDateAt(now),
    ctx = await loadContext(tx, item.yearId);
  const owns =
    item.teacherId === v.personId && item.offeringIds.every((id) => assigned(ctx, v, id, today));
  if (item.status === 'draft') return owns ? item.roster.map((r) => r.studentId) : [];
  if (schoolReader(v) || owns || item.offeringIds.every((id) => assigned(ctx, v, id, today)))
    return item.roster.map((r) => r.studentId);
  const ids = new Set([...homeroomIds(ctx, v, today), ...(await familyIds(tx, v, today))]);
  return item.roster.filter((r) => ids.has(r.studentId)).map((r) => r.studentId);
}
