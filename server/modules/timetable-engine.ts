import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import * as s from '../db/schema.js';
import type {
  TimetableDocument,
  TimetableConflict,
  Occurrence,
  LessonChange,
  TeachingGroup,
} from '../../shared/timetable.js';
import { fail, type Transaction } from './operations.js';
export type Version = typeof s.timetableVersion.$inferSelect;
export const fingerprint = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const addDays = (date: string, n: number) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
export const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
export const contains = (r: { startsOn: string; endsOn: string | null }, date: string) =>
  r.startsOn <= date && (!r.endsOn || date < r.endsOn);
export function dates(start: string, end: string) {
  const result: string[] = [];
  for (let d = start; d < end; d = addDays(d, 1)) {
    if (result.length >= 370) fail('პერიოდი ზედმეტად გრძელია.', 'RANGE', 400);
    result.push(d);
  }
  return result;
}
export async function loadContext(tx: Transaction, yearId: string) {
  const [
    years,
    sections,
    offerings,
    subjects,
    enrollments,
    memberships,
    assignments,
    people,
    staff,
    users,
    rooms,
    availability,
    calendar,
    students,
  ] = await Promise.all([
    tx.select().from(s.academicYear).where(eq(s.academicYear.id, yearId)),
    tx.select().from(s.section).where(eq(s.section.yearId, yearId)),
    tx.select().from(s.courseOffering),
    tx.select().from(s.subject),
    tx.select().from(s.enrollment),
    tx.select().from(s.courseMembership),
    tx.select().from(s.teachingAssignment),
    tx.select().from(s.person),
    tx.select().from(s.staff),
    tx.select({ id: s.user.id, disabled: s.user.disabled }).from(s.user),
    tx.select().from(s.timetableRoom),
    tx.select().from(s.timetableAvailability),
    tx.select().from(s.calendarEvent).where(eq(s.calendarEvent.yearId, yearId)),
    tx.select().from(s.student),
  ]);
  const year = years[0];
  if (!year) fail('სასწავლო წელი ვერ მოიძებნა.', 'NOT_FOUND', 404);
  return {
    year,
    sections,
    offerings,
    subjects,
    enrollments,
    memberships,
    assignments,
    people,
    staff,
    users,
    rooms,
    availability,
    calendar,
    students,
  };
}
export type Context = Awaited<ReturnType<typeof loadContext>>;
export function labelsFor(ctx: Context) {
  return Object.fromEntries([
    ...ctx.sections.map((x) => [x.id, x.name]),
    ...ctx.subjects.map((x) => [x.id, x.name]),
    ...ctx.people.map((x) => [x.id, x.fullName]),
    ...ctx.rooms.map((x) => [x.id, x.number]),
  ]);
}
export function groupStudents(ctx: Context, group: TeachingGroup, date: string): string[] {
  const ids = new Set<string>();
  for (const source of group.sources) {
    const offer = ctx.offerings.find((o) => o.id === source.offeringId);
    if (!offer || !contains(offer, date)) continue;
    for (const e of ctx.enrollments) {
      if (
        e.sectionId !== offer.sectionId ||
        !contains(e, date) ||
        (source.studentIds && !source.studentIds.includes(e.studentId))
      )
        continue;
      if (
        offer.elective &&
        !ctx.memberships.some(
          (m) => m.offeringId === offer.id && m.studentId === e.studentId && contains(m, date),
        )
      )
        continue;
      ids.add(e.studentId);
    }
  }
  return [...ids].sort();
}
export function activeStaff(ctx: Context, id: string, date: string) {
  const person = ctx.people.find((p) => p.id === id),
    staff = ctx.staff.find((s) => s.personId === id);
  return !!(
    person &&
    !person.archivedAt &&
    staff &&
    contains(staff, date) &&
    (!person.userId || !ctx.users.find((u) => u.id === person.userId)?.disabled)
  );
}
export function validateDocument(ctx: Context, doc: TimetableDocument, start: string, end: string) {
  if (start < ctx.year.startsOn || end > ctx.year.endsOn || end <= start)
    fail('ვერსიის პერიოდი სასწავლო წლის ფარგლებში უნდა იყოს.');
  for (const list of [doc.periods, doc.groups, doc.lessons])
    if (new Set(list.map((x) => x.id)).size !== list.length) fail('იდენტიფიკატორი განმეორებულია.');
  if (new Set(doc.periods.map((p) => p.number)).size !== doc.periods.length)
    fail('პერიოდის ნომერი განმეორებულია.');
  for (const p of doc.periods) {
    if (p.end <= p.start) fail('გაკვეთილის დასრულება დაწყების შემდეგ უნდა იყოს.');
    for (const q of doc.periods) {
      if (
        p.id !== q.id &&
        p.weekdays.some((d) => q.weekdays.includes(d)) &&
        p.start < q.end &&
        q.start < p.end
      )
        fail('ზარის პერიოდები ერთმანეთს ფარავს.');
    }
  }
  for (const g of doc.groups) {
    const offers = g.sources.map((src) => ctx.offerings.find((o) => o.id === src.offeringId));
    if (offers.some((o) => !o || !ctx.sections.some((sec) => sec.id === o.sectionId)))
      fail('ჯგუფის კურსი ამ სასწავლო წელს არ ეკუთვნის.');
    if (new Set(offers.map((o) => o!.subjectId)).size !== 1)
      fail('გაერთიანებულ ჯგუფს ერთი საგნის კურსები უნდა ჰქონდეს.');
    for (const src of g.sources) {
      if (src.studentIds?.some((id) => !ctx.students.some((s) => s.id === id)))
        fail('ჯგუფის მოსწავლე ვერ მოიძებნა.');
    }
  }
  for (const l of doc.lessons) {
    const p = doc.periods.find((p) => p.id === l.periodId);
    if (!p || !p.teaching || !p.weekdays.includes(l.weekday))
      fail('არჩეული პერიოდი სასწავლო გაკვეთილისთვის მიუწვდომელია.');
    if (
      !doc.groups.some((g) => g.id === l.groupId) ||
      !ctx.rooms.some((r) => r.id === l.roomId) ||
      !ctx.staff.some((t) => t.personId === l.teacherId)
    )
      fail('შეამოწმეთ ჯგუფი, ოთახი და თანამშრომელი.');
  }
}
export type InternalOccurrence = Occurrence & {
  studentIds: string[];
  document: TimetableDocument;
  substitute: boolean;
  labels: Record<string, string>;
};
export function occurrence(
  ctx: Context,
  v: Version,
  lessonId: string,
  date: string,
  change?: LessonChange,
  revision?: string,
  labels?: Record<string, string>,
): InternalOccurrence | null {
  const l = v.document.lessons.find((l) => l.id === lessonId);
  if (!l) return null;
  const period = v.document.periods.find((p) => p.id === (change?.periodId ?? l.periodId));
  const group = v.document.groups.find((g) => g.id === (change?.groupId ?? l.groupId));
  if (!period || !group) return null;
  const targetDate = change?.targetDate ?? date;
  const offerings = group.sources
    .map((src) => ctx.offerings.find((o) => o.id === src.offeringId))
    .filter((o) => !!o);
  const sections = ctx.sections.filter((s) => offerings.some((o) => o.sectionId === s.id));
  const holiday = ctx.calendar.some(
    (c) =>
      c.kind !== 'milestone' &&
      contains(c, targetDate) &&
      sections.some((s) => s.gradeLevel >= c.gradeFrom && s.gradeLevel <= c.gradeTo),
  );
  const exceptional = change?.exceptionalDay ?? false;
  if (!change && (weekday(date) !== l.weekday || !period.weekdays.includes(weekday(date))))
    return null;
  if ((holiday || weekday(targetDate) === 0 || weekday(targetDate) === 6) && !exceptional)
    return null;
  const teacherId = change?.teacherId ?? l.teacherId,
    roomId = change?.roomId ?? l.roomId;
  const names = labels ?? v.labels;
  return {
    id: `${v.id}:${l.id}:${date}`,
    revision: revision ?? fingerprint([v.id, v.revision, l, date]),
    versionId: v.id,
    lessonId: l.id,
    date,
    targetDate,
    periodId: period.id,
    number: period.number,
    start: change?.start ?? period.start,
    end: change?.end ?? period.end,
    groupId: group.id,
    group: group.name,
    subject: names[offerings[0]?.subjectId ?? ''] ?? 'საგანი',
    teacherId,
    teacher: names[teacherId] ?? 'მასწავლებელი',
    roomId,
    room: names[roomId] ?? '—',
    sectionIds: sections.map((s) => s.id),
    studentIds: groupStudents(ctx, group, targetDate),
    cancelled: change?.cancelled ?? false,
    changed: !!change,
    exceptionalDay: exceptional,
    document: v.document,
    substitute: teacherId !== l.teacherId,
    labels: names,
  };
}
export function effectiveVersion(versions: Version[], date: string) {
  return versions
    .filter((v) => contains(v, date))
    .sort((a, b) => b.startsOn.localeCompare(a.startsOn))[0];
}
export function resolveRange(
  ctx: Context,
  versions: Version[],
  exceptions: (typeof s.timetableException.$inferSelect)[],
  start: string,
  end: string,
): InternalOccurrence[] {
  const result = new Map<string, InternalOccurrence>();
  const latest = new Map<string, (typeof exceptions)[number]>();
  for (const e of [...exceptions].sort((a, b) => a.sequence - b.sequence))
    latest.set(`${e.versionId}:${e.lessonId}:${e.date}`, e);
  for (const date of dates(start, end)) {
    const v = effectiveVersion(versions, date);
    if (!v) continue;
    for (const l of v.document.lessons) {
      const key = `${v.id}:${l.id}:${date}`;
      const ex = latest.get(key);
      const o = occurrence(ctx, v, l.id, date, ex?.change, ex?.id, ex?.labels);
      if (o && o.targetDate >= start && o.targetDate < end) result.set(o.id, o);
    }
  }
  for (const e of latest.values()) {
    if (
      e.targetDate < start ||
      e.targetDate >= end ||
      effectiveVersion(versions, e.date)?.id !== e.versionId
    )
      continue;
    const v = versions.find((v) => v.id === e.versionId);
    if (!v) continue;
    const o = occurrence(ctx, v, e.lessonId, e.date, e.change, e.id, e.labels);
    if (o) result.set(o.id, o);
  }
  return [...result.values()].sort(
    (a, b) =>
      a.targetDate.localeCompare(b.targetDate) ||
      a.start.localeCompare(b.start) ||
      a.id.localeCompare(b.id),
  );
}
export function conflictsFor(ctx: Context, occurrences: InternalOccurrence[]): TimetableConflict[] {
  const conflicts: TimetableConflict[] = [];
  const add = (
    kind: TimetableConflict['kind'],
    date: string,
    lessons: InternalOccurrence[],
    message: string,
    detail: unknown,
    overridable = true,
  ) => {
    const lessonIds = lessons.map((l) => l.id).sort();
    conflicts.push({
      key: fingerprint([
        kind,
        date,
        lessonIds,
        lessons.map((l) => [
          l.teacherId,
          l.roomId,
          l.groupId,
          l.studentIds,
          l.start,
          l.end,
          l.periodId,
        ]),
        detail,
      ]),
      kind,
      date,
      lessonIds,
      message,
      overridable,
    });
  };
  const active = occurrences
    .filter((o) => !o.cancelled)
    .sort((a, b) => a.targetDate.localeCompare(b.targetDate));
  for (const o of active) {
    const group = o.document.groups.find((g) => g.id === o.groupId)!;
    if (!activeStaff(ctx, o.teacherId, o.targetDate))
      add(
        'domain',
        o.targetDate,
        [o],
        'მასწავლებელი ამ თარიღში აქტიური არ არის.',
        o.teacherId,
        false,
      );
    for (const source of group.sources) {
      const offer = ctx.offerings.find((x) => x.id === source.offeringId);
      if (!offer || !contains(offer, o.targetDate))
        add(
          'domain',
          o.targetDate,
          [o],
          'კურსის მოქმედების პერიოდი არ ემთხვევა.',
          source.offeringId,
          false,
        );
      if (
        !o.substitute &&
        !ctx.assignments.some(
          (a) =>
            a.staffPersonId === o.teacherId &&
            a.offeringId === source.offeringId &&
            contains(a, o.targetDate),
        )
      )
        add(
          'domain',
          o.targetDate,
          [o],
          'კურსზე მოქმედი სასწავლო დანიშვნა საჭიროა.',
          source.offeringId,
          false,
        );
    }
    if (!o.studentIds.length)
      add(
        'domain',
        o.targetDate,
        [o],
        'ჯგუფს ამ თარიღში მოქმედი მოსწავლეები არ ჰყავს.',
        o.groupId,
        false,
      );
    for (const a of ctx.availability) {
      if (
        a.teacherId === o.teacherId &&
        contains(a, o.targetDate) &&
        (!a.weekdays || a.weekdays.includes(weekday(o.targetDate))) &&
        (!a.periodNumbers.length || a.periodNumbers.includes(o.number))
      )
        add('availability', o.targetDate, [o], 'მასწავლებელი მიუწვდომელია.', [a.id, a.revision]);
    }
  }
  for (let i = 0; i < active.length; i++) {
    const a = active[i]!;
    for (let j = i + 1; j < active.length; j++) {
      const b = active[j]!;
      if (a.targetDate !== b.targetDate) break;
      if (a.targetDate !== b.targetDate || a.start >= b.end || b.start >= a.end || a.id === b.id)
        continue;
      if (a.teacherId === b.teacherId)
        add(
          'teacher',
          a.targetDate,
          [a, b],
          'მასწავლებელს ერთდროული გაკვეთილები აქვს.',
          a.teacherId,
        );
      if (a.roomId === b.roomId)
        add('room', a.targetDate, [a, b], 'ოთახი უკვე დაკავებულია.', a.roomId);
      const shared = a.studentIds.filter((s) => b.studentIds.includes(s));
      if (shared.length)
        add(
          'student',
          a.targetDate,
          [a, b],
          `${shared.length} მოსწავლეს ერთდროული გაკვეთილები აქვს.`,
          shared,
        );
    }
  }
  return conflicts;
}
export function checkOverrides(
  conflicts: TimetableConflict[],
  overrides: { key: string; reason: string }[],
) {
  if (
    conflicts.some(
      (c) =>
        !c.overridable || !overrides.some((o) => o.key === c.key && o.reason.trim().length >= 8),
    )
  )
    fail(
      'კონფლიქტები გადასაწყვეტია. განაახლეთ შემოწმება და მიუთითეთ ზუსტი გამონაკლისების მიზეზი.',
      'TIMETABLE_CONFLICT',
    );
  if (overrides.some((o) => !conflicts.some((c) => c.key === o.key)))
    fail('კონფლიქტის დადასტურება მოძველდა. შეამოწმეთ თავიდან.', 'STALE_OVERRIDE');
}
export function publicOccurrence(o: InternalOccurrence): Occurrence {
  const {
    id,
    revision,
    versionId,
    lessonId,
    date,
    targetDate,
    periodId,
    number,
    start,
    end,
    groupId,
    group,
    subject,
    teacherId,
    teacher,
    roomId,
    room,
    sectionIds,
    cancelled,
    changed,
    exceptionalDay,
  } = o;
  return {
    id,
    revision,
    versionId,
    lessonId,
    date,
    targetDate,
    periodId,
    number,
    start,
    end,
    groupId,
    group,
    subject,
    teacherId,
    teacher,
    roomId,
    room,
    sectionIds,
    cancelled,
    changed,
    exceptionalDay,
  };
}
