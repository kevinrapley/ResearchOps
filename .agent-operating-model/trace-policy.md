# Operating model trace policy

When a user prompt includes `[reasoning]`, the agent must create an auditable trace for the repository-affecting work.

The trace must be a structured audit record. It must not expose private chain-of-thought.

## Trace layers

Trace events use the `traceLayer` field. Reports may display this as `trace.level`.

Allowed values are:

- `operational`
- `behavioural`
- `mechanistic`
- `training`

Operational traces record what the agent did. Behavioural traces record how the operating model behaves under controlled evals. Mechanistic traces record hypotheses or direct model-internal evidence where available. Training traces record changes to prompts, evals, routing, training data assumptions or model-control changes.

Mechanistic trace entries must not claim internal activation evidence unless the tooling can directly inspect model internals.

## Drift categories

Trace reports and eval failures should classify drift using these categories:

- `instruction`: the agent stops following the repository operating model
- `context`: the agent loses or compresses earlier bundle details
- `priority`: the agent follows the latest prompt over governing rules
- `tool`: the agent performs actions without checking repository contracts
- `explanation`: the agent produces a confident rationale after the fact
- `mechanistic`: the controlling instruction is no longer strongly represented internally

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
