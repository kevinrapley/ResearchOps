# Example multi-language repository

This repository is a passing eval output for the GitHub Diamond Standard bundle.

It shows the expected state after an agent instantiates a compact multi-language repository from the bundle templates. The fixture contains Node and Python project signals, repository governance files, CI workflows, evidence artefacts and local project memory.

## What this example demonstrates

The example demonstrates how a generated repository should hold enough context for a reviewer to understand what the agent created and why it was created.

The repository contains:

- `package.json` for the Node project signal
- `pyproject.toml` for the Python project signal
- GitHub Actions workflows for Node, Python, conformance and documentation quality
- `CODEOWNERS` for ownership routing
- `github-settings.yaml` for expected repository settings
- `conformance-matrix.yaml` for control evidence
- `gap-register.yaml` for accepted or deferred gaps
- `agent-evidence.yaml` for the agent's evidence trail
- `RECENT_LEARNINGS.md` for repository memory

## Expected agent interpretation

The agent should classify this as a multi-language repository instantiation output.

The selected mode is `repo-instantiate` because the fixture represents a generated repository scaffold rather than a targeted fix, review or release decision.

The agent should treat this directory as an eval output. It is not a production service. It is a compact example that proves the bundle can create repository structure, governance files and validation evidence together.

## Local setup

Install Node dependencies with:

```bash
npm ci
```

Run Node validation with:

```bash
npm test
```

Run Python validation with:

```bash
pytest
```

The commands are examples used by the eval fixture. A real repository may replace them with project-specific commands.

## Evidence files

`agent-evidence.yaml` records what the agent read, changed, validated and claimed.

`conformance-matrix.yaml` records whether expected controls are present.

`gap-register.yaml` records unresolved or intentionally deferred controls.

`github-settings.yaml` records expected repository settings for review.

## Review expectation

A reviewer should be able to inspect this fixture and see why Node and Python workflows were selected, which governance files were created, which evidence artefacts were produced, and which gaps remain open.
