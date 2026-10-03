import { and, eq, desc, sql, or, inArray } from 'drizzle-orm';
import { db } from '../../db/client.js';
import * as s from '../../db/schema.js';
import type { Viewer } from '../../../shared/contracts.js';
import { schoolDateAt } from '../../../shared/attendance.js';
import {
  semesterProjection,
  resolveAssessmentPolicy,
  recoveryDeadline,
  type GradebookEntry,
} from '../../../shared/gradebook.js';
import { fail, found, type Transaction } from '../operations.js';
import { loadContext, groupStudents, type Context } from '../timetable-engine.js';
import {
  assigned,
  familyIds,
  homeroomIds,
  offeringGroup,
  requireReader,
  schoolReader,
  corrector,
  type Assessment,
} from './context.js';
import { canReadWriting, canEditWriting } from './writings.js';

export async function readScope(tx: Transaction, v: Viewer, yearId: string, today: string) {
  requireReader(v);
  const ctx = await loadContext(tx, yearId);
  const family = await familyIds(tx, v, today),
    homeroom = homeroomIds(ctx, v, today);
  const pupils = [...new Set([...family, ...homeroom])];
  const offerings = ctx.offerings
    .filter(
      (o) => ctx.sections.some((sec) => sec.id === o.sectionId) && assigned(ctx, v, o.id, today),
    )
    .map((o) => o.id);
  const offeringSQL = offerings.length
    ? sql`${s.gradebookAssessment.offeringIds} <@ ARRAY[${sql.join(
        offerings.map((id) => sql`${id}`),
        sql`, `,
      )}]::uuid[]`
    : sql`false`;
  const pupilSQL = pupils.length
    ? sql`exists(select 1 from jsonb_array_elements(${s.gradebookAssessment.roster}) r where r->>'studentId' in (${sql.join(
        pupils.map((id) => sql`${id}`),
        sql`, `,
      )}))`
    : sql`false`;
  const scope = or(
    and(
      eq(s.gradebookAssessment.status, 'draft'),
      eq(s.gradebookAssessment.teacherId, v.personId!),
      offeringSQL,
    ),
    and(
      sql`${s.gradebookAssessment.status}<>'draft'`,
      or(schoolReader(v) ? sql`true` : sql`false`, offeringSQL, pupilSQL),
    ),
  )!;
  return { ctx, family, homeroom, pupils, offerings, scope };
}
type Scope = Awaited<ReturnType<typeof readScope>>;
export function scopedPupils(v: Viewer, item: Assessment, scope: Scope) {
  const courseRead =
    item.offeringIds.length > 0 && item.offeringIds.every((id) => scope.offerings.includes(id));
  if (item.status === 'draft')
    return item.teacherId === v.personId && courseRead ? item.roster.map((r) => r.studentId) : [];
  return schoolReader(v) || courseRead
    ? item.roster.map((r) => r.studentId)
    : item.roster.filter((r) => scope.pupils.includes(r.studentId)).map((r) => r.studentId);
}
export function projectAssessment(item: Assessment, ids: string[]) {
  return {
    id: item.id,
    revision: item.revision,
    date: item.date,
    title: item.title,
    description: item.description,
    activity: item.activity,
    category: item.category,
    mode: item.mode,
    labels: item.labels,
    status: item.status,
    publishedAt: item.publishedAt,
    criteriaId: item.criteriaId,
    offeringIds: item.offeringIds,
    roster: item.roster
      .filter((r) => ids.includes(r.studentId))
      .map((r) => ({ studentId: r.studentId, name: r.name, number: r.number, section: r.section })),
    entries: item.entries.filter((e) => ids.includes(e.studentId)),
    rosterToken: item.status === 'draft' ? item.rosterToken : null,
  };
}
export async function journal(
  v: Viewer,
  yearId: string,
  semesterId: string,
  offeringId?: string,
  studentId?: string,
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    const today = schoolDateAt(now),
      scope = await readScope(tx, v, yearId, today);
    const semester = found(
      (
        await tx
          .select()
          .from(s.semester)
          .where(and(eq(s.semester.id, semesterId), eq(s.semester.yearId, yearId)))
      )[0],
    );
    const rows = await tx
      .select()
      .from(s.gradebookAssessment)
      .where(
        and(
          scope.scope,
          eq(s.gradebookAssessment.semesterId, semesterId),
          offeringId
            ? sql`${offeringId}::uuid=any(${s.gradebookAssessment.offeringIds})`
            : undefined,
          studentId
            ? sql`exists(select 1 from jsonb_array_elements(${s.gradebookAssessment.roster}) r where r->>'studentId'=${studentId})`
            : undefined,
        ),
      )
      .orderBy(s.gradebookAssessment.date, s.gradebookAssessment.id)
      .limit(2001);
    if (rows.length > 2000) fail('შეარჩიეთ ერთი კურსი ან მოსწავლე.', 'REPORT_RANGE', 400);
    const items = rows
      .map((item) => {
        const ids = scopedPupils(v, item, scope).filter((id) => !studentId || id === studentId);
        return { item, ids };
      })
      .filter((x) => x.ids.length);
    const allowedLive = scope.ctx.offerings.filter(
      (o) =>
        scope.ctx.sections.some((sec) => sec.id === o.sectionId) &&
        (schoolReader(v) ||
          scope.offerings.includes(o.id) ||
          groupStudents(scope.ctx, offeringGroup(o.id), today).some((id) =>
            scope.pupils.includes(id),
          )),
    );
    const historicalOfferIds = items.flatMap((x) =>
      x.item.roster.filter((r) => x.ids.includes(r.studentId)).flatMap((r) => r.offeringIds),
    );
    const choices = scope.ctx.offerings.filter(
      (o) => allowedLive.some((a) => a.id === o.id) || historicalOfferIds.includes(o.id),
    );
    if (offeringId && !choices.some((o) => o.id === offeringId))
      fail('კურსი ვერ მოიძებნა.', 'NOT_FOUND', 404);
    const pupilIds = [
      ...new Set([
        ...items.flatMap((x) => x.ids),
        ...allowedLive
          .filter((o) => !offeringId || o.id === offeringId)
          .flatMap((o) =>
            groupStudents(scope.ctx, offeringGroup(o.id), today).filter(
              (id) =>
                schoolReader(v) || scope.offerings.includes(o.id) || scope.pupils.includes(id),
            ),
          ),
      ]),
    ];
    if (studentId && !pupilIds.includes(studentId))
      fail('მოსწავლე ვერ მოიძებნა.', 'NOT_FOUND', 404);
    const policies = choices.length
      ? await tx
          .select()
          .from(s.assessmentPolicyVersion)
          .where(
            and(
              eq(s.assessmentPolicyVersion.semesterId, semesterId),
              inArray(
                s.assessmentPolicyVersion.offeringId,
                choices.map((o) => o.id),
              ),
            ),
          )
          .orderBy(desc(s.assessmentPolicyVersion.revision))
      : [];
    return {
      year: { id: scope.ctx.year.id, name: scope.ctx.year.name },
      semester,
      offerings: choices.map((o) => ({
        id: o.id,
        subjectId: o.subjectId,
        subject: found(scope.ctx.subjects.find((s) => s.id === o.subjectId)).name,
        section: found(scope.ctx.sections.find((s) => s.id === o.sectionId)).name,
        writable: scope.offerings.includes(o.id),
        requiredSummatives: policies.find((p) => p.offeringId === o.id)?.requiredSummatives ?? null,
        policyConfigured: policies.some((p) => p.offeringId === o.id),
        mode: (() => {
          const p = policies.find((p) => p.offeringId === o.id);
          return p
            ? resolveAssessmentPolicy(
                p.policy,
                found(scope.ctx.sections.find((sec) => sec.id === o.sectionId)).gradeLevel,
                semester.ordinal as 1 | 2,
                p.offeringMode as 'policy_default' | 'formative_only' | 'pass_fail',
              ).mode
            : null;
        })(),
      })),
      pupils: pupilIds
        .filter((id) => !studentId || studentId === id)
        .map((id) => pupilLabel(scope.ctx, id)),
      items: items.map((x) => projectAssessment(x.item, x.ids)),
    };
  });
}
function pupilLabel(ctx: Context, studentId: string) {
  const student = found(ctx.students.find((s) => s.id === studentId));
  return {
    id: studentId,
    name: found(ctx.people.find((p) => p.id === student.personId)).fullName,
    number: student.number,
  };
}
export async function assessmentHistory(v: Viewer, id: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const item = found(
      (await tx.select().from(s.gradebookAssessment).where(eq(s.gradebookAssessment.id, id)))[0],
    );
    const scope = await readScope(tx, v, item.yearId, schoolDateAt(now));
    const ids = scopedPupils(v, item, scope);
    if (!ids.length) fail('შეფასება ვერ მოიძებნა.', 'NOT_FOUND', 404);
    const internal =
      corrector(v) ||
      (item.teacherId === v.personId &&
        item.offeringIds.every((id) => scope.offerings.includes(id)));
    const history = await tx
      .select()
      .from(s.gradebookRevision)
      .where(and(eq(s.gradebookRevision.kind, 'assessment'), eq(s.gradebookRevision.objectId, id)))
      .orderBy(s.gradebookRevision.revision);
    const actors =
      internal && history.length
        ? await tx
            .select({ id: s.user.id, name: s.user.name })
            .from(s.user)
            .where(
              inArray(
                s.user.id,
                history.map((r) => r.actorId),
              ),
            )
        : [];
    const values = (record: Record<string, unknown> | null) =>
      ((record?.entries ?? []) as GradebookEntry[]).filter((e) => ids.includes(e.studentId));
    return history.map((r) => ({
      revision: r.revision,
      action: r.action,
      at: r.createdAt,
      reason: internal ? r.reason : null,
      actor: internal ? (actors.find((a) => a.id === r.actorId)?.name ?? null) : null,
      before: values(r.before),
      after: values(r.after),
      title: r.after.title as string,
    }));
  });
}
export async function writings(v: Viewer, yearId: string, studentId?: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const scope = await readScope(tx, v, yearId, schoolDateAt(now));
    const people = [
      ...new Set([
        ...scope.pupils,
        ...scope.ctx.offerings
          .filter((o) => scope.offerings.includes(o.id))
          .flatMap((o) => groupStudents(scope.ctx, offeringGroup(o.id), schoolDateAt(now))),
      ]),
    ];
    // Scope before loading private narrative bodies. canReadWriting further separates notes from student/Founders views.
    const rows = await tx
      .select()
      .from(s.gradebookWriting)
      .where(
        and(
          eq(s.gradebookWriting.yearId, yearId),
          studentId ? eq(s.gradebookWriting.studentId, studentId) : undefined,
          or(
            corrector(v)
              ? sql`true`
              : schoolReader(v)
                ? eq(s.gradebookWriting.kind, 'narrative')
                : sql`false`,
            eq(s.gradebookWriting.teacherId, v.personId!),
            people.length ? inArray(s.gradebookWriting.studentId, people) : sql`false`,
          ),
        ),
      )
      .limit(2001);
    if (rows.length > 2000) fail('შეარჩიეთ ერთი მოსწავლე.', 'REPORT_RANGE', 400);
    const result = [];
    for (const row of rows)
      if (await canReadWriting(tx, v, row, now))
        result.push({
          id: row.id,
          kind: row.kind,
          yearId: row.yearId,
          offeringId: row.offeringId,
          studentId: row.studentId,
          revision: row.revision,
          status: row.status,
          body: row.body,
          snapshot: row.snapshot,
          publishedAt: row.publishedAt,
          canEdit: await canEditWriting(tx, v, row, now),
        });
    return result;
  });
}
// Bounded academic report; no ranking or arbitrary expression/SQL surface.
export async function progressReport(
  v: Viewer,
  yearId: string,
  semesterId: string,
  offeringId: string,
  studentId?: string,
  now = new Date(),
) {
  const view = await journal(v, yearId, semesterId, offeringId, studentId, now);
  const offer = found(view.offerings.find((o) => o.id === offeringId));
  const rows = view.pupils.map((p) => {
    const items = view.items.flatMap((item) => {
      const entry = item.entries.find((e) => e.studentId === p.id);
      return entry
        ? [
            {
              id: item.id,
              category: item.category,
              published: item.status === 'published',
              voided: item.status === 'void',
              value: entry.value,
            },
          ]
        : [];
    });
    const mode = offer.mode ?? 'numeric_10';
    return {
      pupil: p,
      projection: semesterProjection(items, offer.requiredSummatives, mode),
      recovery: view.items.flatMap((item) => {
        const e = item.entries.find((e) => e.studentId === p.id);
        // Per-assessment policy deadlines are projected separately by the service below; avoid fixed UI policy.
        return item.status === 'published' &&
          item.category === 'summative' &&
          e?.value.kind === 'state' &&
          e.value.state !== 'exempt'
          ? [{ assessmentId: item.id, title: item.title, date: item.date }]
          : [];
      }),
    };
  });
  return {
    year: view.year,
    semester: view.semester,
    offering: offer,
    official: false as const,
    rows,
  };
}
export function deadlineFor(item: Assessment, studentId: string) {
  const pupil = found(item.roster.find((r) => r.studentId === studentId));
  const days = Math.min(
    ...item.policy
      .filter((p) => pupil.offeringIds.includes(p.offeringId))
      .map((p) => p.policy.recoveryCalendarDays),
  );
  return recoveryDeadline(item.date, days);
}

export async function recoveryQueue(v: Viewer, yearId: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const scope = await readScope(tx, v, yearId, schoolDateAt(now));
    const rows = await tx
      .select({ request: s.gradebookRecoveryRequest, item: s.gradebookAssessment })
      .from(s.gradebookRecoveryRequest)
      .innerJoin(
        s.gradebookAssessment,
        eq(s.gradebookAssessment.id, s.gradebookRecoveryRequest.assessmentId),
      )
      .where(and(eq(s.gradebookAssessment.yearId, yearId), scope.scope))
      .orderBy(desc(s.gradebookRecoveryRequest.createdAt))
      .limit(1001);
    if (rows.length > 1000)
      fail('მოთხოვნების სია ზედმეტად დიდია. საჭიროა დამატებითი ფილტრი.', 'REPORT_RANGE', 400);
    return rows
      .filter(({ request, item }) => scopedPupils(v, item, scope).includes(request.studentId))
      .map(({ request: r, item }) => ({
        id: r.id,
        revision: r.revision,
        assessmentId: item.id,
        title: item.title,
        date: item.date,
        subject: item.labels.subject,
        teacher: item.labels.teacher,
        pupil: found(item.roster.find((p) => p.studentId === r.studentId)),
        originalValue: r.originalValue,
        status: r.status,
        createdAt: r.createdAt,
        extendedUntil: r.extendedUntil,
        physicalFollowUp: corrector(v) ? r.physicalFollowUp : undefined,
        reason: corrector(v) || r.actorId === v.id ? r.reason : null,
        decision:
          corrector(v) || r.actorId === v.id || scope.family.includes(r.studentId)
            ? r.decision
            : null,
        canDecide: corrector(v) && ['submitted', 'follow_up', 'review'].includes(r.status),
      }));
  });
}

export async function writingHistory(v: Viewer, id: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const item = found(
      (await tx.select().from(s.gradebookWriting).where(eq(s.gradebookWriting.id, id)))[0],
    );
    if (!(await canReadWriting(tx, v, item, now))) fail('ჩანაწერი ვერ მოიძებნა.', 'NOT_FOUND', 404);
    const internal = await canEditWriting(tx, v, item, now);
    const rows = await tx
      .select()
      .from(s.gradebookRevision)
      .where(and(eq(s.gradebookRevision.kind, 'writing'), eq(s.gradebookRevision.objectId, id)))
      .orderBy(s.gradebookRevision.revision);
    const actors =
      internal && rows.length
        ? await tx
            .select({ id: s.user.id, name: s.user.name })
            .from(s.user)
            .where(
              inArray(
                s.user.id,
                rows.map((r) => r.actorId),
              ),
            )
        : [];
    return rows.map((r) => ({
      actor: internal ? (actors.find((a) => a.id === r.actorId)?.name ?? null) : null,
      revision: r.revision,
      at: r.createdAt,
      action: r.action,
      before: typeof r.before?.body === 'string' ? r.before.body : null,
      after: typeof r.after.body === 'string' ? r.after.body : '',
      reason: internal ? r.reason : null,
    }));
  });
}
