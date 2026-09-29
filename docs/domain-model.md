# Domain model and temporal rules

## Ownership and relationships

| Boundary           | Aggregate / relationships                                                                                               | Invariants                                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Identity           | Person → optional User; Person → Student/Staff; User → many role grants; GuardianLink joins guardian Person and Student | Stable opaque ID; names are not keys; revocation evaluated at request time                        |
| Academic structure | AcademicYear → Semesters; ClassSection belongs to year/grade; Subject → CourseOffering → roster/teacher intervals       | Enrollment date interval within year; archived names retained                                     |
| Enrollment         | Student → many section enrollments across time; course roster may differ for electives                                  | Transfer closes old interval and opens new; no destructive overwrite                              |
| Teaching           | CourseOffering → TeacherAssignment intervals → lesson instances; timetable template → dated instances/overrides         | Changes affect future instances; teacher/room/class overlap conflict checked transactionally      |
| Attendance         | LessonInstance + student → current mark + immutable revisions                                                           | Unique student/lesson; absence/late/early/excused separate; correction reason/actor/time          |
| Assessment         | Offering → Assignment/Exam → Submission versions → grade revisions                                                      | Integer 1–10 or explicit missing/exempt/absent; never encode missing as 0                         |
| Publication        | SemesterReport/Transcript → immutable version with referenced source IDs and display snapshots                          | Published version stable; amended version references predecessor                                  |
| Finance            | BillingAgreement → installment schedule → Invoice/Items; Payment → Allocations; Refund/Reversal references payment      | GEL integer tetri; allocations cannot exceed available payment or invoice balance; atomic locking |
| Support            | Behavior case and achievement refer to student + school year                                                            | Behavior access separate from ordinary student profile; no health/counseling records              |
| Messaging          | Conversation → membership intervals → messages → receipts; Announcement → explicit audiences                            | Membership and relationship policy govern access; remove access without destroying history        |
| Community          | Event/Club → occurrence → membership/capacity; meeting slot → booking                                                   | Unique/locked booking; cancellations retained                                                     |
| Operations         | BookEdition → Copy → Loan; Visitor → Visit; Certificate → issued version; DigitalID → revocable token hash              | No national ID in barcode; expired/revoked tokens rejected                                        |
| Forms              | FormDefinition → immutable schema version → response                                                                    | Typed validation, consent wording version, no scripts                                             |
| Admissions         | Application → stage events/evaluations → decision → enrollment link                                                     | Decision preserved; identity deduplication human-reviewed                                         |
| Alumni             | Person + completed enrollment + contact preference                                                                      | No automatic marketing consent from former student status                                         |
| Infrastructure     | FileMetadata → version + domain attachment; AuditEvent; OutboxJob                                                       | Authorization from owning domain; immutable audit; idempotent jobs                                |

## Initial schema versus future model

The executable Stage 1A schema covers calendar events, subjects, course offerings, elective memberships, hashed onboarding tokens and versioned administrative profiles in addition to Better Auth user/account/session/verification, person, role grants, student, guardian links, staff, academic year/semester/section, enrollment, teaching assignment, file metadata, outbox and audit. Assessment/attendance/finance/agenda demonstration values are explicit fictional fixtures; no production gradebook, payment or attendance write APIs exist. Their future invariants above must be implemented with their module, not implied by the fixtures.

## Data conventions

- UUIDs for domain IDs; authentication IDs are opaque provider-generated strings. External school student number is a unique separate reference, not a security credential.
- `timestamptz` UTC for events; date for birthdays/academic intervals; local lesson date + IANA timezone for schedule semantics. Never assume every school day is 24h globally.
- Effective intervals use inclusive start, exclusive end. Database triggers enforce non-overlapping enrollment, guardian, semester and elective-membership intervals. Enrollment/semester bounds are checked against the year; elective membership bounds against its offering. Services additionally check employment, section enrollment and offering context.
- Foreign keys RESTRICT deletion of academic entities by default. Auth session/account deletion cascades with account lifecycle; person/academic data survives user disablement.
- Audit metadata excludes passwords, tokens, message bodies and file contents. Sensitive change events retain minimal IDs, reason and structured field diffs under policy.
- Index all scope joins (guardian/student, student/enrollment, teacher/section), foreign-key lookup paths, session token, queue status/available time. Search uses normalized names plus stable school number; add PostgreSQL trigram indexes only when needed.
- Draft records use version integer for optimistic concurrency. Published/posting records use append-only revisions/compensations. Serializable transaction or explicit row locks protect financial allocations and scheduling conflicts.
- Soft-delete recoverable drafts/profile visibility with archived timestamp/status; never blindly apply deleted_at to ledger entries or publication snapshots.

## Edge-case decisions

| Case                        | Behavior                                                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Mid-semester transfer       | Close enrollment at effective date; historical marks stay on old offering; receiving gradebook links source where policy permits |
| Withdrawal / return         | Close enrollment and preserve status event; returning creates a new enrollment, same person/student                              |
| Repeat year                 | New year enrollment at same grade; no overwrite or automatic promotion                                                           |
| Staff departure/replacement | Close assignment and disable login; historical teacher name snapshot retained on publication                                     |
| Substitute                  | Scoped, time-limited lesson permission; record actual teacher on lesson instance                                                 |
| Schedule change             | Version template, preserve taught lesson instances, update future instances with notices                                         |
| Grade/attendance correction | New revision with reason, actor, time and prior value; published records require amendment                                       |
| Guardian change             | End relationship interval; separately scope academic/finance rights; no inherited access from shared surname                     |
| Duplicate/identical names   | Distinct opaque IDs and school numbers; merge tool later requires preview, audit and reversible mapping                          |
| Semester/year rollover      | Close period only after validation; published snapshots remain; seed next structure without copying grades                       |
| Archived student            | Hidden from active lists, still linked to historical records under retention policy                                              |
| Refund/payment reversal     | Linked negative compensating movement and revised allocation; original receipt remains traceable                                 |
| Scholarship change          | Effective-dated award; future invoice recalculation only unless explicit credit note                                             |
| Renamed class/subject       | Stable entity ID plus version/display snapshot; don't rename historical report meaning                                           |

## Report-card and transcript design

Template version includes school identity, student number/name snapshot, academic year/semester, subject lines, 1–10 grade or explicit non-grade status, teacher comments, attendance summary, issue date, approver and verification reference. Preview checks missing entries. Approved issue creates frozen render data and generated PDF file version. Transcript composes published academic records, records language/template/version, and supports reissue with provenance. No invented averaging/rounding policy until stakeholders confirm it.

## Stage 1A operational contracts

All administrative writes and their audit event share one transaction. A singleton school administration row is locked before cross-aggregate validation; person/student/staff/year/section/subject/calendar versions reject stale edits. The PostgreSQL-compatible interval triggers also acquire that lock. This is deliberately a single-school mechanism, not distributed locking.

Enrollment change closes the previous interval and opens a new one (or withdraws), retaining IDs/history. It closes overlapping elective membership; unresolved future membership blocks transfer rather than deleting it. Return/repeat-year enrollment uses the same student identity and explicitly chosen year/section. No automatic promotion. Archive requires all current/future enrollments to have ended; restoration does not invent enrollment. Same-day zero-length intervals are rejected.

Two semesters are required. Only unused draft-year identity is editable; active/archived years and used class/subject identity are protected. Future calendar entries can be edited/deleted with version checks; past entries cannot be rewritten. Core course rosters derive from dated section enrollment. Electives require explicit dated membership as well. Historical roster queries remain administrative and retain departed/archived identities; current student lookup remains scoped.

Multiple guardians receive identical normal access on creation (both existing academic/financial flags true). No granular permission editor. Ending a link removes access from its exclusive end date and preserves history. Existing independent flags remain meaningful for previously restricted links and future policy.

Staff employment is one start/end interval in this stage. Ending it closes overlapping teaching assignments and blocks login/role scopes; earlier assignments remain visible. Employment rehire history needs a later explicit model, not reopening a completed interval. Homeroom assignments scope a section; course assignments respect offering/elective intervals. Published academic snapshots, lesson permissions and substitute workflows are still future modules.

The supplied calendar JSON is validated in `server/db/calendar-import.ts` and converted into normal date-only domain rows by an explicit demo seed. Inclusive source end dates become exclusive domain boundaries. Its monthly totals contradict annual totals for grades 1 and 12 (152/156 versus 156/152); these warnings are recorded in seed audit and are not used as authoritative teaching-day counts. The demo year is 2026-09-15 through 2027-06-16 exclusive, with winter/spring breaks and grade-specific milestones. Administrators configure subsequent years; this is not confirmed school policy.
