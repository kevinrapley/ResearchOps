# Agent trace — Outcomes cache-busting route-state fix

**Date:** 2026-06-03  
**Branch:** `fix/outcomes-cache-busting-route-state`  
**Trace type:** operational audit trace  
**Task:** Fix breaking tests on `main` after merge of PR #341.

## Evidence boundary

This trace records observable repository files, tool actions, implementation decisions, validation status and residual risk. It does not expose private chain-of-thought.

## Operating model loaded

Loaded files:

- `README.md`
- `AGENTS.md`
- `RECENT_LEARNINGS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/bootstrap-checklist.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/trace-layers.md`
- `.agent-operating-model/behavioural-evals.json`
- `.agent-operating-model/github-mutation-policy.md`
- `.agent-operating-model/bundles/github/prompt.spec.yaml`
- `.agent-operating-model/bundles/github/prompt.body.xml`
- `.agent-operating-model/bundles/researchops-developer-control/prompt.spec.yaml`
- `.agent-operating-model/bundles/researchops-developer-control/prompt.body.xml`
- `.agent-operating-model/bundles/multi-functional-team/prompt.spec.yaml`
- `.agent-operating-model/bundles/multi-functional-team/prompt.body.xml`
- `.agent-operating-model/bundles/govuk-design-system/prompt.spec.yaml`
- `.agent-operating-model/bundles/govuk-design-system/prompt.body.xml`

Selected bundles:

- `github-diamond`
- `researchops-developer-control`
- `multi-functional-team`
- `govuk-design-system`

Skipped bundles:

- `cloudflare`
- `openai-platform`
- `mcp-agent-tooling`
- `airtable-public-api`
- `mural-public-api`

Cloudflare was not selected because this fix changes the GOV.UK renderer and route-state contract only. It does not change Pages, Worker, Wrangler, D1, KV, deployment workflow or routing configuration.

## Files inspected

- PR #341 metadata and patch
- `public/pages/projects/outcomes/index.html`
- `src/govuk/templates/pages/projects-outcomes.njk`
- `scripts/govuk/render-govuk-pages.mjs`
- `tests/outcomes-page-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/02/impact-record-workflow.md`
- `docs/agent-audit/reasoning/2026/06/02/impact-record-workflow.json`
- `docs/agent-audit/reasoning/2026/06/03/impact-record-workflow-ci-repair.md`
- `docs/agent-audit/reasoning/2026/06/03/impact-record-workflow-ci-repair.json`

## Diagnosis

PR #341 updated `tests/outcomes-page-route-state.test.js` so the outcomes route-state test expected two things:

1. footer script URLs for the outcomes page to include `?v=20260603-form-interactions`;
2. the GOV.UK renderer to contain an `outcomesScriptVersion` and `cacheBustOutcomesPageScripts` helper.

The merged PR versioned the page head stylesheet and modulepreload links, but it did not update `scripts/govuk/render-govuk-pages.mjs`. The committed `public/pages/projects/outcomes/index.html` footer scripts therefore still rendered as unversioned `src` URLs. Main could fail before functional code is reached because the route-state test now asserted renderer symbols that did not exist.

## Implementation decision

The fix keeps the PR #341 cache-busting intent and restores source-of-truth behaviour in the renderer rather than weakening the test.

`renderGovukPage` now routes rendered outcomes HTML through `cacheBustOutcomesPageScripts` before Prettier formats and writes the static page. The helper only applies to `public/pages/projects/outcomes/index.html`, preserves other GOV.UK pages, and versions both `href` and `src` references for:

- `/js/project-context.js`
- `/js/outcomes-page.js`
- `/components/impact-tracker.js`

The route-state test now pins the already-committed versioned outcomes CSS URL explicitly, matching PR #341's cache-busting scope.

## Files modified

- `scripts/govuk/render-govuk-pages.mjs`
- `tests/outcomes-page-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/03/outcomes-cache-busting-route-state-fix.md`
- `docs/agent-audit/reasoning/2026/06/03/outcomes-cache-busting-route-state-fix.json`

## Validation status

Local validation was not run. A local checkout could not be created in this connector session because `git clone` could not resolve `github.com`.

Connector verification completed:

- Confirmed the fix branch renderer contains `outcomesScriptVersion`.
- Confirmed the fix branch renderer contains `cacheBustOutcomesPageScripts`.
- Confirmed `renderGovukPage` passes `env.render(page.template, page.context)` through `cacheBustOutcomesPageScripts` before formatting and writing output.
- Confirmed the outcomes route-state test pins the versioned outcomes stylesheet, script modulepreload and footer script URLs.

Required CI and local follow-up checks:

```sh
npm run build
node --test tests/outcomes-page-route-state.test.js
npm test
npm run validate
```

## Residual risk

The PR should not be treated as fully validated until the normal PR checks complete. The Render GOV.UK pages workflow may also commit regenerated static HTML after the PR is opened because the renderer changed.
