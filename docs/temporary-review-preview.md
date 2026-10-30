# Temporary external review preview

`render.yaml` creates a temporary, passcode-gated review deployment in Frankfurt. It uses a separate Render PostgreSQL database seeded only with fictional demo data; it never connects to `.local/database`. The server requires HTTP Basic credentials before serving the application or API, except the non-sensitive database health check. Render generates the shared passcode and the Better Auth secret; retrieve the passcode from the private service environment and share it with reviewers through a separate channel.

The preview image excludes `/design-lab` static assets, and the server returns 404 for its routes. The source archive, local routes, experiments and fonts are unchanged. The public product UI uses only the selected production font files. The maintainer has confirmed web-use permission; public binary redistribution, school branding and contributor rights remain subject to the evidence and follow-ups in [licensing status](licensing-status.md).

Create the Blueprint from the dedicated review branch in Render. The free web service sleeps after 15 minutes without traffic; free Postgres expires 30 days after creation and should be deleted when review ends. This is a disposable product preview, not a production deployment: canonical demo accounts remain writable, and MFA, mail delivery, proxy/rate-limit review, backup/retention and operational hardening are not included. Do not enter real student or staff data. Delete both Render resources after review.

## Pre-stage correction refresh — 7 October 2026

This deployment branch now includes verified product commit `3c56217` from `redesign/interaction-cohesion`. It retains the existing gate, fictional PostgreSQL database, manual deployment configuration and hosted archive exclusion. Product verification: 161 tests on each database engine, 32 distinct browser workflows across broad/targeted runs, production React runtime and both-theme 1440/1024/390/actual Chrome 67% review. Login focus no longer unmounts anonymous forms; History retains only the same viewer/pupil period while pending; text tabs and Gradebook scores use precise indicators. Master is unchanged. Deploy this branch through the existing service and verify the protected root, health and corrected screens before manual acceptance.

## Accepted UX consolidation refresh — 9 October 2026

The preview incorporates verified master commit `6cdf9b5` through a normal merge, preserving its existing deployment infrastructure. This includes the accepted Phase 2 mobile Login editorial-section removal, theme-switch hit area, shared focus-modality treatment and compact date/number alignment. The product baseline passed all 161 tests on each database engine and all 40 browser workflows in PR, merged-master and milestone GitHub Actions runs. This refresh retains the existing passcode, fictional PostgreSQL database, manual deployment and hosted archive exclusion; it does not change master or introduce another stage. Preview-specific gate tests and a fresh build are checked before redeployment.

## Accepted visual refresh — 28 October 2026

The preview incorporates accepted product master `fc8dc93e0732e5a7e843c778182e2bebe5355c50` through a normal merge after PR #9 passed its required checks. It includes the reviewed Login, Dashboard, sidebar and shared-control polish, followed by the comprehensive refinement across Timetable, Attendance, Gradebook, directories, administration, settings and recovery. The source branch and PR each passed formatting, lint, strict TypeScript, production builds, both database suites and all 42 isolated browser workflows. Post-merge master and preview verification are checked before deployment; their final results are recorded in the release report.

The existing passcode, `reviewer` username, environment-managed secrets, private fictional PostgreSQL database and hosted archive exclusion remain. Deployment stays manual. This merge also carries the current screenshot-only, seven-day CI evidence policy onto the preview branch. It adds no academic stage or production-readiness claim.

### Full Dashboard presentation — 28 October 2026

The protected preview now uses the same fictional overview composition as the accepted local comparison on port 5175. Previously the production runtime's `DEMO_MODE=false` selected a reduced Dashboard despite serving the current design assets. Only the Foundation overview's presentation flag and existing illustrative agenda/announcements now accept `PREVIEW_MODE=true`; school counts and pupil rows retain their existing server-side scopes. This also restores their shared illustrative Calendar/notification context.

`NODE_ENV=production` and global `DEMO_MODE=false` remain authoritative. `/api/config` still reports demo mode and local delivery disabled. Demo login shortcuts, mock finance and local invitation/recovery delivery remain disabled; HTTPS, secure sessions, the passcode gate and ordinary non-preview production behavior are unchanged. No frontend design, schema, seed dataset, archive or master change is required.

## Gradebook refinement and retained Login — 30 October 2026

This normal merge incorporates product review commit `4f0b910180be8b8aabaafb3f842ca9d72f9d6e17`. The journal groups marks under compact category/date headers, and a mark opens a 300px selected-pupil detail surface with deliberate full-roster editing. Whole-assessment saving/publication, server-derived permissions, correction history and recovery semantics remain. Final-source local presentation checks passed together (3 workflows), plus formatting, lint, strict TypeScript and production builds. The complete product and preview GitHub Actions runs are checked before the manual Render deploy; actual deploy history remains the authority for what is live.

The Login exactly matches accepted product `fc8dc93`, preceding both rejected orbit/typographic experiments. Those alternatives remain local ignored checkpoints. Existing passcode protection, manual deployment, fictional PostgreSQL data, Dashboard preview presentation and archive exclusion are retained. No master merge, milestone change, next-stage implementation or new deployment service is included.

The release also incorporates product follow-up `93ed81e`: the first full runs passed 163/163 product database checks and 168/168 preview database checks, with 43 of 45 browser workflows passing. The two failed screenshots showed the real sign-in throttle in unpaced Dashboard tests. Those tests now reuse the established rate-aware sign-in helper; their assertions remain intact. Three affected workflows passed locally after this harness-only correction. Production limits and application source are unchanged by the follow-up. Fresh full CI on the final product and preview heads gates the manual deployment.
