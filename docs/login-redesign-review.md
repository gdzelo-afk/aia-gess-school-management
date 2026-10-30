# Login redesign — rejected alternative, 29–30 October 2026

## Reference review

The user requested a complete Login design replacement after rejecting the refined orbit. Visually reviewed https://typeface.ge/ka and its Georgian Mersad specimen page. The reference combines strong Georgian typographic scale/weight contrasts, flat cobalt/black/white surfaces, spacious specimen rows and compact navigation. Its Georgian navigation uses MersadCaps. The direction below translates these principles; it does not copy the site's artwork, font files, content or navigation.

## Saved alternative

The rejected orbit is preserved locally under `.local/login-artwork/saved-orbit-2026-10-29/`, including the exact source files, an artwork-only patch, screenshots and verification logs. The directory is intentionally ignored. Existing Gradebook work remains separate and unchanged.

## Implementation plan

1. Replace the floating lens and full-height divided panes with a compact identity header, a flat typographic editorial panel and an immediately legible sign-in area.
2. Make the existing Georgian message the artwork: strong Mersad weight/scale contrast and controlled cobalt. Retain the institutional logo, local fonts and genuine live Tbilisi date.
3. Preserve email/password validation, reveal control, email-only remembrance, recovery, throttling, demo-role gating and form state across theme/session refresh. No authentication/backend changes.
4. Keep phones focused on sign-in; the editorial panel has no mobile footprint. Preserve keyboard focus, readable error feedback and reduced motion. Remove obsolete orbit/pause UI rather than keeping decorative controls with no purpose.
5. Review desktop/tablet/mobile in both themes. Run affected Login regression workflows, lint, formatting, TypeScript and production build. Update the motion test to verify the new static typography and retained Tbilisi/date behavior; keep authentication assertions intact.

## Acceptance boundary

Local design exploration only. Rejected by the user on 30 October 2026; the pre-orbit-edit Login is restored. No commit, push, merge, Render or hosted preview. No changes to Gradebook, other product screens, font/logo assets or `/design-lab`.

## Implemented candidate and verification

The planned typographic replacement is implemented. Existing Mersad becomes the artwork: the message is composed in three deliberate scales on a flat cobalt field. The date uses the existing NeoBau face. Identity and theme share a compact header; form controls retain their established focus/validation behavior. A shorter gap around the reserved error area reduces empty space without moving Submit when validation appears. The editorial panel is absent on phones, not moved below the form. No reference-site assets were copied.

- Seven focused Login browser workflows passed across the retained runs. The initial run stopped externally (143) after four successful checks; only its three unfinished workflows were resumed on fresh isolated fictional data, passing with exit 0. No assertion was weakened to recover the interruption.
- Real authentication, reveal/remember-email, throttling, stable error placement, session-refocus input preservation, deliberate reload clearing, Tbilisi midnight rollover, reduced motion, real mobile theme taps, keyboard focus and responsive Login/Dashboard/command rendering are covered.
- Formatting, ESLint, strict TypeScript and production frontend/server builds passed. The updated existing motion test describes the static typographic design and retains the date/reduced-motion assertions. No unchanged domain/database suites were rerun.
- Visual review covers 1440/1920 desktop, 1024/761 tablet and 390 phone in representative light/dark states; automated layouts additionally cover 320px and short landscape. No horizontal page overflow was observed. Captures and logs: `.local/login-editorial/`.

The candidate was verified for local review, then rejected. Its complete checkpoint is `.local/login-editorial/saved-typographic-2026-10-30/`; `http://localhost:5174/login` now uses the pre-orbit-edit Login. The broader Gradebook working tree remains parked. No Git publication, deployment, asset replacement or archival changes were performed.
