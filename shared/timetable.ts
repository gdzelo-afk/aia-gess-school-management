import { z } from 'zod';
import { dateOnly } from './stage1a.js';
const id = z.uuid();
const label = z.string().trim().min(2).max(120);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const weekdays = z.array(z.number().int().min(1).max(5)).min(1).max(5);
export const bellSchema = z
  .object({
    id,
    number: z.number().int().min(1).max(12),
    start: time,
    end: time,
    weekdays,
    teaching: z.boolean(),
  })
  .strict();
export const groupSchema = z
  .object({
    id,
    name: label,
    sources: z
      .array(z.object({ offeringId: id, studentIds: z.array(id).max(200).nullable() }).strict())
      .min(1)
      .max(12),
  })
  .strict();
export const lessonSchema = z
  .object({
    id,
    groupId: id,
    teacherId: id,
    roomId: id,
    weekday: z.number().int().min(1).max(5),
    periodId: id,
  })
  .strict();
export const documentSchema = z
  .object({
    periods: z.array(bellSchema).max(12),
    groups: z.array(groupSchema).max(120),
    lessons: z.array(lessonSchema).max(800),
  })
  .strict();
export type Bell = z.infer<typeof bellSchema>;
export type TeachingGroup = z.infer<typeof groupSchema>;
export type Lesson = z.infer<typeof lessonSchema>;
export type TimetableDocument = z.infer<typeof documentSchema>;
export const exceptionSchema = z
  .object({
    date: dateOnly,
    occurrenceId: z.string().max(150),
    expectedRevision: z.string().min(1).max(64),
    cancelled: z.boolean(),
    teacherId: id,
    roomId: id,
    groupId: id,
    periodId: id,
    start: time,
    end: time,
    targetDate: dateOnly,
    exceptionalDay: z.boolean(),
  })
  .strict();
export type LessonChange = z.infer<typeof exceptionSchema>;
export const availabilitySchema = z
  .object({
    teacherId: id,
    startsOn: dateOnly,
    endsOn: dateOnly,
    weekdays: weekdays.nullable(),
    periodNumbers: z.array(z.number().int().min(1).max(12)).max(12),
  })
  .strict();
export type Availability = z.infer<typeof availabilitySchema>;
const reason = z.string().trim().min(8).max(1000);
const revision = z.number().int().positive();
export const timetableCommand = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('draft.create'),
      yearId: id,
      name: label,
      startsOn: dateOnly,
      endsOn: dateOnly,
      copyId: id.optional(),
    })
    .strict(),
  z.object({ action: z.literal('draft.save'), id, revision, document: documentSchema }).strict(),
  z
    .object({
      action: z.literal('draft.publish'),
      id,
      revision,
      overrides: z.array(z.object({ key: z.string().length(64), reason }).strict()).max(2000),
    })
    .strict(),
  z.object({ action: z.literal('room.create'), number: z.string().regex(/^\d{1,6}$/) }).strict(),
  z
    .object({ action: z.literal('availability.create'), availability: availabilitySchema, reason })
    .strict(),
  z
    .object({ action: z.literal('availability.end'), id, revision, endsOn: dateOnly, reason })
    .strict(),
  z
    .object({
      action: z.literal('exception.apply'),
      changes: z.array(exceptionSchema).min(1).max(30),
      reason,
      overrides: z.array(z.object({ key: z.string().length(64), reason }).strict()).max(300),
    })
    .strict(),
  z
    .object({
      action: z.literal('request.create'),
      changes: z.array(exceptionSchema).max(30),
      absence: availabilitySchema.nullable(),
      reason,
    })
    .strict(),
  z
    .object({
      action: z.literal('request.decide'),
      id,
      revision,
      approve: z.boolean(),
      reason,
      changes: z.array(exceptionSchema).max(30),
      overrides: z.array(z.object({ key: z.string().length(64), reason }).strict()).max(300),
    })
    .strict(),
  z.object({ action: z.literal('request.cancel'), id, revision, reason }).strict(),
]);
export type TimetableCommand = z.infer<typeof timetableCommand>;
export interface TimetableConflict {
  key: string;
  kind: 'teacher' | 'room' | 'student' | 'availability' | 'domain';
  date: string;
  lessonIds: string[];
  message: string;
  overridable: boolean;
}
export interface Occurrence {
  id: string;
  revision: string;
  versionId: string;
  lessonId: string;
  date: string;
  targetDate: string;
  periodId: string;
  number: number;
  start: string;
  end: string;
  groupId: string;
  group: string;
  subject: string;
  teacherId: string;
  teacher: string;
  roomId: string;
  room: string;
  sectionIds: string[];
  cancelled: boolean;
  changed: boolean;
  exceptionalDay: boolean;
}
export interface VersionSummary {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  status: string;
  revision: number;
}
export interface TimetableSetup {
  years: { id: string; name: string; startsOn: string; endsOn: string }[];
  yearId: string | null;
  versions: VersionSummary[];
  rooms: { id: string; number: string }[];
  teachers: { id: string; name: string }[];
  offerings: {
    id: string;
    name: string;
    sectionId: string;
    section: string;
    elective: boolean;
    subjectId: string;
  }[];
  students: { id: string; name: string; number: string }[];
  children: { id: string; name: string }[];
}
export interface DraftView extends VersionSummary {
  document: TimetableDocument;
  conflicts: TimetableConflict[];
}
export interface RequestView {
  id: string;
  revision: number;
  state: string;
  teacher: string;
  reason: string;
  decision: string | null;
  changes: LessonChange[];
  absence: Availability | null;
  createdAt: string;
}
export const weekdayLabels = ['ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი'];
