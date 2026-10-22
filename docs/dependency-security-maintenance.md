# Bounded dependency security maintenance

Verified 22 October 2026. This is dependency maintenance for the accepted prototype, not a product release, penetration test or production-security certification. The separate maintenance PR requires manual acceptance; its candidate results do not mean that the older master lockfile has already been remediated.

## Exact changes

| Package                 | Previous lock | Candidate lock | Purpose                                                    |
| ----------------------- | ------------- | -------------- | ---------------------------------------------------------- |
| Vite                    | 8.3.1         | 8.3.3          | Six development-server advisories                          |
| Vitest / @vitest/mocker | 5.0.2         | 5.0.3          | Two mocker development/browser interception advisories     |
| Concurrently            | 10.0.5        | 10.0.6         | Select patched shell-quote through the upstream dependency |
| shell-quote             | 1.9.0         | 1.12.0         | Reject line terminators following shell-comment tokens     |
| source-map-js           | 1.2.1         | 1.2.2          | Reject pathological indexed-map section offsets            |

Related Vitest spy/magic-string resolutions follow those patch releases; Vitest now pins why-is-node-running 3.2.1 instead of the former 3.2.2 resolution. No application framework, authentication package, academic rules, schema, deployment configuration or override policy is changed. The existing esbuild override is retained; no new override is added.

## Advisories and applicability

- [shell-quote GHSA-pqg4-j6r4-53mv](https://github.com/advisories/GHSA-pqg4-j6r4-53mv): Concurrently introduces shell-quote. Exploitation requires an attacker-controlled argument containing a line terminator after a comment token and subsequent shell execution. This repository's fixed development command does not demonstrate that chain. A regression verifies rejection without executing the input, alongside safe literal quoting.
- [source-map-js GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q): source-map tooling can consume hostile indexed offsets that cause excessive allocation. No public source-map ingestion endpoint is demonstrated here. A regression verifies invalid offset rejection and valid map resolution without attempting memory exhaustion.
- Mocker [GHSA-qxg6-89mg-rqv8](https://github.com/advisories/GHSA-qxg6-89mg-rqv8) and [GHSA-xp26-3454-mjgp](https://github.com/advisories/GHSA-xp26-3454-mjgp): require exposed interception/WebSocket tooling; the latter is Windows-specific. The configured Node test environment and ordinary app Vite server do not register that public interceptor. Presence alone does not establish exploitability.
- Vite [GHSA-698v-4r3x-3vcv](https://github.com/advisories/GHSA-698v-4r3x-3vcv), [GHSA-r825-w8mm-5pxw](https://github.com/advisories/GHSA-r825-w8mm-5pxw), [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm), [GHSA-9jrq-w75r-8gcw](https://github.com/advisories/GHSA-9jrq-w75r-8gcw), [GHSA-rq7h-c2jc-7f22](https://github.com/advisories/GHSA-rq7h-c2jc-7f22) and [GHSA-vfpm-58rq-9qcg](https://github.com/advisories/GHSA-vfpm-58rq-9qcg): the Vite editor-launch cases require their respective Windows or WSL conditions (the Vite CLI-flag case also requires attacker-created filesystem entries and a susceptible editor); the middleware XSS case requires a custom integration absent here; filesystem/Wasm probes require development-server access. The normal localhost boundary and denied private paths remain. A browser regression probes only the committed fictional `.env.example` and verifies HTTP 403 with no Wasm four-byte disclosure. Never probe actual credentials as test fixtures.

The compiled Fastify application serves built files and does not start the Vite development server or Vitest interceptor. Production dependency presence and runtime reachability are separate questions.

## Installation graph

Better Auth 1.7.6 declares an optional Vitest peer. In this lockfile, the root Vitest development dependency satisfies it, and `npm ci --omit=dev` still installs Vitest → Vite → source-map-js. An isolated `--omit=peer` trial does not remove that resolved graph. Better Auth's application entry does not import its separate test-utils subpath in the reviewed runtime graph.

This PR keeps those installed packages patched; it does not hand-delete dependencies, weaken authentication, change Docker or claim that production contains no test tooling. A future clean production composition may be investigated separately with authentication/runtime regression coverage.

## Verification

The first hosted PR run exposed an existing minute-boundary fixture race: the lesson start used one `Date.now()` call while the later arrival input used another. Crossing a minute produced a legitimate 14-minute value against an expected 13. The browser fixture now derives all lesson/arrival offsets from one captured timestamp; the exact approximate-lateness assertion remains unchanged. No product clock or attendance rule is altered. A subsequent school-hours run correctly rejected the fixture move because it collided with normal lessons. The fixture now previews those collisions, asserts an unreviewed move is rejected with HTTP 409, and uses only exact-key, reasoned overrides for teacher/room/student collisions through the existing Director API. Availability or domain conflicts still fail the fixture; no production conflict check is relaxed.

The mobile keyboard-navigation check now waits for the daily summary before traversing the tabs, retaining its focus, full-visibility and manual-activation assertions. A controlled response delay confirmed that the existing asynchronous overdue badge can widen an earlier tab after focus, clipping the last tab by approximately 14px; traversal after data readiness remains visible. This pre-existing late-layout focus edge is a separate UI follow-up, not a demonstrated dependency regression or a product fix in this PR.

Candidate validation uses a clean installation and fictional isolated databases. Full and production npm audits report zero advisories at the recorded check time. The two new unit checks distinguish vulnerable and patched behavior without executing hostile commands or allocating pathological maps. The browser check exercises the actual Vite denial boundary. Formatting, ESLint, strict TypeScript and production builds passed. The complete suite passed 163 tests on PGlite and 163 on PostgreSQL; all 41 browser workflows passed. The actual development command started both children and denied the public environment-example Wasm probe. A clean production-only install passed compiled-runtime checks under HTTPS with PostgreSQL and demo mode disabled: Director, Teacher, Guardian and Student authentication, Secure/HttpOnly cookies, scoped reads, unrelated-student denial and Timetable/Attendance/Gradebook loads. The browser React renderer reported production bundle type 0 and no runtime errors. Hosted results must be checked against the PR revision before acceptance.

Security feeds can change. Zero audit advisories is not a guarantee that all vulnerabilities are known or that the application is production ready. Existing dependency deprecations and PostgreSQL concurrent-query warnings remain ordinary maintenance; broad upgrades are outside this bounded change.
