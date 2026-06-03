# Agent trace — Outcomes cache-busting breadcrumb route-state fix

**Date:** 2026-06-03  
**Branch:** `fix/outcomes-cache-busting-breadcrumb-test`  
**Trace type:** operational audit trace  
**Task:** Fix remaining failing `main` tests after PR #342 was merged.

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

Cloudflare was not selected because this fix changes a route-state test assertion only. It does not change Pages, Worker, Wrangler, D1, KV, deployment workflow or routing configuration.

## Failure evidence

The release gate artifact from PR #342 showed `validate` and `unit-tests` failing. The concrete failing assertion was:

```text
AssertionError [ERR_ASSERTION]: Expected Outcomes route to include: rel="modulepreload" href="/js/project-context.js"
```

The failing test was `tests/govuk-breadcrumb-back-link-route-state.test.js`.

## Diagnosis

PR #342 correctly regenerated `public/pages/projects/outcomes/index.html` so the outcomes page now contains:

```html
<link rel="modulepreload" href="/js/project-context.js?v=20260603-form-interactions" />
<script type="module" src="/js/project-context.js?v=20260603-form-interactions"></script>
```

`tests/outcomes-page-route-state.test.js` was aligned with that versioned contract, but `tests/govuk-breadcrumb-back-link-route-state.test.js` still asserted the older unversioned project-context URLs for the outcomes route.

## Implementation decision

The test was updated to keep the breadcrumb and project-context coverage while matching the current outcomes cache-busting contract.

Only the outcomes assertions changed. Journals remain pinned to unversioned `project-context.js`, because the cache-busting helper is intentionally scoped to the outcomes page.

## Files modified

- `tests/govuk-breadcrumb-back-link-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/03/outcomes-cache-busting-breadcrumb-test-fix.md`
- `docs/agent-audit/reasoning/2026/06/03/outcomes-cache-busting-breadcrumb-test-fix.json`

## Validation status

Local validation was not run. A local checkout could not be created in this connector session because `git clone` could not resolve `github.com`.

Connector verification completed:

- Confirmed the failing assertion from the PR #342 release gate artifact.
- Confirmed `public/pages/projects/outcomes/index.html` on `main` contains versioned outcomes `project-context.js` modulepreload and footer script URLs.
- Confirmed `tests/govuk-breadcrumb-back-link-route-state.test.js` now expects versioned outcomes `project-context.js` URLs.
- Confirmed journals assertions remain unversioned.

Required CI and local follow-up checks:

```sh
node --test tests/govuk-breadcrumb-back-link-route-state.test.js
node --test tests/outcomes-page-route-state.test.js
npm test
npm run validate
```

## Residual risk

The PR should not be treated as fully validated until the normal PR checks complete on the branch head.
