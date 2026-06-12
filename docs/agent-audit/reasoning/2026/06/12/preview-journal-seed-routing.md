# Preview Journal Seed Routing Audit

## Run metadata

- Date: 2026-06-12
- Working tree: `/Users/kevin.rapley/Documents/Codex/2026-06-04/researchops-familiarise-yourself-with-the-repo/work/ResearchOps`
- Branch: `feature/test-project-1-journal-seed`
- Branch posture: `feature/*` requires an auditable trace
- PR: `https://github.com/kevinrapley/ResearchOps/pull/392`
- Reported preview: `https://0f8a7f9b.researchops.pages.dev/`

## Task summary

Investigate why the newly seeded Test Project 1 journal entries, codes, memos and co-occurrence data were not appearing on the Cloudflare Pages PR preview.

## Operating model files loaded

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/github-mutation-policy.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`

## Bundle selection

Selected bundles:

- `github-diamond` at `.agent-operating-model/bundles/github/`
- `researchops-developer-control` at `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` at `.agent-operating-model/bundles/multi-functional-team/`
- `cloudflare` at `.agent-operating-model/bundles/cloudflare/`
- `govuk-design-system` at `.agent-operating-model/bundles/govuk-design-system/`

Skipped bundles:

- `openai-platform`
- `mcp-agent-tooling`
- `airtable-public-api`
- `mural-public-api`

Reasoning:

- Cloudflare applies because the bug is visible in a Pages preview and involves Worker/API routing.
- ResearchOps developer control applies because the fix touches journal service runtime behaviour and seeded D1 fallbacks.
- GOV.UK Design System applies because the journal UI scripts are part of a GOV.UK frontend surface.
- GitHub applies because the work is on an active PR branch and must be pushed back to the PR branch.

## Evidence boundary

- Repository evidence: `public/_worker.js` routes `/api/*` on preview hosts to the passwordless preview API, but `public/js/journal-tabs.js` and `public/js/caqdas-interface.js` were bypassing that proxy by hard-coding the production API worker whenever the hostname ended in `pages.dev`.
- Repository evidence: `infra/cloudflare/src/service/journals.js` returned D1 rows as soon as any Test Project 1 rows existed, so a partially seeded preview D1 could hide the expanded seed.
- Tool limitation: unauthenticated local HTTP requests to the preview URL redirected to Cloudflare Access, so direct browser verification of the authenticated preview data was not possible in this environment.

## Files read

- `public/_worker.js`
- `public/js/journal-tabs.js`
- `public/js/caqdas-interface.js`
- `infra/cloudflare/src/service/journals.js`
- `infra/cloudflare/src/service/reflection/project-data-hydration.js`
- `infra/cloudflare/src/service/reflection/analysis.js`
- `infra/cloudflare/src/service/internals/test-project-1-journal-seed.js`
- `tests/journal-entry-d1-seed-fallback-runtime.test.js`
- `tests/journal-secondary-actions-route-state.test.js`
- `tests/journal-tabs-api-origin-route-state.test.js`
- `tests/journals-project-route-contract.test.js`

## Files created or modified

Created:

- `docs/agent-audit/reasoning/2026/06/12/preview-journal-seed-routing.md`
- `docs/agent-audit/reasoning/2026/06/12/preview-journal-seed-routing.json`

Modified:

- `infra/cloudflare/src/service/journals.js`
- `public/js/caqdas-interface.js`
- `public/js/journal-tabs.js`
- `public/css/home-office-timeline.css`
- `tests/journal-entry-d1-seed-fallback-runtime.test.js`
- `tests/journal-secondary-actions-route-state.test.js`
- `tests/journal-tabs-api-origin-route-state.test.js`
- `tests/journals-project-route-contract.test.js`

## Implementation decisions

- Changed the journal page and CAQDAS analysis scripts to use explicit `data-api-origin` or `window.API_ORIGIN` when present, otherwise same-origin `/api/*` on `pages.dev`.
- Kept local non-Pages development using `location.origin`.
- Expanded journal D1 lookup aliases for Test Project 1 so canonical Airtable id, legacy Airtable id and local project id all resolve the same seeded project.
- Made the journal list route serve and restore the complete Test Project 1 seed when D1 has only a partial Test Project 1 population.
- Updated route-state tests to assert same-origin preview routing rather than production-worker bypassing.
- Updated runtime tests to cover a partial Test Project 1 D1 population.

## Validation attempted

- `node --test tests/journal-entry-d1-seed-fallback-runtime.test.js` passed.
- `node --test tests/journal-secondary-actions-route-state.test.js tests/analysis-d1-cooccurrence-runtime.test.js` passed.
- `npm test` passed with 212 tests.
- `npm run format:check` passed.
- `npm run lint` passed with the repository's existing warnings.

## Validation not run

- Authenticated preview browser verification was not run because the supplied Pages preview redirects to Cloudflare Access from this environment.
- `npm test -- --ci` was attempted but the current npm script passes `--ci` to Node, which fails with `node: bad option: --ci`; `npm test` was used for the authoritative full test run.

## Issues, pivots and residual risks

- The first full test run exposed stale route-state assertions that still expected production API worker usage from preview pages; those tests were corrected to match the intended Pages proxy behaviour.
- `npm run lint` regenerated `public/css/home-office-timeline.css` and removed a stale generated CSS comment.
- The pushed PR branch still depends on Cloudflare Pages and the preview API worker completing deployment before the user can verify the live preview.
