# Roadmap, risks and stakeholder decisions

| Phase                     | Scope                                                                                                                                                                                            | Depends on                                         | Exit evidence                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| F — foundation (complete) | Planning, shell/design tokens, login/session, scoped RBAC, temporal baseline, migrations/fictional seed, API, audit/outbox/file contracts, checks/CI                                             | Empty repository                                   | Builds; representative role isolation passes; desktop/mobile and both themes reviewed        |
| 1 — daily school core     | Invitations/recovery/MFA, school years/semesters, student/guardian/staff management, effective rosters, manual timetable/conflicts, attendance, gradebook basics, announcements, role dashboards | F; stakeholder policy                              | Teacher completes real day; guardian cannot cross family boundary; transfer/correction tests |
| 2 — learning and family   | Assignments/submissions/review, exams/electives, report cards/transcripts, family portal/meetings, tuition invoices/payments/receipts, communication and channels                                | Reliable rosters, assessment policy, file pipeline | Published records stable; finance totals/reversals reconcile; scoped exports verified        |
| 3 — full operations       | Clubs/events, behavior/awards, library, visitors, forms, certificates/digital IDs, alumni, staff attendance/payroll/expenses, custom/scheduled reports                                           | Core identity/domain history and notification jobs | Operational role acceptance and audit completeness                                           |
| 4 — expansion             | Admissions/contracts/e-signature, payment provider, validated EduPage migration, optional timetable generator                                                                                    | Actual data/provider/policy requirements           | Reconciliation and external integration failure/retry tests                                  |
| Launch hardening          | Security/privacy/dependency review, production auth/config, formal accessibility, backup restore, load tests/observability                                                                       | Implemented launch scope                           | Explicit release gates in engineering document                                               |

This preserves the full product vision; phase 1 is not a promise to implement every module at once. Each module ships as a vertical slice with usable workflow, authorization and history, not a table-per-noun CRUD exercise.

## Current sequence

- **1A — Academic Structure + People / Onboarding:** **complete and verified** for the local/demo scope; evidence recorded in implementation-status. Editable academic calendar, temporal enrollment/electives/assignments, student/guardian/staff workflows and administrator-controlled account lifecycle.
- **1B — Timetable: complete and verified, including the scheduling-control-room UX correction.** Manual versions/publication, roster-aware conflicts, split/combined groups, rooms/bells, availability, substitutions/requests and effective occurrences. See implementation-status for current evidence.
- **1C — Attendance: complete and verified for the local/demo scope.** Exact occurrence/roster snapshots, explicit teacher roll call, immutable corrections, guardian explanations, scoped history and missing-roll-call control room. See implementation-status for final evidence.
- **1D — Gradebook basics: next implementation stage (not started).** Publication/correction policy before official results.
- **Authentication hardening:** MFA/recovery codes, real delivery provider and production onboarding acceptance before launch. No partial MFA UI in Stage 1A.

## Open questions and reversible defaults

| School decision                                                                     | Current safe default                                                       | Needed before        |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------- |
| Actual semester dates, lesson periods and holidays                                  | Fictional labeled calendar; dates configurable                             | Academic setup       |
| Semester final-grade calculation/rounding and exam influence                        | No computed official final grade; 1–10 raw scores only                     | Report publication   |
| Who approves corrections after publication                                          | Explicit approval architecture, no publication writes                      | Report cards         |
| Guardian custody/access restrictions and financial payer rights                     | Equal normal guardian rights on new links; preserve effective restrictions | Real guardians       |
| Required consent/legal bases, retention and DPO/DPIA obligations                    | Minimize data, no real records imported                                    | Production           |
| Tuition contracts/installments, scholarships, late fees, refunds and payroll policy | GEL integer amounts; no automated fee policy                               | Finance              |
| Which student ages use independent accounts                                         | Separate student layout, no PIN shortcut                                   | Account rollout      |
| Official report/certificate signatories and e-signature validity                    | Versioned templates, provider deferred                                     | Issuance             |
| Emergency communication audience/channels and escalation                            | No external broadcast delivery in foundation                               | Notifications        |
| Exact EduPage export schema/history and reconciliation owners                       | No import implementation or invented mapping                               | Migration            |
| Hosting budget, RPO/RTO and support ownership                                       | Portable Node/PostgreSQL; provisional budgets                              | Deployment           |
| Final branding/legal name and Georgian copy                                         | Public AIA-GESS name/authorized logo, fictional people                     | Launch copy approval |

## Risks / debt warnings

- PGlite is useful for local development but cannot validate all PostgreSQL concurrency/deployment behavior; PostgreSQL CI is required as features grow.
- Stage 1B isolates substitutes to actual timetable occurrences; Attendance reuses this responsibility model without widening directory access.
- Overview examples are deliberately fixtures and visibly labeled. Never silently promote them to live metrics.
- Local theme/density are device preferences; per-user persistence later must not leak between shared-device accounts.
- Auth plugins are architectural extension points, not completed SSO/MFA/passkey implementations.
- Stage 1A transfer/withdrawal uses effective intervals, transactional overlap guards and version checks. No automatic promotion or staff rehire model is implied.
- Storage/outbox schemas are not a working upload/delivery system. No public endpoints until complete authorization and failure behavior exist.
- Font/UI copy review by Georgian school users and formal accessibility remain necessary.

## Explicit deferrals/exclusions

Deferred: full admissions, online payments, migration, production hardening, formal audit, deep optimization, automatic scheduling, nonessential integrations, native mobile/PWA and advanced disaster recovery. Excluded: AI, ERP/general ledger, transportation, meals, dormitories, clinical/counseling records, asset/facility systems, WhatsApp/Telegram and generic multitenant SaaS infrastructure.
