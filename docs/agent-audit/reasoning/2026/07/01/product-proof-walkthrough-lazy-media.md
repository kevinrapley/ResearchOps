# Product Proof Walkthrough Lazy Media Trace

Date: 2026-07-01
Branch: `fix/bdd-reporting-pages-github-publish`
Task: Fix the BDD visual walkthrough so the ResearchOps Product Proof real UI examples appear in captured screenshots.

## Operating Model

Loaded files:

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/bootstrap-checklist.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/trace-layers.md`
- `.agent-operating-model/github-mutation-policy.md`

Selected bundles:

- `github-diamond` at `.agent-operating-model/bundles/github/`
- `researchops-developer-control` at `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` at `.agent-operating-model/bundles/multi-functional-team/`
- `govuk-design-system` at `.agent-operating-model/bundles/govuk-design-system/`

Skipped bundles:

- `cloudflare`
- `openai-platform`
- `mcp-agent-tooling`
- `airtable-public-api`
- `mural-public-api`

Precedence decision: GitHub Diamond governs branch, trace and validation behaviour. ResearchOps Developer Control governs visual walkthrough implementation. Multi-Functional Team and GOV.UK Design System govern public-service evidence quality and accessibility expectations.

## Evidence

- The Product Proof page renders eight real UI example images from `public/assets/researchops/product-proof/`.
- The Product Proof template marks those images with `loading="lazy"`.
- The visual walkthrough captured full-page screenshots after DOM, network and font settling but did not scroll the page before screenshot capture.
- Full-page screenshots can include below-the-fold lazy image frames before the browser has requested those images.

## Changes

- Added `loadFullPageImages(page)` to the visual walkthrough capture script.
- The helper temporarily treats lazy images as eager, scrolls through the full page to trigger viewport-dependent loading, waits for image load or error completion, returns to the top, then captures the screenshot.
- Called the helper immediately before every full-page screenshot.
- Added route-state test coverage for the lazy-media loading step.

## Validation

Validation to run before reporting completion:

- `node --test tests/qa-bdd-authenticated-walkthrough-route-state.test.js tests/product-proof-route-state.test.js`: passed.
- Product Proof capture smoke check with local assets: passed. All eight `data-product-proof-media` images completed at 1365 by 900 before screenshot capture, and `/tmp/researchops-product-proof-loaded.png` showed the real UI examples.
- `npx prettier -c scripts/visual-walkthrough.mjs tests/qa-bdd-authenticated-walkthrough-route-state.test.js docs/agent-audit/reasoning/2026/07/01/product-proof-walkthrough-lazy-media.md docs/agent-audit/reasoning/2026/07/01/product-proof-walkthrough-lazy-media.json`: passed.
- `git diff --check`: passed.
- `npm run trace:coverage -- --date 2026-07-01`: passed.
- `npm run validate`: passed.

## Risks And Limits

- The change keeps public-page lazy loading intact for users and changes only the evidence-capture flow.
- The helper waits on image completion with a timeout so a broken image cannot hang the walkthrough indefinitely.
