import { z } from 'zod';
import { roleLabels, type Role } from './contracts.js';
export const dateOnly = z.iso.date();
const id = z.uuid();
const name = z.string().trim().min(2).max(120);
const version = z.number().int().positive();
const interval = { startsOn: dateOnly, endsOn: dateOnly };
export const academicCommand = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('year.save'),
      id: id.optional(),
      version: version.optional(),
      name,
      ...interval,
      semesters: z.array(z.object({ name, ...interval }).strict()).length(2),
    })
    .strict(),
  z
    .object({
      action: z.literal('year.status'),
      id,
      version,
      status: z.enum(['active', 'archived']),
    })
    .strict(),
  z
    .object({
      action: z.literal('section.save'),
      id: id.optional(),
      version: version.optional(),
      yearId: id,
      name,
      gradeLevel: z.number().int().min(1).max(12),
    })
    .strict(),
  z
    .object({
      action: z.literal('subject.save'),
      id: id.optional(),
      version: version.optional(),
      name,
      code: z.string().trim().min(2).max(30),
      archived: z.boolean().default(false),
    })
    .strict(),
  z
    .object({
      action: z.literal('calendar.save'),
      id: id.optional(),
      version: version.optional(),
      yearId: id,
      title: name,
      kind: z.enum(['holiday', 'vacation', 'milestone']),
      ...interval,
      gradeFrom: z.number().int().min(1).max(12),
      gradeTo: z.number().int().min(1).max(12),
    })
    .strict(),
  z.object({ action: z.literal('calendar.remove'), id, version }).strict(),
  z
    .object({
      action: z.literal('offering.create'),
      sectionId: id,
      subjectId: id,
      elective: z.boolean(),
      ...interval,
    })
    .strict(),
  z
    .object({
      action: z.literal('assignment.create'),
      staffPersonId: id,
      sectionId: id,
      offeringId: id.nullable(),
      ...interval,
    })
    .strict(),
  z.object({ action: z.literal('assignment.end'), id, endsOn: dateOnly }).strict(),
  z
    .object({ action: z.literal('membership.create'), offeringId: id, studentId: id, ...interval })
    .strict(),
  z.object({ action: z.literal('membership.end'), id, endsOn: dateOnly }).strict(),
]);
export type AcademicCommand = z.infer<typeof academicCommand>;
export const peopleCommand = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('student.create'),
      personId: id.optional(),
      fullName: name,
      contactEmail: z.email().max(200).nullable(),
      number: z.string().trim().min(2).max(40),
      sectionId: id,
      startsOn: dateOnly,
    })
    .strict(),
  z
    .object({
      action: z.literal('student.edit'),
      id,
      version,
      personVersion: version,
      fullName: name,
      number: z.string().trim().min(2).max(40),
      contactEmail: z.email().max(200).nullable(),
    })
    .strict(),
  z
    .object({
      action: z.literal('enrollment.change'),
      studentId: id,
      version,
      sectionId: id.nullable(),
      effectiveOn: dateOnly,
      reason: z.string().trim().min(3).max(200),
    })
    .strict(),
  z
    .object({
      action: z.literal('student.status'),
      id,
      version,
      status: z.enum(['active', 'archived']),
    })
    .strict(),
  z
    .object({
      action: z.literal('person.create'),
      fullName: name,
      contactEmail: z.email().max(200).nullable(),
    })
    .strict(),
  z
    .object({
      action: z.literal('person.edit'),
      id,
      version,
      fullName: name,
      contactEmail: z.email().max(200).nullable(),
    })
    .strict(),
  z.object({ action: z.literal('person.archive'), id, version }).strict(),
  z
    .object({
      action: z.literal('guardian.link'),
      guardianPersonId: id,
      studentId: id,
      startsOn: dateOnly,
    })
    .strict(),
  z.object({ action: z.literal('guardian.end'), id, endsOn: dateOnly }).strict(),
  z
    .object({
      action: z.literal('staff.save'),
      id: id.optional(),
      version: version.optional(),
      personId: id.optional(),
      personVersion: version.optional(),
      fullName: name,
      contactEmail: z.email().max(200).nullable(),
      title: name,
      startsOn: dateOnly,
      endsOn: dateOnly.nullable(),
    })
    .strict(),
]);
export type PeopleCommand = z.infer<typeof peopleCommand>;
export const accountCommand = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('invite'),
      personId: id,
      email: z.email().max(200),
      roles: z
        .array(z.enum(Object.keys(roleLabels) as [Role, ...Role[]]))
        .min(1)
        .max(8),
    })
    .strict(),
  z.object({ action: z.literal('disable'), userId: z.string().min(1).max(100) }).strict(),
  z.object({ action: z.literal('reinvite'), userId: z.string().min(1).max(100) }).strict(),
  z
    .object({
      action: z.literal('roles'),
      userId: z.string().min(1).max(100),
      roles: z
        .array(z.enum(Object.keys(roleLabels) as [Role, ...Role[]]))
        .min(1)
        .max(8),
    })
    .strict(),
]);
export type AccountCommand = z.infer<typeof accountCommand>;
export interface YearRecord {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  status: string;
  version: number;
}
export interface SemesterRecord {
  id: string;
  yearId: string;
  name: string;
  ordinal: number;
  startsOn: string;
  endsOn: string;
}
export interface SectionRecord {
  id: string;
  yearId: string;
  name: string;
  gradeLevel: number;
  version: number;
}
export interface SubjectRecord {
  id: string;
  name: string;
  code: string;
  archived: boolean;
  version: number;
}
export interface CalendarRecord {
  id: string;
  yearId: string;
  title: string;
  kind: string;
  startsOn: string;
  endsOn: string;
  gradeFrom: number;
  gradeTo: number;
  version: number;
}
export interface OfferingRecord {
  id: string;
  sectionId: string;
  subjectId: string;
  elective: boolean;
  startsOn: string;
  endsOn: string;
  version: number;
}
export interface AssignmentRecord {
  id: string;
  staffPersonId: string;
  staffName: string;
  sectionId: string;
  offeringId: string | null;
  kind: string;
  startsOn: string;
  endsOn: string | null;
}
export interface AcademicSetup {
  years: YearRecord[];
  selectedYearId: string | null;
  semesters: SemesterRecord[];
  sections: SectionRecord[];
  subjects: SubjectRecord[];
  events: CalendarRecord[];
  offerings: OfferingRecord[];
  assignments: AssignmentRecord[];
}
export interface PersonRow {
  id: string;
  fullName: string;
  contactEmail: string | null;
  version: number;
  archivedAt: string | null;
  userId: string | null;
  staffId: string | null;
  title: string | null;
  startsOn: string | null;
  endsOn: string | null;
  staffVersion: number | null;
  studentId: string | null;
  number: string | null;
}
export interface PeoplePage {
  items: PersonRow[];
  total: number;
  limit: number;
  offset: number;
}
export interface StudentAdministration {
  id: string;
  personId: string;
  name: string;
  number: string;
  status: string;
  version: number;
  personVersion: number;
  contactEmail: string | null;
  enrollments: {
    id: string;
    sectionId: string;
    sectionName: string;
    yearName: string;
    startsOn: string;
    endsOn: string | null;
  }[];
  guardians: {
    id: string;
    guardianPersonId: string;
    name: string;
    startsOn: string;
    endsOn: string | null;
  }[];
}
export interface AccountRow {
  id: string;
  name: string;
  email: string;
  disabled: boolean;
  personId: string;
  roles: Role[];
  pending: boolean;
}
export interface RosterPage {
  items: {
    id: string;
    name: string;
    number: string;
    membershipId: string | null;
    startsOn: string;
    endsOn: string | null;
  }[];
  total: number;
}

export interface PersonHistory {
  items: { id: string; label: string; context: string; startsOn: string; endsOn: string | null }[];
}
