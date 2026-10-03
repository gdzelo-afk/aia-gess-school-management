import { resolveAssessmentPolicy } from '../../../shared/gradebook.js';
import { and, eq, desc } from 'drizzle-orm';
import { db } from '../../db/client.js';
import * as s from '../../db/schema.js';
import type { Viewer } from '../../../shared/contracts.js';
import { schoolDateAt } from '../../../shared/attendance.js';
import { fail, found, type Transaction } from '../operations.js';
import { assigned, requireReader, schoolReader, visiblePupils } from './context.js';
import { loadContext } from '../timetable-engine.js';
export async function gradebookYears(v: Viewer) {
  requireReader(v);
  const years = await db.select().from(s.academicYear).orderBy(desc(s.academicYear.startsOn));
  const semesters = await db.select().from(s.semester).orderBy(s.semester.startsOn);
  return years.map((y) => ({
    id: y.id,
    name: y.name,
    status: y.status,
    startsOn: y.startsOn,
    endsOn: y.endsOn,
    semesters: semesters
      .filter((s) => s.yearId === y.id)
      .map((s) => ({
        id: s.id,
        name: s.name,
        ordinal: s.ordinal,
        startsOn: s.startsOn,
        endsOn: s.endsOn,
      })),
  }));
}
export async function criteriaVisible(
  tx: Transaction,
  v: Viewer,
  c: typeof s.assessmentCriteriaVersion.$inferSelect,
  now: Date,
) {
  if (schoolReader(v)) return true;
  const ctx = await loadContext(tx, c.yearId);
  if (
    ctx.offerings.some(
      (o) =>
        o.subjectId === c.subjectId &&
        ctx.sections.some((sec) => sec.id === o.sectionId) &&
        assigned(ctx, v, o.id, schoolDateAt(now)),
    )
  )
    return true;
  const items = await tx
    .select()
    .from(s.gradebookAssessment)
    .where(
      and(
        eq(s.gradebookAssessment.criteriaId, c.id),
        eq(s.gradebookAssessment.status, 'published'),
      ),
    );
  for (const item of items) if ((await visiblePupils(tx, v, item, now)).length) return true;
  return false;
}
export async function criteriaLibrary(
  v: Viewer,
  yearId: string,
  subjectId?: string,
  now = new Date(),
) {
  requireReader(v);
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(s.assessmentCriteriaVersion)
      .where(
        and(
          eq(s.assessmentCriteriaVersion.yearId, yearId),
          subjectId ? eq(s.assessmentCriteriaVersion.subjectId, subjectId) : undefined,
        ),
      )
      .orderBy(desc(s.assessmentCriteriaVersion.revision))
      .limit(1001);
    if (rows.length > 1000) fail('აირჩიეთ კონკრეტული საგანი.', 'LIBRARY_RANGE', 400);
    const result = [];
    for (const c of rows)
      if (await criteriaVisible(tx, v, c, now))
        result.push({
          id: c.id,
          revision: c.revision,
          subjectId: c.subjectId,
          yearId: c.yearId,
          text: c.text,
          fileId: c.fileId,
          approvedAt: c.createdAt,
        });
    return result;
  });
}
export async function criteriaDetail(v: Viewer, id: string, now = new Date()) {
  requireReader(v);
  return db.transaction(async (tx) => {
    const c = found(
      (
        await tx
          .select()
          .from(s.assessmentCriteriaVersion)
          .where(eq(s.assessmentCriteriaVersion.id, id))
      )[0],
    );
    if (!(await criteriaVisible(tx, v, c, now))) fail('კრიტერიუმი ვერ მოიძებნა.', 'NOT_FOUND', 404);
    return {
      id: c.id,
      revision: c.revision,
      subjectId: c.subjectId,
      yearId: c.yearId,
      text: c.text,
      fileId: c.fileId,
      approvedAt: c.createdAt,
    };
  });
}
export async function policySetup(v: Viewer, yearId: string, semesterId: string, now = new Date()) {
  requireReader(v);
  return db.transaction(async (tx) => {
    const ctx = await loadContext(tx, yearId);
    const semester = found(
      (
        await tx
          .select()
          .from(s.semester)
          .where(and(eq(s.semester.id, semesterId), eq(s.semester.yearId, yearId)))
      )[0],
    );
    const offers = ctx.offerings.filter(
      (o) =>
        ctx.sections.some((sec) => sec.id === o.sectionId) &&
        (schoolReader(v) || assigned(ctx, v, o.id, schoolDateAt(now))),
    );
    const all = await tx
      .select()
      .from(s.assessmentPolicyVersion)
      .where(eq(s.assessmentPolicyVersion.semesterId, semester.id))
      .orderBy(desc(s.assessmentPolicyVersion.revision));
    const versions = await tx
      .select()
      .from(s.timetableVersion)
      .where(and(eq(s.timetableVersion.yearId, yearId), eq(s.timetableVersion.status, 'published')))
      .orderBy(desc(s.timetableVersion.startsOn));
    return {
      offerings: offers.map((o) => ({
        id: o.id,
        subjectId: o.subjectId,
        subject: found(ctx.subjects.find((s) => s.id === o.subjectId)).name,
        section: found(ctx.sections.find((s) => s.id === o.sectionId)).name,
        writable: assigned(ctx, v, o.id, schoolDateAt(now)),
        policy: (() => {
          const p = all.find((p) => p.offeringId === o.id);
          return p
            ? {
                id: p.id,
                revision: p.revision,
                policy: p.policy,
                resolved: resolveAssessmentPolicy(
                  p.policy,
                  found(ctx.sections.find((sec) => sec.id === o.sectionId)).gradeLevel,
                  semester.ordinal as 1 | 2,
                  p.offeringMode as 'policy_default' | 'formative_only' | 'pass_fail',
                ),
                offeringMode: p.offeringMode,
                requiredSummatives: p.requiredSummatives,
                requirementBasis: p.requirementBasis,
              }
            : null;
        })(),
      })),
      groups: versions.flatMap((version) =>
        version.document.groups
          .filter((g) =>
            g.sources.every((src) =>
              offers.some(
                (o) => o.id === src.offeringId && assigned(ctx, v, o.id, schoolDateAt(now)),
              ),
            ),
          )
          .map((g) => ({
            id: g.id,
            versionId: version.id,
            name: g.name,
            startsOn: version.startsOn,
            endsOn: version.endsOn,
            offeringIds: g.sources.map((src) => src.offeringId),
          })),
      ),
    };
  });
}
