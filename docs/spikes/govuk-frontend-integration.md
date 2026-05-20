# GOV.UK Frontend integration spike

Status: spike proposal.

Branch: `chore/govuk-frontend-integration`.

Supersedes styling repair PR: #261.

## Decision context

The current ResearchOps mobile styling problem should not be solved by continuing to patch the hand-built GOV.UK imitation layer.

The repository currently uses GOV.UK-like class names and custom stylesheets, but it does not use GOV.UK Frontend as the source of truth for CSS, JavaScript, assets or Nunjucks components.

This creates fragile page chrome. It also creates repeated visual regressions when local CSS tries to reproduce GOV.UK component behaviour by hand.

## Official implementation baseline

The spike should follow the official GOV.UK Frontend installation route.

Use npm for GOV.UK Frontend. Use Dart Sass. Import GOV.UK Frontend styles into a project Sass entry point. Serve GOV.UK Frontend assets from a stable application path. Import GOV.UK Frontend JavaScript and initialise the components in scope.

Nunjucks should be explored after the CSS, assets and JavaScript path is proven.

## Spike goal

Prove that ResearchOps can render GOV.UK page chrome using GOV.UK Frontend as the implementation source of truth.

The spike must demonstrate this on representative pages before migration decisions are made.

## Representative pages

Use these pages for the first proof:

- `/`
- `/pages/account/`
- `/pages/start/overview/`

These cover home page chrome, authenticated account content, start journey content, service navigation, phase banner, breadcrumbs, footer, headings, body copy and mobile layout.

## Proposed technical approach

Phase 1: add GOV.UK Frontend and Dart Sass dependencies, then add a Sass entry point and generated public CSS asset.

Phase 2: copy or serve GOV.UK Frontend images, fonts and manifest assets from a stable application path.

Phase 3: copy or bundle GOV.UK Frontend JavaScript and initialise the components in scope.

Phase 4: prove page chrome on the representative pages without continuing local CSS cloning of GOV.UK components.

Phase 5: explore Nunjucks for repeated page templates and component macros after the CSS, asset and JavaScript path is proven.

## Non-goals

- Do not migrate every ResearchOps page in the spike.
- Do not redesign ResearchOps information architecture.
- Do not add another mobile-only stylesheet.
- Do not hand-copy more GOV.UK component CSS.
- Do not use CSS priority override flags to force precedence.
- Do not remove ResearchOps-specific CSS that is genuinely product-specific.

## Acceptance criteria

Feature: GOV.UK Frontend integration spike.

Scenario: GOV.UK Frontend is installed as the styling source of truth.

Given the repository uses GOV.UK Design System components, when the frontend build runs, then GOV.UK Frontend CSS is generated from the official package and ResearchOps does not hand-maintain cloned GOV.UK component CSS for the proved page chrome.

Scenario: GOV.UK Frontend assets are served.

Given GOV.UK Frontend requires font, image and manifest assets, when the application is served locally or from Cloudflare Pages, then the generated GOV.UK CSS can resolve its required assets and the page uses the expected GOV.UK font and logo assets without clipping.

Scenario: GOV.UK Frontend JavaScript is initialised.

Given a GOV.UK component requires JavaScript, when the page loads, then GOV.UK Frontend JavaScript is imported and the relevant components initialise without custom clone scripts.

Scenario: Representative pages render GOV.UK mobile chrome.

Given the representative pages are opened on a mobile viewport, when the page renders, then the header and footer are flush to the viewport edge, the service navigation follows GOV.UK mobile behaviour, and headings, body copy and spacing follow GOV.UK responsive typography and spacing.

## Validation plan

Run the standard ResearchOps validation suite after implementation.

Add or update tests to assert that GOV.UK Frontend dependency exists, a Sass build script exists, generated GOV.UK asset path exists, page templates load the generated GOV.UK asset, no separate mobile stylesheet is introduced, and no CSS priority override flag is present in authored stylesheets.

## Migration risk

This is likely a larger architectural pivot than a CSS fix.

The main risks are generated assets conflicting with hand-authored CSS during transition, existing pages depending on the custom GOV.UK imitation layer, Cloudflare Pages build configuration needing updates, visual walkthrough baselines needing deliberate refresh, and Nunjucks changing how static pages are generated or maintained.

## Recommended outcome

The spike should produce one of two decisions:

1. proceed with a staged GOV.UK Frontend migration, or
2. document why ResearchOps cannot yet adopt GOV.UK Frontend and define the minimum interim controls needed.

The preferred outcome is staged migration.
