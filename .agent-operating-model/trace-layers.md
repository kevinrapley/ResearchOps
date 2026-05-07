# Trace layer architecture

ResearchOps traceability is organised into four layers.

## Layer 1: operational

Operational trace answers: what did the agent do?

It records:

- prompt received
- `[reasoning]` detected
- `AGENTS.md` loaded
- orchestration XML loaded
- bundle registry loaded
- bundles selected
- files read
- commands run
- code changed
- tests run
- issues encountered
- pivots made
- response produced

## Layer 2: behavioural

Behavioural trace answers: how did the model respond under controlled tests?

It tests whether repository-affecting agent behaviour follows the operating model across representative prompts.

The behavioural evals ask:

- Did the model attend to the orchestration instructions?
- Did the model privilege the latest user prompt over repository rules?
- Did the model represent bundle precedence in its selected bundle stack?
- Did the model ignore a loaded instruction?
- Did an instruction conflict produce unstable behaviour?
- Did the model use superficial keyword matching instead of structured rule application?

## Layer 3: mechanistic

Mechanistic trace answers: what internal model components appear to cause the behaviour?

This repository cannot directly inspect model activations. It can record mechanistic hypotheses and externally observable probes.

Mechanistic trace entries must be labelled as hypotheses unless supported by model-internal tooling. They should never be presented as direct activation evidence when only behavioural evidence exists.

## Layer 4: training

Training trace answers: did later improvement work change the model, prompts, evals or repository controls?

It records changes to:

- prompt bundles
- orchestration policies
- behavioural evals
- model routing
- training or fine-tuning data assumptions
- regression results after a control change

## Drift categories

Trace analysis uses these drift categories.

| Category | Meaning |
|---|---|
| instruction | The agent stops following the repository operating model. |
| context | The agent loses or compresses earlier bundle details. |
| priority | The agent follows a recent prompt over governing rules. |
| tool | The agent performs actions without checking repository contracts. |
| explanation | The agent produces a confident rationale after the fact. |
| mechanistic | The controlling instruction is no longer strongly represented internally. |

## Event level values

Trace events must use one of these level values:

- `operational`
- `behavioural`
- `mechanistic`
- `training`

The current event schema stores this value as `traceLayer`. Reports may display it as `trace.level` for readability.
