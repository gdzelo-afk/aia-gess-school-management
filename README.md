# AIA-GESS · სასკოლო სივრცე

A Georgian-language school-management prototype developed voluntarily by a student development team. The team is building academic and administrative workflows to make school work easier for pupils, families and staff, without requesting compensation from the school for this development work. This is the management application, separate from the school's public website.

The intended school population is approximately **830 students, 830 parents or guardians, 50 teachers and 20 other staff**. These are planning figures, **not existing production users**. The school has not formally committed to a production rollout.

**Development prototype; publicly viewable, proprietary source.** Foundation and Stages 1A–1D have accepted development milestones. They are working foundations, not a production-ready school system. No open-source license is granted for the original application; see [licensing and ownership status](docs/licensing-status.md).

## Implemented scope

| Area                               | Current development capability                                                                                                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Foundation and accounts            | Password/session authentication, predefined roles and server-side resource scopes; invitations, activation/recovery and account disablement                                                                  |
| Academic structure and people (1A) | Years/two semesters, school calendar, subjects, course offerings, effective enrollment/transfer, guardian rights, staff assignments and historical relationships                                             |
| Timetable (1B)                     | Manual scheduling control room; private drafts/publication, effective occurrences, split/combined/elective groups, roster-based conflict checks, overrides, availability, substitutions and teacher requests |
| Attendance (1C)                    | Actual lesson roster, local unsaved roll call followed by explicit submission; late/early events, correction history, guardian explanations, oversight and scoped family history                             |
| Gradebook basics (1D)              | Draft/publication/correction workflows, formative/numeric/pass-fail assessment, Summative recovery, private versioned PDF criteria, academic comments and **provisional** reports                            |
| Shared product experience          | Georgian interface, light/dark themes, responsive navigation, contextual inspectors, keyboard controls and role-specific dashboards                                                                          |

Official semester/annual finalization, report cards, exams, assignments/submissions, operational finance, library, admissions, messaging and payroll are not implemented. Planned destinations identify themselves as unavailable. Staff attendance and external notification delivery are deferred. The preserved `/design-lab` is an isolated fictional A/B/C design archive, not additional operational functionality.

## Architecture

TypeScript and React/Vite on the client; Fastify, Drizzle ORM, PostgreSQL and Better Auth on the server. A modular monolith serves the browser build and API. Local development defaults to PGlite, an embedded PostgreSQL runtime. Committed migrations, scoped queries and immutable academic history are part of the implementation. There is no speculative multi-school tenancy or microservice layer.

Start with [the documentation index](docs/README.md), [implementation status](docs/implementation-status.md), [architecture](docs/architecture.md) and [domain model](docs/domain-model.md). The [design system](docs/design-system.md) records the accepted product direction.

## Run locally

Requires Node **22.12+**, npm and a local filesystem. Docker is not needed for the default database.

```sh
npm ci
npm run setup
npm run dev
```

Open **http://localhost:5173**. Setup creates an ignored `.env` with a random local authentication secret, applies committed migrations and seeds fictional data in `.local/database`. Repeating setup preserves the existing environment and data. **Stop the app before migration/seed commands against that PGlite directory: it has one process owner.** No email/SMS provider is invoked.

Select a demo persona on the sign-in screen, or use these deliberately public, fictional local accounts:

| Persona  | Email                     |
| -------- | ------------------------- |
| Director | `director@demo.aia.local` |
| Teacher  | `teacher@demo.aia.local`  |
| Parent   | `parent@demo.aia.local`   |
| Student  | `student@demo.aia.local`  |

Local demo password: `AiaDemo-2026!`. These accounts passed normal-demo browser sign-in/scope checks on 9 October 2026; that is dated evidence, not a claim of a fresh check on every README view. Demo seeding is refused in production. Never put real school data in the demo. HTTP 429 indicates throttling; respect the retry timing rather than repeatedly signing in.

The sample calendar is configured for 2026–27. Some agenda/history examples use explicitly fictional September dates. Historical fixtures and illustrated amounts are not real school records.

## Checks and development commands

| Command                    | Purpose                                                                   |
| -------------------------- | ------------------------------------------------------------------------- |
| `npm run setup`            | Create local environment, migrate and seed                                |
| `npm run dev`              | Frontend :5173 and API :3001                                              |
| `npm run check`            | ESLint, formatting, strict TypeScript, PGlite tests and production builds |
| `npm run test:e2e`         | Isolated Chromium browser workflows                                       |
| `npm run db:migrate`       | Apply reviewed, committed migrations                                      |
| `npm run db:migrate:built` | Apply migrations with the compiled server entry                           |
| `npm run db:seed`          | Fictional development seed only                                           |
| `npm run build`            | Build browser, server and migration artifacts                             |
| `npm start`                | Serve the built application/API on :3001                                  |

The [Foundation checks workflow](.github/workflows/ci.yml) also runs integration tests against PostgreSQL and browser workflows on fresh fictional data. The accepted master revision `6cdf9b5` passed [post-merge CI](https://github.com/gdzelo-afk/aia-gess-school-management/actions/runs/37942417620): **161 tests on each database engine and 40 browser workflows**. These results belong to that revision/run, not to all branches or future commits. See [the readiness review](docs/repository-readiness.md) for current validation and known failures, including the separate preview branch.

Browser tests provision their own API :3101, frontend :5273, database and private-file directory under ignored `.local/browser-runs/run-*`; they refuse occupied ports and never borrow the normal preview/database. No manual seed or running preview is needed. Install Chromium with `npx playwright install --with-deps chromium`, and set `CHROME_PATH` to its executable if `/usr/bin/google-chrome` is unavailable. Local screenshots/traces remain ignored; CI publishes only fictional screenshots, not raw session-bearing trace archives. See [engineering guidance](docs/engineering.md).

For PostgreSQL development, configure a dedicated database through `DATABASE_URL`, then apply migrations; seed only in development demo mode. For `npm test` on PostgreSQL, set `TEST_DATABASE_URL`, `TEST_TIMETABLE_DATABASE_URL`, `TEST_ATTENDANCE_DATABASE_URL`, `TEST_GRADEBOOK_DATABASE_URL` and `TEST_GRADEBOOK_DEMO_DATABASE_URL` to **five distinct disposable databases**. Tests perform writes; never use real data.

For a local built-app smoke, stop dev and run `npm run build`, then `APP_ORIGIN=http://localhost:3001 npm start`. This uses the local development/demo configuration. Production mode requires HTTPS, external PostgreSQL and demo disabled.

## Security, privacy and limitations

Read [SECURITY.md](SECURITY.md) before reporting a vulnerability and [security/privacy requirements](docs/security-privacy.md) before handling data. GitHub [private vulnerability reporting](https://github.com/gdzelo-afk/aia-gess-school-management/security/advisories/new) is enabled; the policy explains confidential reporting and its limits. Do not publish secrets, school records or exploit details in issues.

This repository review is not an external security audit, compliance certification or production authorization. Current dependency advisories and asset-rights gaps are recorded in the [readiness review](docs/repository-readiness.md) and [licensing status](docs/licensing-status.md). MFA, real invitation/recovery delivery, operational monitoring, backup/restore, provider/retention agreements, accessibility review and further security hardening remain launch gates. No student data should be deployed before school approval and those gates.

A separate, protected temporary Render review environment was deployed from `codex/temporary-review-preview`; its infrastructure is not part of master or the normal local setup. It is a fictional demonstration, not the school's production service. This readiness task does not change or redeploy it.

## Licensing and possible future tools

The original application is **proprietary and not released under an open-source license**. Copyright and other applicable rights remain with their respective rightsholders; formal ownership and contributor permissions still require verification. Public GitHub visibility permits viewing/forking under GitHub's terms but does not itself grant a general right to modify, redistribute or sublicense the original application. Third-party components retain their separate licenses. `private: true` prevents accidental npm publication; it does not make the GitHub repository private. `UNLICENSED` is a package marker, not the permissive Unlicense.

The team may later publish selected independent automation tools after checking their usefulness, ownership, separation from proprietary school code and licensing suitability. No such tools are ready for publication; no release date or open-source license is announced. See [licensing and asset evidence](docs/licensing-status.md).
