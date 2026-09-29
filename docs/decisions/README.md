# Accepted foundation decisions

| ID  | Decision                                                                        | Reason                                                                                  | Consequences                                                                    |
| --- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 001 | TypeScript React/Vite + Fastify modular monolith                                | Strong interaction/UI ecosystem, explicit API, one deployable application               | No SSR need for authenticated app; modules separated in code, not services      |
| 002 | PostgreSQL + Drizzle, PGlite locally                                            | Relational integrity/history and inspectable migrations; no Docker prerequisite locally | Production PostgreSQL verification required; no SQLite semantic drift           |
| 003 | Better Auth, disabled public registration                                       | Maintain auth/session primitives rather than hand-roll passwords                        | Invite/recovery/MFA/SSO/passkeys must be completed before launch                |
| 004 | Predefined capability + relationship-scoped RBAC                                | Understandable roles while protecting children and multi-role users                     | Every query/export/job/file must apply resource policy; no custom role editor   |
| 005 | React Router + TanStack Query                                                   | Bookmarkable routes and coherent server-state lifecycle                                 | Clear caches on auth changes; keep domain rules on server                       |
| 006 | Semantic CSS tokens + accessible Radix dialog primitives + Lucide icons         | Original visual identity without generic admin template                                 | Build shared components; add other headless primitives only as needed           |
| 007 | Initial Georgian Noto Sans + Serif, self-hosted OFL (main UI superseded by 011) | Georgian readability, deliberate hierarchy and verifiable embedding rights              | Include licenses; preserve layout with fallback; no runtime font CDN            |
| 008 | One Node artifact + managed PostgreSQL later                                    | Small-team operations and reasonable cost                                               | No Kubernetes/Redis by default; secrets/backups/TLS are launch responsibilities |
| 009 | DB outbox and private file metadata/ports, no worker/uploads yet                | Preserve transaction boundary without speculative infrastructure                        | Implement retries, scanning and delivery in the feature that needs them         |
| 010 | Effective-dated relationships + immutable publication/reversal                  | Historical correctness and revocation                                                   | Current metadata must not silently rewrite old academic/financial records       |

| 011 | Selected A-derived main UI; Mersad UI / NeoBau numbers / GL Tatishvili greeting; preserve lab | Explicit user selection and subsequent cross-route promotion | Scope product tokens; original A lens, terminal cursor; preserve all lab routes/assets; verify production font licenses before distribution |

Amend these decisions when requirements change; update affected implementation and documents together.

Toolchain note: esbuild is overridden to ^0.28.1 to eliminate vulnerable older transitive versions pulled by Drizzle tooling. Migration generation and production builds are verified with the override; review it when upgrading the toolchain.
