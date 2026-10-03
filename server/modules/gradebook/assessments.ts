import { writingAction } from './writings.js';
import { semantic, history, notify } from './common.js';
import { recoveryAction } from './recovery.js';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client.js';
import * as s from '../../db/schema.js';
import type { Viewer } from '../../../shared/contracts.js';
import { schoolDateAt } from '../../../shared/attendance.js';
import {
  gradebookCommand,
  recoveryDeadline,
  validateResult,
  type GradebookCommand,
  type GradebookEntry,
} from '../../../shared/gradebook.js';
import {
  administration,
  audit,
  expectVersion,
  fail,
  found,
  requireCapability,
  type Transaction,
} from '../operations.js';
import { fingerprint, groupStudents, loadContext } from '../timetable-engine.js';
import {
  assigned as assignedForDetail,
  assessmentContext,
  corrector,
  offeringGroup,
  requireReader,
  requireWriter,
  validateOccurrence,
  visiblePupils,
  type Assessment,
} from './context.js';

function entriesFor(item: Assessment, entries: GradebookEntry[]) {
  if (
    entries.length !== item.roster.length ||
    new Set(entries.map((e) => e.studentId)).size !== entries.length ||
    entries.some((e) => !item.roster.some((r) => r.studentId === e.studentId))
  )
    fail('სია შეიცვალა ან შეფასებები არასრულია.', 'ROSTER_CONFLICT');
  for (const entry of entries) {
    const pupil = found(item.roster.find((r) => r.studentId === entry.studentId));
    for (const policy of item.policy.filter((p) => pupil.offeringIds.includes(p.offeringId))) {
      try {
        validateResult(
          {
            ...policy,
            mode: item.mode,
            recoveryCalendarDays: policy.policy.recoveryCalendarDays,
            rounding: policy.policy.rounding,
          },
          item.category,
          entry.value,
        );
      } catch {
        fail('შეფასება კურსის წესს არ შეესაბამება.', 'RESULT', 400);
      }
    }
  }
  return entries.slice().sort((a, b) => a.studentId.localeCompare(b.studentId));
}
const missingSummative = (entry: GradebookEntry) =>
  entry.value.kind === 'state' &&
  ['absent', 'recovery_required', 'unassessed'].includes(entry.value.state);
async function assertTeacherCorrection(
  tx: Transaction,
  v: Viewer,
  item: Assessment,
  entries: GradebookEntry[],
  today: string,
  wholeAssessment = false,
) {
  if (corrector(v)) return;
  const ctx = await loadContext(tx, item.yearId);
  requireWriter(ctx, v, item.offeringIds, item.date, today);
  if (item.teacherId !== v.personId)
    fail('სხვისი შეფასების შეცვლის უფლება არ გაქვთ.', 'FORBIDDEN', 403);
  for (const entry of entries) {
    const previous = found(item.entries.find((e) => e.studentId === entry.studentId));
    if (!wholeAssessment && semantic(previous.value) === semantic(entry.value)) continue;
    const pupil = found(item.roster.find((r) => r.studentId === entry.studentId));
    if (
      !pupil.offeringIds.some((id) =>
        groupStudents(ctx, offeringGroup(id), today).includes(entry.studentId),
      )
    )
      fail('გადაყვანილი მოსწავლის ისტორიულ შეფასებას ადმინისტრაცია ასწორებს.', 'TRANSFER_LOCK');
    if (
      item.category === 'summative' &&
      missingSummative(previous) &&
      entry.value.kind !== 'state'
    ) {
      const days = Math.min(
        ...item.policy
          .filter((p) => pupil.offeringIds.includes(p.offeringId))
          .map((p) => p.policy.recoveryCalendarDays),
      );
      if (today > recoveryDeadline(item.date, days)) {
        const request = (
          await tx
            .select()
            .from(s.gradebookRecoveryRequest)
            .where(
              and(
                eq(s.gradebookRecoveryRequest.assessmentId, item.id),
                eq(s.gradebookRecoveryRequest.studentId, entry.studentId),
                eq(s.gradebookRecoveryRequest.status, 'approved'),
              ),
            )
        )[0];
        if (
          !request?.extendedUntil ||
          today > request.extendedUntil ||
          semantic(request.originalValue) !== semantic(previous.value)
        )
          fail('აღდგენის ვადა ამოიწურა. საჭიროა მოსწავლის დამტკიცებული მოთხოვნა.', 'RECOVERY_LOCK');
      }
    }
  }
}
async function perform(
  tx: Transaction,
  v: Viewer,
  c: GradebookCommand,
  now: Date,
): Promise<{ id: string; revision: number }> {
  const today = schoolDateAt(now);
  if (c.action === 'policy.revise') {
    requireCapability(v, 'gradebook:policy');
    const semester = found(
      (await tx.select().from(s.semester).where(eq(s.semester.id, c.semesterId)))[0],
    );
    const ctx = await loadContext(tx, semester.yearId);
    found(
      ctx.offerings.find(
        (o) => o.id === c.offeringId && ctx.sections.some((sec) => sec.id === o.sectionId),
      ),
    );
    const latest = (
      await tx
        .select()
        .from(s.assessmentPolicyVersion)
        .where(
          and(
            eq(s.assessmentPolicyVersion.offeringId, c.offeringId),
            eq(s.assessmentPolicyVersion.semesterId, c.semesterId),
          ),
        )
        .orderBy(desc(s.assessmentPolicyVersion.revision))
    )[0];
    expectVersion(latest?.revision ?? 0, c.revision);
    const id = randomUUID(),
      revision = c.revision + 1;
    await tx.insert(s.assessmentPolicyVersion).values({
      id,
      offeringId: c.offeringId,
      semesterId: c.semesterId,
      revision,
      policy: c.policy,
      offeringMode: c.offeringMode,
      requiredSummatives: c.requiredSummatives,
      requirementBasis: c.requirementBasis,
      actorId: v.id,
      reason: c.reason,
    });
    return { id, revision };
  }
  if (c.action === 'criteria.revise') {
    requireCapability(v, 'gradebook:policy');
    found((await tx.select().from(s.subject).where(eq(s.subject.id, c.subjectId)))[0]);
    found((await tx.select().from(s.academicYear).where(eq(s.academicYear.id, c.yearId)))[0]);
    if (c.fileId) {
      const file = found(
        (await tx.select().from(s.fileMetadata).where(eq(s.fileMetadata.id, c.fileId)))[0],
      );
      if (
        file.status !== 'ready' ||
        file.ownerPersonId !== v.personId ||
        !file.objectKey.startsWith('criteria/')
      )
        fail('კრიტერიუმის ფაილი მიუწვდომელია.', 'FILE_SCOPE', 403);
    }
    const latest = (
      await tx
        .select()
        .from(s.assessmentCriteriaVersion)
        .where(
          and(
            eq(s.assessmentCriteriaVersion.subjectId, c.subjectId),
            eq(s.assessmentCriteriaVersion.yearId, c.yearId),
          ),
        )
        .orderBy(desc(s.assessmentCriteriaVersion.revision))
    )[0];
    expectVersion(latest?.revision ?? 0, c.revision);
    const id = randomUUID(),
      revision = c.revision + 1;
    await tx.insert(s.assessmentCriteriaVersion).values({
      id,
      revision,
      subjectId: c.subjectId,
      yearId: c.yearId,
      text: c.text,
      fileId: c.fileId,
      actorId: v.id,
      reason: c.reason,
    });
    return { id, revision };
  }
  if (c.action === 'assessment.create') {
    const data = await assessmentContext(tx, c.scope, c.semesterId, c.date);
    requireWriter(
      data.ctx,
      v,
      data.offers.map((o) => o.id),
      c.date,
      today,
    );
    if (!c.formative && data.policies.some((p) => !p.categories.includes(c.category)))
      fail('ამ კურსზე კატეგორია დაუშვებელია.', 'CATEGORY', 400);
    if (c.criteriaId) {
      const criteria = found(
        (
          await tx
            .select()
            .from(s.assessmentCriteriaVersion)
            .where(eq(s.assessmentCriteriaVersion.id, c.criteriaId))
        )[0],
      );
      if (
        c.category !== 'summative' ||
        criteria.subjectId !== data.offers[0]!.subjectId ||
        criteria.yearId !== data.ctx.year.id
      )
        fail('კრიტერიუმი ამ შეფასებას არ შეესაბამება.', 'CRITERIA', 400);
    }
    await validateOccurrence(tx, data, c.occurrenceId, c.date);
    const id = randomUUID();
    await tx.insert(s.gradebookAssessment).values({
      id,
      yearId: data.ctx.year.id,
      semesterId: c.semesterId,
      subjectId: data.offers[0]!.subjectId,
      teacherId: v.personId!,
      scope: c.scope,
      offeringIds: data.offers.map((o) => o.id),
      date: c.date,
      title: c.title,
      description: c.description,
      activity: c.activity,
      category: c.category,
      mode: c.formative ? 'formative_only' : data.policies[0]!.mode,
      criteriaId: c.criteriaId,
      occurrenceId: c.occurrenceId,
      policy: data.policies,
      roster: data.roster,
      entries: data.roster.map((r) => ({
        studentId: r.studentId,
        value: { kind: 'state', state: 'unassessed' },
      })),
      rosterToken: data.rosterToken,
      labels: {
        subject: found(data.ctx.subjects.find((s) => s.id === data.offers[0]!.subjectId)).name,
        teacher: found(data.ctx.people.find((p) => p.id === v.personId)).fullName,
        semester: data.semester.name,
        year: data.ctx.year.name,
      },
    });
    return { id, revision: 1 };
  }
  if (c.action.startsWith('assessment.') && 'id' in c && c.id) {
    const item = found(
      (await tx.select().from(s.gradebookAssessment).where(eq(s.gradebookAssessment.id, c.id)))[0],
    );
    if (!(corrector(v) && item.status !== 'draft')) {
      const access = await loadContext(tx, item.yearId);
      if (
        item.teacherId !== v.personId ||
        !item.offeringIds.every((id) => assignedForDetail(access, v, id, today))
      )
        fail('შეფასება ვერ მოიძებნა.', 'NOT_FOUND', 404);
    }
    if (item.status === 'void') fail('გაუქმებული შეფასების შეცვლა დაუშვებელია.');
    expectVersion(item.revision, c.revision);
    const revision = item.revision + 1;
    if (c.action === 'assessment.reconcile') {
      if (item.status !== 'draft') fail('გამოქვეყნებული სიის შეცვლა დაუშვებელია.');
      const data = await assessmentContext(tx, item.scope, item.semesterId, item.date);
      requireWriter(data.ctx, v, item.offeringIds, item.date, today);
      if (item.teacherId !== v.personId) fail('ეს მონახაზი პირადია.', 'FORBIDDEN', 403);
      if (c.rosterToken !== data.rosterToken)
        fail('სია ისევ შეიცვალა. განაახლეთ გადახედვა.', 'ROSTER_CONFLICT');
      const mode = item.mode === 'formative_only' ? item.mode : data.policies[0]!.mode;
      const next = { ...item, mode, roster: data.roster, policy: data.policies };
      const entries: GradebookEntry[] = data.roster.map((r) => {
        const old = item.entries.find((e) => e.studentId === r.studentId);
        if (old)
          try {
            const policy = found(data.policies.find((p) => r.offeringIds.includes(p.offeringId)));
            validateResult(
              {
                ...policy,
                mode,
                recoveryCalendarDays: policy.policy.recoveryCalendarDays,
                rounding: policy.policy.rounding,
              },
              item.category,
              old.value,
            );
            return old;
          } catch {
            /* Incompatible values remain visibly unresolved after explicit reconciliation. */
          }
        return { studentId: r.studentId, value: { kind: 'state', state: 'unassessed' } };
      });
      entriesFor(next, entries);
      await tx
        .update(s.gradebookAssessment)
        .set({
          revision,
          mode,
          roster: data.roster,
          policy: data.policies,
          rosterToken: data.rosterToken,
          entries,
        })
        .where(eq(s.gradebookAssessment.id, item.id));
      return { id: item.id, revision };
    }
    if (c.action === 'assessment.save' || c.action === 'assessment.publish') {
      if (item.status !== 'draft') fail('გამოქვეყნებული შეფასება შესწორებას საჭიროებს.');
      const data = await assessmentContext(tx, item.scope, item.semesterId, item.date);
      requireWriter(data.ctx, v, item.offeringIds, item.date, today);
      if (item.teacherId !== v.personId) fail('ეს მონახაზი პირადია.', 'FORBIDDEN', 403);
      if (data.rosterToken !== c.rosterToken || item.rosterToken !== c.rosterToken)
        fail('სია ან წესი შეიცვალა. შექმენით განახლებული მონახაზი.', 'ROSTER_CONFLICT');
      const entries = entriesFor(item, c.action === 'assessment.save' ? c.entries : item.entries);
      if (c.action === 'assessment.publish') {
        if (item.date > today) fail('მომავალი შეფასების გამოქვეყნება ჯერ დაუშვებელია.', 'FUTURE');
        await validateOccurrence(tx, data, item.occurrenceId, item.date);
        const labels = {
          ...item.labels,
          teacher: found(data.ctx.people.find((p) => p.id === v.personId)).fullName,
          subject: found(data.ctx.subjects.find((s) => s.id === item.subjectId)).name,
          semester: data.semester.name,
          year: data.ctx.year.name,
        };
        const after = {
          ...item,
          roster: data.roster,
          labels,
          entries,
          revision,
          status: 'published',
          publishedAt: now,
        };
        await history(tx, v, 'assessment', item.id, revision, 'publish', null, null, after);
        await tx
          .update(s.gradebookAssessment)
          .set({
            entries,
            roster: data.roster,
            labels,
            revision,
            status: 'published',
            publishedAt: now,
          })
          .where(eq(s.gradebookAssessment.id, item.id));
        await notify(
          tx,
          'published',
          item.id,
          revision,
          entries.map((e) => e.studentId),
        );
      } else
        await tx
          .update(s.gradebookAssessment)
          .set({ entries, revision })
          .where(eq(s.gradebookAssessment.id, item.id));
      return { id: item.id, revision };
    }
    if (
      c.action === 'assessment.correct' ||
      c.action === 'assessment.describe' ||
      c.action === 'assessment.void'
    ) {
      if (item.status !== 'published') fail('ჯერ გამოაქვეყნეთ შეფასება.');
      const entries =
        c.action === 'assessment.correct' ? entriesFor(item, c.entries) : item.entries;
      await assertTeacherCorrection(tx, v, item, entries, today, c.action !== 'assessment.correct');
      const patch =
        c.action === 'assessment.describe'
          ? { title: c.title, description: c.description, activity: c.activity }
          : c.action === 'assessment.void'
            ? { status: 'void' }
            : { entries };
      await history(tx, v, 'assessment', item.id, revision, c.action.slice(11), c.reason, item, {
        ...item,
        ...patch,
        revision,
      });
      await tx
        .update(s.gradebookAssessment)
        .set({ ...patch, revision })
        .where(eq(s.gradebookAssessment.id, item.id));
      // Resolve approved extensions only after the actual result is recorded, in the same transaction.
      if (c.action === 'assessment.correct')
        for (const e of entries.filter((e) => e.value.kind !== 'state')) {
          const requests = await tx
            .select()
            .from(s.gradebookRecoveryRequest)
            .where(
              and(
                eq(s.gradebookRecoveryRequest.assessmentId, item.id),
                eq(s.gradebookRecoveryRequest.studentId, e.studentId),
                inArray(s.gradebookRecoveryRequest.status, [
                  'submitted',
                  'follow_up',
                  'review',
                  'approved',
                ]),
              ),
            );
          for (const r of requests) {
            await history(tx, v, 'recovery', r.id, r.revision + 1, 'completed', c.reason, r, {
              ...r,
              revision: r.revision + 1,
              status: 'completed',
            });
            await tx
              .update(s.gradebookRecoveryRequest)
              .set({ status: 'completed', revision: r.revision + 1 })
              .where(eq(s.gradebookRecoveryRequest.id, r.id));
          }
        }
      await notify(
        tx,
        'corrected',
        item.id,
        revision,
        entries
          .filter(
            (e) =>
              c.action !== 'assessment.correct' ||
              semantic(e.value) !==
                semantic(item.entries.find((old) => old.studentId === e.studentId)!.value),
          )
          .map((e) => e.studentId),
      );
      return { id: item.id, revision };
    }
  }
  if (c.action === 'recovery.request' || c.action === 'recovery.decide')
    return recoveryAction(tx, v, c, now);
  if (c.action === 'writing.save' || c.action === 'writing.publish')
    return writingAction(tx, v, c, now);
  fail('ეს მოქმედება ჯერ მიუწვდომელია.', 'NOT_IMPLEMENTED', 400);
}
export async function changeGradebook(
  v: Viewer,
  requestId: string,
  input: GradebookCommand,
  now = new Date(),
) {
  const command = gradebookCommand.parse(input);
  requireReader(v);
  const allowed =
    command.action === 'policy.revise' || command.action === 'criteria.revise'
      ? v.capabilities.includes('gradebook:policy')
      : command.action === 'recovery.request'
        ? v.capabilities.includes('gradebook:self')
        : command.action === 'recovery.decide'
          ? corrector(v)
          : command.action.startsWith('writing.')
            ? v.capabilities.includes('gradebook:own') ||
              v.capabilities.includes('gradebook:homeroom') ||
              corrector(v)
            : v.capabilities.includes('gradebook:own') ||
              (corrector(v) &&
                ['assessment.correct', 'assessment.describe', 'assessment.void'].includes(
                  command.action,
                ));
  if (!allowed) fail('ამ მოქმედების უფლება არ გაქვთ.', 'FORBIDDEN', 403);
  return administration(async (tx) => {
    const key = fingerprint(semantic(command));
    const replay = (
      await tx
        .select()
        .from(s.gradebookCommandReceipt)
        .where(eq(s.gradebookCommandReceipt.id, command.commandId))
    )[0];
    if (replay) {
      if (replay.actorId !== v.id || replay.fingerprint !== key)
        fail('მოთხოვნის იდენტიფიკატორი უკვე გამოყენებულია.', 'COMMAND_REUSED');
      return replay.result;
    }
    const result = await perform(tx, v, command, now);
    await tx
      .insert(s.gradebookCommandReceipt)
      .values({ id: command.commandId, actorId: v.id, fingerprint: key, result });
    await audit(tx, v, requestId, `gradebook.${command.action}`, 'gradebook', result.id, {
      revision: result.revision,
    });
    return result;
  });
}
export async function assessmentDetail(v: Viewer, id: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const item = found(
      (await tx.select().from(s.gradebookAssessment).where(eq(s.gradebookAssessment.id, id)))[0],
    );
    const ids = await visiblePupils(tx, v, item, now);
    if (!ids.length) fail('ჩანაწერი ვერ მოიძებნა.', 'NOT_FOUND', 404);
    const ctxForDetail = await loadContext(tx, item.yearId);
    const currentDraft =
      item.status === 'draft'
        ? await assessmentContext(tx, item.scope, item.semesterId, item.date)
        : null;
    const recoveryRequests =
      item.category === 'summative' && item.status === 'published'
        ? await tx
            .select()
            .from(s.gradebookRecoveryRequest)
            .where(
              and(
                eq(s.gradebookRecoveryRequest.assessmentId, item.id),
                inArray(s.gradebookRecoveryRequest.studentId, ids),
              ),
            )
            .orderBy(desc(s.gradebookRecoveryRequest.createdAt))
        : [];
    const canEdit =
      item.status !== 'void' &&
      (corrector(v) ||
        (item.teacherId === v.personId &&
          item.offeringIds.every(
            (id) =>
              assignedForDetail(ctxForDetail, v, id, schoolDateAt(now)) &&
              assignedForDetail(ctxForDetail, v, id, item.date),
          )));
    // Explicit public projection excludes draft tokens, command actors and internal correction reasons.
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
      roster: item.roster
        .filter((r) => ids.includes(r.studentId))
        .map((r) => ({
          studentId: r.studentId,
          name: r.name,
          number: r.number,
          section: r.section,
          recovery: (() => {
            if (item.category !== 'summative' || item.status !== 'published') return null;
            const entry = item.entries.find((e) => e.studentId === r.studentId)!;
            const deadline = recoveryDeadline(
              item.date,
              Math.min(
                ...item.policy
                  .filter((p) => r.offeringIds.includes(p.offeringId))
                  .map((p) => p.policy.recoveryCalendarDays),
              ),
            );
            const request = recoveryRequests.find((q) => q.studentId === r.studentId);
            const missing = entry.value.kind === 'state' && entry.value.state !== 'exempt';
            const pending =
              request &&
              (['submitted', 'follow_up', 'review'].includes(request.status) ||
                (request.status === 'approved' &&
                  !!request.extendedUntil &&
                  schoolDateAt(now) <= request.extendedUntil));
            return {
              deadline,
              missing,
              requestStatus: request?.status ?? null,
              extendedUntil: request?.extendedUntil ?? null,
              canRequest:
                v.capabilities.includes('gradebook:self') &&
                missing &&
                schoolDateAt(now) > deadline &&
                !pending,
            };
          })(),
          canEdit:
            canEdit &&
            (corrector(v) ||
              item.status === 'draft' ||
              r.offeringIds.some((id) =>
                groupStudents(ctxForDetail, offeringGroup(id), schoolDateAt(now)).includes(
                  r.studentId,
                ),
              )),
        })),
      entries: item.entries.filter((e) => ids.includes(e.studentId)),
      canEdit,
      rosterToken: item.status === 'draft' ? item.rosterToken : null,
      reconciliation:
        currentDraft && currentDraft.rosterToken !== item.rosterToken
          ? {
              rosterToken: currentDraft.rosterToken,
              roster: currentDraft.roster.map((r) => ({ studentId: r.studentId, name: r.name })),
              policyChanged: currentDraft.policies.some(
                (p) => !item.policy.some((old) => old.policyId === p.policyId),
              ),
            }
          : null,
    };
  });
}
