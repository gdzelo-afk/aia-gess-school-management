# AIA-GESS product and engineering context

Status: Foundation and Stages 1A–1D, the controlled Login/Dashboard refinement and accepted UX corrections are integrated on master `6cdf9b5`, tagged `ux-consolidation-complete-2026-10-09`; PR and post-merge checks passed. The repository is intentionally public and the original application remains proprietary. The 22 October [readiness review](repository-readiness.md) is a separate, unmerged documentation/hygiene proposal. Temporary Render infrastructure stays on its preview branch. Read this index, then `implementation-status.md` before changing code. The full product vision is larger than the implemented foundation.

| Document                                          | Use it for                                                        |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| [Product](product.md)                             | Principles, people, scope, feature/phase matrix                   |
| [Experience](experience.md)                       | Role dashboards, navigation, workflows, screen inventory          |
| [Design system](design-system.md)                 | Typography, tokens, components, density, responsive rules         |
| [Domain model](domain-model.md)                   | Ownership, relationships, history and invariants                  |
| [Architecture](architecture.md)                   | Runtime boundaries, APIs, jobs, storage, reporting                |
| [Security and privacy](security-privacy.md)       | Authentication, authorization, threats, Georgian context          |
| [Engineering](engineering.md)                     | Repository rules, tests, operations, release gates                |
| [Roadmap](roadmap.md)                             | Dependencies, acceptance gates, stakeholder questions             |
| [Licensing and ownership](licensing-status.md)    | Proprietary status, third-party evidence and rights actions       |
| [Security reporting](../SECURITY.md)              | Reporting policy and current private-channel blocker              |
| [Repository readiness](repository-readiness.md)   | Exposure review, verification, metadata proposal and open actions |
| [Research](research.md)                           | Sources, font/license evidence, assumptions                       |
| [Decisions](decisions/README.md)                  | Short architecture decision records                               |
| [Implementation status](implementation-status.md) | What actually works and what remains planned                      |

**Design decision, 28 September 2026:** evolved Vector A is selected and promoted throughout the main application, including Login, Dashboard, Students, Academics, Messages and command palette. Read the [canonical design system](design-system.md). The [visual lab](design-exploration.md) is preserved with all routes, navigation and A/B/C experiments intact. Styling promotion does not implement planned EMS features.

## Non-negotiable current constraints

1. One Georgian school; no speculative tenancy, campus hierarchy, microservices, AI, or ERP.
2. All application copy is Georgian. No language switch. Docs/code identifiers may be English.
3. Semester-based, grades 1–10, GEL stored in integer tetri, school timezone Asia/Tbilisi.
4. A person can have multiple roles; a guardian can have multiple children. Authorization is server-side and relationship-aware.
5. Historical academic meaning survives transfers, staff departures and renamed classes.
6. Stage 1A implements academic structure and people/onboarding; Stage 1B adds the manual timetable and Stage 1C adds student lesson attendance. Stage 1D adds provisional academic Gradebook workflows; official grading finalization, finance and messaging remain future work; this is not a production release.
7. School website is context and logo source only; never use its design as the interface specification.
8. No Mermaid diagrams. Update docs with changed requirements; these are working decisions, not immutable instructions.

## Future coding task protocol

Read the relevant domain and workflow. Identify its permission scope and temporal invariants. Add migrations and meaningful authorization tests with the feature. Update status and roadmap. Never infer production readiness from a polished demonstration.
