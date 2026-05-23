# Changelog

All notable changes to this project are documented in this file.

The format follows Keep a Changelog conventions and the bundle uses semantic versioning.

---

## [2.9.3+researchops.2026-05-21] - 2026-05-21

### Added

- Added canonical scenario examples under `examples/scenarios/` for repository discovery, CI repair, release readiness, documentation gaps, Node template selection and Node CI workflow selection.
- Added expected-output examples under `examples/expected-outputs/` to show acceptable agent response shape without redundant example headings.
- Added behavioural anti-examples under `examples/anti-examples/` for genuine unsafe or incorrect agent behaviour.
- Added `scripts/validate-eval-harness-execution.py` to prove the eval harness executes structured command objects through their `command` field and fails closed on malformed or unmet command expectations.

### Changed

- Promoted placeholder-style examples into concrete worked examples with user prompts, repository context, mode selection, roles, references, contracts, graders, required evidence and failure conditions.
- Updated `README.md`, `VALIDATION-REPORT.md`, `prompt.spec.yaml` and `prompt.body.xml` to version `2.9.3`.
- Reframed examples as teaching artefacts for bundle behaviour rather than decorative snippets or placeholder files.
- Updated `scripts/run-eval-harness.py` to normalise string and structured command entries, execute the intended shell command string, capture observed stdout/stderr/return code/timestamps and validate expected status/output fields.

### Fixed

- Removed ambiguity around empty arrays and heading-only examples by replacing placeholder intent with concrete scenarios and expected outputs.
- Clarified that placeholder examples are not anti-examples; anti-examples are reserved for genuine unsafe or incorrect behaviours.
- Fixed a critical eval execution defect where structured command objects could be passed directly to `subprocess.run` instead of executing their `command` value.
- Replaced descriptive non-executable eval fixture commands with deterministic executable commands.

---

## [2.9.2+researchops.2026-05-19] - 2026-05-19

### Added

- Added `references/github-tooling-mutation-policy.xml` to require smallest-safe repository mutation mechanics.
- Added explicit surgical-edit rules for GitHub tooling, including patch-capable or Git object workflows for small edits.
- Added PR-readiness checks requiring changed-file count and changed-file list verification before reporting readiness.

### Changed

- Clarified that complete, auditable work does not require full-file repository replacement.
- Clarified that user preference for full rewritten files applies to chat output, not direct GitHub mutation mechanics.
- Updated `prompt.spec.yaml` and `prompt.body.xml` to version `2.9.2`.

### Fixed

- Prevented repeated blocked full-file `update_file` retries from becoming the default response to a small code change.
- Prevented normal edit trees from being created from scratch without the current branch head tree.
- Prevented known-bad PRs from being reported as ready for testing.

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