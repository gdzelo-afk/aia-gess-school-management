# Engineering and operations

## Standards

Strict TypeScript; Zod inputs; ESLint + Prettier; committed npm lockfile; Node 22. Separate transport, domain services and database access. Dependencies are selected for concrete needs. No generic repository framework, duplicate DTO universe, premature monorepo orchestrator or speculative service interfaces.

Changes include docs when a decision/contract changes. Migrations generated from schema, reviewed, committed and applied explicitly; never use schema push in shared/production databases. Seed only fictional data, deterministic/idempotent and refused in production. Secrets stay in ignored `.env`; example contains no deployment credentials. Font licenses are distributed alongside local assets.

## Verification mix

- Unit: permission decisions/formatters/environment constraints, especially role combinations.
- Integration: migrate an isolated embedded PostgreSQL database, seed, run real Better Auth sign-in, session handling, scoped list/detail, denied aggregates, validation and audit immutability. Also run same suite against PostgreSQL in CI.
- Browser: sign-in, principal shell, search, sorting/filtering/pagination, theme and settings persistence, mobile navigation, teacher/guardian/student scope, keyboard dialogs. Screenshots for layout review; no hundreds of snapshot-only component tests.
- Build: production browser bundle and bundled server, production-mode local smoke with non-demo config before launch.
- Accessibility: keyboard, labels, reduced motion and automated smoke where practical. Formal WCAG 2.2 AA review deferred.

## Performance budgets (targets, not measured guarantees)

- Warm API scoped list p95 <200ms at school scale; first app content <2s on ordinary broadband, route interaction <150ms once cached.
- Initial compressed JS target <200KB; loaded fonts <200KB ideally; lazy-load future charts/editors.
- Lists bounded to 100 rows per request, visible pages 6–25 rows; no fetch-all of production school records.
- Avoid N+1 via scope joins and batched relationships. Measure real queries before adding cache/search infrastructure.
- Analytics include period, denominator, data freshness; no invented performance claims.

## Deployment path

Single Node process serves static Vite build + Fastify API, behind managed TLS, with managed PostgreSQL and private object storage when uploads ship. Region/provider chosen after school agreement; inexpensive managed services acceptable. Worker may run same artifact as second process when jobs need it. No cloud resources or public deployment are provisioned by this task.

Production requires `NODE_ENV=production`, `DEMO_MODE=false`, strong auth secret, HTTPS APP_ORIGIN, external PostgreSQL URL. Configure trusted reverse proxy explicitly; never blindly trust forwarded IPs. Build with locked deps, run `node dist/server/migrate.js` as a release step with a separate privileged DB role, then deploy. Use DB connection pooling and bounded shutdown. Container recipe and CI are foundations, not evidence of production hardening.

## Observability

Pino structured request logs, request IDs and health check. Redact authorization/cookies/set-cookie, never log input bodies or student DTOs. Capture operation names/status/duration, not personal names. Future error reporting must scrub personal data. Monitor HTTP errors/latency, DB connectivity/pool saturation, job oldest age/retry/dead letter, notification outcomes, file scan queue and backup freshness. Alert on operational failures rather than pupil data. No analytics tracker in browser.

## Backup and recovery

Production managed daily backups/PITR recommended; encrypt at rest and restrict operator access. Agree RPO/RTO before launch; provisional target RPO <=24h, RTO <=1 working day subject to school confirmation. Restore to isolated environment and verify record counts/publication/payment integrity before go-live and periodically. Include objects, keys/config and migrations. Advanced disaster recovery deferred; an untested backup is not a completed launch gate.

## Release gates

1. Full authorization/privacy/security and dependency review; MFA/recovery/provisioning complete.
2. Georgian copy reviewed by school; semester/grade/report/finance policy confirmed.
3. External PostgreSQL migrations and rollback strategy tested on staging.
4. Backup restore, logging redaction, rate limits and incident contacts verified.
5. Formal accessibility review and representative real-device testing.
6. Demo accounts absent from production database; fixtures cannot appear in live school dashboards.
7. Approved data retention/provider arrangements and staff onboarding.

## Operational browser verification

The browser suite writes real fictional records. Stop the normal dev server first. Use a new dedicated database directory per full run; do not reset the normal `.local/database`:

```sh
DATABASE_URL=pglite://.local/e2e-run npm run db:migrate
DATABASE_URL=pglite://.local/e2e-run npm run db:seed
DATABASE_URL=pglite://.local/e2e-run npm run test:e2e
```

Playwright starts the application with that environment when no server exists. Never reuse a normal running dev server for mutation tests. Use a fresh dedicated directory when repeating the full baseline-count suite. The Stage 1A and timetable browser journeys run after the original read-only/lab tests and create uniquely labeled records; they reuse administrator authentication, wait for the preceding suite’s sign-in window to expire and pace writes/full-page visual reloads to respect existing limits. They do not bypass auth. Playwright waits on the proxied `/api/health` endpoint so both Vite and the database-backed API are ready; waiting on HTML alone can race API startup. The directory-layout check reuses the real Director cookies established in its workspace test file; isolated execution still signs in normally. Stop the test server before resuming `npm run dev` against the normal database. Recovery delivery files remain private under ignored `.local/delivery`; tokens never belong in screenshots/logs shared externally.

PostgreSQL integration verification uses separate disposable databases for `TEST_DATABASE_URL` (foundation/Stage 1A) and `TEST_TIMETABLE_DATABASE_URL` (Stage 1B). Never point both concurrent suites at the same database. Timetable migrations and fictional seed are part of the normal setup; seed preserves subsequent administrator edits.

### Attendance acceptance data

Use a fresh disposable browser database for full write regression. With its server stopped, migrate and seed it, then run `DATABASE_URL=pglite://.local/browser-test npx tsx scripts/prepare-attendance-browser.ts`. The fixture script refuses normal non-CI database paths and production mode; it creates a fictional Founders Office identity with a normal Better Auth credential and scoped role. Run dev/E2E against that same explicit URL. Keep normal `.local/database` separate. No authentication or API rate limits are disabled: harnesses reuse real sessions and honor reset timing.

PGlite tests use in-memory databases. PostgreSQL verification needs three distinct empty disposable databases supplied through `TEST_DATABASE_URL`, `TEST_TIMETABLE_DATABASE_URL` and `TEST_ATTENDANCE_DATABASE_URL`. Migrations, explicit seed repetition and normal preview setup require a single PGlite process owner. Browser storage states/traces/screenshots remain ignored; never add them to a commit. Stage 1C is reviewed on its branch only; preserve the Stage 1B completion tag and private master milestone.
