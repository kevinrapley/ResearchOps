# GitHub Diamond Standard Prompt Bundle

Version: 2.9.4

## Purpose

This bundle is a control-system prompt bundle for AI agents working with GitHub repositories.

It guides repository instantiation, maintenance, review, release and conformance using contracts, modes, graders, templates, evidence, validation scripts, GitHub settings checks, direct repository-state verification and supply-chain assurance.

## Current release

Version 2.9.4 adds cross-cutting coding-agent behaviour controls for repository-affecting work.

It adds an always-loaded LLM coding behaviour reference that requires agents to state material assumptions, surface implementation-critical ambiguity, prefer the simplest sufficient change, preserve unrelated code and define verifiable success criteria before claiming completion.

The release extends behavioural eval coverage for assumptions before coding, minimal implementation, surgical change boundaries and validation evidence. It also aligns the ResearchOps Developer Control implementation workflow and developer obligations with the new behaviour controls.

## Example structure

Examples are teaching artefacts for the bundle operating model.

Use `examples/scenarios/` for scenario YAML files that describe prompts, repository context, selected modes, roles, references, contracts, graders, required evidence and failure conditions.

Use `examples/expected-outputs/` for Markdown files that show what an acceptable agent response looks like.

Use `examples/anti-examples/` for genuine unsafe or incorrect agent behaviours. Placeholder files must not be treated as anti-examples.

## Automated review comment handling

Codex and other automated review comments must be treated as review work items, not as background noise.

Before acting on review feedback, inspect the current review-thread state. Comment text alone is not enough. Only unresolved, non-outdated and still-relevant review threads are active work items.

When an automated review comment is legitimate, the agent must:

1. Fix the issue or provide evidence that the existing implementation already satisfies the concern.
2. Add a thumbs-up reaction to the original comment.
3. Reply directly to the comment or thread explaining how the issue was overcome.
4. Mark the thread resolved with the Resolve conversation action only after the fix and validation evidence are complete.

Resolved review threads are complete unless the user explicitly asks to reopen, re-check or revisit them. Outdated review threads must not be acted on unless the underlying issue still exists on the current pull request head.

When a user refers to a singular Codex comment or review comment, identify the single unresolved relevant thread before making changes. Do not redo work already completed by the user, Codex, GitHub Actions or another agent. Do not move a pull request branch ref to an earlier commit while handling review feedback unless explicitly instructed or recovering from a documented broken branch state.

False positives or superseded comments must still be answered with a clear disposition. Legitimate comments must not be silently ignored, even when status checks are green.

## Offline bundle release gate

Offline bundle validation is different from live repository assurance.

Offline validation checks the bundle, fixtures, contracts and validators. It can run without GitHub credentials.

Run the fast gate:

```bash
PYTHONDONTWRITEBYTECODE=1 python scripts/release-gate.py --mode fast --report release-gate-report.json
```

Run the full gate:

```bash
PYTHONDONTWRITEBYTECODE=1 python scripts/release-gate.py --mode full --report release-gate-report.json
```

Release-gate reports are first-class artefacts. A passing or failing gate must write a schema-valid report.

Validate a report:

```bash
python scripts/validate-release-gate-report.py release-gate-report.json
```

## Live repository release gate

Live repository release readiness requires observable GitHub API state and repository evidence.

Live release profiles are policy-driven through:

```text
templates/repository/live-release-policy.yaml
```

Validate the policy:

```bash
python scripts/validate-live-release-policy.py
```

Run a standard live gate with `scripts/live-repository-release-gate.py --profile standard`.

Run a high-assurance live gate with `scripts/live-repository-release-gate.py --profile high-assurance` and the required evidence files for the selected profile.

High-assurance, regulated and public-service profiles require GitHub API verification, workflow lock validation, hardened workflow release-mode validation, trusted SBOM attestation, external attestation verification evidence, accessibility evidence, performance evidence and evidence-to-repository cross-checking.

## Trusted attestation evidence

Trusted attestation requires both metadata validation and external verification evidence.

Metadata validation is handled by `scripts/validate-sbom-attestation.py`.

External verification evidence is handled by `scripts/verify-trusted-attestation-commands.py` and `scripts/validate-trusted-attestation-verification.py`.

Declared verification without command evidence is not enough for trusted live release mode.

## Workflow hardening

Release-ready workflows must use reviewed, non-placeholder SHA pins.

Validate release-ready workflows with `scripts/validate-workflow-action-lock.py` and `scripts/validate-workflow-hardening.py`.

The release-mode fixture proving non-placeholder locked SHAs is located at `examples/fixtures/workflows-release-mode-pass/`.

## Accessibility assurance

Structured accessibility evidence is defined in `contracts/accessibility-evidence.schema.json`.

Validate against a repository root with `scripts/validate-accessibility-evidence.py`.

Fixture coverage includes repository-root-relative paths, evidence-file-relative paths, open critical defects, low Lighthouse accessibility score, axe violations and Pa11y issues.

## High-assurance fixture assurance

High-assurance live gate fixtures are located at `examples/fixtures/live-gate/`.

Validate them with `scripts/validate-live-gate-fixtures.py`.

## Non-negotiable behaviours

- Do not commit secrets.
- Do not bypass required CI.
- Do not push directly to protected branches.
- Do not ignore CODEOWNERS or required reviews.
- Do not fabricate validation evidence.
- Do not treat automated accessibility testing as complete accessibility assurance.
- Do not release with unresolved release-blocking gaps.
- Do not publish a bundle if the release gate fails.
- Do not silently ignore legitimate Codex or automated review comments.
- Do not act on resolved or outdated automated review threads unless the user explicitly asks to revisit them or the issue still exists on the current pull request head.
- Do not resolve a legitimate automated review thread until the issue has been overcome, the original comment has a thumbs-up reaction and the thread has an explanatory reply.
