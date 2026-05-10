# Validation Report — v2.9.1

Version 2.9.1 moves the bundle from strong live repository assurance toward a fully auditable assurance regime.

## Validation summary

Validated before release:

- ZIP source extracted cleanly from v2.9.0
- generated Python artefacts removed
- XML, JSON and YAML parsed successfully
- all XML roots declare `version="2.9.1"`
- manifest hashes checked
- manifest coverage checked
- transient citation markers checked
- changelog order and uniqueness checked
- documentation consistency checked
- template registry validation checked
- eval definition validation checked
- agent evidence validation checked
- direct repository-state verification checked
- GitHub settings verification checked
- evidence-to-repository cross-check checked
- eval harness with test execution checked
- fast release gate checked
- full release gate checked
- release-gate pass and fail report validation checked
- intentional failure report generation checked
- performance adapter mapping and adapter-specific budgets checked
- SBOM validation checked
- offline-test SBOM attestation validation checked
- trusted-mode attestation positive and negative checks checked
- external attestation verification evidence checked
- structured accessibility evidence validation with JSON Schema and `--root` checked
- accessibility positive and negative fixtures checked
- workflow hardening standard mode checked
- workflow hardening template mode checked
- workflow hardening release-mode fixture checked
- workflow action lock validation checked
- live release policy validation checked
- high-assurance live gate positive and negative fixtures checked
- GitHub API strict-mode fixtures checked
- direct final package validation checked

## Offline and live assurance

Offline release-gate assurance validates the bundle and fixtures.

Live repository assurance validates the actual GitHub repository, live API-observed state and evidence required by the selected profile.

## Failure reports

Release-gate reports are first-class artefacts.

Both passing and failing release gates must produce schema-valid reports. Failed reports preserve command history, failed command, structured error, output tails and duration metadata.

## Policy-driven profiles

Live release profiles are defined in `templates/repository/live-release-policy.yaml`.

High-assurance, regulated and public-service profiles require GitHub API verification, workflow lock validation, hardened workflow validation, trusted SBOM attestation, external attestation verification evidence, accessibility evidence, performance evidence and evidence-to-repository cross-checking.

## Trusted attestation

Trusted attestation requires both metadata validation and external verification evidence.

The bundle validates SBOM attestation metadata and separately validates command evidence from `gh attestation verify` and `cosign verify-blob`.

## Accessibility

Accessibility validation now supports repository-root-relative paths, evidence-file-relative paths and bundle-root fallback for bundled fixtures.

Negative fixtures prove failures for open critical defects, low Lighthouse accessibility scores, axe violations and Pa11y issues.

## Result

Validation status: passed.

v2.9.1 preserves the v2.8.x and v2.9.0 control architecture while adding auditable failure reports, live policy profiles, stricter GitHub API edge-case handling, external attestation evidence validation and stronger fixture coverage.
