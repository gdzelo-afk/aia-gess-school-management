# Product vision and scope

A calm, trustworthy school workspace: staff complete daily work quickly; leadership sees exceptions that require action; families understand each child's next step. One school, approximately 830 students, 50 teachers and 20 other staff. Approximately 830 parent/guardian accounts are also intended. These are planning figures, not existing production users; school rollout is not formally committed. The project is developed voluntarily by student developers, without requesting development compensation from the school.

## Principles

- Start with the person's day, not a wall of modules. Each dashboard leads to a concrete next action.
- Preserve academic truth. Publication and correction are explicit operations, not destructive edits.
- Reveal only necessary information; a family portal is a distinct product surface.
- Use fast, dense workspaces for repetitive tasks and generous spacing for interpretation.
- Use useful counts with denominators, periods and freshness. Missing data is not zero.
- Predictable navigation, visible save state, keyboard support, recoverable errors.
- Configure genuine school policy; do not build a no-code platform.

## People

Identity is a Person; credentials belong to a User; Student and Staff are profiles. A guardian relationship belongs to two people and has access attributes and an effective interval. Multiple role grants coexist. Roles alone never imply access to all rows.

Predefined roles: super administrator, owner/director, principal, vice principal, administrator, teacher, homeroom teacher, student, guardian, accountant, HR, librarian, nurse, security, receptionist, counselor, IT administrator. Nurse/counselor are recognized identities with minimal access; no clinical/counseling module exists. System administration is not automatic permission to inspect grades, finance or private messages. Emergency break-glass access is a later explicit, audited policy.

## Full capability inventory

F = this foundation; 1 = first school workflows; 2 = subsequent core; 3 = extended product; 4 = later.

| Domain               | Long-term capabilities                                                                                                               | Phase / dependencies                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Identity and access  | Invitations, profiles, multi-role grants, scoped guardians, sessions, recovery, MFA, SSO, passkeys                                   | F schema/login/RBAC; operational provisioning in 1; advanced auth before launch |
| School structure     | Years, two semesters, grades 1–12, sections, subjects, rooms, periods, holidays, calendars                                           | F baseline; 1 before academic work                                              |
| Students             | Enrollment, contacts, guardians, transfers, status history, documents, academic/attendance history, restricted notes                 | F sample read model; 1                                                          |
| Staff                | Employment intervals, teaching assignments, homerooms, schedules, attendance                                                         | 1; payroll later                                                                |
| Timetable            | Manual lessons, conflicts, rooms, substitutions, special days, changes                                                               | 1 after structure; generator deferred                                           |
| Attendance           | Student/staff, lesson marks, late arrival, early departure, authorized absence, corrections and notifications                        | 1C student attendance/explanations; staff deferred; guardian cannot mark        |
| Teaching             | Today's classes, seating charts, lesson plans, quick attendance, assignments, homework, submissions, attachments, review             | 1 basics; 2 submissions/planning                                                |
| Assessment           | 1–10 grades, bulk entry, import/export, notes, exams, results, electives                                                             | 1 gradebook; 2 exams/electives; no weighted categories                          |
| Academic records     | Semester report cards, comments, attendance summaries, revisions, transcripts, certificates                                          | 2 after publication policy                                                      |
| Student portal       | Schedule, tasks, submissions, grades, attendance, exams, messages, events, documents                                                 | 1 overview; 2 complete; younger pupils receive simpler task language            |
| Family portal        | Child switch, progress, attendance, timetable, tasks, teacher comments, documents, acknowledgements, meetings, own-child finance     | 1 overview; 2 complete                                                          |
| Finance              | Tuition/fees, installment plans, invoices/items, discounts/scholarships, payment allocation, balances, receipts, late fees, refunds  | 2; online payments 4                                                            |
| Workforce finance    | Payroll summaries, staff expense approval/reimbursement                                                                              | 3; not tax filing/general ledger                                                |
| Communication        | Targeted announcements, teacher–family/student chat, groups, read state, delivery history                                            | 1 announcements; 2 conversations                                                |
| Notifications        | In-app, email, SMS, push, preferences, emergency broadcast and delivery tracking                                                     | 1 in-app; 2 channels; provider selection at integration                         |
| Community            | Events, clubs, capacity and memberships, achievements, behavior with restricted visibility                                           | 2–3                                                                             |
| Operations           | Library catalog/copies/loans, visitors/check-in/check-out, certificates, revocable digital IDs                                       | 3                                                                               |
| Forms                | Versioned surveys, configurable typed fields, acknowledgements, submissions                                                          | 3; no arbitrary scripts                                                         |
| Alumni               | Transition from enrollment, consent-controlled contacts and events                                                                   | 3                                                                               |
| Admissions           | Internal application records/forms, documents, interviews, entrance exams, evaluations, waitlists, decisions, contracts/e-signatures | 4; no public application workflow now                                           |
| Analytics            | Operational/executive views, saved filters, custom reports, CSV/Excel/PDF, scheduled reports, audit views                            | 1 basic; 2–3 advanced                                                           |
| Historical migration | One-time administrator EduPage import, staging, validation, dry run, reconciliation, recoverability                                  | 4; no dataset available                                                         |

## Boundaries

Finance tracks school receivables/payables and payroll-related information. It is not a chart-of-accounts/general-ledger or professional accounting replacement. No transport, meals, dormitory, assets/facilities, health or counseling records. No AI functionality, WhatsApp/Telegram, speculative integration platform, PWA/offline or native app implementation.
