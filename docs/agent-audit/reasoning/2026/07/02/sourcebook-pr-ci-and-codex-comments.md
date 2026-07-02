# Sourcebook PR CI and Codex comments trace

Date: 2026-07-02
Branch: `feature/govuk-static-utility-pages`
Trace requirement: required by `feature/` branch prefix.

## Task

Fix failing CI checks and unresolved Codex review comments on PR 456, `Add GOV.UK Research Operations Sourcebook`.

## Operating model

Loaded repository operating-model sources:

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/github-mutation-policy.md`
- `/Users/kevin.rapley/.hermes/skills/github/github-diamond-standard/SKILL.md`

Selected bundles:

- `github-diamond` at `.agent-operating-model/bundles/github/`
- `researchops-developer-control` at `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` at `.agent-operating-model/bundles/multi-functional-team/`

Precedence: repository PR and comment-handling rules from GitHub Diamond, implementation shape from ResearchOps Developer Control, and public-service assurance defaults from Multi-Functional Team.

## Evidence

- PR 456 was open, non-draft and mergeable.
- CI failures were observed in Node 20, Node 22, Release gate and Validate Cloudflare Workers.
- The shared failing test was `tests/visual-walkthrough-registry-coverage.test.js`, which reported `/pages/sourcebook/data-and-knowledge-management/index.html` as discoverable but not registered or explicitly excluded.
- Codex comment `3510921236` identified that `.github/workflows/render-govuk-pages.yml` did not include `sourcebook/sourcebook-index.json` or `src/govuk/data/sourcebook.mjs` in render triggers and changed-input detection.
- Codex comment `3510921239` identified that `.github/workflows/format-pr.yml` did not stage `public/css/sourcebook.css` when generated CSS was rebuilt.

## Changes made

- Added sourcebook model and data-loader paths to `.github/workflows/render-govuk-pages.yml`.
- Added `public/css/sourcebook.css` to the generated CSS paths committed by `.github/workflows/format-pr.yml`.
- Added sourcebook index and pillar pages to `visual-walkthrough.config.mjs`, using the same generated-page registry pattern as repository pages.
- Added test coverage that the visual walkthrough registry includes the sourcebook index and each pillar page.
- Updated GOV.UK render workflow tests to assert sourcebook model inputs are render triggers.

## Validation

Passed:

- `npm test -- tests/visual-walkthrough-registry-coverage.test.js`
- `npm test -- tests/sourcebook-clause-model.test.js`
- `npm test -- tests/govuk-pages-render-workflow-state.test.js`
- `npm run format:check`
- `npm run sourcebook:validate`
- `npm test`

## Codex comment disposition

- `3510921236`: valid. Added a thumbs-up reaction before remediation.
- `3510921239`: valid. Added a thumbs-up reaction before remediation.

## Residual risk

- GitHub Actions still need to rerun on the pushed branch before the PR can be considered fully green.
