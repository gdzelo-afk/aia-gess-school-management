# Selected product design system

**Selected and promoted, 28 September 2026.** The main application uses the canonical AIA-GESS system, including Login, Dashboard, Students, Academics, Messages and command palette. They evolve Vector A into one coherent system; the lab is historical reference, not an open competition. Do not create new competing vectors or revert these screens to paper/forest.

## Scope and source of truth

- `src/pages/Login.tsx`: real authentication entrance at `/login` and any unauthenticated main route.
- `src/pages/Dashboard.tsx`: real authenticated `/`, with director, teacher, guardian and student views using server-scoped data.
- `src/components/CommandPalette.tsx`: shared keyboard search/actions. `Shell.tsx` applies the same selected navigation/topbar on every main route.
- `src/styles/product.css`: selected semantic tokens, fonts and shared controls. `product-login.css`, `product-dashboard.css`, `product-command.css`, `product-workspaces.css`: scoped screen rules.
- `ProductIdentity.tsx`: unchanged institutional mark, original A layered lens artifact, current Tbilisi date.

Students retains scoped search, filtering, sorting, pagination and detail/finance preview. Academics exposes the existing academic-year context and progressive disclosure explaining planned capabilities; Messages is a purpose-specific unavailable/empty communication workspace, without fabricated conversations, composer or sending. Calendar, settings, generic planned pages and shared dialogs inherit the same chrome, typography and controls. No operational module backend was added.

Selected tokens stay under `.product-theme`; main chrome stays under `.product-shell`. Portaled dialogs/toasts receive the selected theme. Extend this system by function, not independent page art direction. **Preserve `/design-lab`, its navigation, all A/B/C sub-routes, typography surface and assets.** Its separate entry graph never imports product styles. A normal document link from the main design page opens the archive without mixing React/CSS graphs.

## Design logic

A is the dominant spatial system: calm neutral chrome, controlled cobalt accent, restrained layering, readable opaque work surfaces, a priority panel and contextual count distribution. The date, geographic detail and cursor are reinterpreted in A's proportions and materials; no B console styling or C display-heading system is imported.

The chosen “This Thing” hero is the original Vector A abstract lens: four translucent circular shells, dimensional CSS perspective, a quiet central Georgian glyph and a finite entrance. The markup/geometry/materials were reused from `design-lab/overview.tsx` and `lab.css` into independently scoped production code; no screenshot/raster replacement. **The layered shield was rejected and removed from the main login.** Do not restore it or force the crest into the object. The unchanged crest remains in the masthead. The city coordinates are an approximate **Tbilisi geographic reference**, not a claimed surveyed campus location. The prominent date is live in **Asia/Tbilisi**, including midnight rollover; it is separate from the dashboard's explicitly labeled fictional snapshot date.

The dashboard preserves real scoped counts and enrollment distribution, child switching, identity links, announcements and schedule previews. A polished surface must never imply that planned academic/financial modules are operational. Priorities distinguish usable lists/calendar from planned modules. Sample events and announcements remain labeled.

## Typography

| Role                                                                 | Family                  | Working treatment                                                                                              |
| -------------------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| Georgian interface, forms, navigation and running copy               | Mersad Variable         | Generally 12–15px / 1.5–1.8, weight 400–500                                                                    |
| Login and dashboard hierarchy                                        | Mersad Variable         | Login 42–62px desktop; section emphasis 24–31px; optical negative spacing only on large headings               |
| Dashboard greeting only                                              | GL Tatishvili 12 Normal | Original Normal face, 36px desktop / 26px mobile, weight 400, natural tracking; never a general UI font        |
| Dates, prominent counts, time, years and compact numeric identifiers | MCh NeoBau              | Regular for most display values; genuine Bold available; tabular numerals; never used as the general text face |
| Secondary labels                                                     | Mersad Variable         | Typically 11–12px; 10px reserved for compact noncritical metadata, with larger mobile working labels           |

Keep Georgian text unclipped. Headline line height is 1.2–1.4; ordinary UI copy is not forcibly uppercase. The greeting cursor stays attached to the name on narrow screens. The terminal cursor uses em-based geometry and stays on the greeting baseline. Tatishvili is preloaded by the main entry only. A Mersad fallback with adjusted size/ascent/descent and an explicit line height stabilizes the director greeting while the font loads.

Fonts are local and use `font-display: swap`; Tatishvili is the sole greeting preload, other faces are requested when rendered. Main-product URLs are `/fonts/product/`, independent from `/design-lab/`. Source URLs, hashes and verbatim embedded notices live with the exact font binaries. **Production license verification required** before external distribution; selection is not a license certification. The prior twelve-candidate research remains in [the archived exploration](design-exploration.md). The original Noto assets/OFL notices remain in the repository; selected main surfaces explicitly use the product font roles.

## Palette, surfaces and geometry

| Token        | Light   | Dark    | Purpose                       |
| ------------ | ------- | ------- | ----------------------------- |
| canvas       | #f1f3f7 | #10151f | Workspace                     |
| surface      | #ffffff | #1b2332 | Main working planes           |
| surface-soft | #e9edf4 | #242f42 | Secondary treatment           |
| rail         | #f8f9fc | #141b27 | Navigation / quiet controls   |
| ink          | #252d3d | #eaf0fb | Primary type                  |
| muted        | #647187 | #a5b2c8 | Supporting text               |
| border       | #dce2eb | #303d53 | Structural separators         |
| accent       | #3565bf | #99b9fa | Selected state, action, focus |
| accent-soft  | #e9effc | #253959 | Restrained selection fill     |

The accent is an independent product decision, not sampled from the crest. Light is the default; dark uses a blue-black canvas, lifted planes and carefully bounded borders. Working panels are opaque. Translucency is limited to contextual topbar/command/backdrop material and the entrance artifact. Shadows are sparse and shallow; the command overlay gets the strongest depth.

Use 4/8/12/16/20/24/28/32/36/48 spacing steps according to density. Radii: 6–7px utility controls, 8px identity/switcher treatment, 12px major panels, 14px command overlay. Do not apply the same rounding everywhere. Avoid nested card stacks and decorative KPI grids. Prefer rules and typography for secondary information.

## Dashboard composition and shared context

The current distribution chart is retained. Directly below it, the compact A-derived next-meeting surface pairs a prominent time with meeting context and a working details action. It reads the existing scoped overview agenda; do not import lab fixtures or invent meeting records. The full-width **დღის რიტმი** comes next, followed by the existing student overview and school news. The rhythm uses horizontal event columns on desktop and a vertical sequence on mobile; calendar navigation remains available. Example schedule context stays tied to the labeled demo snapshot, not the live clock.

The sidebar's **I სემესტრი** block follows the main navigation in document order, above the flexible account area. It replaces the duplicate year header and bottom slogan; semester copy is demo-only until real academic context is implemented. The uncluttered shared footer shows `თბილისი · HH:mm:ss`, updated each second using the valid IANA zone `Asia/Tbilisi`. Its numeric container has a fixed width, and updates are isolated in `TbilisiClock` so the shell does not rerender every second. Keep these shared chrome changes consistent across existing main routes. Archived design-lab styles and components remain untouched.

## Command interaction

- `Meta+K` (Win/Command) and `Ctrl+K` toggle the palette; the visible search control also opens it. Operating systems may intercept Win+K, so Ctrl+K remains available. No claim that a webpage overrides OS shortcuts.
- Input receives focus on opening. Arrow keys traverse results, Enter acts, Escape closes; focus returns to the opener. IME composition does not accidentally execute a selection. Pointer selection and touch remain available.
- Grouped pages/actions plus server-authorized student results; no fictional lab records imported. Query length is bounded, input is debounced 120ms, and obsolete fetches receive cancellation signals. Results for a previous query are never presented as current.
- Preview explains the selected destination or displays only fields already returned by the scoped student API. Planned destinations are identified. Loading, empty, retry/error and clear-query states are implemented.
- The result list and contextual preview scroll independently; header/footer remain visible in short windows. Mobile removes the preview pane while keeping the same keyboard behavior. Opening is 170ms, closing 100ms; actions do not wait for animation.

## Motion and responsive behavior

The login lens resolves in 1.4 seconds, with masked type following a related easing curve. A pause/resume control affects the decorative entrance. The dashboard cursor is a conventional terminal block: one-second cycle, 500ms visible / 500ms invisible, crisp `steps(1, end)` opacity only, indefinitely. Text is immediately present. No typing, position animation, scaling, breathing or unusual cadence. Reduced motion leaves the cursor steady. Hover and theme changes remain short; counts do not animate through invented values.

`prefers-reduced-motion` removes travel/delay and repeated animation, including overlays. No motion is required to use a form or command. No GSAP, Motion, Three.js, canvas, video or other new frontend dependency is introduced. Vite ignores API-only `.env` files; browser configuration uses `/api/config`, and production builds use the production React runtime.

Desktop remains primary. At 1024px the two main dashboard columns remain viable. Below 900px the left navigation becomes a drawer. At phone widths the dashboard stacks, the command preview is removed, and the login artifact becomes a compact entrance above the form. Tap controls stay usable; long content scrolls normally rather than being clipped to a viewport.

## Verification boundary

Use `npm run check` and `npm run test:e2e`. Product browser coverage checks real login, password/error states, Meta/Ctrl K, keyboard traversal/focus return, scoped search/error recovery, Tbilisi midnight rollover, pause/reduced motion, fixed terminal-cursor frames, working student filters/details, planned-route boundaries, and light/dark layouts at 1440/1024/390px. Preserve the existing backend authorization suite and main role workflows. Capture/inspect rendered screens; compilation alone does not validate visual quality.

Formal accessibility certification, external font-license verification and school production rollout remain separate launch gates. This is the selected main-product design on an engineering foundation, not a claim that a complete EMS has shipped.

## Operational administration (Stage 1A)

Academic setup uses a year context and compact tabs; people use searchable rows and contextual histories. Extend main-product tokens, not lab styling. Focused dialogs use a two-column desktop form, single-column small-screen reflow and readable Georgian confirmation values. Async person selectors require an actual selected identity, expose distinguishing context and warn about similar names without merging. Staff/guardian history, enrollment boundaries and irreversible consequences are visible in context. End dates are consistently exclusive. Main sidebar semester progress must derive from configured active-year semester dates in Tbilisi, with neutral gaps/missing data; the archived lab's mock progress is not a data source.
