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
