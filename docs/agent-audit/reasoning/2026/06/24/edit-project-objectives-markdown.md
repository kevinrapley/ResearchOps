# Trace - edit project objectives as Markdown

- Date: 2026-06-24
- Branch: `feature/edit-project-objectives-markdown`
- Trace decision: required because this is repository-affecting work on a `feature/` branch.
- Task: make `/pages/project-dashboard/` project objectives editable in place as Markdown, saving changed Markdown automatically on textarea blur, then extend the same click-to-edit and blur-save pattern to the project description text.

## Operating Model

Loaded:

- `AGENTS.md`
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

Selected bundles:

- `github-diamond` at `.agent-operating-model/bundles/github/`
- `researchops-developer-control` at `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` at `.agent-operating-model/bundles/multi-functional-team/`
- `govuk-design-system` at `.agent-operating-model/bundles/govuk-design-system/`
- `cloudflare` at `.agent-operating-model/bundles/cloudflare/`
- `airtable-public-api` at `.agent-operating-model/bundles/airtable-public-api/`

Skipped conditional bundles:

- `openai-platform`: no OpenAI API or model behaviour was changed.
- `mcp-agent-tooling`: no MCP or agent-tool contract behaviour was changed.
- `mural-public-api`: no Mural integration behaviour was changed.

Precedence applied:

- GitHub Diamond governed branch naming, trace creation, validation, commit, push and PR creation.
- ResearchOps Developer Control governed repository layers, generated static page parity and route-state tests.
- Multi-Functional Team governed public-sector product assurance and avoiding unnecessary scope.
- GOV.UK Design System governed textarea, keyboard access and focus-state handling.
- Cloudflare governed the follow-up decision to make the project PATCH route succeed from D1 rather than an external API response.
- Airtable Public API governed the follow-up decision to treat Airtable capture as secondary and non-blocking when rate-limited.
- Cloudflare also governed the follow-up Pages proxy correction for preview-host API calls carrying Cloudflare Access headers into the passwordless/D1 Worker.
- Cloudflare and Airtable Public API governed the follow-up project-list correction so D1 preview/cache rows remain the first-class read source and Airtable remains a secondary capture/upstream source.
- Cloudflare governed the DaaS project follow-up because the missing record was a preview D1 seed gap rather than a browser rendering problem.
- Cloudflare governed the DaaS ordering and content follow-up because the preview D1 payload needed the same project fields the dashboard and Projects page use for display.
- Cloudflare governed the target-state screenshot follow-up because the remaining mismatch was incomplete preview D1 record content. The brand variant shown in the target screenshot was confirmed as environment-specific and left unchanged.
- GOV.UK Design System, Cloudflare and Airtable Public API governed the description-edit follow-up because the project description became a keyboard-accessible textarea interaction that saves through D1 first and queues Airtable capture second.

## Files Read

- `README.md`
- `.github/CODEOWNERS`
- `.github/pull_request_template.md`
- `package.json`
- `package-lock.json`
- `RECENT_LEARNINGS.md`
- `.agent-operating-model/bundles/github/prompt.spec.yaml`
- `.agent-operating-model/bundles/github/prompt.body.xml`
- `.agent-operating-model/bundles/researchops-developer-control/prompt.spec.yaml`
- `.agent-operating-model/bundles/researchops-developer-control/prompt.body.xml`
- `.agent-operating-model/bundles/multi-functional-team/prompt.spec.yaml`
- `.agent-operating-model/bundles/multi-functional-team/prompt.body.xml`
- `.agent-operating-model/bundles/govuk-design-system/prompt.spec.yaml`
- `.agent-operating-model/bundles/govuk-design-system/prompt.body.xml`
- `.agent-operating-model/bundles/researchops-developer-control/references/core-rules.xml`
- `.agent-operating-model/bundles/researchops-developer-control/references/researchops-platform-context.xml`
- `.agent-operating-model/bundles/researchops-developer-control/references/researchops-repository-conventions.xml`
- `.agent-operating-model/bundles/researchops-developer-control/references/researchops-endpoint-catalog.xml`
- `.agent-operating-model/bundles/researchops-developer-control/references/researchops-route-availability-policy.xml`
- `.agent-operating-model/bundles/researchops-developer-control/references/quality-gates.xml`
- `.agent-operating-model/bundles/cloudflare/prompt.spec.yaml`
- `.agent-operating-model/bundles/cloudflare/prompt.body.xml`
- `.agent-operating-model/bundles/cloudflare/references/storage-and-state.xml`
- `.agent-operating-model/bundles/cloudflare/references/testing-and-observability.xml`
- `.agent-operating-model/bundles/airtable-public-api/prompt.spec.yaml`
- `.agent-operating-model/bundles/airtable-public-api/prompt.body.xml`
- `.agent-operating-model/bundles/govuk-design-system/references/govuk-form-affordance-reference.xml`
- `.agent-operating-model/bundles/govuk-design-system/roles/accessibility-specialist.xml`
- `public/pages/project-dashboard/index.html`
- `src/govuk/templates/pages/project-dashboard.njk`
- `public/js/project-dashboard.js`
- `src/styles/project-dashboard.scss`
- `public/css/project-dashboard.css`
- `tests/project-dashboard-route-state.test.js`
- `infra/cloudflare/src/service/projects.js`
- `infra/cloudflare/src/service/project-record-routes.js`
- `infra/cloudflare/src/worker.js`
- `infra/cloudflare/src/service/projects/normalisation.js`
- `infra/cloudflare/src/core/auth/access.js`
- `infra/cloudflare/src/core/auth/passwordless.js`
- `public/_worker.js`
- `tests/pages-advanced-worker-auth-route-state.test.js`
- `infra/cloudflare/migrations/preview/0002_seed_projects_cache.sql`
- `tests/projects-route-contract.test.js`
- `public/js/projects-page.js`
- `data/projects.csv`
- `docs/agent-audit/reasoning/2026/06/16/daas-dashboard-brand-panel.md`
- Target-state screenshots attached by the user showing the expected DaaS/TCN description, stakeholders and user groups.
- Current request to make the project description text editable with the same textarea blur-save behaviour as project objectives.

## Diagnosis

- The dashboard already rendered objective Markdown-like lines as numbered objectives with nested bullet lists.
- The browser-side project save helper already sends PATCH requests to `/api/projects/:id`.
- The Worker project PATCH route already accepts `objectives` and stores normalised objective lines.
- The missing behavior was local interaction: rendered objectives were not editable and there was no inline textarea blur-save path.
- DaaS follow-up diagnosis: Home Office Biometrics projects loaded from D1 preview seed, but the reported DaaS project id `recdMo80h1QaNQCBk` was absent from `infra/cloudflare/migrations/preview/0002_seed_projects_cache.sql`. A remote D1 read check was attempted but blocked because the local environment has no `CLOUDFLARE_API_TOKEN`.
- DaaS ordering/content diagnosis: the DaaS seed used a placeholder `DaaS project` payload with no `createdAt`, objectives, user groups, stakeholders or lead researcher fields. The Projects page and Worker both sort by `createdAt`, so the DaaS row fell below seeded Home Office Biometrics rows and the dashboard rendered empty content panels.
- Target-state screenshot diagnosis: the latest deployed DaaS view had the correct project name and objectives but still used the short placeholder description, one stakeholder and two user groups. The target screenshot showed the full TCN description, three PSG - ILEC stakeholders and seven user groups. The Home Office purple brand variant was environment-specific and did not require a code change.
- Description-edit follow-up diagnosis: the dashboard rendered the project description as plain text and the inline editing helpers existed only for objectives. The project record route also needed to accept `description` as an updatable framing field so blur-save could persist through D1 before non-blocking Airtable capture.

## Changes

- Added objective Markdown grouping so each rendered top-level objective retains its source Markdown lines.
- Rendered each objective as a keyboard-accessible edit target with a visible GOV.UK focus state.
- Added inline textarea editing for an objective; unchanged blur restores the rendered view, changed blur PATCHes the updated `objectives` payload and re-renders from the saved Markdown.
- Added an accessible hidden label and polite status region for the inline editor.
- Follow-up correction: hid the parent ordered-list marker while a list item is in edit mode so the Markdown `1.` appears only inside the textarea.
- Codex review correction: removed the one-shot blur listener so a failed PATCH can be retried from the same open textarea.
- Follow-up acceptance coverage: asserted that clearing an objective textarea splices the objective out, saves the shorter objectives payload and re-renders either the remaining objectives or the clean empty state with no editor/list-item orphan.
- Follow-up persistence correction: routed project PATCH updates through the D1-backed project-record route, requires the updated framing to be written into `rops_projects_cache` before responding, and schedules Airtable PATCH capture with `waitUntil` so Airtable 429s do not block the edit.
- Follow-up preview-load correction: stripped `cf-access-jwt-assertion` from preview Pages proxy API requests, matching the existing stripping of Cloudflare Access email headers. This keeps the preview API on the ResearchOps passwordless session path and prevents the passwordless/D1 Worker from falling back to Cloudflare Access validation when Access certificate settings are intentionally absent.
- Updated the Pages proxy diagnostic header so stripped preview requests report `x-researchops-access-headers-forwarded: false` rather than `jwt-only`.
- Follow-up dashboard-load correction: added `/pages/project-dashboard/` to the Pages static protected-route preflight. A signed-out project dashboard URL now redirects to `/pages/account/sign-in/` with the original `?id=...` return path instead of rendering the dashboard shell and then failing its project API calls.
- Follow-up D1 read correction: allowed `preview-seed` project cache rows to serve the project list and single-project dashboard reads, preserved `preview-seed` when a D1-backed objective edit is saved, and allowed `airtable-partial` project cache rows as the last-resort list fallback after Airtable is unavailable.
- Follow-up DaaS seed correction: added the known DaaS Airtable record id `recdMo80h1QaNQCBk` to the preview D1 project cache seed with `DaaS` org/team metadata and `team_daas` in `payload_json`, so DaaS users can load it from D1 when Airtable is unavailable.
- Follow-up DaaS content correction: replaced the placeholder seed payload with `Third Country National Discovery`, `createdAt`, description, TCN objective Markdown, user groups, stakeholder and lead researcher fields so DaaS appears first in Projects and the dashboard has the expected content when Airtable is unavailable.
- Follow-up target-state content correction: expanded the DaaS/TCN preview seed payload to the target screenshot content: the long Home Office Digital/ECRIS-TCN description, Pam Thethi, Chris Moffitt and Maria Athayde as stakeholders, and the seven expected user groups.
- Follow-up description-edit correction: wrapped the description in a stable `project-description-region`, renders it as a keyboard-accessible edit target, replaces it with a GOV.UK textarea on click or keyboard activation, saves changed text on blur with `{ description }`, restores unchanged text without saving, and keeps failed saves retryable in the open textarea.
- Follow-up description persistence correction: added `description` to the D1-first project framing PATCH route and legacy framing mapper, mapping it to Airtable `Description` only as secondary capture.
- Follow-up description coverage: added route-state assertions for the description editor hooks, focus styling and cache-busted assets, and extended the D1/Airtable 429 project PATCH contract to assert edited descriptions are saved in D1 and included in queued Airtable capture.
- Bumped the project dashboard JS and CSS asset version to `project-dashboard-objective-edit-20260624`.
- Bumped the project dashboard JS and CSS asset version again to `project-dashboard-description-edit-20260624`.
- Regenerated `public/css/project-dashboard.css` and `public/pages/project-dashboard/index.html`.
- Updated route-state tests for the inline edit contract, blur-save path, keyboard activation, focus styling and cache-busted assets.
- Updated the Pages advanced Worker route-state test to assert preview API calls remove Cloudflare Access JWT and email headers while preserving the ResearchOps session cookie.
- Added a Pages advanced Worker route-state regression asserting signed-out `/pages/project-dashboard/?id=...` requests redirect to sign-in with the project id preserved in `returnTo`.

## Validation

- `npm run agent:model -- "Make project-dashboard project objectives editable in-place as markdown textarea saving on blur"`: passed; always-load bundles selected. GOV.UK Design System was manually selected from the conditional UI/content rule because the task changes an interactive page.
- `npm run build:project-dashboard`: passed.
- `npm run build:govuk-pages`: passed.
- `node --import ./tests/helpers/generated-govuk-page-source.mjs --test tests/project-dashboard-route-state.test.js`: passed, 1 test.
- `npm run format:check`: passed.
- `npm run lint`: passed with existing repository warnings and no errors.
- `npm test -- --ci`: failed because the repository script passes `--ci` through to `node --test`, which reports `node: bad option: --ci`.
- `npm test`: passed, 247 tests after the project dashboard protected-page regression was added.
- Local Playwright preview check against `http://127.0.0.1:4173/pages/project-dashboard/?id=test-project-1`: passed for desktop click-to-edit and blur-save, visible focus state, mobile keyboard edit and blur-save, and no mobile horizontal overflow.
- Follow-up local Playwright preview check: passed for desktop and mobile edit mode with the `<li>` marker hidden and the Markdown `1.` retained inside the textarea.
- Codex review retry check: local Playwright preview forced the first PATCH to fail and confirmed the editor stayed open and the next blur saved without reopening.
- Follow-up local Playwright preview check: clearing and blurring the first objective removed it, promoted the remaining objective without an empty list item, and clearing the final objective replaced the ordered list with `<p class="govuk-body-s">No objectives yet.</p>` with no editor, editing class or orphaned `<li>`.
- `node --import ./tests/helpers/generated-govuk-page-source.mjs --test tests/projects-route-contract.test.js`: passed, including Airtable 429 during project PATCH with D1 success.
- `node --import ./tests/helpers/generated-govuk-page-source.mjs --test tests/project-dashboard-route-state.test.js`: passed after adding description inline edit route-state coverage.
- `node --import ./tests/helpers/generated-govuk-page-source.mjs --test tests/projects-route-contract.test.js`: passed after adding D1-first description PATCH coverage and Airtable capture assertions.
- `npm run format:check`: passed after the description-edit follow-up.
- `npm run lint`: passed with existing repository warnings and no errors after the description-edit follow-up.
- `npm test`: passed after the description-edit follow-up, 247 tests.
- `npm run trace:coverage -- --date 2026-06-24`: passed after the description-edit follow-up.
- `git diff --check`: passed after the description-edit follow-up.
- `node --test tests/pages-advanced-worker-auth-route-state.test.js`: passed, 12 tests after adding the project dashboard protected-page preflight.
- `node --import ./tests/helpers/generated-govuk-page-source.mjs --test tests/projects-route-contract.test.js`: passed after the Pages proxy correction.
- `npm run format:check`: initially failed because generated CSS was stale; `npm run lint` rebuilt generated CSS and then passed. A follow-up `npm run format:check` passed.
- `npm run trace:coverage -- --date 2026-06-24`: passed.
- `node --import ./tests/helpers/generated-govuk-page-source.mjs --test tests/projects-service-split-route-state.test.js tests/projects-page-route-state.test.js`: passed, 2 tests.
- `node --import ./tests/helpers/generated-govuk-page-source.mjs --test tests/projects-route-contract.test.js`: passed after the D1 preview-seed and partial-cache fallback correction.
- `node --import ./tests/helpers/generated-govuk-page-source.mjs --test tests/projects-route-contract.test.js`: passed after adding the DaaS preview seed regression.
- `node --import ./tests/helpers/generated-govuk-page-source.mjs --test tests/projects-route-contract.test.js`: passed after adding DaaS ordering and TCN content assertions.
- `sqlite3 ':memory:' < infra/cloudflare/migrations/preview/0002_seed_projects_cache.sql`: passed after the TCN content seed correction.
- `npm test`: passed after the DaaS ordering and TCN content correction, 247 tests.
- `npm run lint`: passed with existing repository warnings and no errors after the DaaS ordering and TCN content correction.
- `node --import ./tests/helpers/generated-govuk-page-source.mjs --test tests/projects-route-contract.test.js`: passed after expanding the DaaS/TCN description, stakeholders and user groups to match the target screenshot.
- `sqlite3 ':memory:' < infra/cloudflare/migrations/preview/0002_seed_projects_cache.sql`: passed after the target-state content correction.
- `sqlite3 ':memory:' ".read infra/cloudflare/migrations/preview/0002_seed_projects_cache.sql" "SELECT json_extract(payload_json, '$.description'), json_array_length(json_extract(payload_json, '$.stakeholders')), json_array_length(json_extract(payload_json, '$.user_groups')) FROM rops_projects_cache WHERE id = 'recdMo80h1QaNQCBk';"`: returned the long TCN description with 3 stakeholders and 7 user groups.
- `npm test`: passed after the final target-state DaaS/TCN content correction, 247 tests.
- `npm run lint`: passed with existing repository warnings and no errors after the D1 preview-seed correction.
- `npm test`: first run after lint failed in `tests/deploy-asset-paths.test.js`; the focused asset-path test passed immediately afterwards and a clean rerun of `npm test` passed, 247 tests.
- `npm test`: passed after the DaaS preview seed correction, 247 tests.
- `git diff --check`: passed.

## Review Threads

- `chatgpt-codex-connector` on `public/js/project-dashboard.js`: valid. Added `+1`, removed `{ once: true }` from the blur listener, added a route-state regression assertion, validated with focused tests and local Playwright retry check, replied, and resolved the thread.

## Residual Risk

- Live deployment verification was not run because this branch has not yet been merged or deployed.
- Production Cloudflare Access fallback remains unchanged; this correction is scoped to preview-host API proxying where the target is the passwordless preview Worker.
- Any other direct dashboard URL for a project id that is absent from D1 will still depend on Airtable becoming available; this DaaS follow-up adds the known DaaS project id reported in testing.
