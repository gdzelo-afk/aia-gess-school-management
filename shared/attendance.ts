import { z } from 'zod';
import { dateOnly } from './stage1a.js';
import type { Occurrence } from './timetable.js';

export const attendanceLabels = {
  present: 'ესწრება',
  absent: 'არ ესწრება',
  late: 'დაგვიანება',
  authorized: 'საპატიო გაცდენა',
} as const;
export type AttendanceStatus = keyof typeof attendanceLabels;
export const attendanceTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const reason = z.string().trim().min(5).max(600);
export const attendanceEntry = z
  .object({
    studentId: z.uuid(),
    status: z.enum(['present', 'absent', 'late', 'authorized']),
    arrival: attendanceTime.nullable(),
    departure: attendanceTime.nullable(),
    timeSource: z.enum(['reported', 'estimated']).default('reported'),
  })
  .strict()
  .superRefine((v, ctx) => {
    if ((v.status === 'late') !== (v.arrival !== null))
      ctx.addIssue({
        code: 'custom',
        path: ['arrival'],
        message: 'დაგვიანების დრო აუცილებელია მხოლოდ დაგვიანებისას.',
      });
    if (v.departure && !['present', 'late'].includes(v.status))
      ctx.addIssue({
        code: 'custom',
        path: ['departure'],
        message: 'გასვლის დრო მხოლოდ დამსწრე მოსწავლეს მიეთითება.',
      });
  });
export type AttendanceEntry = z.infer<typeof attendanceEntry>;
export const occurrenceId = z.string().regex(/^[a-f0-9-]{36}:[a-f0-9-]{36}:\d{4}-\d{2}-\d{2}$/);
export const rollCallInput = z
  .object({
    occurrenceId,
    expectedToken: z.string().length(64),
    revision: z.number().int().min(0),
    entries: z.array(attendanceEntry).min(1).max(400),
    reason: reason.optional(),
    reconcileRoster: z.boolean().default(false),
  })
  .strict();
export type RollCallInput = z.infer<typeof rollCallInput>;
export const attendanceCommand = z.discriminatedUnion('action', [
  z.object({ action: z.literal('submit'), commandId: z.uuid(), ...rollCallInput.shape }).strict(),
  z
    .object({
      action: z.literal('explanation.create'),
      commandId: z.uuid(),
      studentId: z.uuid(),
      startsOn: dateOnly,
      endsOn: dateOnly,
      reason,
    })
    .strict(),
  z
    .object({
      action: z.literal('explanation.decide'),
      commandId: z.uuid(),
      id: z.uuid(),
      revision: z.number().int().positive(),
      approve: z.boolean(),
      reason,
    })
    .strict(),
  z
    .object({
      action: z.literal('request.create'),
      commandId: z.uuid(),
      proposal: rollCallInput,
      reason,
    })
    .strict(),
  z
    .object({
      action: z.literal('request.decide'),
      commandId: z.uuid(),
      id: z.uuid(),
      revision: z.number().int().positive(),
      approve: z.boolean(),
      reason,
      proposal: rollCallInput.optional(),
    })
    .strict(),
]);
export type AttendanceCommand = z.infer<typeof attendanceCommand>;
export interface AttendanceParticipant {
  studentId: string;
  name: string;
  number: string;
}
export interface AttendanceSnapshot {
  /** Stable subject/year identity and effective duration for future annual subject analytics. */
  academic?: { yearId: string; subjectId: string; instructionalMinutes: number };
  occurrence: Occurrence;
  roster: AttendanceParticipant[];
}
export interface AttendanceState {
  snapshot: AttendanceSnapshot;
  entries: AttendanceEntry[];
}

/** School timestamps use the configured IANA zone, including historical offset handling. */
export function schoolInstant(date: string, time: string): number {
  const guess = Date.parse(`${date}T${time}:00Z`);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tbilisi',
    timeZoneName: 'longOffset',
  }).formatToParts(guess);
  const offset = parts.find((p) => p.type === 'timeZoneName')!.value;
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(offset);
  if (!match) throw new Error('Unsupported school timezone offset');
  return guess - (match[1] === '+' ? 1 : -1) * (Number(match[2]) * 60 + Number(match[3])) * 60000;
}
export function schoolDateAt(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tbilisi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
export function attendanceWindow(o: Occurrence, now: Date) {
  const start = schoolInstant(o.targetDate, o.start),
    end = schoolInstant(o.targetDate, o.end);
  return {
    started: now.getTime() >= start,
    overdue: now.getTime() > start + 15 * 60000,
    locked: now.getTime() >= end + 24 * 3600000,
    startsAt: new Date(start).toISOString(),
    locksAt: new Date(end + 24 * 3600000).toISOString(),
  };
}
export function approximateLateness(start: string, arrival: string) {
  const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  return Math.max(0, minutes(arrival) - minutes(start));
}
export function attendanceSummary(entries: AttendanceEntry[], expected: number) {
  const counts = { present: 0, absent: 0, late: 0, authorized: 0, early: 0 };
  for (const e of entries) {
    counts[e.status]++;
    if (e.departure) counts.early++;
  }
  const finalized = entries.length,
    missing = Math.max(0, expected - finalized),
    missed = counts.absent + counts.authorized;
  return {
    ...counts,
    expected,
    finalized,
    missing,
    percentage: finalized
      ? Math.round(((counts.present + counts.late) / finalized) * 1000) / 10
      : null,
    provisional: missing > 0,
    state: missing
      ? 'incomplete'
      : !expected
        ? 'no_lessons'
        : missed === 0
          ? 'present'
          : missed === expected
            ? 'absent'
            : 'partial',
  };
}
