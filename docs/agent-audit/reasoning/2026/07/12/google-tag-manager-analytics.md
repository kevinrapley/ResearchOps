# Google Tag Manager analytics

## Run metadata

- Date: 2026-07-12
- Branch: feature/add-gtm-analytics
- Task: Add the `GTM-KGGFK4KW` container across ResearchOps public and application pages.

## Branch-prefix trace decision

- The `feature/` prefix requires an auditable operational trace.
- The work started from a separate feature branch to avoid including unrelated uncommitted changes from the original worktree.

## Operating model and bundles

- Loaded the required operating-model files: `AGENTS.md`, orchestration, registry, task signals, selection rules, bootstrap checklist, precedence, trace, behavioural-eval and GitHub-mutation policies.
- Applied GitHub Diamond, ResearchOps Developer Control and Multi-Functional Team as always-load bundles.
- Applied GOV.UK Design System because the shared HTML document structure changed.
- The Mural bundle was selected by the model's `tag` keyword fallback, but no Mural API capability is involved or changed.
- Skipped Cloudflare, OpenAI, MCP and Airtable bundles because their domains are not in scope.

## Implementation

- Added the provided GTM bootstrap to the shared Nunjucks head and the required noscript iframe immediately after body start.
- Updated the public-page normaliser so legacy static pages receive the same snippets without duplicate injection.
- Regenerated the committed public and application pages, and covered the two standalone pages outside the generator.
- Added a route-state regression test for the complete deployable-page set.

## Privacy and release decision

- GTM is intentionally loaded across public and authenticated application pages as requested.
- The repository has no consent mechanism, privacy approval, data-flow record, tag inventory or opt-out path for non-essential analytics.
- `harm-register.yaml` and `gap-register.yaml` record this as a high residual risk requiring escalation to the privacy lead, data protection officer and service owner before non-essential GTM tags are enabled.

## Validation

- `npm run build:govuk-pages` — passed.
- `node --test tests/google-tag-manager-route-state.test.js` — passed.
- `npm run format:check` — passed.
- `npm run lint` — passed with pre-existing warnings.
- `npm test` — passed: 358 tests.
- `git diff --check` — passed.

## Residual risk

The commit installs only the GTM container. Any tag configuration in GTM can change what data is collected without a code deployment; keep non-essential tags disabled until the recorded privacy and consent controls have been approved and implemented.

## Follow-up: merge-conflict resolution

- Merged the current `origin/main` without rewriting the published feature branch.
- `main` had added Flux analytics at the same shared head and body insertion points. The resolution retains Flux's module and page metadata, restores the GTM snippets and regenerates static pages from the combined sources.
- `node --test tests/google-tag-manager-route-state.test.js tests/flux-behaviour-tracker-route-state.test.js` passed after the merge.

## Follow-up: Codex review comments

- **CSP finding:** moved the GTM bootstrap into the first-party `/js/google-tag-manager.js` script. The Pages Worker and static header policies now allow only `https://www.googletagmanager.com` for GTM scripts and the noscript iframe, without adding `'unsafe-inline'`.
- **Redirect-page finding:** removed GTM from the legacy `/pages/synthesize/` redirect so its automatic navigation cannot produce a duplicate GTM page view.
- `node --test tests/google-tag-manager-route-state.test.js tests/security-hardening-controls-route-state.test.js tests/flux-behaviour-tracker-route-state.test.js` passed.
