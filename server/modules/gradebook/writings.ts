import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import * as s from '../../db/schema.js';
import type { Viewer } from '../../../shared/contracts.js';
import { schoolDateAt } from '../../../shared/attendance.js';
import type { GradebookCommand } from '../../../shared/gradebook.js';
import { expectVersion, fail, found, type Transaction } from '../operations.js';
import { groupStudents, loadContext } from '../timetable-engine.js';
import {
  corrector,
  familyIds,
  homeroomIds,
  offeringGroup,
  requireWriter,
  schoolReader,
} from './context.js';
import { history, notify } from './common.js';

type Writing = typeof s.gradebookWriting.$inferSelect;
type Command = Extract<GradebookCommand, { action: 'writing.save' | 'writing.publish' }>;
async function permission(
  tx: Transaction,
  v: Viewer,
  item: Pick<Writing, 'kind' | 'yearId' | 'offeringId' | 'studentId'>,
  today: string,
) {
  const ctx = await loadContext(tx, item.yearId);
  if (item.kind === 'homeroom_note') {
    if (item.offeringId || !homeroomIds(ctx, v, today).includes(item.studentId))
      fail('ზოგადი კომენტარი მხოლოდ საკუთარი კლასის დამრიგებელს შეუძლია.', 'FORBIDDEN', 403);
  } else {
    if (!item.offeringId) fail('აირჩიეთ საგნის კურსი.', 'OFFERING', 400);
    requireWriter(ctx, v, [item.offeringId], today, today);
    if (!groupStudents(ctx, offeringGroup(item.offeringId), today).includes(item.studentId))
      fail('მოსწავლე კურსის მოქმედ სიაში არ არის.', 'TRANSFER_LOCK');
  }
  return ctx;
}
export async function writingAction(tx: Transaction, v: Viewer, c: Command, now: Date) {
  const today = schoolDateAt(now);
  const old = c.id
    ? found((await tx.select().from(s.gradebookWriting).where(eq(s.gradebookWriting.id, c.id)))[0])
    : null;
  if (old) {
    if (!(corrector(v) && old.status !== 'draft') && old.teacherId !== v.personId)
      fail('ჩანაწერი ვერ მოიძებნა.', 'NOT_FOUND', 404);
    if (old.status === 'void') fail('გაუქმებული ჩანაწერი აღარ იცვლება.');
    if (
      c.action === 'writing.save' &&
      (c.kind !== old.kind ||
        c.yearId !== old.yearId ||
        c.studentId !== old.studentId ||
        c.offeringId !== old.offeringId)
    )
      fail('ჩანაწერის აკადემიური კავშირი უცვლელია.', 'IDENTITY');
    if (old.status === 'draft' || !corrector(v)) {
      if (old.teacherId !== v.personId)
        fail('სხვისი ჩანაწერის შეცვლა დაუშვებელია.', 'FORBIDDEN', 403);
      await permission(tx, v, old, today);
    }
  }
  if (old) expectVersion(old.revision, c.revision);
  if (c.action === 'writing.publish') {
    if (!old || old.status !== 'draft') fail('მონახაზი უკვე გამოქვეყნებულია.');
    const revision = old.revision + 1;
    await history(tx, v, 'writing', old.id, revision, 'publish', null, null, {
      ...old,
      revision,
      status: 'published',
      publishedAt: now,
    });
    await tx
      .update(s.gradebookWriting)
      .set({ revision, status: 'published', publishedAt: now })
      .where(eq(s.gradebookWriting.id, old.id));
    await notify(tx, old.kind, old.id, revision, [old.studentId]);
    return { id: old.id, revision };
  }
  if (!old) {
    expectVersion(0, c.revision);
    const ctx = await permission(tx, v, c, today);
    const student = found(ctx.students.find((st) => st.id === c.studentId));
    const person = found(ctx.people.find((p) => p.id === student.personId));
    if (person.archivedAt) fail('დაარქივებული მოსწავლის ახალი ჩანაწერი დაუშვებელია.');
    const subject = c.offeringId
      ? found(
          ctx.subjects.find(
            (s) => s.id === found(ctx.offerings.find((o) => o.id === c.offeringId)).subjectId,
          ),
        ).name
      : null;
    const id = randomUUID();
    await tx.insert(s.gradebookWriting).values({
      id,
      kind: c.kind,
      yearId: c.yearId,
      offeringId: c.offeringId,
      studentId: c.studentId,
      teacherId: v.personId!,
      body: c.body,
      snapshot: {
        student: person.fullName,
        number: student.number,
        subject,
        teacher: v.name,
        year: ctx.year.name,
      },
    });
    return { id, revision: 1 };
  }
  const revision = old.revision + 1;
  if (old.status === 'published') {
    if (!c.reason) fail('გამოქვეყნებული ჩანაწერის შესწორებას მიზეზი სჭირდება.', 'REASON', 400);
    await history(tx, v, 'writing', old.id, revision, 'correct', c.reason, old, {
      ...old,
      revision,
      body: c.body,
    });
  }
  await tx
    .update(s.gradebookWriting)
    .set({ body: c.body, revision })
    .where(eq(s.gradebookWriting.id, old.id));
  if (old.status === 'published') await notify(tx, old.kind, old.id, revision, [old.studentId]);
  return { id: old.id, revision };
}
export async function canReadWriting(tx: Transaction, v: Viewer, item: Writing, now: Date) {
  const today = schoolDateAt(now),
    ctx = await loadContext(tx, item.yearId);
  if (item.teacherId === v.personId) {
    try {
      await permission(tx, v, item, today);
      return true;
    } catch {
      /* A former assignment grants no current private access. */
    }
  }
  if (item.status !== 'published') return false;
  if (item.kind !== 'narrative')
    return corrector(v) || (await familyIds(tx, v, today, true)).includes(item.studentId);
  return (
    schoolReader(v) ||
    homeroomIds(ctx, v, today).includes(item.studentId) ||
    (await familyIds(tx, v, today)).includes(item.studentId)
  );
}

export async function canEditWriting(tx: Transaction, v: Viewer, item: Writing, now: Date) {
  if (item.status === 'void') return false;
  if (corrector(v) && item.status === 'published') return true;
  if (item.teacherId !== v.personId) return false;
  try {
    await permission(tx, v, item, schoolDateAt(now));
    return true;
  } catch {
    return false;
  }
}
