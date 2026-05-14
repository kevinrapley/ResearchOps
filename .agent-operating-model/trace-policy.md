# Operating model trace policy

Agents must create auditable traces for repository-affecting work based on branch posture, not only when the prompt includes `[reasoning]`.

The trace must be a structured audit record. It must not expose private chain-of-thought.

## Branch naming policy

Repository work branches must start with exactly one of these prefixes:

- `feature/`
- `chore/`
- `test/`
- `fix/`
- `perf/`
- `hotfix/`

Do not use any other work-branch prefix.

For example, do not create or continue branches such as:

- `claude/...`
- `codex/...`
- `bugfix/...`
- `experiment/...`

The mainline branches `main` and `master` are exempt from work-branch prefix checks.

## Trace trigger policy

Always record reasoning traces for repository-affecting work on branches that start with:

- `feature/`
- `chore/`
- `test/`
- `fix/`
- `perf/`

Do not record reasoning traces for branches that start with:

- `hotfix/`

A `hotfix/` branch is reserved for urgent operational repair where trace generation could slow a time-critical fix. The absence of a trace on a `hotfix/` branch must not be used to broaden the scope of that branch.

The legacy `[reasoning]` prompt token remains allowed as an explicit trace request for trace-eligible branches, but it is no longer the only trigger. If the branch prefix requires traces, traces are required even when the user does not type `[reasoning]`.

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
- branch name and branch-prefix trace decision
- corrected branch behaviour if any branch was abandoned or recreated
- operating-model files loaded
- canonical bundle directories selected
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

## Promotion

Validated raw traces can be promoted with:

```text
npm run trace:promote -- --input .agent-traces/raw/<trace>.jsonl --slug <slug> --date YYYY-MM-DD
```

Promotion writes:

```text
docs/agent-audit/reasoning/YYYY/MM/DD/<slug>.md
docs/agent-audit/reasoning/YYYY/MM/DD/<slug>.json
```

The promotion tool validates the raw JSONL trace before writing audit artefacts. Invalid traces must not be promoted.

Promotion reports must summarise event evidence. They must not expose private chain-of-thought.

## Enforcement

`npm run trace:coverage` enforces the branch-prefix policy.

The coverage check must fail when a work branch uses an unapproved prefix.

The coverage check must require a promoted `.json` trace for branches starting with `feature/`, `chore/`, `test/`, `fix/` or `perf/`.

The coverage check must skip trace coverage for `hotfix/` branches while still allowing the branch name.
