# Contributing

This fixture shows the contribution guidance expected in a generated multi-language repository.

The guidance is intentionally compact, but it must still describe the working pattern a future agent or contributor should follow.

## Working model

Use a branch for each change.

Keep changes small and reviewable.

Do not mix unrelated fixes, documentation edits and workflow changes in one pull request unless the relationship is explicit and evidenced.

## Before making changes

Read the repository README, `RECENT_LEARNINGS.md`, `agent-evidence.yaml`, `conformance-matrix.yaml` and `gap-register.yaml`.

Check whether the change affects Node files, Python files, GitHub workflows, governance evidence or documentation.

Use the smallest change that satisfies the request.

## Validation

Run the relevant commands before opening a pull request.

For Node changes:

```bash
npm ci
npm test
```

For Python changes:

```bash
pytest
```

For repository governance changes, update or check:

- `agent-evidence.yaml`
- `conformance-matrix.yaml`
- `gap-register.yaml`
- `github-settings.yaml`

## Pull request expectations

A pull request should explain:

- what changed
- why the change was needed
- which files were inspected
- which commands were run
- what remains uncertain
- whether any gap was opened, closed or deferred

## Evidence standard

Do not claim checks passed unless the output or fixture evidence supports that claim.

If a command cannot be run in the environment, say so and record the command as required validation rather than completed validation.
