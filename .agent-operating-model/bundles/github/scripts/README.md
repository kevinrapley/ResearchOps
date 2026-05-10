# Bundle scripts

Install dependencies:

```bash
python -m pip install -r requirements.txt
```

Run full bundle validation:

```bash
python scripts/validate-bundle.py
```

Validate template registry:

```bash
python scripts/validate-template-registry.py
```

Validate evidence and grade it:

```bash
python scripts/validate-agent-evidence.py examples/agent-evidence.example.yaml
python scripts/grade-output.py --grader github-settings-grader --evidence examples/agent-evidence.example.yaml
```

Run eval harness:

```bash
python scripts/run-eval-harness.py --eval-id instantiate-multi-language-repo --output-dir /path/to/generated --evidence examples/agent-evidence.example.yaml
```

Check performance budget:

```bash
python scripts/check-performance-budget.py --budget examples/performance-budget.example.yaml --results examples/performance-results/example-results.yaml --mode blocking
```

Generate SBOM:

```bash
python scripts/generate-sbom.py --root . --output artifacts/sbom.cyclonedx.json
```

Validate workflow hardening:

```bash
python scripts/validate-workflow-hardening.py templates/github/.github/workflows --mode standard
```

## verify-github-settings.py

Validates `github-settings.yaml` and can optionally inspect branch-protection settings through the GitHub REST API when `GITHUB_TOKEN`, owner and repository name are available.

## performance-adapters.py

Converts benchmark outputs from pytest-benchmark, Go benchmark output, Lighthouse, k6 and autocannon into the shared performance-results format.

## validate-accessibility-evidence.py

Checks that accessibility evidence includes both automated and manual coverage, including keyboard, focus and screen-reader evidence.

## validate-sbom.py

Validates CycloneDX SBOM output and can require dependency graph entries and licence metadata.

## verify-evidence-against-repo.py

Cross-checks agent evidence against direct repository-state and GitHub-settings verification. Use this to reduce reliance on self-reported evidence.

## validate-performance-results.py

Validates performance result files and checks whether budget metrics are present unless missing metrics are explicitly allowed.

## generate-sbom-attestation.py

Creates a hash-based SBOM attestation that records the SBOM hash and hashes of the subject files.

## validate-sbom-attestation.py

Validates that the SBOM attestation matches the SBOM file and records subject file hashes.

## Additional performance adapters

`performance-adapters.py` supports pytest-benchmark, Go benchmark output, Lighthouse, k6, autocannon, JMeter, Gatling and Artillery.

## v2.9.1 assurance scripts

- `verify-github-settings.py` supports offline YAML validation and live GitHub API checks with `--require-api`.
- `pin-workflow-actions.py` resolves and pins workflow actions with a reviewable lock file.
- `performance-adapters.py` supports metric profiles through `--profile`.
- `validate-accessibility-evidence.py` validates structured evidence, tool outputs and manual testing evidence.
- `generate-sbom-attestation.py` can emit DSSE, SLSA, GitHub artifact-attestation and Sigstore-oriented attestation blocks.
- `release-gate.py` uses subprocess execution with timeouts and explicit exit-code handling.
