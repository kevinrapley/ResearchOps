# Operating model trace policy

When a user prompt includes `[reasoning]`, the agent must create an auditable trace for the repository-affecting work.

The trace must be a structured audit record. It must not expose private chain-of-thought.

## Required trace content

The user-readable trace must record:

- run metadata
- original task summary
- corrected branch behaviour if any branch was abandoned or recreated
- operating-model files loaded
- bundle package location
- bundles selected
- bundles skipped
- precedence decisions
- files read
- files created or modified
- validation attempted
- validation not run and why
- issues, pivots and residual risks

## Required evidence boundary

The trace must distinguish between:

- evidence from repository files
- implementation decisions
- assumptions
- tool limitations
- validation results

## Storage

User-readable traces live under:

```text
docs/agent-audit/reasoning/YYYY/MM/DD/
```

Machine-readable summaries may be stored beside the Markdown report.

Raw `.agent-traces/` JSONL files remain local unless deliberately promoted.
