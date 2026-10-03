import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import * as s from '../../db/schema.js';
import type { Viewer } from '../../../shared/contracts.js';
import { schoolDateAt } from '../../../shared/attendance.js';
import { recoveryDeadline, type GradebookCommand } from '../../../shared/gradebook.js';
import { expectVersion, fail, found, requireCapability, type Transaction } from '../operations.js';
import { history, notify, semantic } from './common.js';

type Command = Extract<GradebookCommand, { action: 'recovery.request' | 'recovery.decide' }>;
export async function recoveryAction(tx: Transaction, v: Viewer, c: Command, now: Date) {
  const today = schoolDateAt(now);
  if (c.action === 'recovery.request') {
    requireCapability(v, 'gradebook:self');
    const student = found(
      (
        await tx
          .select()
          .from(s.student)
          .innerJoin(s.person, eq(s.student.personId, s.person.id))
          .where(eq(s.student.personId, v.personId!))
      )[0],
    );
    if (student.person.archivedAt) fail('ჩანაწერი ვერ მოიძებნა.', 'NOT_FOUND', 404);
    const item = found(
      (
        await tx
          .select()
          .from(s.gradebookAssessment)
          .where(
            and(
              eq(s.gradebookAssessment.id, c.assessmentId),
              eq(s.gradebookAssessment.status, 'published'),
            ),
          )
      )[0],
    );
    const entry = item.entries.find((e) => e.studentId === student.student.id);
    if (!entry) fail('შეფასება ვერ მოიძებნა.', 'NOT_FOUND', 404);
    if (
      item.category !== 'summative' ||
      entry.value.kind !== 'state' ||
      !['absent', 'recovery_required', 'unassessed'].includes(entry.value.state)
    )
      fail('აღდგენის მოთხოვნა ამ შეფასებას არ სჭირდება.');
    const pupil = found(item.roster.find((r) => r.studentId === entry.studentId));
    const days = Math.min(
      ...item.policy
        .filter((p) => pupil.offeringIds.includes(p.offeringId))
        .map((p) => p.policy.recoveryCalendarDays),
    );
    if (today <= recoveryDeadline(item.date, days))
      fail('ჩვეულებრივი აღდგენის ვადა ჯერ არ დასრულებულა.', 'RECOVERY_OPEN');
    const pending = await tx
      .select()
      .from(s.gradebookRecoveryRequest)
      .where(
        and(
          eq(s.gradebookRecoveryRequest.assessmentId, item.id),
          eq(s.gradebookRecoveryRequest.studentId, entry.studentId),
          inArray(s.gradebookRecoveryRequest.status, [
            'submitted',
            'follow_up',
            'review',
            'approved',
          ]),
        ),
      );
    for (const r of pending) {
      if (r.status !== 'approved' || !r.extendedUntil || r.extendedUntil >= today)
        fail('მოთხოვნა უკვე განხილვის პროცესშია.', 'PENDING_REQUEST');
      await history(
        tx,
        v,
        'recovery',
        r.id,
        r.revision + 1,
        'expired',
        'აღდგენის დამატებითი ვადა ამოიწურა',
        r,
        { ...r, status: 'expired', revision: r.revision + 1 },
      );
      await tx
        .update(s.gradebookRecoveryRequest)
        .set({ status: 'expired', revision: r.revision + 1 })
        .where(eq(s.gradebookRecoveryRequest.id, r.id));
    }
    const id = randomUUID();
    await tx.insert(s.gradebookRecoveryRequest).values({
      id,
      assessmentId: item.id,
      studentId: entry.studentId,
      actorId: v.id,
      reason: c.reason,
      assessmentRevision: item.revision,
      originalValue: entry.value,
    });
    await history(tx, v, 'recovery', id, 1, 'requested', c.reason, null, {
      assessmentId: item.id,
      studentId: entry.studentId,
      originalValue: entry.value,
      lesson: item.labels,
      title: item.title,
      date: item.date,
      pupil,
    });
    await notify(tx, 'recovery_requested', id, 1, [entry.studentId]);
    return { id, revision: 1 };
  }
  requireCapability(v, 'gradebook:correct');
  const request = found(
    (
      await tx
        .select()
        .from(s.gradebookRecoveryRequest)
        .where(eq(s.gradebookRecoveryRequest.id, c.id))
    )[0],
  );
  expectVersion(request.revision, c.revision);
  if (!['submitted', 'follow_up', 'review'].includes(request.status))
    fail('მოთხოვნა უკვე განხილულია.', 'DECIDED');
  const item = found(
    (
      await tx
        .select()
        .from(s.gradebookAssessment)
        .where(eq(s.gradebookAssessment.id, request.assessmentId))
    )[0],
  );
  const current = item.entries.find((e) => e.studentId === request.studentId);
  if (
    item.status !== 'published' ||
    !current ||
    semantic(current.value) !== semantic(request.originalValue)
  )
    fail('შეფასება შეიცვალა. მოთხოვნა ხელახლა განიხილეთ.', 'STALE_REQUEST');
  if (
    c.status === 'approved' &&
    (!c.physicalFollowUp || !c.extendedUntil || c.extendedUntil < today)
  )
    fail('დამტკიცებას სჭირდება პირადი განხილვა და მოქმედი დამატებითი ვადა.', 'APPROVAL', 400);
  const year = found(
    (await tx.select().from(s.academicYear).where(eq(s.academicYear.id, item.yearId)))[0],
  );
  if (c.extendedUntil && c.extendedUntil >= year.endsOn)
    fail('დამატებითი ვადა სასწავლო წელს სცდება.', 'DEADLINE', 400);
  const patch = {
    status: c.status,
    physicalFollowUp: c.physicalFollowUp,
    extendedUntil: c.status === 'approved' ? c.extendedUntil : null,
    decision: c.reason,
    decidedBy: v.id,
    decidedAt: now,
    revision: request.revision + 1,
  };
  await history(tx, v, 'recovery', request.id, patch.revision, 'decided', c.reason, request, {
    ...request,
    ...patch,
  });
  await tx
    .update(s.gradebookRecoveryRequest)
    .set(patch)
    .where(eq(s.gradebookRecoveryRequest.id, request.id));
  await notify(tx, 'recovery_decided', request.id, patch.revision, [request.studentId]);
  return { id: request.id, revision: patch.revision };
}
