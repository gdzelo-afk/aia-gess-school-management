# Security policy

## Maintenance scope

AIA-GESS is a development prototype, not an approved production school system. Security maintenance focuses on the accepted `master` development baseline and fixes explicitly accepted through review. Historical tags, archival `/design-lab` prototypes and temporary review branches are not separately supported production releases. Reports involving accidental exposure in any public branch/history are still relevant.

This policy is neither a security certification nor a response-time, bounty or support guarantee. The volunteer team has no published security SLA.

## Reporting channel — configuration pending

**Verified on 22 October 2026: GitHub private vulnerability reporting is disabled, and no dedicated security email/contact is verified in this repository. There is currently no configured private intake channel.**

Do not submit credentials, personal school information or reproducible exploit details in public issues, PRs or discussions. Do not assume an ordinary GitHub issue is private. If you already have a privately agreed maintainer contact, ask how to transmit the report securely before sending sensitive material; this repository does not publish or invent that contact. Otherwise, a public request to configure a private reporting channel should contain no vulnerability details.

Maintainer action: approve and enable GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository), verify the repository's **Security → Advisories → Report a vulnerability** control is available, and update this policy with the tested intake link. Do not direct reporters to a submission endpoint before it works. This non-versioned setting remains pending separate maintainer approval.

## Helpful report information

Once a private channel is established, include:

- Affected commit/tag and local environment; distinguish product master from a preview branch.
- Expected versus observed behavior, impact and minimal reproduction using fictional identities.
- Relevant file/route and sanitized request/response details, with tokens, cookies, personal data and deployment configuration removed.
- Whether access is unauthenticated or depends on a role, guardian relationship, substitute assignment or other scope.
- Any observed exposure and suggested containment; never include the actual secret in a public follow-up.

Do not test credentials discovered in source/history against external systems. Do not access unrelated pupil/family data or perform disruptive/destructive testing on hosted services. Use isolated fictional local data and obtain separate authorization before testing a deployment.

If a credential is exposed, treat it as potentially compromised: privately notify its owner for revocation/rotation. Deleting a line or committing a replacement does not remove historical exposure. Coordinate any history or artifact removal separately; never silently rewrite accepted history.

## Engineering context

[Security and privacy](docs/security-privacy.md) documents implemented scopes and production-hardening dependencies. [Repository readiness](docs/repository-readiness.md) distinguishes current findings from unverified risks. Passing tests or an exposure scan does not establish that the application is vulnerability-free.
