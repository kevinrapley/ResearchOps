# Agent trace: signal-based bundle selection model

> This is an auditable trace for a repository-affecting task that included `[reasoning]`. It records operating-model loading, branch hygiene, task interpretation, implementation decisions, review corrections and validation design. It does not expose private chain-of-thought.

## Run metadata

- Trace ID: `atrace-20260507-signal-selection-model`
- Date: 2026-05-07
- Repository: `kevinrapley/ResearchOps`
- Active branch: `feature/signal-selection-model`
- Abandoned branch: `feature/signal-based-bundle-selection`
- Trigger token detected: `[reasoning]`

## Operating model loaded

The repository operating model was bootstrapped from `main` before repository-affecting changes.

Loaded or checked:

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/selection-rules.json`

The current `AGENTS.md` requires repository-affecting agents to load the repository operating model, not rely on chat memory or re-attached bundles.

## Branch hygiene

`main` had advanced after PR #208 was merged.

An initial branch, `feature/signal-based-bundle-selection`, was created from the PR #208 merge commit. A compare check showed it was already behind current `main` by three commits before implementation.

Corrective action:

- stopped using `feature/signal-based-bundle-selection`
- created `feature/signal-selection-model` from current `main`
- confirmed `feature/signal-selection-model` was identical to `main` before implementation
- made all implementation changes on `feature/signal-selection-model`
- did not force-update any branch

## User task interpretation

The user highlighted the residual weakness in the previous trace architecture:

> The structured rules still use phrase matching as one input, but now require rule IDs, facets, matched phrases or explicit registry-keyword fallback evidence instead of returning unlabelled keyword hits.

I interpreted this as a hardening task: keep phrase matches as useful evidence, but stop letting phrase matches function as the direct bundle-selection rule.

## Design decision

The selection pipeline now separates three concerns:

1. **Task signal inference**: derive typed task signals from task text.
2. **Bundle rule application**: select bundles from required signal IDs.
3. **Evidence reporting**: keep phrase hits and registry keywords as evidence, not as unlabelled selectors.

This reduces superficial keyword matching without pretending to provide model-internal attention evidence.

## P2 review correction

A PR #209 review comment found that `expectedEvidence: ["matched-signal"]` was still too weak. It only checked whether some selected bundle had `matchedSignals`, so always-load bundles could satisfy the eval even if expected conditional bundles fell back to registry keywords after signal-catalog drift.

Correction:

- `run-behavioural-evals.mjs` now identifies expected conditional bundles for each eval.
- For `matched-signal` and `matched-condition`, each expected conditional bundle must have `selectionBasis: required-task-signal`.
- Each expected conditional bundle must also carry non-empty `matchedSignals` evidence.
- Registry keyword fallback remains valid only when the eval does not require matched-signal evidence for that conditional bundle.

## Files created

- `.agent-operating-model/task-signal-catalog.json`
- `docs/agent-audit/reasoning/2026/05/07/signal-selection-model-trace.md`
- `docs/agent-audit/reasoning/2026/05/07/signal-selection-model-trace.json`

## Files modified

- `.agent-operating-model/README.md`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/behavioural-evals.json`
- `AGENTS.md`
- `scripts/agent-operating-model/load-operating-model.mjs`
- `scripts/agent-operating-model/run-behavioural-evals.mjs`
- `scripts/agent-operating-model/validate-operating-model.mjs`
- `scripts/validate.sh`
- `tests/agent-operating-model-regression.test.js`

## Implementation detail

### Task signal catalogue

Added `.agent-operating-model/task-signal-catalog.json`.

It defines typed signals such as:

- `repository-affecting-task`
- `government-product-assurance-default`
- `ui-or-content-change`
- `runtime-or-deployment-change`
- `external-api-or-data-change`
- `external-api-or-collaboration-change`

Phrase hits now attach to task signals as evidence.

### Signal-based bundle rules

Updated `.agent-operating-model/selection-rules.json` so rules use `requiredSignals` rather than direct phrase lists.

### Loader update

Updated `load-operating-model.mjs` so it:

- reads the task signal catalogue
- infers `taskSignals`
- selects bundles from signal-based rules
- preserves registry keyword fallback as an explicitly labelled fallback path
- returns `matchedSignals`, `matchedPhrases`, `matchedRegistryKeywords`, `ruleId`, `selectionBasis` and `traceLayer`

### Behavioural eval update

Updated `run-behavioural-evals.mjs` so:

- `superficial-keyword-only` fails unless selected bundles have auditable signal evidence or explicit registry fallback evidence
- `matched-signal` evals require every expected conditional bundle to carry matched signal evidence
- expected conditional bundles cannot satisfy matched-signal evidence through always-load bundle defaults

### Regression coverage

Updated `tests/agent-operating-model-regression.test.js` to assert:

- conditional bundles are selected from typed task signals
- selected bundles expose `matchedSignals`
- registry keyword fallback remains explicit and labelled
- trace reports can use `taskSignals`
- `AGENTS.md` references the task signal catalogue

## Validation designed

Validation now checks that:

- `.agent-operating-model/task-signal-catalog.json` exists
- task signal IDs referenced by selection rules exist in the catalogue
- selected bundles include either signal evidence or explicit registry fallback evidence
- behavioural evals expect `matched-signal` evidence rather than the older `matched-condition` wording
- matched-signal evals require expected conditional bundles to carry matched signal evidence
- repository validation requires the task signal catalogue

## Validation not claimed

I have not claimed full local `npm run lint`, `npm run validate` or `npm test` success in this environment. CI should provide the definitive result.

## Residual risks

- Phrase matching still exists, but it now supports task signal inference rather than directly selecting bundles.
- Registry keyword fallback remains intentionally available for compatibility, but it must be explicitly labelled as fallback evidence.
- This remains behavioural and operational traceability. It does not provide direct mechanistic evidence from model internals.
