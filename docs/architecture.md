# Technical architecture

## Runtime

TypeScript modular monolith: React/Vite browser application → same-origin Fastify API → Drizzle → PostgreSQL. Local development can use persistent PGlite (embedded PostgreSQL) without Docker; deployment uses PostgreSQL via node-postgres. The schema and generated SQL migrations are shared. PGlite is a local convenience, not a production database architecture.

One repository, one lockfile, one application deployment serving built static frontend and API. Vite dev server proxies `/api` to Fastify. No SSR is needed for an authenticated operational app. No Redis, service mesh, external search, message broker or tenant abstraction in the foundation.

```
src/
  components/       reusable primitives and shell
  pages/            route-level UI
  lib/              API client, formatting, local preferences
  styles/           tokens and component/application styling
shared/             DTOs, role names/capabilities, Georgian labels
server/
  auth/             Better Auth configuration and session resolution
  db/               schema, database adapter, migration/seed scripts
  modules/          scoped foundation queries; future domain services
  infrastructure/   jobs/storage contracts and audit helper
  app.ts            transport construction
  index.ts          lifecycle/bootstrap
migrations/         reviewed generated SQL and journal
scripts/            local setup and verification utilities
tests/              integration/unit and browser checks
docs/               current product/engineering context
```

## Boundaries and application code

HTTP parses and validates input, resolves session/capabilities, calls module query/service and serializes an explicit DTO. Services own business transactions. Queries embed authorization constraints before selection. UI visibility is convenience only. Don't import database/server modules from frontend. Shared DTOs expose minimal projections, never raw database rows or auth secrets.

React Router handles routes; TanStack Query handles server state, cache lifecycle, loading/retry. Local component state handles ephemeral forms/dialogs. Preferences may use versioned localStorage, never session tokens or school data. Clear query cache on sign-out/account change. Avoid a global state framework until justified.

## API conventions

- JSON under `/api`; foundation examples under `/api/foundation`. Evolve domain routes when features exist, not generic CRUD endpoints.
- Zod validation at boundary. Strict input shape; client cannot set role grants via registration or profile edits.
- Error `{error:{code,message,requestId}}`, Georgian user message; 400 validation, 401 no session, 403 capability denied, 404 missing/invisible resource, 409 conflict, 429 throttling. Do not leak invisible record existence.
- List requests have bounded limit <=100, offset initially; stable order and count under the same scope. Cursor pagination when a real history query needs it.
- Same-origin cookies, no bearer token in browser storage, no permissive credentialed CORS. Trusted origin validation for mutation routes.
- Sensitive reads return `Cache-Control: no-store`; future downloads reauthorize. Idempotency keys for payments, notifications and bulk imports.
- `/api/health` tests DB availability without details. Production logs include request IDs and latency but not request bodies/cookies.

## Storage

Metadata and ownership in PostgreSQL. Define private blob-store port; production adapter should be S3-compatible object storage, local private directory during development. No public uploads implemented now. Future flow: validate intent/size/type → quarantine opaque key → malware scan/type verification → attachment authorization → release → short-lived signed access. Deny executable HTML/SVG inline display; never trust filename or client MIME. Expiration/version reminders via outbox. E-signature provider later, bound to exact document digest/version.

## Jobs / realtime / notifications

Database outbox foundation stores job kind, payload, deduplication key, attempts, availability and status. Domain mutation + outbox + audit commit together. Future PostgreSQL worker uses row locking with SKIP LOCKED, retry with jitter, max attempts/dead letter and lease recovery. No delivery worker runs in this foundation; no misleading sent state.

Future notifications: domain event → recipient policy → preferences/emergency policy → channel deliveries, each with idempotency and outcome. Never include sensitive pupil/finance data in lock-screen/SMS content by default. Select email/SMS provider at integration; no provider lock-in abstraction beyond a narrow delivery port. Push subscription lifecycle belongs to notification domain.

Use SSE for one-way notification/job refresh when needed. Authenticated conversation realtime may later use WebSockets, with permission checks on join and each publish. Start with bounded query refresh, not a premature realtime service.

## Reporting and finance

Permission-aware SQL read models first; bounded filters, period and denominator on every measure. Saved views store typed definitions, not raw SQL. Custom reporting uses allowlisted fields/joins/operators; row policies apply to preview, totals and export job execution. CSV mitigates spreadsheet formula injection; Excel preserves types; PDF pins render data/template/font versions. Scheduled exports reauthorize when run and again on download; expire artifacts.

Financial amounts use integer tetri, GEL currency explicit, deterministic decimal conversion at boundaries. Invoice issue and payment allocation are transactions. Parent finance repository requires a current finance-enabled guardian relationship independently of generic student view. No whole-school finance aggregate is ever returned in the guardian DTO.

## Migration utility (future)

Obtain actual EduPage export formats first. Import into staging with source identifiers/checksums and batch IDs; dry run validates identities, dates, grades, duplicates, relation completeness and totals. Human resolves ambiguous identity matches. Commit bounded idempotent batches; audit mappings and reconcile source/target counts and totals. Rollback unreferenced batches; otherwise compensating corrections. Back up before commit. No invented source dataset or daily migration module.

## Stage 1A operational slice

`shared/stage1a.ts` defines strict commands and DTOs; `server/modules/academics.ts`, `people.ts`, `onboarding.ts` own transactions and scoped read models. `stage1a-routes.ts` is transport only. `/api/academics`, `/api/people`, `/api/accounts` expose bounded reads; their `/actions` endpoints accept explicit domain commands rather than raw table updates. Public `/api/onboarding/activate` and `/recovery` are origin/rate protected. `/api/config` also reports local delivery availability.

The main UI adds AcademicManagement, StudentAdministration, PeopleManagement and Accounts, with reusable focused fields, asynchronous identity selection and review-before-save dialogs. Activation/recovery use real routes outside the authenticated shell. Query invalidation refreshes domain data without re-fetching static config/session after every mutation. No new frontend dependency or lab coupling was introduced. Delivery remains one contained local adapter in onboarding; provider/outbox delivery is deferred.
