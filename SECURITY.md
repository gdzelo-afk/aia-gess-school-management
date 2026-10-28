# Security policy

## Maintenance scope

AIA-GESS is a development prototype, not an approved production school system. Security maintenance focuses on the accepted `master` development baseline and fixes explicitly accepted through review. Historical tags, archival `/design-lab` prototypes and temporary review branches are not separately supported production releases. Reports involving accidental exposure in any public branch/history are still relevant.

This policy is neither a security certification nor a response-time, bounty or support guarantee. The volunteer team has no published security SLA.

## Confidential vulnerability reporting

Use GitHub's [Report a vulnerability](https://github.com/gdzelo-afk/aia-gess-school-management/security/advisories/new) form for this repository, also available under **Security → Advisories → Report a vulnerability**. A GitHub account/sign-in is required. Reports are private to the reporter and authorized maintainers/collaborators until coordinated disclosure; do not publish the report or create a public issue containing exploit details.

Private reporting was enabled and verified on 22 October 2026: the repository API reports it enabled, the public advisory page exposes the reporting control, and the authenticated private advisory form loads. No test vulnerability or advisory was submitted. This establishes an available intake channel, not a response-time guarantee or a security audit.

Do not submit credentials, personal school information or reproducible exploit details in public issues, PRs or discussions. If GitHub's private form is unavailable, do not substitute a public issue: send only a detail-free request for maintainers to restore private reporting. No dedicated security email is published or implied.

## Helpful report information

In your private report, include:

- Affected commit/tag and local environment; distinguish product master from a preview branch.
- Expected versus observed behavior, impact and minimal reproduction using fictional identities.
- Relevant file/route and sanitized request/response details, with tokens, cookies, personal data and deployment configuration removed.
- Whether access is unauthenticated or depends on a role, guardian relationship, substitute assignment or other scope.
- Any observed exposure and suggested containment; never include the actual secret in a public follow-up.

Do not test credentials discovered in source/history against external systems. Do not access unrelated pupil/family data or perform disruptive/destructive testing on hosted services. Use isolated fictional local data and obtain separate authorization before testing a deployment.

If a credential is exposed, treat it as potentially compromised: privately notify its owner for revocation/rotation. Deleting a line or committing a replacement does not remove historical exposure. Coordinate any history or artifact removal separately; never silently rewrite accepted history.

## Engineering context

[Security and privacy](docs/security-privacy.md) documents implemented scopes and production-hardening dependencies. [Repository readiness](docs/repository-readiness.md) distinguishes current findings from unverified risks. Passing tests or an exposure scan does not establish that the application is vulnerability-free.
