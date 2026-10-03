# Domain model and temporal rules

## Ownership and relationships

| Boundary           | Aggregate / relationships                                                                                               | Invariants                                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Identity           | Person → optional User; Person → Student/Staff; User → many role grants; GuardianLink joins guardian Person and Student | Stable opaque ID; names are not keys; revocation evaluated at request time                        |
| Academic structure | AcademicYear → Semesters; ClassSection belongs to year/grade; Subject → CourseOffering → roster/teacher intervals       | Enrollment date interval within year; archived names retained                                     |
| Enrollment         | Student → many section enrollments across time; course roster may differ for electives                                  | Transfer closes old interval and opens new; no destructive overwrite                              |
| Teaching           | CourseOffering → TeacherAssignment intervals → lesson instances; timetable template → dated instances/overrides         | Changes affect future instances; teacher/room/class overlap conflict checked transactionally      |
| Attendance         | LessonInstance + student → current mark + immutable revisions                                                           | Unique student/lesson; Present/Late attended; Absent/Authorized missed; Early Departure separate  |
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

The executable Stage 1A schema covers calendar events, subjects, course offerings, elective memberships, hashed onboarding tokens and versioned administrative profiles in addition to Better Auth user/account/session/verification, person, role grants, student, guardian links, staff, academic year/semester/section, enrollment, teaching assignment, file metadata, outbox and audit. Stage 1B timetable and Stage 1C Attendance extend this schema with the operational contracts below. Assessment/finance/agenda demonstration values remain explicit fictional fixtures; Gradebook APIs are described below; payment write APIs are not implemented. Their future invariants must be implemented with their module, not implied by the fixtures.

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

Staff employment is one start/end interval in this stage. Ending it closes overlapping teaching assignments and blocks login/role scopes; earlier assignments remain visible. Employment rehire history needs a later explicit model, not reopening a completed interval. Homeroom assignments scope a section; course assignments respect offering/elective intervals. Published academic assessment snapshots remain future work. Stage 1B lesson permissions and substitution contracts are described below.

The supplied calendar JSON is validated in `server/db/calendar-import.ts` and converted into normal date-only domain rows by an explicit demo seed. Inclusive source end dates become exclusive domain boundaries. Its monthly totals contradict annual totals for grades 1 and 12 (152/156 versus 156/152); these warnings are recorded in seed audit and are not used as authoritative teaching-day counts. The demo year is 2026-09-15 through 2027-06-16 exclusive, with winter/spring breaks and grade-specific milestones. Administrators configure subsequent years; this is not confirmed school policy.

## Stage 1B timetable contracts

Timetable versions carry their own bell periods and groups. Rooms contain only a numeric room number. One recurring lesson references one group, one teacher, one room and one weekday/period. Groups compose same-subject course offerings; optional member subsets support disjoint split sections. Whole/elective rosters always intersect Stage 1A effective enrollment/membership on the occurrence date. Combined sections form one activity and never self-conflict.

Publication is transactional and immutable; later effective versions and append-only dated exceptions retain historical identities and display labels. Recurring local times are not UTC instants. Exceptions cover substitutions, room/course/time/date changes, cancellation and explicit extra/special days. Source occurrence identity survives a move; its revision changes. Holidays come exclusively from the Stage 1A calendar. Conflict checks compare actual overlapping local times, teachers, rooms and pupil sets, including across different period numbers.

Teacher availability has inclusive-start/exclusive-end dates, optional weekdays and optional period numbers (empty means full day). Teacher absence requests capture affected published occurrences; stale decisions fail and require re-evaluation. Approval resolves each affected lesson with a substitute/move/cancellation, then commits availability, exceptions and audit together. Stage 1C consumes these occurrences; it must not rebuild schedule logic. Automatic scheduling and staff attendance remain out of scope.

## Stage 1C — lesson attendance

Attendance uses Stage 1B's resolved, published effective occurrence (version + lesson + source date, retaining moved target date), never a parallel schedule. Opening a roster creates nothing. Explicit atomic submission captures the exact pupils, readable lesson context, subject/year identity and effective instructional minutes; subsequent timetable, names or roster changes do not rewrite that snapshot. Deliberate administrative reconciliation creates another revision. PostgreSQL JSONB comparisons use semantic fields, not key ordering.

Present and Late count as attended; Absent and Authorized Absence count as missed. Late requires reported/estimated arrival time and displays approximate minutes. Early Departure is a separate timed attribute of Present/Late. **Recording departure is not permission to release a pupil.** Administrative release authorization based on an appropriate request/recommendation remains a separate future operational dependency; a guardian explanation or teacher checkbox grants no release authority. No clinical information/documents are stored.

The subject teacher or actual substitute owns the occurrence roll call: start through +15 minutes is normal, later submission is overdue, direct teacher correction ends 24 hours after effective lesson end. Corrections require reasons and immutable before/after/actor/time history. Locked teachers submit a request with captured lesson/roster and original/proposed entries. Administration can approve, adjust or deny; stale proposals cannot overwrite newer data. Historical administrative correction always requires a note.

Guardian explanations are scoped inclusive date/range UI over date-only half-open storage. Approval does not create attendance. Actual Absent under an approved explanation becomes Authorized; Present/Late remain unchanged. Retroactive authorization appends history. Missing teacher roll call remains unknown. Day state cannot be fully present while required data is unresolved. Percentages use recorded conducted required occurrences and expose missing data/provisional completeness; cancellations and non-rostered lessons are excluded.

**Future subject/year rules:** snapshots retain academic year ID, subject ID and effective instructional minutes in addition to the occurrence's published version/group identity. Annual subject queries can aggregate recorded missed minutes (Absent + Authorized) and required effective minutes, resolving unsaved occurrences through the existing timetable resolver in bounded date ranges; unresolved minutes must be reported separately. Preserve numerator, denominator and completeness rather than summing monthly percentages. The historical approximately 30% rule is policy evidence only: no threshold, examination consequence or current-year policy is hard-coded. A later academic-rules/examinations stage must confirm year/level-specific policy before acting on it.

## Gradebook (Stage 1D implementation)

`gradebook_assessment` binds a semester, subject offering or effective published teaching group, optional actual lesson occurrence, and historical policy/criteria/roster snapshots. Split and combined groups reuse the timetable resolver. Opening a journal does not write results. Explicit private draft commands and publication/correction commands use revisions, roster fingerprints, idempotency receipts and one transaction. Published academic identity is immutable; reasoned corrections/voids append actor/time/before/after history. A departed pupil's published result survives and requires administrative correction rather than a former teacher's routine edit.

Versioned policy resolves grade band, semester, offering mode and fixed Classwork/Homework/Summative categories. I–IV and V semester I are formative; V semester II supports numeric assessment but numeric Homework starts at VII. Formative Homework remains valid for V. Numeric scores are integers 1–10; pass/fail and formative results have separate meanings. Unassessed, absent, recovery-required and exempt are explicit non-score states, never invented zeroes.

Only published numeric entries contribute equally to the exact rational running mean. Display rounding (two decimals) and whole provisional rounding are independent half-up operations. Pass/fail, narrative and non-score states are excluded. Unresolved Summatives and unknown requirements make completeness explicit. Recovery replaces the original result, never adds another weighted assessment. Annual projections use rounded provisional semesters (Grade V uses semester II only); neither is an official semester/annual publication.

Normal Summative recovery lasts ten calendar days. An overdue pupil may request an extension; authorized administration records the decision, required offline follow-up and deadline before teacher recovery. Historical administrative overrides require reasons. Criteria are versioned per subject/year, optionally with an authenticated private PDF; earlier assessments retain their original version.

Writings distinguish annual formative narrative, guardian-only subject comments and guardian-only homeroom comments. They have private drafts, explicit publication and immutable reasoned correction history. They are one-way academic communication, not messages. Notifications use deduplicated outbox events and a scoped in-app projection; there is no external delivery provider.

Bounded report families cover pupil progress, assessment matrix, provisional semester/annual results, distribution without ranking, unresolved Summatives/recovery, pass/fail, narrative/publication completeness and subject Attendance context. Attendance remains its own canonical occurrence/history model. The historical approximately 30% academic/examination consequence is not enforced. Official finalization, exams, transcripts, report cards, assignment submission and general file management remain deferred.
