# Recent Learnings

This file records repeatable repository-specific lessons for ResearchOps agents and maintainers. It is not a changelog.

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
