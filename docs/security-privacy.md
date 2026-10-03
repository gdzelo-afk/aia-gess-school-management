# Security and privacy

Engineering requirements, not legal advice. Legal policy and operational approval must be confirmed before handling real school data.

## Authentication

Better Auth owns password hashing, sessions and trusted-origin/CSRF behavior. Foundation enables email/password login with server-held session cookies; public registration is disabled. Demo accounts are provisioned by an explicit non-production seed command. No user may assign themselves a role. Production disables demo mode and requires strong configured secret, HTTPS origin and external PostgreSQL.

Long-term: verified invitation and reset email, recovery policy, session/device revocation, Google and Microsoft OAuth with verified school onboarding, TOTP 2FA and recovery codes, passkeys; phone authentication only after ownership verification, recycled-number and cost/abuse policy. Do not use student PIN authentication. Staff MFA and recovery/testing are pre-launch gates, not features claimed complete now.

## Authorization model

Predefined role → capability → resource scope. A user can hold several grants; union only the grants relevant to the requested capability. A role never converts a guardian scope into all-school scope. Default deny for absent/unknown grants. An absent or archived person mapping suppresses all grants immediately, including school-wide roles.

| Persona                    | Student scope                                         | Finance scope                                  | Administrative power                                          |
| -------------------------- | ----------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------- |
| Super administrator        | Explicit school student capability                    | Explicit school finance capability             | All Stage 1A management + protected role grants               |
| Director                   | School overview and student projection                | School finance summary                         | Academic/people/staff management and constrained provisioning |
| Principal / vice principal | School academics                                      | None by default                                | Academic approvals                                            |
| Administrator              | School roster/contact projection                      | None by default                                | Enrollment operations                                         |
| Teacher / homeroom         | Active assigned sections/offerings only               | None                                           | Assigned teaching actions                                     |
| Guardian                   | Current linked children, academic right enabled       | Current linked children, finance right enabled | None                                                          |
| Student                    | Own student record                                    | None by default                                | Own submission only                                           |
| Accountant                 | Minimal billing identity through finance              | School finance                                 | Finance operations                                            |
| HR                         | Staff employment, no student list                     | Payroll permission separately                  | HR workflows                                                  |
| Librarian                  | Minimal borrower lookup when module exists            | None                                           | Library only                                                  |
| Nurse / counselor          | No student scope by default in this foundation        | None                                           | No sensitive module implemented                               |
| Security / receptionist    | Minimal visitor/student-release lookup when justified | None                                           | Front-desk only                                               |
| IT administrator           | None by default                                       | None                                           | Accounts/system, never implicit academic access               |

Every child-detail query and aggregate must contain the same scope predicate as its list. Search, counts, exports, files and jobs inherit that rule. Relationships have effective intervals and independent academic/finance flags. Revocation is checked against the database at each protected request. Tests must cover unrelated child, revoked/expired link, unauthorized aggregate, role combinations and unauthenticated access. No client-supplied role is trusted.

## Practical threat register

| Threat                              | Foundation / planned mitigation                                                          | Launch evidence                                 |
| ----------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Guardian IDOR / over-broad response | SQL-scoped student lists/details, minimal DTOs, negative integration tests               | Exhaustive scope matrix including exports/files |
| Account takeover                    | Maintained auth library, bounded login rate, cookie sessions, generic Georgian UI errors | MFA/recovery, invite abuse review               |
| CSRF/XSS                            | Same-origin, origin checks, auth CSRF, React escaping, CSP/security headers              | Stored content/upload review                    |
| SQL injection                       | Parameterized Drizzle, strict boundary validation                                        | No raw user SQL in reports                      |
| Internal misuse                     | Least privilege, explicit audit events, separate sensitive domains                       | Audit coverage/access review                    |
| Malicious uploads                   | No upload route yet; private storage contract                                            | Quarantine/scanning/size/type tests             |
| Sensitive logs/exports              | Redacted cookies/auth headers; no response body logging; no-store                        | Retention/redaction tests, export scope recheck |
| Lost/rewritten history              | Foreign keys, temporal intervals, future immutable publication/revision                  | Correction and rollover integration tests       |
| Duplicate financial action          | Future idempotency, row locks, reversal model                                            | Allocation/reversal concurrency tests           |
| Demo exposure                       | Demo seed refuses production; production refuses demo flag                               | Deployment config test and clean DB             |

## Audit foundation

Append-only audit table protected against update/delete by SQL trigger; record actor, action, object type/id, request ID, metadata and timestamp. Foundation records explicit successful scoped detail views as representative audit events. Complete domain mutation coverage is deferred to each module. Write sensitive mutation and audit in one transaction; audit failure must fail that mutation. Database owner can bypass protections; production application uses restricted DB role and separate migration role. Off-host audit export/retention later.

## Georgian context

Reviewed the official consolidated Law of Georgia on Personal Data Protection, especially purpose/lawful basis, children, security, incident response and controller duties; see [official text](https://new.matsne.gov.ge/en/document/view/5827307). Consent-based processing of children has age/guardian rules; do not make blanket consent the basis for all required educational processing. The minor's best interests remain central. Determine lawful basis per purpose and keep evidence/version of optional consents. Current institutional/legal requirements should be confirmed at launch because amendments affect oversight and obligations.

Engineering implications: minimize collected data; separate employee, academic, financial and restricted behavior records; document purpose and retention; support authenticated access/export/correction requests; record guardian authority; retain legal/academic history where justified instead of indiscriminate erasure. Restrict student information in notifications, logs and exported files. Establish processor agreements and cross-border assessment for hosting/delivery providers. No special residency architecture is assumed.

Stakeholder/legal review must set retention periods per category, data-subject request process, incident notification process/deadlines, DPO/DPIA applicability, lawful bases, guardian restrictions and employee monitoring policy. No clinical/counseling records or biometric identification in scope. Do not present this foundation as legal compliance certification.

## Stage 1A administration and onboarding

Explicit capabilities: `academics:manage`, `people:manage`, `staff:manage`, `access:roles` plus existing `access:manage`. Super administrator/director manage Stage 1A; principal/vice principal manage academics and people; administrator manages people; HR manages staff; IT manages account lifecycle only. IT gains no student/academic administration. Account identity lookup returns no academic/HR projection. Staff and guardian histories require their own management capability. Search/lookup is bounded and server-authorized.

Only super administrators can grant or alter protected super-admin/director/IT identities. Self-role/disable actions and removal of the last active super administrator are blocked. Staff roles require an active staff profile, students an active student profile, guardians a current relationship. Disabling an account deletes sessions and invalidates onboarding tokens without deleting the person/history. Archived identities lose role-derived scopes. Scheduled staff departure is checked on each request and at session creation.

Invitation/reset tokens contain 32 random bytes; only SHA-256 digests are stored. Invites expire in 48 hours; recovery in one hour. Password creation uses Better Auth hashing; consumption, credential update, token invalidation, session revocation and audit are atomic. Tokens cannot carry client-chosen roles. URLs use fragments so tokens do not enter request/access-log URLs. Public signup remains disabled. Origin checks and existing authentication/request limits remain enabled; throttling returns 429.

Delivery is deliberately local-demo-only: authorized administrators see a newly created link once; public recovery responds generically and writes a private mode-0600 file under `.local/delivery` (directory 0700). No email is sent and production issuance is unavailable until a delivery provider is integrated. The public UI states that limitation. Protect/delete expired local delivery files as developer secrets; never commit them. Audit excludes passwords/tokens. MFA is explicitly deferred: integrate Better Auth TOTP and recovery codes with setup, recovery, revocation and security tests in a dedicated hardening task before real deployment.

## Stage 1B timetable authorization

`founders_office` is a predefined Georgian-labelled Founders Office role. It receives explicit timetable school-view/manage/publish/override capabilities, with no account, finance or school-wide student permissions. Director, principal, vice principal and administrator receive the same timetable capabilities; super administrator retains them. Provisioning Founders Office is protected like other executive roles and requires super administrator authority.

Teachers have own timetable and self-request capabilities. Students and guardians receive only applicable published occurrences; current academic guardian links gate child selection independently of financial rights. Substitutes can see their actual occurrences without gaining general student scopes. Admin drafts, internal reasons, conflict overrides, unrelated requests and rosters are withheld from family DTOs. Teachers cannot directly change master/exception records. Active staff/person/account lifecycle checks apply to substitutes; permanent offering assignment is deliberately not required for a one-off substitute.

Every draft edit/publication, availability mutation, request/decision, special-day action and exception is audited in its mutation transaction. Concurrency checks cover document revision, occurrence revision and absence request signatures. Collision overrides bind exact conflict digests and nonempty reasons; lifecycle/domain invalidity is not overridable. Authentication, trusted origin and rate limits remain unchanged.

## Attendance scope and privacy

Stage 1C reuses actual subject-lesson ownership and temporary substitute assignment; it does not grant substitute directory access. Leadership with `attendance:manage` can correct with immutable note/history. Founders Office has whole-school read/analytics only; mutation, explanation decisions and correction approvals are denied on the server. Students see self; guardians require current academic child rights for lists, details, explanations and notifications. Revocation applies immediately, including historical reads.

Teacher response projections omit administrative decision notes and private guardian narratives. Family history excludes internal roll-call oversight and correction narratives. Teacher correction requests snapshot lesson/roster/original/proposed data; review is version checked and transactional. Opening/mark-all performs no write; unsaved roster state lives only in component memory. Notifications contain minimal child/day/kind context, are deduplicated independently for absence/late/early departure, and recheck guardian rights when read. They are in-app events only, not claims of external delivery. Early Departure records an observed attendance consequence and does not confer administrative release authority. Staff attendance, clinical records, external delivery and MFA remain deferred.

### Deployment rate-limit gate

Before a real deployment, verify reverse-proxy topology and trusted-proxy configuration,
shared school/NAT traffic, and appropriate request/authentication rate-limit keys.
The local limits remain unchanged; this is a deployment review dependency, not a
confirmed local authorization defect. Browser mutation tests now own a separate
origin and a fresh fictional database and cannot reuse the normal preview server.

## Gradebook boundary (Stage 1D)

Every journal, detail, report, count, writing/history, criteria download and notification read is scoped on the server. Subject teachers need current/effective course assignments; timetable substitute-only access confers no grading rights. Homeroom teachers read their own pupils across subjects and may write permitted general guardian comments, but cannot grade another teacher's course. Founders Office has school-wide published read/report access and aggregate private-draft counts only; it cannot grade, publish, correct, authorize recovery or change criteria. Academic policy/criteria administration is a separate capability from general historical correction.

Students see self-only published academic results, never guardian-only comments. Guardians need current academic rights independently of financial rights. Revoked/unrelated family links fail on histories, reports, files and notices too. Private drafts and internal correction/recovery reasons are withheld from family projections. History permission is rechecked rather than trusting a prior session or a hidden button.

Criteria uploads are PDF-only, bounded to 3 MB, validated for media/header/end structure and stored under generated names outside public assets. Download rechecks the referenced subject/version and current scope, uses attachment/no-store/nosniff/sandbox headers, and discloses no storage path. This is not a malware-scanning or general document-management service; production scanning/storage operations remain launch work. The browser-write harness uses unique disposable databases/private-file directories and refuses occupied test ports; it never borrows the manual preview.
