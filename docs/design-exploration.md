# AIA-GESS visual direction lab

**ARCHIVED EXPLORATION — decision recorded 28 September 2026.** The user selected A. Its evolved system is now promoted to the main Login, Dashboard and command palette; see [the canonical design system](design-system.md). B/C remain historical references. No further selection is pending.

The following records the exploration as completed on 27 September, when all directions were still unselected. Its scope and verification evidence describe that historical state, not the current product selection.

The lab adds a separate browser experience to the existing foundation. The paper/forest main application remains available at `/`. Backend, authentication, authorization, PostgreSQL/PGlite, schema, migrations, seeds and APIs are unchanged. The gradebook, forms, review statuses and schedule below are fictional frontend prototypes, not new school modules.

## Routes and review sequence

Start at `/design-lab`. Each direction has four directly accessible screens:

| Direction             | Login                 | Director                  | People                   | Dense workflow            |
| --------------------- | --------------------- | ------------------------- | ------------------------ | ------------------------- |
| A — ორბიტა / Orbit    | `/design-lab/a/login` | `/design-lab/a/dashboard` | `/design-lab/a/students` | `/design-lab/a/gradebook` |
| B — ვექტორი / Vector  | `/design-lab/b/login` | `/design-lab/b/dashboard` | `/design-lab/b/students` | `/design-lab/b/gradebook` |
| C — იმპულსი / Impulse | `/design-lab/c/login` | `/design-lab/c/dashboard` | `/design-lab/c/students` | `/design-lab/c/gradebook` |

`/design-lab/a`, `/b`, `/c` also resolve to their respective login experiences. `/design-lab/type` is the independent font comparison. In development prepend `http://localhost:5173`. Use the same `npm run dev` process as the existing app; do not start a second PGlite owner.

Use the prefilled fictional login form or direct-preview link. No authentication request is made, no session is created, and form input is not stored. Each direction starts light; its independent theme preference is stored under `aia-lab-{a,b,c}-theme`. School data and credentials are never put into storage by the lab.

## Three separate philosophies

### A — ორბიტა / Orbit

A spatial work environment: quiet chrome, layered opaque work surfaces, a focused priority panel and a circular enrollment distribution linked to class filters. Mersad Variable handles UI, numerals and restrained large headings. Cool neutral surfaces use a controlled cobalt action accent; dark mode uses blue-black depth, lifted surfaces and a brighter blue focus color.

The login's original CSS lens construction and Georgian letter establish a material motif without stock imagery, WebGL or video. Masked type lines enter on a soft ease-out; dialogs scale briefly into place and inspectors slide from the edge. Glass is confined to utility chrome and command/overlay layers. Tables stay opaque. Controls use moderate curvature; a workspace boundary has more radius than a dense cell.

### B — ვექტორი / Vector

An instrument-like console: graphite left navigation, numbered contexts, low-travel rows, a work queue beside a calibrated schedule, and a compact information strip. BPG DejaVu Sans handles working text; Eurostile GEO_Nus gives time, numeric data and headings a technical cadence. Copper marks attention and actions; dark mode uses graphite divisions and amber highlights, not an inverted light palette.

The login uses plotted paths, coordinates and large date numerals. SVG stroke reveals and short type entrances supply choreography; a finite cursor pulse establishes the console context. Dense pages use thin rules and sharper geometry. Schedule marker position and length encode the actual fictional start/end times on a 09:00–17:00 axis; labels remain outside the short markers for readability.

### C — იმპულსი / Impulse

A typographic architecture: oversized Antena headings, a strong date masthead, deliberate black rules, open sections and emphatic but limited vermilion. MCh NeoBau Regular/Bold provides working text and numeric rhythm. Antena is reserved for display hierarchy; it is not used in student names or grade entry. The main logo wordmark uses Mersad for stable Latin identity.

The login's original Georgian letter sculpture, staggered masked typography and fine moving rule form its cinematic moment. Working screens use clean, opaque planes; floating layers can carry depth. Tables use open row rules and square identity marks. Dark mode uses warm-neutral charcoal, soft white structure and a lighter coral action accent. Display movement is finite; data work remains immediate.

## Functional exploration coverage

- All three: login validation/password reveal, separate light/dark setting, left navigation, responsive mobile drawer, priority drill-down, class distribution links and event modal.
- People: search, class filter, review filter, alphabetical sort, selection, density toggle, detail inspector, sample note form and feedback. Mobile keeps name/ID/class and review state; secondary desktop columns are omitted. Pagination controls are explicitly disabled for the single 12-person page.
- View menu: deliberately trigger loading or error scenarios; recover via retry. Search for an absent name to inspect the empty state. These are controlled scenarios, not simulated real API failures.
- Command layer: Ctrl/Cmd+K, query filtering, student lookup, navigation, theme action, meeting context, arrow selection, Enter, Escape. Native dialogs provide top-layer focus containment and keyboard dismissal.
- Gradebook: fictional 1–10 cells, class/subject views, contextual current-day column, derived sample mean/count, arrow/Enter traversal, sticky identity, scrollable dates, review confirmation and reset. Edits are local component state, discarded on navigation/reload. No official grades or publications exist.
- Notices, actions and labels explain the prototype boundary in Georgian. No external messaging, upload, export or record mutation occurs.

The twelve identities and section assignments mirror the existing fictional seed. Two review flags and all grades are extra local examples. Display counts are computed from those fixtures; no invented growth, attendance or finance trend is presented as live analytics.

## Typography research

The Typeface.ge catalog was examined across its 11 pages, not only its first entries. Twelve plausible candidates spanning variable grotesk, geometric, humanist, technical, narrow and expressive display categories were downloaded as unmodified local specimens. The first comparison used real Georgian names/navigation/numbers; the interactive route continues that evaluation at **12, 13, 14, 16, 20, 24, 32 and 64px**, plus large display compositions.

Each comparison includes navigation, a heading, Georgian prose, a form/button, student rows, 1–10 grades, GEL/₾, date strings and mixed Latin acronyms. Choose two families side by side, vary working size/variable weight, edit the heading and switch theme. Static font specimens disable synthetic font styles. The font directory preserves source metadata and notices.

| Candidate / catalog                                                                          | Inspected specimen                       | Observation and role in exploration                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Mersad](https://typeface.ge/ka/font/Mersad)                                                 | Variable `wght` 100–900                  | Broad, contemporary forms; clear mixed-script rhythm. A's UI/display. More weight is useful for emphasis, not every label.                                                                                                        |
| [123 Antena](https://typeface.ge/ka/font/123+Antena)                                         | Variable `wght` 100–700, `ital` −100–100 | Strong vertical identity and narrow silhouette; 12–16px specimens are too compressed for operational text. C display only. Weight motion possible; the unusual italic axis is recorded, not falsely called a standard CSS italic. |
| [TF Mecomicse](https://typeface.ge/ka/font/TF+Mecomicse)                                     | Regular; catalog contains more styles    | Expressive organic shapes; useful branded voice, visually noisy at dense UI size. Retained for comparison.                                                                                                                        |
| [Eurostile GEO_Nus](https://typeface.ge/ka/font/Eurostile+GEONus)                            | Regular                                  | Squared technical forms and distinctive figures; B headings/time/data, with another family for long working copy.                                                                                                                 |
| [MCh NeoBau](https://typeface.ge/ka/font/MCh+NeoBau)                                         | Regular + real Bold                      | Open geometric character, economical width. C UI; working sizes are deliberately larger than A/B because optical size differs.                                                                                                    |
| [BPG Nino Medium](https://typeface.ge/ka/font/BPG+Nino+Medium)                               | Medium                                   | Light, humanist rhythm; small metadata needs careful optical sizing. Retained.                                                                                                                                                    |
| [BPG Nino Elite Cond](https://typeface.ge/ka/font/BPG+Nino+Elite+Cond)                       | Regular                                  | Economical long names; thin 12px strokes constrain dense usage. Retained.                                                                                                                                                         |
| [BPG Rioni Vera Condensed Light](https://typeface.ge/ka/font/BPG+Rioni+Vera+Condensed+Light) | Light                                    | Delicate narrow display rhythm; insufficient emphasis for small operational cells. Retained.                                                                                                                                      |
| [BPG Sans](https://typeface.ge/ka/font/BPG+Sans)                                             | Regular                                  | Robust Georgian small text; this specimen's heavy tone gives less hierarchy flexibility. Retained.                                                                                                                                |
| [BPG DejaVu Sans](https://typeface.ge/ka/font/BPG+DejaVu+Sans)                               | Regular                                  | Consistent Georgian/Latin working text. B UI; size increased during browser review for dense-name readability.                                                                                                                    |
| [MS Pillar](https://typeface.ge/ka/font/MS+Pillar)                                           | Regular                                  | Strong tall silhouette; compelling at display scale, impractical for small work labels. Retained.                                                                                                                                 |
| [MCh Ma Si Vardi Serif](https://typeface.ge/ka/font/MCh+Ma+Si+Vardi+Serif)                   | Regular                                  | Contemporary expressive contrast and slant; display candidate rather than a data-table face. Retained.                                                                                                                            |

These are visual observations, not a ranking of the three directions. No family was removed because the catalog lacked a license badge. Several embedded notices describe free/commercial use; others contain only copyright. **Production license verification required** for the exact selected binaries, including embedding, redistribution and upstream/adaptation rights. This task does not certify those rights. See `public/design-lab/fonts/sources.json`, `embedded-notices.txt` and its README. Noto's existing OFL notices apply only to the unchanged main application fonts.

## Reference study

References informed principles, not copied layouts/assets:

- [Apple OS](https://www.apple.com/os/): differentiated material roles, control precision and a hierarchy between expressive entry and working surfaces.
- [Raycast](https://www.raycast.com/): keyboard-first access, focused command layers and quick contextual actions.
- [Linear](https://linear.app/): restrained chrome, consistent alignment and dense task focus.
- [Stripe](https://stripe.com/): clear information structure, explanatory labels and organized operational data.
- [Floema](https://floema.com/en): scale contrast, typographic rhythm and controlled reveal; its materials/palette are not adopted.
- [Lama Lama](https://lamalama.com/): compositional confidence and expressive brand moments; no background video or media copied.
- [Igloo](https://www.igloo.inc/): referenced by the brief and opened during research, but remained at its loader in the headless browser. No claim of a complete live interaction review there.

Research captures are local/ignored under `.local/design-research/`. No reference-site assets were imported into the product.

## Engineering and performance boundaries

No new npm dependency. React, React Router and existing Lucide icons supply structure. Motion uses CSS transforms/opacity, finite SVG stroke animation and native browser controls. No GSAP/Motion runtime, WebGL, canvas, video or image-generation assets were needed. Reduced-motion removes travel and delays; login pause/replay controls are available. Operational inputs never wait for animation completion.

`src/main.tsx` dispatches by URL to two dynamic entry graphs. `src/main-app.tsx` is the byte-for-byte previous entry. Normal routes load the existing UI/tokens/providers; lab routes load `src/design-lab/main.tsx` and `lab.css`. Returning to the main app uses a document navigation, so experimental styles cannot linger. The lab makes no API calls and imports no server code. It is directly accessible without real authentication because it contains only fictional fixtures.

Direction styles are grouped under `.dl-a`, `.dl-b`, `.dl-c`, with private `--dl-*` tokens and independent layouts. Shared interaction primitives avoid duplicating behavior; dashboards/login compositions and visual systems stay distinct. No existing production design-system document or token file is replaced.

The 12-candidate comparison is intentionally heavier than an individual direction. Font-face declarations do not fetch unused fonts; only faces actually rendered are requested. Original local font binaries total approximately 0.82MB; no all-family preload is added. Font subsetting/WOFF2 packaging can follow a selected direction and verified license. The lab entry is approximately 21KB gzip JavaScript plus 15KB gzip CSS, alongside shared React/router/icon runtime (~146KB gzip). The main app has a separate ~35KB gzip entry and ~12KB gzip CSS. These are build sizes, not measured user latency. The lab currently loads all three prototype compositions together after entering its isolated route; fonts load on demand.

Responsive behavior is checked at 1440, 1024 and 390px. Mobile replaces the fixed rail with a left drawer, stacks console sections, simplifies student rows, and retains a horizontally scrollable grade grid with pinned identity. It does not scale the desktop page down.

## Completion evidence

Reviewed on 27 September 2026. The continuation preserved completed compositions, then corrected undersized secondary text/touch controls, mobile review indicators, keyboard grade-grid scrolling, accurate schedule marker lengths/event details, command input focus, and the mobile A login headline/lens separation. No main-app redesign or backend change was made.

- `npm run check` passed: ESLint, Prettier, strict TypeScript, **18 Vitest integration/formatting checks**, and frontend/server/migration production builds. After the final A-only mobile CSS adjustment, production build and its affected responsive browser workflow were repeated; no integration behavior changed.
- `npm run test:e2e`: **11 workflows passed** (3 existing main-app workflows + 8 lab/isolation workflows). Lab coverage includes local login with no API traffic, command keyboard lookup, people filters/selection/empty/error/retry, grade validation/traversal/reset, independent themes, mobile drawer/inspector, reduced motion, all 12 font specimens and main-route asset isolation.
- Screenshots from **72 screen/theme/width combinations**: each direction × login/dashboard/students/gradebook × light/dark × 1440/1024/390. Contact sheets and targeted full-size captures were visually inspected. No page overflow or browser runtime errors occurred in that matrix. Tables intentionally retain their own horizontal scroll where necessary.
- Additional Chromium interaction review verified all three login animations start, pause, resume and settle; command input receives focus; schedule inspectors show the selected event/time. Reduced-motion login remains functional. This is practical browser QA, not a formal accessibility audit or frame-rate benchmark.
- The saved pre-exploration checksum inventory confirms backend/shared/schema/migrations and existing main UI components/styles remain unchanged. Only the old entry file becomes the route dispatcher; its former contents are preserved byte-for-byte in `src/main-app.tsx`. No database verification environment was recreated because database code is unchanged.
- Built-artifact Chromium smoke passed for the main login, lab hub, typography route and representative A/B/C deep links. Main requests included no lab entry/CSS/fonts; lab requests included no main-app CSS or API calls. No browser runtime errors occurred. `/api/health` also returned `{"status":"ok"}`.
- Generated review captures/reports remain ignored under `.local/design-review/`; browser checks generate `test-results/design-lab/`. Local development data was preserved.

### Original completion checkpoint

| Brief items                                                     | Evidence / final boundary                                                                                                                                                                  |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1–2, 23, 26: preserve engineering/main UI; no propagation       | Checksum comparison, existing integration/browser checks, isolated dynamic entries; main tokens/components unchanged.                                                                      |
| 3–8: three distinct real experiences and four surfaces each     | Twelve direct routes; separate login/dashboard compositions and direction-specific navigation, data styling and typography.                                                                |
| 9–10, 15–18: themes, motion, materials, accent and navigation   | Deliberate direction palettes, finite motion and reduced-motion fallback; opaque working tables, contextual overlay glass, desktop left rail/mobile left drawer.                           |
| 11–14: serious Georgian type exploration and coherent systems   | Twelve source-linked candidates, local specimen binaries/notices, realistic content comparison; unresolved licensing recorded rather than grounds for rejection.                           |
| 19–20: art direction beyond the prior identity; avoid templates | Original lens, plotted-path and Georgian-letter compositions; spatial, console and typographic systems; no template kit/layout imported. Final aesthetic judgment belongs to human review. |
| 21–22: actual browser/responsive QA                             | 72 captures, interaction workflows, font loading, mobile inspectors/navigation, scroll and keyboard review.                                                                                |
| 24–25: documented as unselected; no winner                      | This document, hub and repository status preserve all three as **UNSELECTED EXPLORATIONS**. No ranking or next-phase implementation.                                                       |

Exploration is complete for human discussion. Production font licensing, formal accessibility validation and any adoption/migration remain later work after an explicit design decision.
