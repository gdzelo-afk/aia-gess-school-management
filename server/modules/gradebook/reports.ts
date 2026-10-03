import { and, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import * as s from '../../db/schema.js';
import { db } from '../../db/client.js';
import type { Viewer } from '../../../shared/contracts.js';
import {
  annualProjection,
  currentAssessmentPolicy,
  rationalMean,
  type SemesterProjection,
} from '../../../shared/gradebook.js';
import { schoolDateAt } from '../../../shared/attendance.js';
import { fail, found } from '../operations.js';
import {
  journal,
  progressReport,
  readScope,
  writings,
  deadlineFor,
  scopedPupils,
} from './reads.js';
import { schoolReader } from './context.js';
export const reportKind = z.enum([
  'progress',
  'matrix',
  'provisional',
  'distribution',
  'summatives',
  'pass_fail',
  'narratives',
  'publication',
  'attendance',
  'annual',
]);
export type ReportKind = z.infer<typeof reportKind>;
export async function academicReport(
  v: Viewer,
  kind: ReportKind,
  yearId: string,
  semesterId: string,
  offeringId: string,
  studentId?: string,
  now = new Date(),
) {
  const view = await journal(v, yearId, semesterId, offeringId, studentId, now);
  const offering = found(view.offerings.find((o) => o.id === offeringId));
  const cohort =
    schoolReader(v) ||
    v.capabilities.includes('gradebook:own') ||
    v.capabilities.includes('gradebook:homeroom');
  if (!cohort && ['matrix', 'distribution', 'publication', 'narratives'].includes(kind))
    fail('ჯგუფური ანგარიში მხოლოდ უფლებამოსილი თანამშრომლისთვისაა.', 'FORBIDDEN', 403);
  if (kind === 'matrix')
    return { kind, offering, pupils: view.pupils, assessments: view.items, official: false };
  if (kind === 'progress' || kind === 'provisional')
    return { kind, ...(await progressReport(v, yearId, semesterId, offeringId, studentId, now)) };
  if (kind === 'distribution') {
    const marks = view.items
      .filter((i) => i.status === 'published')
      .flatMap((i) =>
        i.entries
          .filter((e) => e.value.kind === 'numeric')
          .map((e) => (e.value.kind === 'numeric' ? e.value.score : 0)),
      );
    return {
      kind,
      offering,
      scoreCount: marks.length,
      mean: marks.length
        ? rationalMean(
            marks.reduce((n, v) => n + v, 0),
            marks.length,
          )
        : null,
      distribution: Array.from({ length: 10 }, (_, i) => ({
        score: i + 1,
        count: marks.filter((v) => v === i + 1).length,
      })),
      official: false,
    };
  }
  if (kind === 'pass_fail')
    return {
      kind,
      offering,
      rows: view.pupils.map((p) => ({
        pupil: p,
        assessments: view.items
          .filter((i) => i.status === 'published' && i.mode === 'pass_fail')
          .flatMap((i) => {
            const entry = i.entries.find((e) => e.studentId === p.id);
            return entry ? [{ id: i.id, title: i.title, date: i.date, value: entry.value }] : [];
          }),
      })),
      official: false,
    };
  if (kind === 'narratives') {
    const list = await writings(v, yearId, studentId, now);
    return {
      kind,
      offering,
      rows: view.pupils.map((p) => ({
        pupil: p,
        published: list.some(
          (w) =>
            w.kind === 'narrative' &&
            w.offeringId === offeringId &&
            w.studentId === p.id &&
            w.status === 'published',
        ),
      })),
      basis: 'published_only',
    };
  }
  if (kind === 'annual') {
    const terms = await db
      .select()
      .from(s.semester)
      .where(eq(s.semester.yearId, yearId))
      .orderBy(s.semester.ordinal);
    const projections = await Promise.all(
      terms.map((t) => progressReport(v, yearId, t.id, offeringId, studentId, now)),
    );
    const [offer] = await db
      .select({ grade: s.section.gradeLevel })
      .from(s.courseOffering)
      .innerJoin(s.section, eq(s.section.id, s.courseOffering.sectionId))
      .where(eq(s.courseOffering.id, offeringId));
    const policies = await db
      .select()
      .from(s.assessmentPolicyVersion)
      .where(eq(s.assessmentPolicyVersion.offeringId, offeringId))
      .orderBy(sql`${s.assessmentPolicyVersion.revision} desc`);
    const policy =
      policies.find((p) => p.semesterId === terms.find((t) => t.ordinal === 2)?.id)?.policy ??
      policies[0]?.policy ??
      currentAssessmentPolicy;
    return {
      kind,
      offering,
      rows: view.pupils.map((p) => {
        const term = (ordinal: number): SemesterProjection | null =>
          projections[terms.findIndex((t) => t.ordinal === ordinal)]?.rows.find(
            (r) => r.pupil.id === p.id,
          )?.projection ?? null;
        return { pupil: p, annual: annualProjection(policy, found(offer).grade, term(1), term(2)) };
      }),
      official: false,
      excludesExams: true,
    };
  }
  const summativeSummary =
    kind === 'summatives'
      ? await progressReport(v, yearId, semesterId, offeringId, studentId, now)
      : null;
  return db.transaction(async (tx) => {
    const scope = await readScope(tx, v, yearId, schoolDateAt(now));
    const ids = view.pupils.map((p) => p.id);
    if (kind === 'publication') {
      // Leadership receives counts, never a teacher's private draft contents.
      const rows = await tx
        .select({ status: s.gradebookAssessment.status })
        .from(s.gradebookAssessment)
        .where(
          and(
            eq(s.gradebookAssessment.semesterId, semesterId),
            sql`${offeringId}::uuid=any(${s.gradebookAssessment.offeringIds})`,
            schoolReader(v) ? sql`true` : scope.scope,
          ),
        );
      return {
        kind,
        offering,
        draft: rows.filter((r) => r.status === 'draft').length,
        published: rows.filter((r) => r.status === 'published').length,
        voided: rows.filter((r) => r.status === 'void').length,
      };
    }
    if (kind === 'summatives') {
      const items = await tx
        .select()
        .from(s.gradebookAssessment)
        .where(
          and(
            scope.scope,
            eq(s.gradebookAssessment.semesterId, semesterId),
            eq(s.gradebookAssessment.status, 'published'),
            eq(s.gradebookAssessment.category, 'summative'),
            sql`${offeringId}::uuid=any(${s.gradebookAssessment.offeringIds})`,
          ),
        );
      const summary = summativeSummary!;
      return {
        kind,
        offering,
        rows: summary.rows.map((row) => ({
          ...row,
          recovery: items.flatMap((item) => {
            const entry = item.entries.find((e) => e.studentId === row.pupil.id);
            return scopedPupils(v, item, scope).includes(row.pupil.id) &&
              entry?.value.kind === 'state' &&
              entry.value.state !== 'exempt'
              ? [
                  {
                    assessmentId: item.id,
                    title: item.title,
                    state: entry.value.state,
                    deadline: deadlineFor(item, row.pupil.id),
                    overdue: deadlineFor(item, row.pupil.id) < schoolDateAt(now),
                  },
                ]
              : [];
          }),
        })),
        official: false,
      };
    }
    if (kind === 'attendance') {
      const course = found(scope.ctx.offerings.find((o) => o.id === offeringId));
      const records = ids.length
        ? await tx
            .select({
              studentId: s.attendanceRecord.studentId,
              status: s.attendanceRecord.status,
              departure: s.attendanceRecord.departure,
            })
            .from(s.attendanceRecord)
            .innerJoin(
              s.attendanceSession,
              eq(s.attendanceSession.id, s.attendanceRecord.sessionId),
            )
            .where(
              and(
                inArray(s.attendanceRecord.studentId, ids),
                sql`${s.attendanceSession.snapshot}->'academic'->>'yearId'=${yearId}`,
                sql`${s.attendanceSession.snapshot}->'academic'->>'subjectId'=${course.subjectId}`,
                sql`${s.attendanceSession.snapshot}->'occurrence'->>'targetDate'>=${view.semester.startsOn} and ${s.attendanceSession.snapshot}->'occurrence'->>'targetDate'<${view.semester.endsOn}`,
              ),
            )
        : [];
      return {
        kind,
        offering,
        basis: 'submitted_roll_calls_only',
        unresolvedExcluded: true,
        rows: view.pupils.map((p) => {
          const r = records.filter((r) => r.studentId === p.id);
          return {
            pupil: p,
            recorded: r.length,
            attended: r.filter((r) => ['present', 'late'].includes(r.status)).length,
            missed: r.filter((r) => ['absent', 'authorized'].includes(r.status)).length,
            late: r.filter((r) => r.status === 'late').length,
            early: r.filter((r) => r.departure).length,
          };
        }),
      };
    }
    fail('ანგარიშის ტიპი არასწორია.', 'REPORT_KIND', 400);
  });
}
