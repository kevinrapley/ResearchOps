# Changelog

All notable changes to this project are documented in this file.

The format follows Keep a Changelog conventions and the bundle uses semantic versioning.

---

## [2.9.5+researchops.2026-06-04] - 2026-06-04

### Added

- Added `references/test-contract-impact-sweep.xml` to define proactive test-contract review for change, update, migration, refactor and generated-output work.
- Added explicit sweep coverage for legacy contract terms such as CSS classes, route ids, data attributes, DOM hooks, generated file paths, script URLs, import paths, endpoint paths, event names, fixtures, snapshots, selectors, workflow branch filters and documentation examples.

### Changed

- Updated `prompt.spec.yaml`, `prompt.body.xml` and `README.md` to version `2.9.5`.
- Registered `references/test-contract-impact-sweep.xml` as an always-loaded GitHub Diamond reference.
- Added pull-request readiness expectations requiring agents to record test-contract impact sweep status before claiming readiness.
- Recorded the reusable operating-model lesson in `RECENT_LEARNINGS.md`.

### Fixed

- Reduced the risk of reactive CI repair loops where stale route-state, generated-output, shared assertion or fixture tests are discovered one failure at a time after a predictable contract change.
- Reduced the risk of agents treating implementation changes and test-contract updates as separate workstreams during migrations.

---

## [2.9.4+researchops.2026-05-29] - 2026-05-29

### Added

- Added `references/llm-coding-behaviour.xml` to define cross-cutting coding-agent behaviour controls for repository-affecting work.
- Added explicit behaviour rules for assumptions before coding, simplicity first, surgical changes and goal-driven validation.
- Added behavioural eval coverage for assumptions, minimal implementation, change-boundary discipline and validation evidence.

### Changed

- Updated `prompt.spec.yaml` and `prompt.body.xml` to version `2.9.4`.
- Registered `references/llm-coding-behaviour.xml` as an always-loaded GitHub Diamond reference.
- Added a mandatory pre-coding step requiring agents to state assumptions, surface tradeoffs, avoid speculative scope and define verification before changing code.
- Added light ResearchOps Developer Control hooks so implementation workflow and developer obligations align with the new coding behaviour controls.
- Recorded the reusable operating-model lesson in `RECENT_LEARNINGS.md`.

### Fixed

- Reduced the risk of silent interpretation, speculative implementation and over-engineered coding changes.
- Reduced the risk of unrelated refactors, formatting drive-bys and broad cleanup during focused repository tasks.
- Reduced the risk of agents claiming completion without clear success criteria, reproduction checks or validation evidence.

---

## [2.9.3+researchops.2026-05-21] - 2026-05-21

### Added

- Added canonical scenario examples under `examples/scenarios/` for repository discovery, CI repair, release readiness, documentation gaps, Node template selection and Node CI workflow selection.
- Added expected-output examples under `examples/expected-outputs/` to show acceptable agent response shape without redundant example headings.
- Added behavioural anti-examples under `examples/anti-examples/` for genuine unsafe or incorrect agent behaviour.

### Changed

- Promoted placeholder-style examples into concrete worked examples with user prompts, repository context, mode selection, roles, references, contracts, graders, required evidence and failure conditions.
- Updated `README.md`, `VALIDATION-REPORT.md`, `prompt.spec.yaml` and `prompt.body.xml` to version `2.9.3`.
- Reframed examples as teaching artefacts for bundle behaviour rather than decorative snippets or placeholder files.

### Fixed

- Removed ambiguity around empty arrays and heading-only examples by replacing placeholder intent with concrete scenarios and expected outputs.
- Clarified that placeholder examples are not anti-examples; anti-examples are reserved for genuine unsafe or incorrect behaviours.

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
