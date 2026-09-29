# Research and provenance

Reviewed 27 September 2026. Public context is not an operational requirements source. Counts, product scope, current EduPage use and one-campus structure are supplied by the user. Every sample pupil/staff/guardian is fictional.

## School context

[Official AIA-GESS website](https://www.aia-gess.ge/) identifies the school and highlights academic achievement, international educational activities and school news. These support a product emphasis on academic history, achievements, events and family communication; exact school workflows still require validation. No public student names or records were copied into fixtures.

Logo source: `https://www.aia-gess.ge/templates/geo/images/logo.png`. User explicitly permits its use in this product foundation. Retain the original asset; it is a school mark, not an open-source asset. Interface design is independently specified in design-system.md; website colors/layout/type/navigation were not adopted.

## Typeface selection and licensing

The following Noto decision records the original 27 September foundation. It was superseded for the selected main UI by the twelve-candidate [exploration](design-exploration.md) and [current design system](design-system.md): Mersad UI, NeoBau numerical display and user-requested [GL Tatishvili 12 Normal](https://typeface.ge/ka/font/GL+Tatishvili+12+Normal) for the greeting. Exact unmodified binaries, source URLs, hashes and embedded notices are in `public/fonts/product/`. Missing catalog license metadata did not exclude candidates. Production license verification remains required before external distribution.

[typeface.ge](https://typeface.ge/ka) was the Georgian discovery source. Compared its listings for [123 Antena](https://typeface.ge/ka/font/123%2BAntena), [Mersad](https://typeface.ge/ka/font/Mersad), and its [Noto Georgian journal entry](https://typeface.ge/ka/journal/noto-msofliostvis). The catalog shows multiple weights for Antena and Mersad. A clear commercial embedding license was not established for those two during research, so their files were not embedded in that initial foundation. Some typeface.ge pages intermittently failed/returned test-mode pages; discovery was supplemented with upstream license evidence.

Selected Noto Sans Georgian for readable small labels, full Georgian character coverage and useful weight range; Noto Serif Georgian provides restrained academic character in large headings. Evaluate table numerals, long Georgian labels, mobile forms and both themes in browser. Serif is not used in dense data. This is a deliberate Georgian pairing, not an Inter/system-default selection.

Primary embedding evidence: [Sans OFL](https://raw.githubusercontent.com/google/fonts/main/ofl/notosansgeorgian/OFL.txt), [Serif OFL](https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifgeorgian/OFL.txt). Both use SIL Open Font License 1.1, permitting bundling/embedding subject to preserving copyright/license and its other conditions. Self-host via Fontsource packages; distribute license text in public/fonts. No Google Fonts runtime requests.

## Privacy

[Official consolidated Georgian personal-data law](https://new.matsne.gov.ge/en/document/view/5827307) is the primary source. Engineering considerations and unresolved legal policy appear in security-privacy.md. Verify the current consolidation at production review, especially amendments and oversight arrangements. This is not legal advice or a compliance certification.

## Technical primary references

- [Better Auth Fastify integration](https://better-auth.com/docs/integrations/fastify): web Request/Response bridge and server session resolution.
- [Better Auth Drizzle adapter](https://better-auth.com/docs/adapters/drizzle): PostgreSQL adapter integration; committed auth schema remains explicit.
- [Drizzle PGlite setup](https://orm.drizzle.team/docs/get-started/pglite-new): local PostgreSQL-compatible driver.

Package-lock records the exact installed versions. Consult installed types and current primary docs before changing integrations; avoid stale copied examples.
