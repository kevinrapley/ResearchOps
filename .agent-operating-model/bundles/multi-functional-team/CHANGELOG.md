# CHANGELOG

## 4.2.0

Integrated a government-ready harm framework across bundle assembly, roles, templates, graders, schema, and tests.

### Added
- `references/harm-framework.xml`: new always-load reference module containing a structured harm taxonomy table for government services, user research, and team safety.
- `templates/harm-register.xml`: dedicated harm register template for affected groups, pathways, mitigations, residual harms, and escalation routes.
- `README.md`: new bundle overview and release notes, including harm-framework guidance.
- Harm-specific grader rules in `graders/agent-behaviour.xml` and `graders/role-behaviour.xml`.
- Red-team and regression coverage for harm omission, harm separation, and unsafe fieldwork scenarios.

### Changed
- Bundle version: 4.1.0 -> 4.2.0 in `prompt.spec.yaml`, `prompt.body.xml`, and `registry-manifest.yaml`.
- `prompt.body.xml`: now always loads `references/harm-framework.xml` and registers `templates/harm-register.xml`.
- `prompt.spec.yaml`: assembly updated to include the harm framework and harm register template.
- `templates/research-plan.xml`: expanded from a six-step flow to a seven-step flow with an explicit harms, safeguarding, and team protections step.
- `templates/risk-register.xml`: now records harm references, affected parties, residual harm, and escalation ownership alongside conventional risk fields.
- `templates/high-stakes-compliance-summary.xml`: now includes affected groups, material harms, escalation needed, and residual harm in the mandatory summary.
- `roles/user-research.xml`: strengthened to require harm-aware planning, participant protection, and researcher/team protection.
- `roles/research-operations.xml`: strengthened to require burden controls, discreet participant handling, safeguarding operations, and team safety controls.
- `roles/team-mode.xml`: strengthened to require explicit separation of service-user, participant, and researcher/team harms in relevant high-stakes outputs.
- `output.schema.json`: extended with `affected_groups`, `harms`, `residual_harms`, and `escalations_required`, plus richer high-stakes compliance summary fields.
- `registry-manifest.yaml`: regenerated against the new tree and asset set.

### Verification
- All updated XML modules parse cleanly.
- New and changed bundle assembly entries resolve to shipped files.
- The manifest includes the new README, harm framework, and harm register assets.

## 4.1.0

Validation and audit-and-fix pass over the 4.0.0 bundle.

### Fixed
- `roles/safeguarding-lead.xml`: added the required `<activation>` block (`@start-safeguard`, `@start-sg`). Previously the triggers were only mentioned in prose, violating the canonical role-module template.
- `roles/trauma-informed-design-advocate.xml`: added the required `<activation>` block (`@start-tida`, `@start-trauma-informed`). Same gap as above.
- `roles/content-design.xml`: changed activation trigger from `@start-content-design` to canonical `@start-cd`, realigning with `command-registry.xml` and `contextual-mode-control.xml`.
- `roles/content-strategy.xml`: changed activation trigger from `@start-content` to canonical `@start-cs`, realigning with `command-registry.xml` and `contextual-mode-control.xml`. Also removes the `@start-content` / `@start-content-design` prefix-match collision.
- `roles/service-owner.xml`: changed activation trigger from `@start-so` to `@start-owner` to resolve the prefix-match collision with `@start-solarch` (Solutions Architecture).
- `references/command-registry.xml`: added entries for Service Owner (`@start-owner`), Safeguarding Lead (`@start-safeguard` / `@start-sg`), and Trauma-Informed Design Advocate (`@start-tida` / `@start-trauma-informed`). These three roles shipped in 4.0.0 without any command-registry entry.
- `references/command-registry.xml`: removed the duplicate `@show-subsets` entry from the `diagnostic-commands` group (kept the canonical entry in `dynamic-team-assembly`).

### Added
- `references/command-registry.xml` `<notes>`: explicit longest-exact-match resolution rule to disambiguate the two intrinsic prefix pairs `@start-dev` / `@start-devops` and `@start-gov` / `@start-govern`. Phase-modifier suffixes are now documented as only applying after a full base command has resolved.

### Changed
- Bundle version: 4.0.0 → 4.1.0 in `prompt.spec.yaml` and `prompt.body.xml`.
- `registry-manifest.yaml`: regenerated against the updated tree. Self-reference entry removed (a manifest cannot faithfully hash itself; the entry was structurally stale on every rebuild).

### Preserved
- All 87 original assets remain in place. Role, template, reference, grader, and schema content is otherwise unchanged.
- No changes to `prompt.body.xml` role/template/reference/grader registries — the registry already pointed at all 28 role files correctly; only their internal triggers were drifting.

### Verification
- All XML files parse cleanly.
- All 28 role modules now have non-empty `<activation>` blocks with at least one `<trigger>`.
- Every declared role trigger resolves to an entry in `command-registry.xml`.
- No unresolved prefix-match collisions remain: the two intrinsic ones (`dev`/`devops`, `gov`/`govern`) are explicitly disambiguated by the new resolution rule.

## 4.0.0

Rebuilt the bundle as a native semantic XML prompt system.

### Changed
- Replaced document-style XML structure with prompt-semantic XML module types.
- Removed source-conversion metadata from canonical prompt modules.
- Normalised internal references to XML module targets.
- Added native XML grader modules for agent, role, developer, and debate behaviour.
- Added grade.schema.json to constrain grader outputs.
- Moved task definitions into references/task-catalog.xml and wired them into the assembly layer.
- Rewrote prompt.body.xml as an orchestration file rather than an archive wrapper.

### Preserved
- Original multidisciplinary role set.
- Original templates, references, commands, and task registry intent.
- Behavioural enforcement intent from agent-lint, role-lint, dev-lint, and debate-lint.

### Notes
- Role, template, and reference content is structurally normalised.
- Behaviour assurance is now self-contained inside XML grader modules instead of external code graders.
