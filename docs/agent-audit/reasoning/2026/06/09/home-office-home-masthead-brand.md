# Home Office home masthead brand treatment

## Run metadata

- Date: 2026-06-09
- Repository: `kevinrapley/ResearchOps`
- Branch: `fix/home-office-home-masthead-brand`
- Pull request: #379
- Trace layer: operational
- Branch-prefix trace decision: `fix/` requires a promoted trace.

## Original task summary

Fix the Home Office brand variant after PR #377 so the home page hero uses the Home Office purple treatment instead of GOV.UK blue, while ordinary content links continue to use GOV.UK link blue. Hero breadcrumb links inside masthead treatments must render white.

## Corrected branch behaviour

The first follow-up work was committed directly to `main`, which breached repository workflow. Corrective PR #378 reverted the direct-main follow-up changes. This PR reapplies the intended work on the approved `fix/home-office-home-masthead-brand` branch.

## Operating-model files loaded

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/bootstrap-checklist.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/github-mutation-policy.md`
- `.agent-operating-model/bundles/github/prompt.spec.yaml`
- `.agent-operating-model/bundles/github/prompt.body.xml`
- `.agent-operating-model/bundles/github/references/github-tooling-mutation-policy.xml`
- `.agent-operating-model/bundles/github/references/test-contract-impact-sweep.xml`
- `.agent-operating-model/bundles/researchops-developer-control/prompt.spec.yaml`
- `.agent-operating-model/bundles/researchops-developer-control/references/core-rules.xml`
- `.agent-operating-model/bundles/researchops-developer-control/references/researchops-platform-context.xml`
- `.agent-operating-model/bundles/researchops-developer-control/references/researchops-repository-conventions.xml`
- `.agent-operating-model/bundles/govuk-design-system/prompt.spec.yaml`

## Canonical bundle directories selected

- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`
- `.agent-operating-model/bundles/govuk-design-system/`

## Bundles selected

- `github-diamond`: repository safety, branch hygiene, PR discipline, CI, test evidence and review comment handling.
- `researchops-developer-control`: platform conventions, route-specific CSS boundaries and generated CSS contract.
- `multi-functional-team`: government product assurance defaults.
- `govuk-design-system`: GOV.UK component, colour, accessibility and frontend contract implications.

## Bundles skipped

- `cloudflare`: no Worker, Pages routing or deployment code changed.
- `openai-platform`: no OpenAI API or model integration changed.
- `mcp-agent-tooling`: no MCP protocol or tool contract changed.
- `airtable-public-api`: no Airtable schema or API behaviour changed.
- `mural-public-api`: no Mural integration changed.

## Precedence decisions

GitHub Diamond governed the corrective PR workflow and branch discipline. ResearchOps Developer Control governed the implementation layer. GOV.UK Design System governed component and accessibility treatment. No lower-precedence convenience rule was used to override repository safety.

## Files read

- `src/styles/researchops-home.scss`
- `src/styles/brands/home-office.scss`
- `public/css/brands/home-office.css`
- `tests/brand-variant-route-state.test.js`
- `public/index.html`
- PR #379 metadata and comments

## Files modified or created

Implementation files:

- `src/styles/brands/home-office.scss`
- `public/css/brands/home-office.css`
- `tests/brand-variant-route-state.test.js`

Trace files:

- `docs/agent-audit/reasoning/2026/06/09/home-office-home-masthead-brand.md`
- `docs/agent-audit/reasoning/2026/06/09/home-office-home-masthead-brand.json`

## Implementation summary

- Added `--govuk-brand-colour: #{$ho-purple}` to the Home Office brand selector so existing masthead rules that use `var(--govuk-brand-colour, #1d70b8)` resolve to Home Office purple.
- Added Home Office brand-layer treatment for the home masthead, home inverse service navigation and home phase banner.
- Added explicit white colour treatment for hero breadcrumb links inside home and repository mastheads.
- Preserved GOV.UK link blue for ordinary content links.
- Regenerated `public/css/brands/home-office.css` to match the Sass source.
- Updated `tests/brand-variant-route-state.test.js` so the home masthead variable and breadcrumb contracts are protected.

## Test-contract impact sweep

Performed. The change affects source Sass, generated CSS and route-state assertions. The affected generated output and test contract were updated in the same PR. The sweep also checked that ordinary content link blue remains represented by `$govuk-link: #1d70b8` and generated `#1d70b8` link styling.

## Codex and automated review comments

PR #379 had a Cloudflare deployment notice and a Codex usage-limit notice. No actionable Codex code review thread was present at the time of trace creation. No thumbs-up, reply or resolve action was appropriate because no legitimate review defect had been raised.

## Validation attempted

GitHub Actions had already passed on commit `313f035b253f3c11066e0187ef0f8d06112c8e30` before trace creation:

- CI
- Validate ResearchOps
- Worker CI
- Release Gate
- Accessibility audit (pa11y-ci)
- qa-bdd
- QA — Broken links (Lychee)

After adding this trace duo, checks need to run again on the new branch head.

## Residual risks

- Visual confirmation on the branch preview is still useful for the home and repository mastheads because the change is visual CSS.
- If a later automated review comment appears, it must be classified and handled under the Codex comment disposition rules.
