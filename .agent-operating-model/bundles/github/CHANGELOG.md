# Changelog

All notable changes to this project are documented in this file.

The format follows Keep a Changelog conventions and the bundle uses semantic versioning.

---

## [2.9.1+researchops.2026-05-14] - 2026-05-14

### Added

- Added branch-prefix governance for ResearchOps work branches.
- Added the approved branch prefixes: `feature/`, `chore/`, `test/`, `fix/`, `perf/` and `hotfix/`.
- Added explicit prohibition of unapproved prefixes such as `claude/`, `codex/`, `bugfix/` and `experiment/`.
- Added branch-driven trace posture so `feature/`, `chore/`, `test/`, `fix/` and `perf/` branches always require auditable traces without requiring the user to include `[reasoning]`.
- Added `hotfix/` as the only approved work-branch prefix that does not require an auditable trace.

### Changed

- Reframed `[reasoning]` as an allowed explicit trace request rather than the sole trigger for trace creation.

---

## [2.9.1+researchops.2026-05-13] - 2026-05-13

### Added

- Documented the expected handling of legitimate Codex and automated review comments.
- Added explicit requirements to add a thumbs-up reaction, reply with how the issue was overcome and resolve the review thread only after the fix and validation evidence are complete.
- Added regression coverage for the Codex comment-handling rule in the ResearchOps repository test suite.

### Changed

- Updated `prompt.body.xml`, `modes/repo-review.xml`, `modes/repo-fix.xml` and `README.md` so the expectation is present in both bundle-level doctrine and mode-level runbooks.

---

## [2.9.1] - 2026-04-28

### Added

- Release-gate report schema at `contracts/release-gate-report.schema.json`.
- `scripts/validate-release-gate-report.py`.
- Passing and failing release-gate report fixtures.
- Intentional failure command for release-gate failure-path testing.
- Policy-driven live release profiles in `templates/repository/live-release-policy.yaml`.
- Live release policy schema and validator.
- Trusted attestation verification evidence schema and validator.
- GitHub API strict-mode fixture validator.
- Accessibility path and negative evidence fixtures.
- High-assurance live gate positive and negative fixtures.
- Live gate fixture validator.

### Changed

- Updated the bundle version to `2.9.1` across prompt specification, prompt body, XML modules and manifest.
- Updated `release-gate.py` so failed reports preserve full command history, failed command, structured error and duration metadata.
- Updated `release-gate.py` so generated reports are validated against schema.
- Updated `live-repository-release-gate.py` to read live profile requirements from the policy file.
- Updated GitHub API strict mode to handle `204 No Content` and distinguish insufficient permissions from non-observable state.
- Updated trusted attestation command evidence so live trusted mode can require external verification output.
- Updated accessibility evidence validation fixtures for root-relative and evidence-file-relative paths.

### Fixed

- Strengthened failure-path assurance for release gates.
- Reduced ambiguity between offline bundle assurance and live repository assurance.
- Prevented high-assurance live profiles from passing without policy-required evidence.
- Added fixture coverage for expected high-assurance live gate failures.
- Preserved v2.9.0 fast and full gate behaviour while adding report validation.

---

## [2.9.0] - 2026-04-28

### Added

- Fast and full offline release-gate modes in `scripts/release-gate.py`.
- Machine-readable release-gate reports through `--report`.
- In-process cached release-gate execution to reduce Python subprocess startup overhead.
- `scripts/live-repository-release-gate.py` profiles for `standard`, `high-assurance`, `regulated` and `public-service`.
- High-assurance live gate requirements for workflow locks, trusted SBOM attestation, accessibility evidence and performance evidence.
- `scripts/verify-trusted-attestation-commands.py` to run real `gh attestation verify` and `cosign verify-blob` verification commands where tools are available.
- Release-mode workflow pass fixture with a non-placeholder locked SHA.
- `--root` support for accessibility evidence validation.

### Changed

- Updated the bundle version to `2.9.0` across prompt specification, prompt body, XML modules and manifest.
- Updated GitHub API verification so critical 403/404 responses are blocking under `--require-api`.
- Updated offline release-gate execution to avoid repeated subprocess startup overhead.
- Updated live repository gate to enforce assurance profiles.
- Updated accessibility validation to resolve artefact paths against an explicit repository root, the evidence file directory or the bundle root.
- Updated documentation consistency checks to include live gate profiles, trusted attestation command verification, release reports and accessibility root support.

### Fixed

- Improved release-gate runtime reliability by reducing subprocess use in the offline bundle gate.
- Added explicit fast/full release-gate controls rather than relying on one heavy validation path.
- Reduced ambiguity between external attestation verification evidence and local attestation metadata.
- Preserved offline validation while strengthening live repository release requirements.

---

## [2.8.9] - 2026-04-28

### Added

- `scripts/live-repository-release-gate.py` for live repository release readiness with required GitHub API verification.
- `scripts/validate-workflow-action-lock.py` to validate reviewed workflow action lock files.
- Release-mode and template-mode workflow hardening controls.
- Placeholder SHA rejection in release-mode workflow hardening.
- Workflow lock-file matching between workflow `uses:` pins and reviewed lock-file SHAs.
- Offline-test and trusted SBOM attestation modes.
- Trusted-mode validation for DSSE, SLSA, GitHub artifact attestation and Sigstore evidence.
- JSON Schema validation inside `scripts/validate-accessibility-evidence.py`.

### Changed

- Updated the bundle version to `2.8.9` across prompt specification, prompt body and XML modules.
- Updated `release-gate.py` to emit clean timeout and command-failure summaries.
- Updated offline release-gate workflow validation to use hardened template mode.
- Updated live release gate to require API-observed repository state.
- Updated GitHub API verification so unobservable API state remains tolerated only in offline mode and is blocking under `--require-api`.
- Updated SBOM attestation validation so declared-but-unverified Sigstore or GitHub artifact-attestation blocks fail in trusted mode.
- Updated accessibility validation to combine schema validation with custom assurance checks.

### Fixed

- Prevented fake all-zero SHA pins from passing release-mode hardened workflow validation.
- Removed false confidence from placeholder hardened workflow templates.
- Separated offline bundle assurance from live repository release assurance.
- Clarified trusted attestation semantics without weakening offline bundle validation.

---

## [2.8.8] - 2026-04-28

### Added

- Subprocess-based release gate with explicit timeout handling and clean process termination.
- `scripts/validate-release-gate-termination.py` release-gate process termination self-test.
- Faster strict validation path in `scripts/validate-bundle.py` by collecting schema documents once and validating schemas only.
- Expanded GitHub API inspection for repository rulesets, environments, deployment protections, CODEOWNERS API errors, Actions policy, default workflow token permissions, secret scanning/push-protection signals, Dependabot security state, required conversation resolution, signed commits and linear-history posture.
- Hardened workflow template directory under `templates/github/.github/workflows-hardened/`.
- `scripts/pin-workflow-actions.py` to resolve and pin workflow actions with a reviewable lock file.
- `templates/github/workflow-action-lock.example.yaml`.
- DSSE, SLSA, GitHub artifact-attestation and Sigstore-oriented fields in SBOM attestation generation and validation.
- `templates/repository/performance-metric-profiles.yaml` for automated adapter-to-budget metric mapping.
- Adapter-specific performance budget templates for pytest-benchmark, Go bench, Lighthouse, k6, autocannon, JMeter, Gatling and Artillery.
- Structured accessibility evidence schema in `contracts/accessibility-evidence.schema.json`.
- Accessibility fixtures for axe, Pa11y, Lighthouse, keyboard tests, screen-reader notes, assistive technology/browser combinations and defect severity.

### Changed

- Updated the bundle version to `2.8.8` across prompt specification, prompt body and XML modules.
- Updated release-gate execution to call scripts through subprocesses rather than `runpy`, reducing hangs and making exit codes explicit.
- Updated performance adapters to apply metric profiles and emit canonical metric names.
- Updated performance-budget checks to support canonical metrics and minimum-threshold comparators.
- Updated SBOM attestation validation to require DSSE, SLSA, GitHub artifact-attestation and Sigstore blocks when requested.
- Updated accessibility evidence validation to inspect structured evidence and tool output files.
- Updated documentation consistency checks to cover the v2.9.1 assurance surface.

### Fixed

- Reduced release-gate timeout risk and improved deterministic process termination.
- Reduced strict-validation overhead without lowering schema-validation coverage.
- Removed stale documentation omissions for performance mapping, accessibility structure, hardened workflow templates and live GitHub API checks.
- Strengthened live-repository assurance while preserving offline bundle validation.

---

## [2.8.7] - 2026-04-28

### Added

- `scripts/verify-evidence-against-repo.py` to cross-check agent evidence against repository-state and GitHub-settings verification.
- GitHub API enforcement mode for `verify-github-settings.py` through `--require-api`.
- GitHub API pass-through flags in `verify-repository-state.py` and `run-eval-harness.py`.
- SBOM attestation generation through `scripts/generate-sbom-attestation.py`.
- SBOM attestation validation through `scripts/validate-sbom-attestation.py`.
- Performance result validation through `scripts/validate-performance-results.py`.
- Performance adapters for JMeter, Gatling and Artillery.
- Additional performance input fixtures for JMeter, Gatling and Artillery.

### Changed

- Updated the bundle version to `2.8.7` across prompt specification, prompt body and XML modules.
- Strengthened GitHub settings verification so file-only, file-and-API and API-unavailable states are explicitly reported.
- Updated direct repository-state verification to accept GitHub API checks and to treat API verification as blocking when `--require-github-api` is used.
- Updated the eval harness to cross-check agent evidence against repository state and GitHub settings.
- Updated release-gate coverage for evidence cross-checks, API-unavailable handling, SBOM attestation and broader performance-adapter coverage.
- Extended SBOM validation to support required purls and required tool metadata.
- Extended performance validation to check that result files are structurally complete and aligned with budget metrics when required.

### Fixed

- Reduced reliance on agent-provided evidence by adding independent evidence-to-repository cross-checking.
- Clarified API verification semantics so local YAML is not confused with observed GitHub server state.
- Improved SBOM provenance by validating the SBOM against an attestation containing subject and SBOM hashes.
- Improved performance assurance coverage without changing unrelated bundle areas.

---

## [2.8.6] - 2026-04-28

### Added

- Deeper direct repository-state verification for branch-protection semantics, CODEOWNERS, selected status checks and baseline diffs.
- `scripts/verify-github-settings.py` for local GitHub settings validation and optional GitHub REST API inspection.
- `scripts/github_settings_verification.py` as the shared GitHub settings verification helper.
- Eval harness support for running repository test commands through `test-commands.yaml`.
- Eval harness support for GitHub settings verification during eval runs.
- Workflow hardening classification for first-party, verified third-party, third-party, local and Docker actions.
- Richer CycloneDX SBOM generation with dependency graph entries and licence metadata where available.
- SBOM validation flags for dependency graph and licence metadata.
- `scripts/performance-adapters.py` for pytest-benchmark, Go benchmark output, Lighthouse, k6 and autocannon result conversion.
- `scripts/validate-accessibility-evidence.py` for checking automated and manual accessibility evidence.
- Positive fixtures for CODEOWNERS, test commands, accessibility evidence and performance adapter inputs.

### Changed

- Updated the bundle version to `2.8.6` across prompt specification, prompt body and XML modules.
- Extended `verify-repository-state.py` to validate semantic GitHub settings, expected status checks and CODEOWNERS support.
- Extended `run-eval-harness.py` to run tests, inspect GitHub settings and report test results.
- Updated `validate-workflow-hardening.py` to distinguish action provenance instead of treating all `uses:` references equally.
- Updated `generate-sbom.py` to emit dependency graph entries and richer component metadata.
- Extended `agent-evidence.schema.json` with GitHub settings verification, branch protection verification, test results, SBOM and performance adapter evidence.
- Extended `github-settings.schema.json` with explicit branch-protection verification fields.
- Updated release-gate coverage for GitHub settings, tests, performance adapters, SBOM dependency metadata and accessibility evidence.

### Fixed

- Strengthened release assurance without rewriting unaffected bundle areas.
- Reduced drift risk between repository-state verification, CI selection and template registry triggers.
- Improved evidence quality for accessibility, performance, SBOM and GitHub governance checks.

---

## [2.8.5] - 2026-04-28

### Added

- Complete manual rebuild of `CHANGELOG.md`, preserving release history from `1.0.0` through `2.8.5`.
- `scripts/validate-changelog.py` to reject duplicate version headings, missing historical versions and incorrect version ordering.
- `scripts/validate-docs-consistency.py` to detect duplicate current-release sections and stale self-referential release wording.
- `scripts/validate-sbom.py` to validate CycloneDX SBOM output and enforce a minimum component count for assurance fixtures.
- `scripts/repository_conditions.py` as the shared condition-evaluation module for repository traits, template triggers and CI selection.
- Non-empty SBOM fixture under `examples/fixtures/sbom-non-empty/`.
- Release-gate check proving SBOM generation returns at least one component for the non-empty fixture.
- Improved workflow status-check labels, including `CI (Node)`, `CI (Python)`, `CodeQL`, `Dependency Review`, `CI (Conformance)` and `CI (Documentation Quality)`.

### Changed

- Updated the bundle version to `2.8.5` across prompt specification, prompt body and XML modules.
- Rebuilt README content to remove duplicated 2.8.x current-release sections.
- Updated CI template selection and repository-state verification to use shared trigger logic.
- Updated release-gate coverage to include changelog validation, documentation consistency validation and non-empty SBOM validation.
- Regenerated `registry-manifest.yaml`.

### Fixed

- Removed changelog duplication across historical entries.
- Replaced generic 2.4-2.6 changelog entries with distinct release-specific histories.
- Removed stale wording that described a release as fixing itself.
- Reduced selector/verifier drift by centralising repository-condition evaluation.
- Preserved no-regression assurance from `2.8.4`.

---

## [2.8.4] - 2026-04-27

### Added

- `.gitignore` entries for runtime artefacts, caches, dependency folders, build outputs, coverage reports, temporary artefacts, local logs and local environment files.
- `PYTHONDONTWRITEBYTECODE=1` configuration for deterministic Python validation runs.
- Release-gate cleanup behaviour to remove generated artefacts before and after validation.

### Changed

- Updated the bundle version to `2.8.4` across prompt specification, prompt body and XML modules.
- Updated `requirements.txt` to include `jsonschema>=4.0`.
- Updated `validate-bundle.py` so generated artefacts do not destabilise manifest validation.
- Updated `release-gate.py` to remove generated Python artefacts during release validation.
- Updated `run-eval-harness.py` to delegate direct repository-state checks to `verify-repository-state.py`.

### Fixed

- Removed packaged `__pycache__/`, `*.pyc` and `*.pyo` files.
- Excluded generated runtime artefacts from `registry-manifest.yaml`.
- Prevented release-gate execution from invalidating the manifest.
- Preserved manifest coverage for source and fixture artefacts only.
- Strengthened trigger inference for web, public-service and performance-sensitive repositories.

---

## [2.8.3] - 2026-04-27

### Added

- Registry-driven CI template selection.
- Expanded direct repository-state verification for all selected workflows.
- Conditional direct checks for `harm-register.yaml`, `accessibility-evidence.md` and `performance-budget.yaml`.
- Diff-aware eval output reporting for created, modified and deleted files.
- GitHub Actions release-gate workflow template.
- GitHub settings evidence model supporting desired state, observed state and verification method.

### Changed

- Updated the bundle version to `2.8.3` across prompt specification, prompt body and XML modules.
- Updated `select-ci-templates.py` to read from `template-registry.yaml` instead of a hard-coded language table.
- Updated `verify-repository-state.py` to check all selected workflows, not only language CI workflows.
- Updated `run-eval-harness.py` to compare generated output against fixture baselines.
- Updated `validate-workflow-hardening.py` to accept a workflow path and validate generated repository workflows as well as bundle workflow templates.
- Updated the positive eval fixture so it contains all workflows selected by the registry-driven selector.

### Fixed

- Reduced drift between template registry entries and CI workflow selection.
- Strengthened no-regression verification for generated repository state.
- Improved workflow status-check naming consistency.
- Regenerated `registry-manifest.yaml`.

---

## [2.8.2] - 2026-04-27

### Added

- `scripts/select-ci-templates.py` for manifest-based CI template selection.
- `scripts/verify-repository-state.py` for direct repository-state verification.
- `scripts/validate-selected-template-set.py` for selected-template validation.
- `scripts/release-gate.py` to run validators and direct-state checks before packaging.
- Optional strict schema validation through `scripts/validate-bundle.py --strict`.
- Positive eval output fixture under `examples/eval-outputs/instantiate-multi-language-repo-pass/`.
- Ecosystem-specific performance result examples.
- Explicit accessibility evidence fields in `agent-evidence.schema.json`.

### Changed

- Updated the bundle version to `2.8.2` across prompt specification, prompt body and XML modules.
- Fixed the template registry destination for `templates/RECENT_LEARNINGS-template.md` so it scaffolds to `RECENT_LEARNINGS.md`.
- Strengthened `agent-evidence.schema.json` with explicit repository-state and accessibility-evidence fields.
- Reworked `grade-output.py` so GitHub settings are graded from exact nested fields.
- Expanded SBOM generation for additional ecosystems and dependency records.
- Updated `run-eval-harness.py` to verify repository state directly, not only agent-reported evidence.

### Fixed

- Reduced reliance on agent-supplied evidence alone.
- Improved assurance that repository controls exist in the generated repository tree.
- Normalised XML module versions.
- Regenerated `registry-manifest.yaml`.

---

## [2.8.1] - 2026-04-27

### Added

- Mode runbooks under `modes/`.
- Graders under `graders/`.
- Contracts for repository, workflow, GitHub settings, harm register, performance budget, conformance, gap register, provenance, endpoint catalogue, evals, grade results and SBOM records.
- Expanded template registry covering repository templates, GitHub templates, workflows, starter trees and archetype profiles.
- CI workflow templates for Node, Python, Go, Rust, Java, .NET, Ruby, PHP and data/ML.
- Dependency Review, CodeQL, accessibility, documentation-quality, performance, conformance, file-inventory and CycloneDX SBOM workflows.
- Executable validation scripts and examples.

### Changed

- Updated the bundle version to `2.8.1` across prompt specification, prompt body and XML modules.
- Rewrote `prompt.body.xml` to orchestrate registry, evidence, conformance, gaps, harm register, GitHub settings, performance budgets and graders.
- Converted `evals.yaml` to executable eval format.
- Aligned `template-registry.yaml` with `contracts/template-registry.schema.json`.
- Aligned `agent-evidence.schema.json` with the agent evidence example and grader expectations.
- Fixed performance-budget schema, examples, script and CI workflow invocation.

### Fixed

- Stabilised the failed `2.8.0` integration.
- Normalised bundle versioning across prompt spec, prompt body and XML modules.
- Removed transient chat citation markers.
- Restored the missing `references/performance-budget-control.xml` module.
- Regenerated `registry-manifest.yaml`.
- Added a path argument to workflow-hardening validation.

---

## [2.8.0] - 2026-04-27

### Added

- Initial `template-registry.yaml` describing available scaffolds and destination paths.
- `contracts/template-registry.schema.json`.
- Initial structured agent evidence and grade-result contracts.
- Basic performance-budget utility.
- Basic SBOM utility.
- Initial workflow-hardening validator.
- Script documentation and Python dependency notes.
- Initial release-gate concept for validation before packaging.

### Changed

- Updated the bundle version to `2.8.0` across prompt specification and prompt body.
- Replaced a static `template_modules` list in `prompt.spec.yaml` with a template-registry pointer.
- Added `requirements.txt` to document Python dependencies.

### Removed

- Removed the explicit `template_modules` list from `prompt.spec.yaml` in favour of registry-based discovery.

### Known Issues

- Registry, schemas, evidence examples, evals and manifest were not fully aligned.
- Stabilisation was required in `2.8.1`.

---

## [2.7.0] - 2026-04-27

### Added

- Authoritative template-registry concept with template destination, applicability and trigger metadata.
- Template-registry schema validation.
- Structured agent evidence contracts.
- Eval runner configuration.
- SBOM record contracts.
- Validation scripts for template registry, agent evidence, workflow hardening and eval execution.
- CycloneDX SBOM workflow and SBOM generation script.
- `requirements.txt`.
- `scripts/README.md`.

### Changed

- Updated the bundle version to `2.7.0` across prompt specification and prompt body.
- Updated `prompt.spec.yaml` to reference the template registry rather than a partial template list.
- Shifted grading toward structured evidence rather than arbitrary prose.
- Wired performance-budget checking into `ci-performance.yml`.
- Renamed the earlier SBOM-style file inventory workflow to `file-inventory.yml`.
- Marked source-catalogue entries as used, reserved or retired.
- Made harm-register creation explicit in mode runbooks when ethics triggers are met.

### Fixed

- Reduced template-orchestration ambiguity.
- Strengthened eval and evidence validation.
- Reduced the risk of prose-only grading.
- Regenerated `registry-manifest.yaml`.

---

## [2.6.0] - 2026-04-27

### Added

- Runbook-style mode definitions with inputs, actions, outputs, failure states, required contracts and required graders.
- `github-settings-grader.xml`.
- Eval and grade contracts.
- `scripts/validate-evals.py`.
- `scripts/grade-output.py`.
- `scripts/check-performance-budget.py`.
- Harm-register contract and template.
- Performance-budget contract and checker script.
- Archetype control profiles.
- Additional archetype templates.
- Hardened workflow validation modes.
- Rule-source traceability for control packs.

### Changed

- Updated the bundle version to `2.6.0` across prompt specification, prompt body and XML modules.
- Normalised XML module versions.
- Upgraded the file-inventory/SBOM baseline workflow.
- Applied package-manager detection to accessibility and documentation-quality workflows.
- Strengthened source references at rule level across core references.
- Extended bundle validation for evals and schema correctness.

### Fixed

- Reduced gaps between control definitions and executable agent operations.
- Improved alignment between mode runbooks, contracts and graders.
- Added missing validation paths for performance budgets and harm registers.

---

## [2.5.0] - 2026-04-27

### Added

- Restored explicit repository-operator responsibilities.
- Strengthened `RECENT_LEARNINGS.md` as the repository memory and learning-loop artefact.
- Code-confidence controls for formatting, linting, type checking, tests, documentation, accessibility, performance and supply-chain checks.
- Quality-gate conventions informed by the ResearchOps developer-control bundle.
- Stronger pull-request, issue and implementation workflow governance.
- Expanded accessibility and formatting expectations, including Prettier-style formatting where applicable.
- Stronger language-specific workflow guidance for repository confidence checks.

### Changed

- Updated the bundle version to `2.5.0` across prompt specification, prompt body and XML modules.
- Shifted the bundle from broad governance guidance toward a stricter repository-operator control model.
- Strengthened instructions around regression tests, red-team tests, registry manifests, evals, integration contracts and conformance matrices.
- Repositioned the repository operator as the steward of project-specific learning for future agents.

### Fixed

- Restored operational-memory expectations that had been weakened in earlier iterations.
- Reduced ambiguity around when an agent must update `RECENT_LEARNINGS.md`.
- Tightened repository-quality requirements before PR or release readiness.

---

## [2.4.0] - 2026-04-27

### Added

- Control-system rebuild of the bundle architecture.
- Dedicated `modes/`, `contracts/`, `graders/`, expanded `references/`, repository templates, GitHub scaffolds and example fixtures.
- Developer control contract.
- Implementation workflow module.
- Integration contracts.
- Quality gates.
- CI governance pack.
- Conformance matrix model.
- Contract test pack.
- Repository design pattern catalogue.
- Endpoint catalogue policy for API and service repositories.
- Ethics pack for high-stakes contexts.
- Payload examples policy and fixture index validation pack.
- Gap register.
- Metadata provenance pack.
- PR and logging governance pack.
- Repository conventions.
- Surface availability policy.
- Local source catalogue to replace transient citation markers.
- Executable-style `scripts/validate-bundle.py`.

### Changed

- Updated the bundle version to `2.4.0` across prompt specification, prompt body and XML modules.
- Rebuilt `prompt.body.xml` to orchestrate reference packs, modes, contracts and graders.
- Replaced generic development guidance with enforceable workflow and evidence contracts.
- Expanded the new-repository question model.
- Moved implementation doctrine out of the main prompt into dedicated references.

### Fixed

- Added grader modules to match the prompt specification.
- Added evals to match the declared evaluation flow.
- Added registry and changelog discipline.
- Corrected pull-request template structure.
- Eliminated transient citation markers from bundle files.
- Regenerated `registry-manifest.yaml`.

---

## [2.3.0] - 2026-04-27

### Added

- Comprehensive CI templates for Go, Java, .NET and cross-cutting concerns such as accessibility, documentation quality, performance and conformance.
- `registry-manifest.yaml` enumerating bundle files with SHA-256 hashes.
- `evals.yaml`, `tests.regression.yaml` and `tests.redteam.yaml`.
- Expanded README content explaining CI selection, code-confidence layers, GitHub settings and the learning loop.
- Enhanced reference packs for formatting/style, documentation quality, performance budgets, architecture integrity and GitHub settings.
- Refined CI selection guidelines with detection rules for Go, Java, .NET and documentation-only repositories.

### Changed

- Updated the bundle version to `2.3.0` across prompt specification and prompt body.
- Strengthened the repository-operator role and learning-loop instructions.
- Required agents to update `RECENT_LEARNINGS.md` after encountering project-specific pitfalls.
- Consolidated discovery and classification routines to reduce ambiguity.
- Enhanced security guidance, including secret management and supply-chain scanning.

### Fixed

- Corrected minor typos and improved clarity in reference modules.
- Improved integration consistency from earlier minor releases.

---

## [2.2.0] - 2026-04-27

### Added

- Specialist role modules for maintainer, developer, architect, QA, security and documentation.
- Initial templates for README, CONTRIBUTING, SECURITY, issue forms and pull-request templates.
- Initial GitHub workflows for CI, linting and testing.
- Basic quality gates for formatting, linting and test coverage.
- GitHub Settings Pack covering branch protection, review requirements, secret scanning and Dependabot configuration.
- CI Selection Guidelines.
- Code Confidence, Accessibility Confidence, Formatter and Style, Documentation Quality, Performance Confidence and Architecture Integrity reference packs.
- `RECENT_LEARNINGS.md` template.

### Changed

- Updated the bundle version to `2.2.0` across prompt specification and prompt body.
- Refactored the prompt body to include a clearer execution loop for agents.
- Expanded the default module set in `prompt.spec.yaml`.
- Updated README and prompt body content to reflect the new reference packs and roles.

### Fixed

- Corrected references to outdated files.
- Resolved version-compatibility issues in the early 2.x structure.

---

## [2.1.0] - 2026-04-27

### Added

- `references/learning-loop.xml`.
- `references/code-confidence-pack.xml`.
- `references/accessibility-confidence-pack.xml`.
- `references/formatter-and-style-policy.xml`.
- `references/documentation-quality-pack.xml`.
- `references/architecture-integrity-pack.xml`.
- `references/performance-confidence-pack.xml`.
- `templates/repository/RECENT_LEARNINGS-template.md`.
- Node, Python, web accessibility, documentation quality and performance workflow templates.
- Learning-loop, code-confidence and accessibility graders.

### Changed

- Updated the bundle version to `2.1.0` across prompt specification and prompt body.
- Restored the repository operator as a senior maintainer and repository memory steward.
- Strengthened `quality-gates.xml` with explicit confidence layers and waiver policy.
- Strengthened `ci-governance-pack.xml` with workflow classes, job order and GitHub Actions security defaults.
- Expanded `developer-control-contract.xml` to require recent learnings, code confidence, accessibility and performance impact.
- Expanded regression, red-team and eval coverage.

### Fixed

- Addressed the v2 weakness where governance machinery diluted the v1 repository-operator learning-loop doctrine.
- Clarified when agents must capture project-specific repository lessons.

---

## [2.0.0] - 2026-04-27

### Added

- First major rebuild of the GitHub Diamond Standard Prompt Bundle.
- ResearchOps-style control architecture.
- Registry manifest with file hashes.
- Regression tests, red-team tests and eval scenarios.
- Dedicated modes for discovery, instantiation, build, fix, review, security, release, conformance, docs and archive.
- Developer control contract.
- Implementation workflow module.
- Integration contracts.
- Quality gates.
- CI governance pack.
- Conformance matrix model.
- Contract test pack.
- Repository design pattern catalogue.
- Endpoint catalogue policy for API and service repositories.
- Ethics pack for high-stakes contexts.
- Payload examples and fixture index validation.
- Gap register.
- Metadata provenance pack.
- PR and logging governance pack.
- Repository conventions.
- Surface availability policy.
- GitHub `.github` scaffold templates.
- Agent instruction templates.
- Release governance and security supply-chain controls.

### Changed

- Updated the bundle version to `2.0.0` across prompt specification and prompt body.
- Reframed the bundle from a repository-starting prompt into a repository lifecycle prompt bundle.
- Introduced a stronger distinction between planning, building, reviewing, releasing and maintaining repositories.
- Removed transient conversation-local citation markers.
- Replaced generic guidance with enforceable workflow and evidence contracts.
- Expanded the new-repository question model.
- Moved implementation doctrine out of the main prompt into dedicated references.

### Fixed

- Added grader modules to match the prompt specification.
- Added evals to match the declared evaluation flow.
- Added registry and changelog discipline.
- Corrected pull-request template structure.

---

## [1.1.0] - 2026-04-27

### Added

- Early templates for issues, pull requests, discussions, security policy and repository maintenance.
- Early guidance for CI, branch protection, code review and quality checks.
- Initial `.github` structure guidance.
- Initial repository maintenance conventions.

### Changed

- Expanded the initial bundle beyond repository creation into basic repository maintenance.
- Clarified the questions an agent should ask before starting a new repository.
- Added early maintenance and review language to the repository operating model.

### Fixed

- Improved clarity in repository-inception guidance.
- Reduced ambiguity in early repository setup prompts.

---

## [1.0.0] - 2026-04-27

### Added

- Initial GitHub Diamond Standard Prompt Bundle.
- Foundational instructions for creating and maintaining GitHub repositories.
- Baseline repository planning questions.
- Early guidance for technology selection, documentation, quality, security, issues, pull requests, discussions and GitHub Actions.
- Initial repository discovery, classification and plan-build-test-release loop guidance.

### Changed

- Initial release.

### Fixed

- Initial release.
