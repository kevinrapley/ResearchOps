# GitHub tooling mutation policy trace

- Branch: `fix/github-tooling-mutation-policy`
- Task: Fix the operating model so agents do not repeatedly use full-file `update_file` for small GitHub edits.
- Branch trace decision: `fix/` branch, trace required.

## Operating model files loaded

- `AGENTS.md`
- `RECENT_LEARNINGS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/bootstrap-checklist.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/bundles/github/prompt.spec.yaml`
- `.agent-operating-model/bundles/github/prompt.body.xml`

## Selected bundles

- `github-diamond`
- `researchops-developer-control`
- `multi-functional-team`

## Root cause

The operating model required complete and auditable repository work, but it did not explicitly distinguish chat-delivered full file rewrites from repository mutation mechanics.

This left a tooling ambiguity: an agent could over-apply full-file output preferences and repeatedly use GitHub contents API replacement for small edits.

A later Git object attempt also exposed a second ambiguity: a normal tree edit must be based on the current branch head tree. Creating a tree from scratch for an ordinary file edit can create a partial repository tree and a destructive pull request diff.

## Changes

- Added `.agent-operating-model/github-mutation-policy.md`.
- Added `.agent-operating-model/bundles/github/references/github-tooling-mutation-policy.xml`.
- Updated `AGENTS.md` to include the mutation policy in bootstrap and PR readiness behaviour.
- Updated `.agent-operating-model/bootstrap-checklist.md` to require reading the mutation policy before GitHub file changes.
- Updated `.agent-operating-model/orchestration.xml` to version `1.4.1` and add the mutation policy as a precedence rule.
- Updated `.agent-operating-model/bundle-registry.json` to version `1.4.1`.
- Updated the GitHub bundle spec and body to version `2.9.2` and load the mutation policy reference.
- Updated `RECENT_LEARNINGS.md` with the repeatable lesson.

## Policy intent

For small repository edits, agents must prefer a patch-capable or Git object workflow that preserves surrounding content.

Contents API full-file replacement is now explicitly limited to cases where the user asks for a full file rewrite, the file is short enough to review completely, the complete replacement has no placeholders and no safer mutation path exists.

## Validation

Validation has not been executed locally in this ChatGPT environment. The PR should run operating-model validation in CI.

## Residual risk

The GitHub bundle registry manifest still contains artifact hash data that may need regeneration by the repository's bundle release tooling if strict manifest hash validation is introduced later.
