# Recent Learnings

This file records fixture-specific lessons for the high-assurance live-gate positive case.

## 2026-05-23 — Root evidence files must be realistic examples

The immediate files in `examples/fixtures/live-gate/high-assurance-pass/repo/` are part of the teaching surface of the GitHub Diamond bundle.

They must not be thin placeholders. A positive high-assurance fixture should show realistic synthetic evidence for repository state, GitHub settings, accessibility, performance, SBOM, attestation, trusted verification, command execution, conformance and gap management.

The following direct root files were expanded to strengthen the fixture:

- `accessibility-evidence.yaml`
- `agent-evidence.yaml`
- `attestation.json`
- `conformance-matrix.yaml`
- `gap-register.yaml`
- `github-settings.yaml`
- `package.json`
- `performance-budget.yaml`
- `performance-results.yaml`
- `pyproject.toml`
- `README.md`
- `sbom.json`
- `sigstore-bundle.json`
- `test-commands.yaml`
- `trusted-attestation-verification.json`

Nested directories such as `.github/`, `docs/`, `results/` and `templates/` should be reviewed separately. Do not assume work on the immediate root files also expands nested fixture content.

## 2026-05-23 — Gap evidence can be non-empty without creating blockers

The positive fixture should not hide active release blockers.

An empty `gap-register.yaml` is structurally valid, but it does not teach how gap evidence should be represented. The positive fixture now includes closed, non-blocking fixture-quality records.

This keeps the release-gate interpretation as `pass` while showing how a high-assurance gate can distinguish closed fixture-quality gaps from active release blockers.

## 2026-05-23 — Attestation evidence should show linkage

High-assurance attestation evidence should not be a disconnected blob.

The fixture now links:

- release artifact digest
- SBOM digest
- subject files
- builder identity
- SLSA-style provenance
- GitHub artifact attestation
- Sigstore-style bundle evidence
- DSSE envelope metadata
- trusted verification command output

The evidence remains synthetic and fixture-safe. Real release gates must still verify actual artifacts, repositories and bundles using trusted tooling.

## 2026-05-21 — Positive live-gate fixture must remain complete

The positive fixture is intentionally complete for the high-assurance release profile.

It should include workflow lock evidence, trusted SBOM attestation evidence, external attestation verification evidence, accessibility evidence, performance evidence, repository evidence and workflow evidence.

Do not remove an evidence file from this fixture to create a new failure case. Use a separate `negative-*` fixture instead.

## 2026-05-21 — Negative fixtures should isolate one blocker

Each negative live-gate fixture should fail for one primary reason.

That makes validator failures easier to diagnose and prevents one broken fixture from hiding several unrelated assurance gaps.

## 2026-05-21 — Fixture evidence is not live infrastructure

This fixture uses local files to represent high-assurance evidence.

It does not prove production branch protection, deployment policy, real-world attestation verification or live repository permissions. A real release gate must still observe live GitHub API state where the selected profile requires it.
