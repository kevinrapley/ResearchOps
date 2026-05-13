# GitHub Diamond Standard Prompt Bundle

Version: 2.9.1

## Purpose

This bundle is a control-system prompt bundle for AI agents working with GitHub repositories.

It guides repository instantiation, maintenance, review, release and conformance using contracts, modes, graders, templates, evidence, validation scripts, GitHub settings checks, direct repository-state verification and supply-chain assurance.

## Current release

Version 2.9.1 moves the bundle closer to a fully auditable assurance regime.

It adds schema-valid release-gate reports for both pass and fail states, policy-driven live release profiles, stricter GitHub API observability handling, trusted attestation verification evidence, stronger accessibility fixtures, and high-assurance live gate fixtures.

## Automated review comment handling

Codex and other automated review comments must be treated as review work items, not as background noise.

When an automated review comment is legitimate, the agent must:

1. Fix the issue or provide evidence that the implementation already satisfies the concern.
2. Add a thumbs-up reaction to the original comment.
3. Reply directly to the comment or thread explaining how the issue was overcome.
4. Mark the thread resolved with the Resolve conversation action only after the fix and validation evidence are complete.

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

Run a standard live gate:

```bash
GITHUB_TOKEN=<token> python scripts/live-repository-release-gate.py --profile standard --repo . --owner <owner> --repo-name <repo>
```

Run a high-assurance live gate:

```bash
GITHUB_TOKEN=<token> python scripts/live-repository-release-gate.py --profile high-assurance --repo . --owner <owner> --repo-name <repo> --evidence agent-evidence.yaml --workflow-lock workflow-action-lock.yaml --trusted-attestation attestation.json --trusted-attestation-verification trusted-attestation-verification.json --sbom sbom.json --artifact artifact.zip --repo-full-name <owner>/<repo> --sigstore-bundle sigstore-bundle.json --accessibility-evidence accessibility-evidence.yaml --performance-budget performance-budget.yaml --performance-results performance-results.yaml
```

High-assurance, regulated and public-service profiles require GitHub API verification, workflow lock validation, hardened workflow release-mode validation, trusted SBOM attestation, external attestation verification evidence, accessibility evidence, performance evidence and evidence-to-repository cross-checking.

## Trusted attestation evidence

Trusted attestation requires both metadata validation and external verification evidence.

Metadata validation:

```bash
python scripts/validate-sbom-attestation.py --attestation attestation.json --sbom sbom.json --require-dsse --require-slsa --require-github-artifact-attestation --require-sigstore --trusted-mode
```

External verification evidence:

```bash
python scripts/verify-trusted-attestation-commands.py --artifact artifact.zip --repo <owner>/<repo> --sigstore-bundle sigstore-bundle.json --output trusted-attestation-verification.json
python scripts/validate-trusted-attestation-verification.py trusted-attestation-verification.json
```

The external verifier records `gh attestation verify` and `cosign verify-blob` results. Declared verification without command evidence is not enough for trusted live release mode.

## Workflow hardening

Release-ready workflows must use reviewed, non-placeholder SHA pins.

Validate release-ready workflows:

```bash
python scripts/validate-workflow-action-lock.py --lock-file workflow-action-lock.yaml --release-mode
python scripts/validate-workflow-hardening.py .github/workflows --mode hardened --release-mode --lock-file workflow-action-lock.yaml
```

The release-mode fixture proving non-placeholder locked SHAs is located at:

```text
examples/fixtures/workflows-release-mode-pass/
```

## Accessibility assurance

Structured accessibility evidence is defined in:

```text
contracts/accessibility-evidence.schema.json
```

Validate against a repository root:

```bash
python scripts/validate-accessibility-evidence.py accessibility-evidence.yaml --root .
```

Fixture coverage includes repository-root-relative paths, evidence-file-relative paths, open critical defects, low Lighthouse accessibility score, axe violations and Pa11y issues.

## High-assurance fixture assurance

High-assurance live gate fixtures are located at:

```text
examples/fixtures/live-gate/
```

Validate them:

```bash
python scripts/validate-live-gate-fixtures.py
```

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
- Do not resolve a legitimate automated review thread until the issue has been overcome, the original comment has a thumbs-up reaction and the thread has an explanatory reply.
