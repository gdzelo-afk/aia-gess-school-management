# AIA-GESS · სასკოლო სივრცე

A Georgian-only school workspace with Stage 1A academic structure/people, Stage 1B manual timetable, Stage 1C lesson attendance and Stage 1D academic Gradebook workflows. React/Vite + Fastify + Drizzle/PostgreSQL + Better Auth. This is a polished local demonstration and engineering baseline, **not a production-ready school system**.

## Run locally

Requires Node 22.12+ and npm. No Docker is needed for the default local database.

```sh
npm ci
npm run setup
npm run dev
```

Open **http://localhost:5173**. Setup creates an ignored `.env` with a random local auth secret, applies migrations, and seeds fictional data in `.local/database` (PGlite, embedded PostgreSQL). Stop the app before running migration/seed commands against that embedded directory; one process owns it at a time. Setup can be repeated and preserves existing `.env`/data. No external services, emails or SMS are invoked.

Select one of four demo roles on the sign-in screen, or sign in with:

| Persona  | Email                     |
| -------- | ------------------------- |
| Director | `director@demo.aia.local` |
| Teacher  | `teacher@demo.aia.local`  |
| Parent   | `parent@demo.aia.local`   |
| Student  | `student@demo.aia.local`  |

Local demo password for these accounts: `AiaDemo-2026!`. All four passed browser sign-in and role/scope checks against the preserved normal local database on 3 October 2026. These credentials are deliberately public and fictional. Demo seeding is refused in production. Never use the demo database for real deployment. Repeated automated/manual sign-ins share a local request budget; HTTP 429 means wait one minute, not a wrong password. Do not run mutation browser tests on the manual-preview server.

## What works

- Georgian login and four distinct dashboard experiences; original light/dark design, self-hosted Georgian typography, responsive navigation.
- Real password/session authentication, role grants and SQL-scoped student queries (director 44, teacher 34, guardian 2 children, student 1 in the expanded fictional demo).
- Scoped searchable student administration, effective enrollment/guardian history, academic year/semester/calendar configuration, subjects/offerings/elective rosters, staff/teaching assignments and account invitation/activation/recovery/disable.
- `/timetable`: scheduling control room with one searchable section/group/teacher/room lens, aligned period matrix, contextual inspector, changes-before-publish review and operational conflict/request/availability/setup areas. Includes versioned private drafts/publication, configurable bell periods and numeric rooms, split/combined/elective groups, roster-based conflicts and reasoned overrides, dated substitutions, teacher availability and approval requests. Dashboard day rhythm reads the scoped published timetable; the illustrative next-meeting block remains an agenda concept.
- `/attendance`: teacher lesson-first roll call with local-only Mark All Present and explicit atomic submission; timed late/early exceptions, reasoned corrections/history, locked teacher requests, guardian explanations, missing-roll-call oversight and scoped monthly history. Founders Office is read-only. Guardian event notices remain in-app only.
- `/gradebook`: dense course journal, assessment-first mobile sheet, local draft editing and explicit publication, reasoned corrections/history, formative/1–10/pass-fail results, Summative recovery/extension decisions, guardian-only academic comments and annual narratives. Scoped reports expose exact and rounded **provisional**, never official, results. Private versioned PDF criteria and in-app notices preserve historical meaning.
- Reviewed SQL migrations, repeatable fictional seed, temporal identity/academic baseline, protected audit events, metadata/outbox foundations.
- Staff/parent/student sample data, illustrative 1–10 grades and GEL invoice preview. Fictional fixed-date agenda: 28 September 2026. Attendance seed adds an explicitly fictional historical week (21–25 September) idempotently; today/future roll calls stay unfilled.

Other module destinations show an explicit planned state. Stage 1D Gradebook is accepted for the local/demo scope at `3293a50`, on `master` and tagged `stage-1d-complete-2026-10-03`. Finance, library, admissions, messaging and payroll writes remain unimplemented.

## Selected product design

The real [Login](http://localhost:5173/login) and [Dashboard](http://localhost:5173/) now use the selected, refined Vector A system: Mersad interface typography, NeoBau numerical display, Option A Mersad display greeting, original A translucent lens artifact, deliberate light/dark modes and keyboard command search. The controlled Login/Dashboard refinement adds a live Georgian greeting/date, today-timetable action, collapsible desktop rail and direct login split; it is isolated on `redesign/dashboard-login-option-a` for review. Read [the canonical design system](docs/design-system.md). The same shell, tokens and controls now extend across main routes, including the functional Students workspace and operational Academics and explicitly planned Messages surfaces. The design-lab and all A/B/C references remain intact.

The [design lab](http://localhost:5173/design-lab) and [typography comparison](http://localhost:5173/design-lab/type) remain archival references, not active alternatives.

## Project context

Start with [docs/README.md](docs/README.md) and [implementation status](docs/implementation-status.md). [Design](docs/design-system.md), [domain model](docs/domain-model.md), [security](docs/security-privacy.md), and [roadmap](docs/roadmap.md) guide subsequent tasks. Update docs when requirements change.

## Commands

| Command                    | Purpose                                                             |
| -------------------------- | ------------------------------------------------------------------- |
| `npm run setup`            | Create local environment, migrate, seed                             |
| `npm run dev`              | Vite :5173 and API :3001                                            |
| `npm run check`            | Lint, formatting, strict types, integration tests, production build |
| `npm run test:e2e`         | Chromium browser workflows; requires setup first                    |
| `npm run db:generate`      | Generate reviewed migration after schema edits                      |
| `npm run db:migrate`       | Apply committed migrations                                          |
| `npm run db:migrate:built` | Apply migrations using the compiled production entry                |
| `npm run db:seed`          | Non-production fictional seed only                                  |
| `npm run build`            | Build browser and server artifacts                                  |
| `npm start`                | Serve built app/API on :3001                                        |

For a local built-app smoke test, stop dev then run `APP_ORIGIN=http://localhost:3001 npm start` and open that origin. This intentionally retains development/demo mode. Production mode requires HTTPS, PostgreSQL and demo disabled.

Browser tests perform real writes against a fresh disposable database and private-file directory under `.local/browser-runs/run-*`. `npm run test:e2e` starts/migrates/seeds its own API :3101 and frontend :5273, provisions scoped fictional test identities, and refuses occupied ports. No manual seed command or running preview is needed. Normal :5173 and `.local/database` are not reused. The harness retains actual authentication/rate limits and paces requests. Chrome defaults to `/usr/bin/google-chrome`; set `CHROME_PATH` for another Chromium executable. Screenshots/traces remain ignored in `test-results/`. See `docs/engineering.md`.

## External PostgreSQL

Use a dedicated empty database and set `DATABASE_URL=postgresql://...` in `.env`. Apply the same migrations; seed only in demo development. `TEST_DATABASE_URL=postgresql://... TEST_TIMETABLE_DATABASE_URL=postgresql://... TEST_ATTENDANCE_DATABASE_URL=postgresql://... TEST_GRADEBOOK_DATABASE_URL=postgresql://... TEST_GRADEBOOK_DEMO_DATABASE_URL=postgresql://... npm test` runs integration tests against a **dedicated disposable test database**; do not point this at real data. Use five distinct fresh disposable databases for foundation, timetable, attendance, Gradebook domain and Gradebook demo tests. CI creates all five.

## Deployment boundary

`Dockerfile` packages the single Node application. PostgreSQL, TLS, secrets, actual invitation/recovery delivery, MFA, storage pipeline, delivery workers, monitoring and backup restore remain production work. See [release gates](docs/engineering.md). No hosting has been provisioned or deployed.

Original AIA-GESS mark is used with user authorization. Legacy Noto fonts are SIL OFL; notices in `public/fonts/`. Selected Mersad/NeoBau/GL Tatishvili source records and embedded notices are in `public/fonts/product/`; production license verification is required before external distribution. Archived lab fonts retain separate records in `public/design-lab/fonts/`. Dependencies are governed by their own licenses; the private project has no public distribution license assigned.
