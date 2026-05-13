# Recent Learnings

This file records repeatable repository-specific lessons for ResearchOps agents and maintainers. It is not a changelog.

## 2026-05-13 — Account dashboards must adapt to the user's access shape

Context: The account dashboard correctly retrieved team and role data, but the first successful design presented all team, role and permission data in a table. That was visually heavy and made a single-team account look as complex as a multi-team account.

Learning: Correct data is not the same as a usable presentation. A user with one team needs a simple account summary. A user with multiple teams needs to compare team memberships. A ResearchOps Core Team Admin needs an explanation of their wider administrative capability. These are different UI states.

Action: Account dashboards should branch their presentation by membership shape. Use a summary-card and summary-list for a single team, a spaced list for multiple teams, and a short explanatory inset for ResearchOps Core Team Admin capability. Do not use a table unless the user genuinely needs row-and-column comparison.

## 2026-05-13 — Do not mix role membership with detailed capability labels

Context: The account dashboard table showed roles and permissions in the same team-membership display. The result was noisy and made it harder to understand the basic question: which team am I in and what role do I have there?

Learning: Role membership and current capabilities are related but different information types. Role membership belongs in the team-membership section. Effective permissions belong near actions and controls, where they explain why actions are available.

Action: In account UI, show team names and role labels in the membership display. Keep permission labels in a separate `Current permissions` section or behind contextual help. Avoid exposing permission-code-like concepts as the primary account summary.

## 2026-05-13 — Preview Worker deploy triggers must include the branch classes used for PR work

Context: Backend fixes to `/api/me` passed CI but were not visible in preview because the Worker deployment workflow only ran on `main` and `feature/**`. The PR branch was `fix/account-auth-redirect-and-team-selection`.

Learning: A preview Pages branch can appear up to date while the preview Worker is stale if workflow branch filters omit the branch class in use. This creates misleading UI debugging because front-end assets and API behaviour are from different commits.

Action: When a PR changes Worker code, confirm the deploy workflow runs for that branch naming pattern. Keep `.github/workflows/deploy-worker.yml` branch filters aligned with real branch conventions such as `feature/**` and `fix/**`.

## 2026-05-13 — Account membership recovery can hide data drift but must not replace correct writes

Context: Preview data had active role assignments and permissions, but the account dashboard showed no team memberships. The backend was made more robust by recovering membership display data from active team-scoped role assignments as well as `auth_team_memberships`.

Learning: Recovery logic improves resilience, but it is not a substitute for writing consistent records. Role assignment should continue to create or reactivate the relevant `auth_team_memberships` row.

Action: Keep the role-assignment write path atomic: create/reactivate membership, create/update role assignment, and write audit evidence together. Use recovery logic only to make account views tolerant of historical or preview-state inconsistencies.

## 2026-05-13 — Long-running access-control branches need continuous product notes and traces

Context: The account registration work expanded into signed-in redirects, role assignment, team creation, team-scoped permissions, preview Worker deployment and dashboard design. Several implementation pivots happened before product notes and trace records were backfilled.

Learning: When a branch changes scope or crosses product, design, backend and deployment concerns, documentation must be kept current as the work evolves. Backfilling is possible, but it risks losing the sequence of decisions and the reasons for pivots.

Action: For long-running repository-affecting work, update `docs/product/` and `docs/agent-audit/reasoning/` when a meaningful decision or pivot happens. Do not wait until the branch is nearly finished. Use `RECENT_LEARNINGS.md` for reusable process lessons, not as a changelog.

## 2026-05-13 — New branch features must work end to end in preview and production

Context: The account registration page reached the check-answers step in a Pages branch preview, but `Send request` failed because the frontend assumed a Worker origin that was not guaranteed to work for that preview environment. The journey needed to work in both preview and production, not only in static page rendering.

Learning: A feature is not end-to-end complete when the page renders. Branch previews must be able to call the required API routes, either through same-origin `/api/*` routing or through an explicit, CORS-allowed fallback. Production must continue to use the same route contract.

Action: For new frontend journeys, test or guard the full action path: form input, check answers, API submit, success state and error state. Prefer relative `/api/*` routes first. If an external Worker fallback is needed, update Worker CORS to allow ResearchOps Pages preview origins and add route-state tests that check the preview-safe routing contract.

## 2026-05-13 — Check answers change links must change answers, not just anchor

Context: The account registration check-answers page rendered `Change` links, but the links only pointed to anchors while the form was hidden. This did not follow the GOV.UK pattern because users could not actually change the answer from the check-answers state.

Learning: A check-answers `Change` link must take the user back to the relevant question or field with the current answer preserved and focus moved to the control they need to change. It must not just update the URL hash.

Action: When implementing check answers in a single-page flow, attach an explicit handler to each change link, reveal the form, hide the check-answers section and focus the target field. Add a route-state or UI test asserting the existence of the change-link handler.

## 2026-05-13 — Do not put focus rings on non-control containers

Context: The registration check-answers section had `tabindex="-1"`, and the script focused the heading/container. This caused a yellow focus ring around the whole check-answers area. That looked like an interactive control and was not appropriate.

Learning: Yellow GOV.UK focus styling should appear on specific controls and links, not arbitrary content containers. Programmatic focus can be valid for error summaries, but it should not make passive sections look interactive.

Action: Do not add `tabindex` to passive check-answers containers. On transition to check answers, scroll the section into view rather than focusing the whole container. Keep focus styling for the `Change`, `Send request` and `Change answers` controls.

## 2026-05-13 — GOV.UK form fields need explicit affordance and rhythm decisions

Context: The account registration form initially used full-width text inputs for full name, work email address and team or service. The page also needed clearer vertical rhythm between introductory content and the first form field.

Learning: GOV.UK-style forms should not default every input to full width. Field widths are part of the affordance. The expected answer length and page layout should determine whether an input is fixed width, fluid-width or full width. Introductory content, inset text and the first form group also need deliberate spacing using the GOV.UK spacing scale.

Action: For every GOV.UK form page, explicitly review text input, textarea and select widths. Use sensible fluid widths such as `govuk-!-width-two-thirds` for common fields like names, email addresses and team names unless a stronger field-specific reason exists. Add page-level CSS or component classes to preserve spacing between intro content and form controls.

## 2026-05-13 — Update RECENT_LEARNINGS.md when a bundle misses a reusable rule

Context: A reviewer identified that the active GOV.UK bundle should have caught the full-width input and vertical-rhythm issue during design review. The root recent learnings file had not been updated for around two weeks.

Learning: When an agent or reviewer discovers a repeatable repository-specific lesson, the lesson should be recorded immediately. Bundle changes alone are not enough because `RECENT_LEARNINGS.md` is the quick operational memory for future repository work.

Action: When a repeat mistake, CI issue, accessibility concern, design-system gap or implementation convention should change future agent behaviour, update `RECENT_LEARNINGS.md` with context, learning and action. Do not use it as a changelog.

## 2026-04-30 — Prettier must be executed, not inferred

Context: A new visual walkthrough registry test failed `prettier -c .` even though the code broadly followed the repository indentation rules. The remaining failure came from Prettier's wrapping decisions for chained calls and long assertions, not from JavaScript semantics.

Learning: Formatter compliance cannot be reliably inferred from rules, memory, house style, or visual inspection. Prettier is an executable formatter with specific line-breaking behaviour. API-based file writes are especially exposed because they bypass the local edit-save-format loop.

Action: Treat actual Prettier execution as the source of truth. When writing JavaScript through API-based edits, pre-wrap chained calls and assertions in the shape Prettier normally emits, then rely on `npm run format:check` or CI to verify. Where possible, use a local checkout or a formatter-capable agent path before opening or updating a PR.

## 2026-04-30 — Prettier follows the repository EditorConfig

Context: A new route-state regression test repeatedly failed `prettier -c .` because it was written with space indentation. The repository has `.editorconfig` with `indent_style = tab`.

Learning: Do not assume default Prettier spacing. In this repo, Prettier reads `.editorconfig`, so JavaScript files should be written with tab indentation unless a nearer formatter config says otherwise.

Action: Before creating or rewriting formatted files, check `.editorconfig` and any Prettier config. For JavaScript tests, use tab indentation and keep assertions short enough that Prettier does not need unexpected wrapping.

## 2026-04-30 — Release provenance needs trusted attestation

Context: Local provenance files are useful release evidence, but they are not equivalent to a trusted signed attestation.

Learning: Release provenance should separate supporting metadata from trusted attestation. A DSSE-shaped local file is evidence metadata unless it is signed and verified through a trusted mechanism.

Action: Use the Release Provenance workflow for tagged releases, upload the generated provenance bundle, and verify the GitHub artifact attestation before treating the provenance as trusted.

## 2026-04-30 — Deployment tools must be pinned

Context: The Worker deployment workflow used `wrangler@latest`, which allowed the deployment toolchain to change without a repository change.

Learning: Floating deployment tooling weakens release evidence because a clean validation run does not prove the same toolchain will be used later.

Action: Pin Wrangler in `.github/workflows/deploy-worker.yml`, keep the pinned version aligned with `deployment-toolchain.yaml`, and record the Wrangler version in deployment logs.

## 2026-04-29 — Security audit findings need policy classification

Context: npm audit can return non-zero for development-only tooling findings even when the production runtime dependency surface is not affected.

Learning: Release gates should not hide dependency findings, but they should classify them by dependency scope and severity before deciding whether to block release.

Action: Use `security-audit-policy.json` and the policy evaluator to block runtime high or critical findings, block unknown-scope high or critical findings until classified, and keep development-only low, moderate and high findings visible as advisory evidence.

## 2026-04-29 — Release evidence can become stale after merge

Context: `release-evidence.yaml` can record a baseline commit that is correct when written but stale after subsequent PRs merge.

Learning: Commit-specific evidence is useful for provenance, but it must be confirmed against the actual release commit before release decisions are made.

Action: When preparing a release, confirm or regenerate any baseline SHA, release-gate run reference, accessibility baseline statement and deployment evidence before treating the file as authoritative.

## 2026-04-29 — Do not remediate accessibility without a failing baseline

Context: PR #120 attempted to remediate Pa11y absolute-position contrast warnings from a speculative CSS change.

Learning: If `main` has a clean accessibility run, do not create a remediation PR. Treat clean `main` as the baseline. Accessibility fixes must be driven by a failing baseline or by a Pa11y artifact with a specific selector, HTML context, rule and page URL.

Action: Before changing CSS for accessibility, inspect the Pa11y artifact and confirm the issue exists on the current base branch.

## 2026-04-29 — Repository governance files must use GitHub-recognised paths

Context: CODEOWNERS and the pull request template previously existed under `.github/workflows/`, which GitHub does not use for those functions.

Learning: Governance metadata must live in supported GitHub locations.

Action: Keep `.github/CODEOWNERS` and `.github/pull_request_template.md` as the authoritative files for branch-protection and PR-template behaviour.

## 2026-04-29 — CI script names must distinguish write mode from check mode

Context: The repository previously had a write-mode `format` script but CI needed a pure check.

Learning: CI must never rely on write-mode formatting commands for validation.

Action: Use `npm run format:check` in CI and reserve `npm run format` for local write-mode formatting.

## 2026-04-29 — Release assurance should be joined into a single auditable gate

Context: ResearchOps already had CI, validation, accessibility, security and QA workflows, but the release decision was spread across separate checks.

Learning: A dedicated release gate makes the release decision auditable.

Action: Use the `Release Gate` workflow as the central release-assurance check and keep its uploaded report artifacts as release evidence.
