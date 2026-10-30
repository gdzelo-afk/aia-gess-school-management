# Gradebook visual refinement — approval checklist

Date: 29 October 2026. Branch: `codex/gradebook-visual-refinement`.

**Status: local verification complete; the user authorized deployment of the current version on 30 October, subject to readiness checks.** The findings below preserve the initial review. Deployment follows the final-source checks and the preview branch’s complete CI; no broader product or next-stage changes are authorized.

## Feedback being addressed

- Give the Gradebook table a more deliberate visual design; its spreadsheet appearance is undesirable. Keep the result restrained and practical.
- Replace or substantially refine `gb-inspector`: it should be easier to use, consume less space and expand smoothly.
- Remove repetitive assessment headings above every mark column. Organize scored marks around Classwork, Homework and Summative; retain the existing formative/no-score option.
- Prioritize visual quality, then improve the related interaction without changing academic rules.

## Useful work already present

Category bands and compact date headers replace repeated assessment titles. Full titles remain in accessible labels and details. Boxed cell borders have been softened into row separators and category gutters. The desktop inspector is narrower at 360px; a selected mark reveals its pupil. Mobile uses the existing accessible sheet with reachable save/publish actions and focus return. Opening/layout motion respects reduced motion.

Keep these improvements while addressing the gaps below. Do not restore verbose per-column headings or reinterpret dates as unnecessary: dates still identify assessment occurrences.

## Findings from the initial iteration

| ID    | Finding and evidence                                                                                                                                                                                                                  | Classification                                                                                                                                   | Proposed correction, subject to approval                                                                                                                                                                                     |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GB-01 | The table remains visually close to a spreadsheet: uniform numeric columns, repeated horizontal rules and heavy category bands still dominate the composition. Visible in the current light/dark review captures.                     | Visual judgment tied directly to the user's feedback; not a functional defect.                                                                   | Refine category-band weight, row separation, pupil identity and mark emphasis as one coherent composition. Keep the compact matrix and avoid decorative cards, extra badges or elaborate effects.                            |
| GB-02 | Clicking one mark still opens the entire assessment roster. The selected pupil is revealed, but the other pupils remain in the same panel, duplicating the table. `AssessmentPanel.tsx` renders `data.roster.map(...)` for this view. | Confirmed current behavior; the central inspector complaint is only partly addressed.                                                            | Make the selected pupil and mark the primary detail context. Recommend a compact selected-mark surface with deliberate access to the full assessment editor. The interaction change requires approval before implementation. |
| GB-03 | The inspector consumes 360px plus a 20px gap. At the reviewed 1440px desktop width, this narrows the table enough to move some rightmost marks into its horizontal scroller.                                                          | Confirmed composition limitation; contained table scrolling, not horizontal page overflow.                                                       | Judge the detail surface by the usable journal width it preserves. Reduce duplicated content before choosing its final width or anchored/overlay presentation. Compare it open and closed with the dense 20-pupil journal.   |
| GB-04 | Opening has a 220ms content animation, but closing immediately unmounts the panel content while the grid contracts. Loading and loaded content also use separate mounted frames, which may make entry feel staged.                    | Immediate close is confirmed by source. A visible loading/entry discontinuity remains a verification item, not a proven defect in every opening. | Coordinate opening, closing and assessment switching; keep content stable through loading. Review intermediate frames, quick open/close and reduced motion. Preserve focus restoration and unsaved-change guards.            |
| GB-05 | Two assessments in the same category on the same date would have identical visible date headers. Their full names remain in accessible labels and native tooltips. The current fixture does not demonstrate this duplicate-date case. | Rendering-based usability risk; not a reproduced data or authorization failure.                                                                  | Check a duplicate-date example and use a discreet distinction or contextual reveal if needed. Do not bring back long headings above every mark.                                                                              |

Source references: [matrix and selection](../src/pages/Gradebook.tsx), [assessment detail content](../src/components/gradebook/AssessmentPanel.tsx), [layout and motion](../src/styles/product-gradebook.css). Existing evidence remains ignored under `.local/gradebook-refinement/`, particularly `verified-detail-light.png`, `verified-detail-dark.png` and `verified-mobile-dark.png`.

## Approved direction

Retain the grouped journal as the primary overview. Complete its visual hierarchy and explore a smaller, selected-mark detail surface; expose full assessment editing deliberately when the teacher needs the whole roster. Final placement should follow a desktop comparison, rather than assuming the current side panel must remain or that a popover is automatically better.

This is a presentation/interaction proposal only. Preserve the assessment model, complete-roster save/publication semantics, server-derived permissions, private drafts, reasoned corrections, recovery rules and existing formative/no-score behavior. Formative feedback must continue to read as non-scoring feedback, not a fourth numerical grading category. Mobile must retain comfortable targets and reachable actions.

## Implemented follow-up

- **GB-01:** Category headings now share the journal surface instead of filled bands. Grouped row separators, clearer pupil names and mark typography reduce repeated grid lines. An inherited no-wrap rule was also corrected after a long Georgian surname was found clipped in visual review.
- **GB-02:** A mark opens only its pupil/result. “მთელი შეფასების ნახვა” deliberately reveals the full roster and moves focus to that pupil’s row. All entries stay in the working state; switching pupils does not discard edits. Save/correction payloads and counts still cover the complete assessment. Compact drafts require full-roster review before publication.
- **GB-03:** Selected-mark details use 300px plus a 16px gap, compared with the initial 360px plus 20px. Full-assessment editing retains 360px. The dense 20-pupil fixture is compared with details open and closed at desktop width.
- **GB-04:** The outgoing content remains during the 220ms desktop layout transition, then focus returns. Reopening cancels the pending close; reduced motion closes immediately. The desktop frame persists during assessment loading/switching. Editor state remains above the responsive sheet, preserving edits across the breakpoint.
- **GB-05:** Same-category/same-date assessments receive small sequence numbers. Full names, dates, status and sequence remain available in accessible labels. Isolated browser coverage creates two real fictional drafts on one date and opens the corresponding columns.

No backend, permission, academic-policy, dependency or database-schema change is included. Browser mutations use disposable fictional data. Verification results are recorded in [implementation status](implementation-status.md).

## Acceptance checks

- [x] The table reads as an intentional AIA-GESS journal in both themes, including a dense course and a sparse course.
- [x] Classwork, Homework and Summative are clear without repetitive assessment titles; formative feedback stays explicitly non-scoring.
- [x] Clicking a mark makes that pupil/result the immediate focus without presenting an unnecessarily large duplicated roster.
- [x] Opening details preserves useful table width at 1440px; intentional table scrolling remains contained.
- [x] Open, close, switch and loading transitions look settled; reduced motion, keyboard focus and unsaved edits behave correctly.
- [x] Same-category/same-date assessments remain distinguishable without verbose headers.
- [x] Tablet/mobile details remain bounded and their primary actions remain reachable.
- [x] Relevant existing Gradebook workflows pass after the changes, using isolated fictional test data.
- [x] The user reviewed the result as good/decent, retained the pre-experiment Login and authorized deployment of the current version subject to readiness (30 October).

## Separate resolved preview issue

The Login failure at `localhost:5174` was a local backend/origin mismatch and has been corrected in runtime configuration. Teacher demo sign-in and Director credential-form sign-in passed. It is not evidence that the remaining Gradebook design work is complete. Runtime notes are ignored at `.local/gradebook-refinement/preview-runtime.md`.

The 30 October deployment authorization supersedes the original local-only boundary. The product branch may be published and incorporated into the existing protected Render preview after checks pass. Master integration is not part of this deployment. `/design-lab` and future modules remain outside scope.
