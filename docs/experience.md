# Experience architecture

## Application model

A persistent school rail, concise context bar, and content workspace. Main content maximum width ~1560px. Current academic period remains visible. Navigation groups are role-derived, while the API independently enforces authorization. Browser routes are bookmarkable. Active page has one h1. Search is a dialog opened by Ctrl/Cmd+K, not a second navigation rail.

| Audience   | Landing experience                                                           | Primary navigation                                                     | Deliberately absent                         |
| ---------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------- |
| Leadership | School pulse, incomplete work, operational exceptions, day agenda            | Overview, students, academics, schedule, finance if granted, reporting | Unrestricted sensitive notes                |
| Teacher    | Next lesson, assigned classes, pending attendance/review                     | My day, students in scope, teaching, schedule, messages                | School finance and unrelated rosters        |
| Guardian   | Child cards/switcher, next event, learning/attendance, own-child obligations | Family overview, children, calendar, messages                          | All-school aggregates, unrelated identities |
| Student    | Today's learning and next due task                                           | My day, learning, timetable, messages                                  | Adult administrative menus                  |
| Operations | Role-specific queue and relevant people lookup                               | Only assigned operations and personal settings                         | Academic notes by default                   |

Foundation routes: `/`, `/students` (read-only scope demonstration), `/calendar` (fictional agenda), `/settings` (browser preferences), `/design` (component/state reference). Remaining navigation opens honest planned-state screens, never pretend working feature flows. Student/guardian variants use task/child sections instead of the leadership statistics layout.

## Long-term screen inventory

| Workspace      | Screens and important subviews                                                                             | Density                             |
| -------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Access         | Sign in, invitation, password recovery, MFA challenge/setup, sessions                                      | Spacious                            |
| Overview       | Executive, principal, teacher, student, family, operations                                                 | Spacious                            |
| People         | Student/staff lists, profile overview, contacts, guardian access, enrollment/status timeline, documents    | Dense lists; spacious profile       |
| Academics      | Year/semester setup, sections, subjects, offerings, electives, roster transfer wizard                      | Balanced                            |
| Teaching       | Lesson workspace, attendance grid, gradebook, assignment editor, submission review, seating plan           | Dense                               |
| Schedule       | Week/day, room/teacher/class filters, conflict panel, substitution editor, special-day overlay             | Dense desktop; agenda mobile        |
| Records        | Exam setup/entry, report preview/publication/revision, transcript/certificate generation                   | Dense entry; spacious print preview |
| Family         | Child landing, progress, tasks, own invoices/receipts, teacher booking, forms                              | Spacious                            |
| Finance        | Receivables, invoice/detail, allocation/reversal, scholarship intervals, payroll summary, expense approval | Dense                               |
| Communication  | Inbox/thread, group info, announcement composer/audience preview, notification center                      | Balanced                            |
| Community      | Events, club list/membership, achievement, restricted behavior detail                                      | Balanced                            |
| Operations     | Library loans/catalog, visitor register, ID issue/revoke, form builder/responses, alumni                   | Dense                               |
| Reporting      | Saved reports, typed field/filter builder, export job/status, audit search                                 | Dense                               |
| Administration | Permissions by preset, academic configuration, templates, notification policy, audit, imports              | Balanced                            |

## Key workflows and contracts

1. Teacher opens next lesson → sees effective roster → marks exceptions → previews counts → saves one transaction. No assumption that untouched pupils are present until explicitly confirmed. Concurrent edits return conflict, preserving unsaved marks.
2. Teacher selects assessment → keyboard entry 1–10 → validates missing versus absent/exempt → submits batch with optimistic version. Corrections require reason and immutable revision. Published results never silently change.
3. Administrator transfers pupil → effective date and receiving section → preview affected offerings/future lessons → atomically close/open enrollment. Prior grades and attendance remain with original offerings.
4. Guardian selects child → server verifies current academic/financial relationship separately → child-scoped query and exports. Changing child clears previously cached scoped content. Removed access takes effect at next request.
5. Accountant drafts invoice → verifies item/tetri totals → issues immutable document → allocates payment → receipt. Refund/reversal is a linked compensating entry; never edit a posted payment amount.
6. Principal reviews semester → validates incomplete grades/attendance → approves publication snapshot → releases to permitted audiences. Later change creates revision and supersedes prior version.
7. Substitute receives time-limited offering/lesson grant; can take attendance for assigned lesson, no general teacher access.
8. Year rollover previews new year, classes, staffing and expected enrollments; repeated students remain in prior-year history. No automatic promotion policy inferred.
9. Emergency announcement requires confirmed audience and authorization, explicit delivery channels, idempotency and result summary. Never label queued notifications as delivered.

## Interaction rules

- Search uses permission-filtered projections, bounded results and no hidden record counts. Foundation search covers navigation and already-authorized sample people only.
- Tables have visible row counts, filter reset, explicit sort state and bounded pagination. Bulk selection distinguishes page/all results; export reauthorizes on server.
- Settings save displays local-only or server-persisted semantics. No fake success messages for unimplemented work.
- Modal: labeled title/description, focus containment, Escape, return focus. Drawer is a dialog variant; full screen on mobile.
- Destructive action states object/consequence; restore where meaningful. Posted financial records and published records use reversal/revision instead of delete.
- Empty/no results/denied/offline/error are distinct states. Retry preserves filters and user input.
- Toasts announce transient confirmation; blocking errors stay adjacent to the relevant content.

## Responsive and keyboard

> =1200px: 232px rail, 32px workspace inset, main/aside ratio ~2:1. 768–1199px: condensed spacing, single content column as necessary. <768px: modal navigation, 16px inset, stacked summaries, touch targets >=44px; wide tables scroll inside a labeled region. Never shrink gradebook cells into illegibility; future mobile gradebook uses one assessment at a time.

Tab follows DOM order. Ctrl/Cmd+K searches, Escape closes. Do not override native browser shortcuts. Respect reduced motion. Foundation native select/date controls are intentional accessible defaults; use custom autocomplete only for large sets.

## Stage 1B operational timetable

`/timetable` opens the effective published week. Draft and Published workspaces share the same period-aligned Monday–Friday matrix, including empty bell periods. One searchable Section / Group / Teacher / Room lens establishes context; the school overview is a directory and operational summary, not a wall of every lesson. Subject/change/conflict filters are secondary disclosures. Additional weekend columns appear for actual special-day occurrences.

Selection opens context first in a right-side desktop inspector; editing is explicit. At narrower widths the same inspector becomes a focus-managed sheet. Phones select one day while retaining the period axis. Neutral cells prioritize subject, with lens-aware teacher/group/room metadata; conflicts include text and an icon. Drag targets receive debounced server previews without moving the grid; dropping still requires review, and a form provides the keyboard alternative. Final mutations revalidate revision and domain invariants.

Changes review compares the draft against the publication effective at its start: added/removed/moved lessons, teacher/room/group changes, bell times and group membership. Before/after values use Georgian names, not IDs. Dated exceptions remain attached to their historical version, and later publications retain their own effective start. Publication is a separate explicit step; unresolved overrideable conflicts require acknowledgement and a reason, while invalid relationships cannot be overridden.

Conflicts, Requests/Substitutions, Availability and Setup are persistent operational areas. Conflict links distinguish groups; requests have pending/approved/denied history and contextual before/proposal details. Teachers can propose substitutions, date moves or cancellations while requesting one/two-day absence; administrators resolve every affected lesson atomically. Availability separates the recurring week from dated restrictions. Setup groups versions, bell periods, cohort sources, numeric rooms and special-day actions. Published structures remain immutable; create a future draft to change the recurring pattern. Families only see scoped effective occurrences, substitutions/cancellations and their permitted child selector.

The approved dashboard meeting component remains illustrative meeting data. `დღის რიტმი` now presents today's real, scoped published lessons and opens the timetable. The design-lab remains an unchanged historical archive. Stage 1C adds an Attendance link from actual occurrence details without changing the approved meeting or day-rhythm semantics.

## Attendance product workflows

`/attendance` extends the selected product system. Teacher entry is today's current/needed lesson, exact compact roster, local Mark All Present, timed exceptions, then explicit sticky Submit. Unresolved, unsaved, submitted, overdue and locked states are distinct. Before-start availability refreshes without resetting an active edit. Corrections are deliberate; locked requests retain readable context. Timetable occurrence details and a restrained dashboard pulse link to the same workspace.

Administration has Today, Missing, Students/day state, History, Explanations and Correction Requests. Search and contextual filters avoid a permanent dropdown wall. Requests show original → proposed statuses and allow a focused adjustment before reasoned approval. Opening either decision queue refreshes requests from other sessions without resetting an active roll-call edit. Guardian/student monthly history has one child at a time, provisional percentages, daily drill-down and no internal teacher-oversight labels. Guardians submit a simple date/range explanation; approval never fabricates attendance. In-app notices link back to current history. Founders Office gets read-only overview/history, with no administrative decision controls.

Early Departure's contextual form explicitly distinguishes recording a time from administrative permission to release. Historical school documents do not replace the current configured calendar/bell schedule.

## Stage 1D academic journal

Teacher desktop uses one course lens, pupils vertically and assessments horizontally, with keyboard cell navigation and deliberate assessment inspection. Mobile selects an assessment first and opens the existing accessible sheet with a vertical roster and reachable save controls. Draft result changes remain local until Save Draft; Publish is a separate confirmation. Course/semester/route transitions ask before discarding local changes, and Cancel keeps the original scope. Published correction is a deliberate mode with a mandatory reason; descriptions/voids are separate reasoned actions.

Written feedback can be saved privately, reopened, edited, published and corrected with readable history. Grade V formative Homework is offered without pretending numeric Homework is valid. Families use published subject history and provisional reports, with explicit incomplete/recovery states and guardian-only comments separated from student-visible narratives. Leadership's opening surface shows publication/completion context and a recovery decision queue; it does not display teachers' private draft contents. Homeroom and Founders Office surfaces remain read-only where their server permissions require it.

The existing command palette links Gradebook and its recovery area; the dashboard shows a compact scoped academic pulse and notifications disclose only currently authorized result/comment destinations. These additions preserve timetable/day-rhythm/semester and approved dashboard composition.

## Login and overview refinement (3 October 2026)

The main entrance keeps the original layered lens and current form in a direct split. Identity is within the left pane; phone layouts prioritize access before the reduced lens/message. Remember-email is explicitly an identifier convenience only; recovery appears once beside it. The Dashboard uses a live Georgian weekday/date, time-aware greeting and a compact today-timetable action. It preserves all existing body read models and meeting/day-rhythm semantics. Guardians carry their selected child into the existing scoped timetable. The desktop rail can collapse without losing navigation destinations; keyboard focus exposes the same labels as hover. Mobile continues using the existing accessible drawer. See the canonical design-system document for typography, breakpoints and timing.
