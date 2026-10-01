import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  boolean,
  timestamp,
  uuid,
  integer,
  date,
  jsonb,
  index,
  uniqueIndex,
  check,
  primaryKey,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { roleLabels } from '../../shared/contracts.js';
import type { Role } from '../../shared/contracts.js';
const instant = (name: string) => timestamp(name, { withTimezone: true });
const id = () => uuid('id').primaryKey().defaultRandom();
export const user = pgTable('app_user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  disabled: boolean('disabled').notNull().default(false),
  image: text('image'),
  createdAt: instant('created_at').notNull().defaultNow(),
  updatedAt: instant('updated_at').notNull().defaultNow(),
});
export const session = pgTable(
  'auth_session',
  {
    id: text('id').primaryKey(),
    expiresAt: instant('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: instant('created_at').notNull().defaultNow(),
    updatedAt: instant('updated_at').notNull().defaultNow(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [index('session_user_idx').on(t.userId)],
);
export const account = pgTable(
  'auth_account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: instant('access_token_expires_at'),
    refreshTokenExpiresAt: instant('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: instant('created_at').notNull().defaultNow(),
    updatedAt: instant('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('account_user_idx').on(t.userId),
    uniqueIndex('account_provider_unique').on(t.providerId, t.accountId),
  ],
);
export const verification = pgTable(
  'auth_verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: instant('expires_at').notNull(),
    createdAt: instant('created_at').notNull().defaultNow(),
    updatedAt: instant('updated_at').notNull().defaultNow(),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
);
export const person = pgTable('person', {
  id: id(),
  userId: text('user_id')
    .unique()
    .references(() => user.id),
  fullName: text('full_name').notNull(),
  version: integer('version').notNull().default(1),
  contactEmail: text('contact_email'),
  createdAt: instant('created_at').notNull().defaultNow(),
  archivedAt: instant('archived_at'),
});
export const roleEnum = pgEnum('role_key', Object.keys(roleLabels) as [Role, ...Role[]]);
export const roleGrant = pgTable(
  'role_grant',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id),
    role: roleEnum('role').notNull(),
    createdAt: instant('created_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.role] })],
);
export const student = pgTable(
  'student',
  {
    id: id(),
    personId: uuid('person_id')
      .notNull()
      .unique()
      .references(() => person.id),
    number: text('school_number').notNull().unique(),
    version: integer('version').notNull().default(1),
    status: text('status').notNull().default('active'),
  },
  (t) => [check('student_status_check', sql`${t.status} in ('active','archived')`)],
);
export const staff = pgTable(
  'staff',
  {
    id: id(),
    personId: uuid('person_id')
      .notNull()
      .unique()
      .references(() => person.id),
    title: text('title').notNull(),
    version: integer('version').notNull().default(1),
    startsOn: date('starts_on').notNull(),
    endsOn: date('ends_on'),
  },
  (t) => [check('staff_interval', sql`${t.endsOn} is null or ${t.endsOn} > ${t.startsOn}`)],
);
export const guardianLink = pgTable(
  'guardian_link',
  {
    id: id(),
    guardianPersonId: uuid('guardian_person_id')
      .notNull()
      .references(() => person.id),
    studentId: uuid('student_id')
      .notNull()
      .references(() => student.id),
    academicAccess: boolean('academic_access').notNull().default(false),
    financeAccess: boolean('finance_access').notNull().default(false),
    startsOn: date('starts_on').notNull(),
    endsOn: date('ends_on'),
  },
  (t) => [
    index('guardian_scope_idx').on(t.guardianPersonId, t.studentId),
    check('guardian_interval', sql`${t.endsOn} is null or ${t.endsOn} > ${t.startsOn}`),
  ],
);
export const academicYear = pgTable(
  'academic_year',
  {
    id: id(),
    name: text('name').notNull().unique(),
    status: text('status').notNull().default('draft'),
    version: integer('version').notNull().default(1),
    startsOn: date('starts_on').notNull(),
    endsOn: date('ends_on').notNull(),
  },
  (t) => [
    check('year_interval', sql`${t.endsOn} > ${t.startsOn}`),
    check('year_status', sql`${t.status} in ('draft','active','archived')`),
    uniqueIndex('one_current_year')
      .on(t.status)
      .where(sql`${t.status} = 'active'`),
  ],
);
export const semester = pgTable(
  'semester',
  {
    id: id(),
    yearId: uuid('year_id')
      .notNull()
      .references(() => academicYear.id),
    name: text('name').notNull(),
    ordinal: integer('ordinal').notNull(),
    startsOn: date('starts_on').notNull(),
    endsOn: date('ends_on').notNull(),
  },
  (t) => [
    uniqueIndex('semester_year_ordinal').on(t.yearId, t.ordinal),
    check('semester_ordinal', sql`${t.ordinal} in (1,2)`),
    check('semester_interval', sql`${t.endsOn} > ${t.startsOn}`),
  ],
);
export const section = pgTable(
  'class_section',
  {
    id: id(),
    yearId: uuid('year_id')
      .notNull()
      .references(() => academicYear.id),
    name: text('name').notNull(),
    gradeLevel: integer('grade_level').notNull(),
    version: integer('version').notNull().default(1),
  },
  (t) => [
    uniqueIndex('section_year_name').on(t.yearId, t.name),
    check('grade_level_check', sql`${t.gradeLevel} between 1 and 12`),
  ],
);
export const enrollment = pgTable(
  'enrollment',
  {
    id: id(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => student.id),
    sectionId: uuid('section_id')
      .notNull()
      .references(() => section.id),
    startsOn: date('starts_on').notNull(),
    endsOn: date('ends_on'),
  },
  (t) => [
    index('enrollment_student_idx').on(t.studentId),
    index('enrollment_section_idx').on(t.sectionId),
    uniqueIndex('one_open_enrollment')
      .on(t.studentId)
      .where(sql`${t.endsOn} is null`),
    check('enrollment_interval', sql`${t.endsOn} is null or ${t.endsOn} > ${t.startsOn}`),
  ],
);
export const teachingAssignment = pgTable(
  'teaching_assignment',
  {
    id: id(),
    offeringId: uuid('offering_id').references(() => courseOffering.id),
    kind: text('kind').notNull().default('homeroom'),
    staffPersonId: uuid('staff_person_id')
      .notNull()
      .references(() => person.id),
    sectionId: uuid('section_id')
      .notNull()
      .references(() => section.id),
    startsOn: date('starts_on').notNull(),
    endsOn: date('ends_on'),
  },
  (t) => [
    index('teaching_scope_idx').on(t.staffPersonId, t.sectionId),
    check('teaching_interval', sql`${t.endsOn} is null or ${t.endsOn} > ${t.startsOn}`),
  ],
);
export const auditEvent = pgTable(
  'audit_event',
  {
    id: id(),
    actorUserId: text('actor_user_id').references(() => user.id),
    action: text('action').notNull(),
    objectType: text('object_type').notNull(),
    objectId: text('object_id').notNull(),
    requestId: text('request_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: instant('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('audit_object_idx').on(t.objectType, t.objectId),
    index('audit_time_idx').on(t.createdAt),
  ],
);
export const fileMetadata = pgTable(
  'file_metadata',
  {
    id: id(),
    ownerPersonId: uuid('owner_person_id')
      .notNull()
      .references(() => person.id),
    objectKey: text('object_key').notNull().unique(),
    originalName: text('original_name').notNull(),
    contentType: text('content_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    status: text('status').notNull().default('quarantined'),
    version: integer('version').notNull().default(1),
    createdAt: instant('created_at').notNull().defaultNow(),
  },
  (t) => [
    check('file_size_check', sql`${t.sizeBytes} >= 0`),
    check('file_status_check', sql`${t.status} in ('quarantined','ready','rejected')`),
  ],
);
export const outboxJob = pgTable(
  'outbox_job',
  {
    id: id(),
    kind: text('kind').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    deduplicationKey: text('deduplication_key').notNull().unique(),
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    availableAt: instant('available_at').notNull().defaultNow(),
    createdAt: instant('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('outbox_available_idx').on(t.status, t.availableAt),
    check('job_attempts_check', sql`${t.attempts} >= 0`),
    check('job_status_check', sql`${t.status} in ('pending','running','done','failed')`),
  ],
);

export const calendarEvent = pgTable(
  'school_calendar_event',
  {
    id: id(),
    yearId: uuid('year_id')
      .notNull()
      .references(() => academicYear.id),
    title: text('title').notNull(),
    kind: text('kind').notNull(),
    startsOn: date('starts_on').notNull(),
    endsOn: date('ends_on').notNull(),
    gradeFrom: integer('grade_from').notNull().default(1),
    gradeTo: integer('grade_to').notNull().default(12),
    version: integer('version').notNull().default(1),
  },
  (t) => [
    index('calendar_year_date').on(t.yearId, t.startsOn),
    check('calendar_interval', sql`${t.endsOn}>${t.startsOn}`),
    check('calendar_kind', sql`${t.kind} in ('holiday','vacation','milestone')`),
    check(
      'calendar_grades',
      sql`${t.gradeFrom} between 1 and 12 and ${t.gradeTo} between ${t.gradeFrom} and 12`,
    ),
  ],
);
export const subject = pgTable('subject', {
  id: id(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  archived: boolean('archived').notNull().default(false),
  version: integer('version').notNull().default(1),
});
export const courseOffering = pgTable(
  'course_offering',
  {
    id: id(),
    sectionId: uuid('section_id')
      .notNull()
      .references(() => section.id),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subject.id),
    elective: boolean('elective').notNull().default(false),
    startsOn: date('starts_on').notNull(),
    endsOn: date('ends_on').notNull(),
    version: integer('version').notNull().default(1),
  },
  (t) => [
    uniqueIndex('offering_section_subject').on(t.sectionId, t.subjectId),
    check('offering_interval', sql`${t.endsOn}>${t.startsOn}`),
  ],
);
export const courseMembership = pgTable(
  'course_membership',
  {
    id: id(),
    offeringId: uuid('offering_id')
      .notNull()
      .references(() => courseOffering.id),
    studentId: uuid('student_id')
      .notNull()
      .references(() => student.id),
    startsOn: date('starts_on').notNull(),
    endsOn: date('ends_on').notNull(),
  },
  (t) => [
    index('membership_scope').on(t.offeringId, t.studentId),
    check('membership_interval', sql`${t.endsOn}>${t.startsOn}`),
  ],
);
export const onboardingToken = pgTable(
  'onboarding_token',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id),
    digest: text('digest').notNull().unique(),
    purpose: text('purpose').notNull(),
    expiresAt: instant('expires_at').notNull(),
    usedAt: instant('used_at'),
    createdAt: instant('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('onboarding_user').on(t.userId),
    check('onboarding_purpose', sql`${t.purpose} in ('invite','recovery')`),
  ],
);

// Timetable documents are bounded aggregate snapshots. Published documents never mutate.
// Source identities stay in Stage 1A; JSON contains only validated references and bell/group structure.
export const timetableVersion = pgTable(
  'timetable_version',
  {
    id: id(),
    yearId: uuid('year_id')
      .notNull()
      .references(() => academicYear.id),
    name: text('name').notNull(),
    startsOn: date('starts_on').notNull(),
    endsOn: date('ends_on').notNull(),
    status: text('status').notNull().default('draft'),
    revision: integer('revision').notNull().default(1),
    document: jsonb('document')
      .$type<import('../../shared/timetable.js').TimetableDocument>()
      .notNull(),
    labels: jsonb('labels').$type<Record<string, string>>().notNull().default({}),
    overrides: jsonb('overrides').$type<{ key: string; reason: string }[]>().notNull().default([]),
    publishedAt: instant('published_at'),
    publishedBy: text('published_by').references(() => user.id),
  },
  (t) => [
    index('timetable_year_date').on(t.yearId, t.startsOn),
    check('timetable_interval', sql`${t.endsOn}>${t.startsOn}`),
    check('timetable_status', sql`${t.status} in ('draft','published')`),
    uniqueIndex('timetable_publication_start')
      .on(t.yearId, t.startsOn)
      .where(sql`${t.status}='published'`),
  ],
);
export const timetableRoom = pgTable(
  'timetable_room',
  { id: id(), number: text('number').notNull().unique() },
  (t) => [check('room_number', sql`${t.number} ~ '^[0-9]{1,6}$'`)],
);
export const timetableAvailability = pgTable(
  'timetable_availability',
  {
    id: id(),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => person.id),
    startsOn: date('starts_on').notNull(),
    endsOn: date('ends_on').notNull(),
    weekdays: jsonb('weekdays').$type<number[] | null>(),
    periodNumbers: jsonb('period_numbers').$type<number[]>().notNull(),
    reason: text('reason').notNull(),
    revision: integer('revision').notNull().default(1),
  },
  (t) => [
    index('availability_teacher_date').on(t.teacherId, t.startsOn),
    check('availability_interval', sql`${t.endsOn}>${t.startsOn}`),
  ],
);
export const timetableException = pgTable(
  'timetable_exception',
  {
    sequence: integer('sequence').generatedAlwaysAsIdentity(),
    id: id(),
    versionId: uuid('version_id')
      .notNull()
      .references(() => timetableVersion.id),
    lessonId: uuid('lesson_id').notNull(),
    date: date('date').notNull(),
    targetDate: date('target_date').notNull(),
    change: jsonb('change').$type<import('../../shared/timetable.js').LessonChange>().notNull(),
    labels: jsonb('labels').$type<Record<string, string>>().notNull(),
    reason: text('reason').notNull(),
    overrides: jsonb('overrides').$type<{ key: string; reason: string }[]>().notNull().default([]),
    createdAt: instant('created_at').notNull().defaultNow(),
    actorId: text('actor_id')
      .notNull()
      .references(() => user.id),
  },
  (t) => [
    index('exception_occurrence').on(t.versionId, t.date, t.lessonId),
    index('exception_target_date').on(t.targetDate),
  ],
);
export const timetableRequest = pgTable(
  'timetable_request',
  {
    id: id(),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => person.id),
    state: text('state').notNull().default('pending'),
    revision: integer('revision').notNull().default(1),
    reason: text('reason').notNull(),
    changes: jsonb('changes').$type<import('../../shared/timetable.js').LessonChange[]>().notNull(),
    absence: jsonb('absence').$type<import('../../shared/timetable.js').Availability | null>(),
    affected: jsonb('affected').$type<{ id: string; revision: string }[]>().notNull(),
    decision: text('decision'),
    createdAt: instant('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('request_teacher_state').on(t.teacherId, t.state),
    check('request_state', sql`${t.state} in ('pending','approved','denied','cancelled')`),
  ],
);

// Attendance snapshots preserve submitted meaning independently of later timetable/roster edits.
export const attendanceSession = pgTable(
  'attendance_session',
  {
    id: id(),
    occurrenceId: text('occurrence_id').notNull().unique(),
    versionId: uuid('version_id')
      .notNull()
      .references(() => timetableVersion.id),
    schoolDate: date('school_date').notNull(),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => person.id),
    snapshot: jsonb('snapshot')
      .$type<import('../../shared/attendance.js').AttendanceSnapshot>()
      .notNull(),
    revision: integer('revision').notNull().default(1),
    submittedBy: text('submitted_by')
      .notNull()
      .references(() => user.id),
    submittedAt: instant('submitted_at').notNull(),
    overdue: boolean('overdue').notNull(),
  },
  (t) => [
    index('attendance_date_teacher').on(t.schoolDate, t.teacherId),
    check('attendance_revision', sql`${t.revision}>0`),
  ],
);
export const attendanceRecord = pgTable(
  'attendance_record',
  {
    sessionId: uuid('session_id')
      .notNull()
      .references(() => attendanceSession.id),
    studentId: uuid('student_id')
      .notNull()
      .references(() => student.id),
    status: text('status').$type<import('../../shared/attendance.js').AttendanceStatus>().notNull(),
    arrival: text('arrival'),
    departure: text('departure'),
    timeSource: text('time_source').$type<'reported' | 'estimated'>().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.sessionId, t.studentId] }),
    index('attendance_student_status').on(t.studentId, t.status),
    check('attendance_status', sql`${t.status} in ('present','absent','late','authorized')`),
    check('attendance_arrival', sql`(${t.status}='late')=(${t.arrival} is not null)`),
    check('attendance_departure', sql`${t.departure} is null or ${t.status} in ('present','late')`),
    check(
      'attendance_times',
      sql`(${t.arrival} is null or ${t.arrival} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') and (${t.departure} is null or ${t.departure} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')`,
    ),
    check('attendance_time_source', sql`${t.timeSource} in ('reported','estimated')`),
  ],
);
export const attendanceRevision = pgTable(
  'attendance_revision',
  {
    id: id(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => attendanceSession.id),
    revision: integer('revision').notNull(),
    actorId: text('actor_id')
      .notNull()
      .references(() => user.id),
    action: text('action').notNull(),
    reason: text('reason'),
    before: jsonb('before').$type<import('../../shared/attendance.js').AttendanceState | null>(),
    after: jsonb('after').$type<import('../../shared/attendance.js').AttendanceState>().notNull(),
    createdAt: instant('created_at').notNull(),
  },
  (t) => [uniqueIndex('attendance_session_revision').on(t.sessionId, t.revision)],
);
export const attendanceExplanation = pgTable(
  'attendance_explanation',
  {
    id: id(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => student.id),
    guardianId: uuid('guardian_id')
      .notNull()
      .references(() => person.id),
    startsOn: date('starts_on').notNull(),
    endsOn: date('ends_on').notNull(),
    reason: text('reason').notNull(),
    state: text('state').$type<'pending' | 'approved' | 'denied'>().notNull().default('pending'),
    revision: integer('revision').notNull().default(1),
    reviewerId: text('reviewer_id').references(() => user.id),
    decision: text('decision'),
    decidedAt: instant('decided_at'),
    createdAt: instant('created_at').notNull(),
  },
  (t) => [
    index('attendance_explanation_student_date').on(t.studentId, t.startsOn),
    index('attendance_explanation_queue').on(t.state),
    check('attendance_explanation_interval', sql`${t.endsOn}>${t.startsOn}`),
    check('attendance_explanation_state', sql`${t.state} in ('pending','approved','denied')`),
  ],
);
export const attendanceRequest = pgTable(
  'attendance_request',
  {
    id: id(),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => person.id),
    occurrenceId: text('occurrence_id').notNull(),
    snapshot: jsonb('snapshot').$type<
      import('../../shared/attendance.js').AttendanceSnapshot & {
        originalEntries?: import('../../shared/attendance.js').AttendanceEntry[];
      }
    >(),
    proposal: jsonb('proposal')
      .$type<import('../../shared/attendance.js').RollCallInput>()
      .notNull(),
    reason: text('reason').notNull(),
    state: text('state').$type<'pending' | 'approved' | 'denied'>().notNull().default('pending'),
    revision: integer('revision').notNull().default(1),
    reviewerId: text('reviewer_id').references(() => user.id),
    decision: text('decision'),
    decidedAt: instant('decided_at'),
    createdAt: instant('created_at').notNull(),
  },
  (t) => [
    index('attendance_request_queue').on(t.teacherId, t.state),
    check('attendance_request_state', sql`${t.state} in ('pending','approved','denied')`),
  ],
);
// Transactional idempotency receipts cover commands, including multi-session authorization.
export const attendanceReceipt = pgTable('attendance_receipt', {
  id: uuid('id').primaryKey(),
  actorId: text('actor_id')
    .notNull()
    .references(() => user.id),
  fingerprint: text('fingerprint').notNull(),
  result: jsonb('result').$type<{ id: string; revision: number }>().notNull(),
  createdAt: instant('created_at').notNull(),
});
