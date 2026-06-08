# Repository Maturity Filter And Masthead Trace

- Date: 2026-06-08
- Trace layer: operational
- Branch: `fix/repository-maturity-filter-counts`
- Branch decision: trace required by `fix/` prefix
- Task summary: fix evidence maturity filter counts on the repository landing page, improve filter panel button contrast, and move the repository landing page hero/search into a GOV.UK Design System-style masthead with route-specific header, menu, breadcrumb and phase-banner styling.
- Follow-up scope: strengthen repository menu inverse-colour styling against the shared header stylesheet and improve the repository masthead SVG so it has connected square-dot paths and a higher-quality repository workflow scene.
- Illustration quality scope: inspected the GOV.UK Design System homepage SVG and the DWP Design System homepage banner SVG source to compare composition, group structure, connector dot construction, laptop geometry and internal UI detail before rebuilding the ResearchOps Repository asset. Follow-up replaced the DWP-like code-editor panel with a traced online research session scene based on the supplied PNG coordinate system and used the detailed DWP `Crown-logo` element in the laptop page header.

## Operating Model Evidence

- Loaded: `AGENTS.md`
- Loaded: `.agent-operating-model/orchestration.xml`
- Loaded: `.agent-operating-model/bundle-registry.json`
- Loaded: `.agent-operating-model/task-signal-catalog.json`
- Loaded: `.agent-operating-model/selection-rules.json`
- Loaded: `.agent-operating-model/bootstrap-checklist.md`
- Loaded: `.agent-operating-model/precedence-policy.md`
- Loaded: `.agent-operating-model/github-mutation-policy.md`

## Bundles Selected

- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`
- `.agent-operating-model/bundles/govuk-design-system/`
- `.agent-operating-model/bundles/cloudflare/`

## Bundles Skipped

- `.agent-operating-model/bundles/openai/`: no OpenAI API or model changes.
- `.agent-operating-model/bundles/mcp-agent-tooling/`: no MCP contract changes.
- `.agent-operating-model/bundles/airtable-public-api/`: Airtable fallback shape was kept aligned but no Airtable API calls or schema changes were made.
- `.agent-operating-model/bundles/mural-public-api/`: unrelated to repository UI and D1 filter behaviour.

## Precedence Decisions

- Repository operating model and `AGENTS.md` governed branch naming, trace requirement and validation.
- GOV.UK Design System bundle governed masthead, menu, breadcrumb and responsive illustration treatment.
- ResearchOps Developer Control governed the repository API payload contract and filter count behaviour.
- Cloudflare bundle applied because the repository API is Worker/D1-backed.
- User instruction not to commit generated CSS or HTML output was followed; local generated assets were used only for browser verification.

## Implementation Decisions

- Changed repository filter facet payloads from `evidence_maturity` to `maturity` so API filter counts match the Nunjucks checkbox `name="maturity"` and the page script can attach counts to the Evidence maturity labels.
- Kept D1 query filtering on the `evidence_maturity` column; only the public API facet name changed.
- Applied the same `maturity` facet name to the Airtable fallback path.
- Added a white background rule for the secondary Apply filters button inside the grey repository filter panel.
- Wrapped the repository landing page breadcrumbs and hero/search in `<div class="app-masthead repository-masthead">` inside `main`.
- Kept the service menu in `<header class="govuk-template__header">`, matching the GOV.UK Design System separation between header/navigation and main masthead.
- Corrected the shared page chrome so the same service header element also carries `govuk-header`, preserving the existing `header.govuk-header` smoke-test landmark while keeping the menu inside `header.govuk-template__header`.
- Added a repository-specific SVG masthead illustration in the same flat GOV.UK palette and hid it below the desktop breakpoint.
- Styled repository-page service navigation, breadcrumbs, masthead and phase banner for the brand-colour treatment from route-specific `repository.scss`.
- Strengthened service-navigation inverse-colour selectors against `[data-active="Research Repository"]` so the repository menu remains white after the shared page chrome stylesheet is appended.
- Removed active repository navigation `box-shadow` and `border-bottom` treatment; route-scoped navigation item and service-name borders are still set to white.
- Set the repository `.app-masthead` border to `var(--govuk-brand-colour, #1d70b8)` so it matches the Design System brand-colour treatment.
- Replaced the masthead SVG with a connected repository workflow illustration: an online research session/collaboration scene, candidate record card and repository service page are connected by circular dotted paths into a more detailed laptop composition with stronger internal UI geometry.
- Updated the remaining GOV.UK Frontend integration route-state assertion so it recognises the single shared header element carrying both `govuk-template__header` and `govuk-header`.
- Removed route-state assertions that inspected internal SVG drawing details; the tests now check that the repository page references the illustration, not how the image is drawn.
- Replaced the approximate online research session drawing with a traced sub-scene using the supplied PNG's `1220` by `813` coordinate system scaled into the repository illustration panel.
- Replaced the simplified laptop crown mark with the detailed `Crown-logo` element from the DWP Design System SVG source.
- Corrected the research-session panel ratio so the traced `1220` by `813` scene scales uniformly inside a matching 1.5:1 window rather than being squeezed into the old code-window proportions.
- Adjusted the research-session scene again so the `T` glyph matches the lighter sans-serif weight of the `R`, moved the session window up, and split the lower connector into vertical and horizontal dotted runs so it forms a visible right angle beneath the window.
- Extended the lower connector so its vertical leg meets the bottom of the research-session window inline with the left edge of the bottom-right participant body, then runs horizontally back toward the laptop.
- Scoped the inverse service-navigation and phase-banner styling to a repository front-page body marker set by the GOV.UK page renderer so deeper repository pages keep the standard white GOV.UK service navigation and phase banner while the landing page keeps the `app-masthead` treatment.
- Updated the service-page normaliser so it preserves existing body classes instead of flattening every rendered page back to `govuk-template__body`.

## Validation

- `node tests/repository-front-page-route-state.test.js`: passed.
- `npm run format:check`: passed.
- Local build for browser verification: `npm run build:generated-css` and `npm run build:govuk-pages`: passed.
- In-app browser desktop verification at `http://127.0.0.1:4180/pages/repository/`: header contains service navigation, masthead is inside `main`, masthead/nav/phase banner use `rgb(29, 112, 184)`, breadcrumbs are white, search panel is white, illustration is visible at 1280px.
- In-app browser mobile verification at 390px: illustration column is hidden, masthead/nav remain brand-blue, search panel fits the viewport.
- Follow-up browser verification: repository service-navigation background, active link and visited link colours remain inverse after the shared header stylesheet loads; SVG renders as a connected square-dot workflow illustration at `/images/repository-masthead-illustration.svg`.
- Follow-up browser verification after active-state adjustment: active repository navigation link has `box-shadow: none`, no bottom border and white text; active navigation item border resolves to white.
- Follow-up browser verification after masthead border adjustment: `.app-masthead.repository-masthead` background and bottom border both resolve to `rgb(29, 112, 184)`.
- Follow-up SVG quality verification: `xmllint --noout public/images/repository-masthead-illustration.svg` passed; in-app browser loaded the replacement asset with intrinsic size 749 by 464 and rendered it in the masthead at 320 by 198.
- CI failure follow-up: Node and Worker validation failed on `tests/govuk-frontend-integration-route-state.test.js` because it still expected `class="govuk-header"` as the exact class value. Updated the assertion and verified `node tests/govuk-frontend-integration-route-state.test.js`, `node tests/govuk-page-chrome-navigation-route-state.test.js` and `node tests/repository-front-page-route-state.test.js` pass locally.
- Follow-up research-session trace verification: `xmllint --noout public/images/repository-masthead-illustration.svg`, `node tests/repository-front-page-route-state.test.js`, `node tests/govuk-frontend-integration-route-state.test.js`, `node tests/govuk-page-chrome-navigation-route-state.test.js` and `npm run format:check` passed.
- In-app browser verification after trace replacement: repository masthead image loads at `/images/repository-masthead-illustration.svg` with intrinsic size 749 by 464 and renders in the masthead at 320 by 198.
- In-app browser verification after ratio correction: repository masthead image still loads at intrinsic size 749 by 464 and renders at 320 by 198; the left research-session scene preserves the supplied PNG aspect ratio inside the resized window.
- In-app browser verification after connector/glyph adjustment: the research-session window renders higher in the masthead, the lower dotted connector forms an L shape below the window, and the `T` glyph weight is visually closer to the `R`.
- In-app browser verification after extending the lower connector: the vertical dotted run now sits under the bottom-right participant body's left edge and the horizontal run extends toward the laptop.
- Route-state coverage added for the repository front-page body marker and to confirm the static deeper repository template does not carry that marker.
- Route-state coverage added for the normaliser class merge so the generated front page keeps its repository-specific body marker.
- In-app browser verification after chrome scoping: `/pages/repository/` keeps the blue service navigation, white active link, blue phase banner and blue `app-masthead`; `/pages/repository/review/stale/` has no masthead, standard pale service navigation, normal dark phase-banner text and no repository front-page body marker.
- GitHub Codex review comment handling: reacted with thumbs-up, replied that the nested banner landmark issue was resolved by using a single shared header element, and resolved review thread `PRRT_kwDOP3Td2M6Hw9ty`.

## Residual Risks

- The static local browser preview cannot show real D1 filter counts without the Worker API; the service contract test protects the API facet naming and CI preview will exercise the deployed Worker path.
- Header structural change affects shared page chrome, so full CI should run before merge.
