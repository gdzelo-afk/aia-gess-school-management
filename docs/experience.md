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
