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

## Shared interaction rules (UX cohesion review, 4 October 2026)

- `Shell` owns the lazy-route pending boundary; navigation/chrome stay mounted. New route paths start at the header; query-only changes preserve working position. Timetable schedule content stays mounted across operational tabs. Do not animate away a remount or reset an editor for a viewport/sidebar change.
- `Select` replaces production native menus, using a compact listbox and search for longer lists. `PersonPicker` searches the existing scoped API. Popovers use Radix positioning, Escape and focus handling; keyboard focus is visible, pointer focus has no extra halo. Hidden native controls retain form values/validation; controlled scope guards remain authoritative.
- `DateInput` owns a compact Georgian calendar because OS date popups cannot guarantee localization. It retains ISO date-only form values, bounds, manual entry, spillover days and keyboard month/day navigation. Weekdays are `კვი.`, `ორშ.`, `სამშ.`, `ოთხ.`, `ხუთ.`, `პარ.`, `შაბ.`; footer actions are `გასუფთავება` and `დღეს`. It is a field control, not a replacement for the Calendar workspace.
- Safe directory filtering may retain visibly pending, inert previous rows and disable pagination. Never carry previous child, course, lesson or academic records into a different context. Attendance/Gradebook await authoritative context data; local unsaved edits and existing guards remain intact.
- Predictable validation uses a small stable inline slot; longer persistent errors may expand. Transient operational notices use dismissible overlays. Do not absolutely position all errors or reserve large blank panels.
- Timetable periods scroll with the **page**, with no inner vertical height cap. Horizontal matrix containment remains. Other dense lists retain their useful scrolling.
- Main-only `product-interactions.css` coordinates 120–200ms controls/popovers/rail motion and existing dialog primitives, respecting reduced motion. Portals use the product theme. Keep useful data-row rules; omit duplicate perimeter rules and decorative separators. Archived lab styling remains independent.

## Design logic

A is the dominant spatial system: calm neutral chrome, controlled cobalt accent, restrained layering, readable opaque work surfaces, a priority panel and contextual count distribution. The date, geographic detail and cursor are reinterpreted in A's proportions and materials; no B console styling or C display-heading system is imported.

The chosen “This Thing” hero is the original Vector A abstract lens: four translucent circular shells, dimensional CSS perspective, a quiet central Georgian glyph and a finite entrance. The markup/geometry/materials were reused from `design-lab/overview.tsx` and `lab.css` into independently scoped production code; no screenshot/raster replacement. **The layered shield was rejected and removed from the main login.** Do not restore it or force the crest into the object. The unchanged crest remains in the left-pane identity. The city coordinates are an approximate **Tbilisi geographic reference**, not a claimed surveyed campus location. The prominent date is live in **Asia/Tbilisi**, including midnight rollover; the Dashboard header now uses the same live date, independently of dated demo announcements and meeting examples.

The dashboard preserves real scoped counts and enrollment distribution, child switching, identity links, announcements and schedule previews. A polished surface must never imply that planned academic/financial modules are operational. Priorities distinguish usable lists/calendar from planned modules. Sample events and announcements remain labeled.

## Typography

| Role                                                                 | Family                                       | Working treatment                                                                                                        |
| -------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Georgian interface, forms, navigation and running copy               | Mersad Variable                              | Generally 12–15px / 1.5–1.8, weight 400–500                                                                              |
| Login and dashboard hierarchy                                        | Mersad Variable                              | Login 43–68px desktop; section emphasis 24–31px; optical negative spacing only on large headings                         |
| Dashboard greeting                                                   | Mersad Variable (Option A display treatment) | 30–40px desktop / 26px mobile, weight 450, -0.04em tracking, 1.28 line-height; live Tbilisi greeting + viewer first name |
| Dates, prominent counts, time, years and compact numeric identifiers | MCh NeoBau                                   | Regular for most display values; genuine Bold available; tabular numerals; never used as the general text face           |
| Secondary labels                                                     | Mersad Variable                              | Typically 11–12px; 10px reserved for compact noncritical metadata, with larger mobile working labels                     |

Keep Georgian text unclipped. Headline line height is 1.2–1.4; ordinary UI copy is not forcibly uppercase. The greeting cursor stays attached to the name on narrow screens. The terminal cursor uses em-based geometry and stays on the greeting baseline. The 3 October controlled redesign replaces the former Tatishvili greeting treatment with Option A’s Mersad display voice. The main stylesheet loads Mersad directly; the redundant late React preload was removed after compiled network inspection; the greeting uses an explicit line height and its cursor reserves fixed inline geometry. Existing Tatishvili assets/notices remain preserved, but it is no longer requested by the main greeting.

Fonts are local and use `font-display: swap`; Mersad is the shared UI/display face, loaded once through CSS; numerical faces are requested when rendered. Main-product URLs are `/fonts/product/`, independent from `/design-lab/`. Source URLs, hashes and verbatim embedded notices live with the exact font binaries. **Production license verification required** before external distribution; selection is not a license certification. The prior twelve-candidate research remains in [the archived exploration](design-exploration.md). The original Noto assets/OFL notices remain in the repository; selected main surfaces explicitly use the product font roles.

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

Desktop remains primary. At 1024px the two main dashboard columns remain viable. Below 900px the left navigation becomes a drawer. At phone widths the dashboard stacks, the command preview is removed, and the login form precedes the compact editorial artifact. Tap controls stay usable; long content scrolls normally rather than being clipped to a viewport.

## Verification boundary

Use `npm run check` and `npm run test:e2e`. Product browser coverage checks real login, password/error states, Meta/Ctrl K, keyboard traversal/focus return, scoped search/error recovery, Tbilisi midnight rollover, pause/reduced motion, fixed terminal-cursor frames, working student filters/details, planned-route boundaries, and light/dark layouts at 1440/1024/390px. Preserve the existing backend authorization suite and main role workflows. Capture/inspect rendered screens; compilation alone does not validate visual quality.

Formal accessibility certification, external font-license verification and school production rollout remain separate launch gates. This is the selected main-product design on an engineering foundation, not a claim that a complete EMS has shipped.

## Operational administration (Stage 1A)

Academic setup uses a year context and compact tabs; people use searchable rows and contextual histories. Extend main-product tokens, not lab styling. Focused dialogs use a two-column desktop form, single-column small-screen reflow and readable Georgian confirmation values. Async person selectors require an actual selected identity, expose distinguishing context and warn about similar names without merging. Staff/guardian history, enrollment boundaries and irreversible consequences are visible in context. End dates are consistently exclusive. Main sidebar semester progress must derive from configured active-year semester dates in Tbilisi, with neutral gaps/missing data; the archived lab's mock progress is not a data source.

## Timetable scheduling workspace (Stage 1B)

Use `components/timetable/Matrix`, `Panel`, `Forms` and the timetable stylesheet with existing product tokens. Draft and published schedules share period rows, a sticky time axis and weekday headings. Keep one searchable scheduling lens; do not restore independent day-card stacks or permanent filter walls. Neutral lesson cells disclose full context through an inspector, not through dense inline controls. Desktop inspectors use a separate column; at 1100px and below use the modal sheet, with a single-day matrix on phones. Drag feedback occupies a fixed overlay so targets never move during preview. Conflict text/icons and explicit reasons supplement color. Operational queues and configuration use separators and hierarchy rather than nested cards. These components are main-product only; the historical design-lab is unchanged.

### Attendance extension

Attendance uses the same opaque operational surfaces, fine separators, Mersad UI and NeoBau numeric roles. Compact pupil rows use labeled status controls; time details disclose inline. The mobile roll-call summary/explicit submit remains sticky, with no horizontal roster scroll. Unresolved/unsaved/submitted states use text as well as restrained semantic color. Monthly history uses date buttons with accessible day-state labels and a separate completeness summary. Review dialogs remain bounded to the viewport. These are main-product patterns; the archived design-lab is unchanged.

### Gradebook extension

Use main-product `product-gradebook.css`, the course matrix and contextual assessment inspector. Keep narrow Georgian assessment headings wrapped within fixed-width columns, sticky pupil identity/time context and bounded internal scrolling. At 1150px and below, reuse the accessible product modal as a Gradebook sheet; do not leave the inspector inside the scrolling page. Phone result controls retain readable labels and touch targets, with a persistent draft/correction save bar. Neutral cells distinguish score, narrative, explicit non-score and publication states through words as well as restrained color. Reports show exact/provisional/incomplete meaning without pupil ranking. Never import or alter archive-vector styles.

## Controlled Login / Dashboard refinement — 3 October 2026

The current product is the base. Only the annotated header/entrance/chrome concepts are synthesized from Option A. Dashboard metrics, enrollment distribution, priorities, next meeting, day rhythm, student/news rows and scoped Attendance/Gradebook pulses remain unchanged. The small full Georgian weekday/date precedes a time-aware Mersad greeting and the conventional stationary cursor; a calendar-icon **დღის განრიგი** action replaces the large date card. The redundant demo strip is removed. `school-time.ts` uses IANA `Asia/Tbilisi` (not the invalid `Europe/Tbilisi` identifier) with explicit Georgian weekday/month names. Morning is 05–12, afternoon 12–18, evening 18–23; overnight uses a neutral greeting. Today links to the existing published timetable week and selects the corresponding mobile day, including a neutral weekend view. Guardian links carry the selected permitted child; server scopes remain authoritative.

The shared desktop sidebar can collapse to a 72px icon rail. All real destinations remain; hover/focus labels use a portal outside the scrolling rail, Escape dismisses them, and active state stays visible. Only the `aia-sidebar-collapsed` presentation preference is stored locally. Below 901px the existing navigation dialog remains; its close handler explicitly restores focus to the mobile menu button. Semester context remains after navigation when expanded; collapse does not relocate it.

Login is a direct ~60/40 split at large desktop widths, with a single fine divider and no full-width header or central gutter. Identity belongs to the left pane, theme utility to the upper right. Current coordinates/date/lens/message and form/security notice remain. The compact options row contains **ელფოსტის დამახსოვრება** and the sole recovery link. The checkbox stores only the email identifier after successful sign-in; unchecking removes it. It never stores passwords or changes session duration. Demo shortcuts remain gated by the existing demo configuration. Phone layouts (≤760px, or short landscape ≤900×500px) show identity and the complete sign-in form only; the editorial section has no rendered footprint. Regular tablets and desktops retain the editorial composition. The mobile theme utility owns a 44px hit area above the identity, whose padding reserves that space. No lab labels, disclaimer or comparison actions enter the product.

This refinement adds no UI dependency and changes no backend, authentication rules, contracts, migrations or demo data. The separate lab source/asset graph is untouched.

### Precise interaction feedback and safe date transitions

Main operational text tabs retain their underline language on hover/keyboard focus. Gradebook score selection uses restrained text/inset indicators and fine column boundaries, avoiding filled rectangular slabs. Full selectable rows/cards and date/listbox options remain intentional exceptions. All keyboard feedback remains visible in light/dark themes.

Attendance History may retain its last authoritative month only for the same viewer/pupil context. The displayed content keeps its own period label, announces pending and disables stale drill-down until replacement; pupil/lesson/academic-scope changes require fresh data. Login's anonymous session revalidation must not unmount a form. Typed passwords live only in React memory and never survive document refresh through storage.

### Form focus and compact date controls

Main-product bordered text fields, textareas and Select triggers use a single accent border for pointer focus and a contiguous 2px inner focus band for keyboard navigation. A main-entry modality tracker distinguishes Tab/keyboard navigation from ordinary typing after a click; no interaction preference is persisted. Invalid fields retain their danger boundary and keyboard indicator. Custom Attendance radio groups, Gradebook matrix cells and command search keep their existing indicators. Checkbox/radio focus is not suppressed.

Borderless scheduling-lens/searchable-menu inputs and compact date controls use a bottom boundary: 1px for pointer focus, 2px for keyboard focus. `DateInput` defaults to the ordinary field treatment; its explicit `compact` variant normalizes Attendance/Timetable toolbar height to 42px and balances Mersad's unused numeral descent with 10px/6px vertical padding around a 20px line. Attendance stays 142px wide; Timetable stays 170px with its existing 12px text. Date values, parsing, bounds and calendar behavior are unchanged. Large NeoBau numbers and other native numeric/time fields are not optically repositioned.

### Keyboard and resilient working-state continuity

Main-product Modal returns focus to its connected usable opener unless a caller deliberately overrides it. A Select reveals the selected/highlighted option using only its own list scroll; Tab/Shift+Tab closes the portalled list and continues the form. Search input uses combobox semantics with a valid active descendant. These behaviors must retain native form validation and server-derived scope/unsaved-change guards.

WorkspaceNav uses manual arrow/Home/End focus traversal and keeps the focused/selected item visible within its own horizontal viewport. Activation remains explicit, so a guarded Gradebook transition is never bypassed. Pathname navigation focuses the named main region; query-only academic/history changes keep local interaction focus.

A transient background session-check failure preserves resolved working state and offers a dismissible Georgian retry notice below modal surfaces, without content reflow. Initial session errors and real expiration retain their own bootstrap/authentication behavior. Directory typing is coalesced locally over 180ms, with old rows visibly pending/inert from the first change; cancellation and retention are not global query defaults. Academic, lesson and family-context changes still require authoritative scope data.

### Depth and directional feedback (27 October 2026; accepted 28 October)

The comparison branch adds theme-aware shallow depth tokens for stationary Dashboard panels and contextual popovers/tooltips. Enabled primary buttons use a fine inner highlight; existing shadow/press transitions stay coordinated. Only directional arrows travel 2–3px on eligible hover or keyboard focus, with no travel under reduced motion. Text, hit areas, panel geometry, input-focus treatment and the neutral palette remain fixed. Login lighting stays confined to the existing desktop editorial pane. The user accepted this finish on 28 October 2026; it extends the existing design system.

Every sidebar destination shares the existing accent current-page marker in expanded navigation, the collapsed icon rail and the mobile drawer. Route matching and `aria-current` remain owned by NavLink; the decorative marker fades between destinations over 120ms. Expanded markers retain their fixed geometry throughout the fade to avoid a temporary thickened/shortened shape at fractional pixel positions; the collapsed rail and mobile drawer retain the restrained 160ms vertical reveal. It stays outside layout, with inactive markers transparent and reduced-motion changes immediate. Expanded labels use matching color/weight transitions so their emphasis does not snap ahead of the marker; the collapsed treatment is unchanged.

### Dense-workspace finish (28 October 2026, accepted)

The same comparison now extends to Timetable, Attendance and Gradebook. Keep matrix/roster geometry fixed: opaque weekday and assessment headers gain a quiet rail-to-surface gradient; lesson hover gains shallow depth without moving tiles or drag grips. The desktop timetable inspector retains its separator and gains only a faint side wash. Attendance's current lesson and monthly calendar use the existing raised-surface token. Attendance submit and Gradebook save bars share a shallow upward shadow and inner highlight, distinguishing persistent actions from scrolling content without altering their position. Gradebook pupil identity retains an opaque background with a fine trailing shadow; score cells remain transparent. Existing mobile sheets, semantic states and focus indicators are preserved. Directional arrows travel only 1–2px on eligible hover/focus, and reduced motion disables transitions. No new colors, typography, UI dependencies or operational behavior are introduced.
