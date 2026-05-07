# Agent trace: trace layer evals

> This is an auditable trace for a repository-affecting task that included `[reasoning]`. It records operational, behavioural and mechanistic trace decisions without exposing private chain-of-thought.

## Run metadata

- Trace ID: `atrace-20260507-trace-layer-evals`
- Date: 2026-05-07
- Repository: `kevinrapley/ResearchOps`
- Active branch: `feature/trace-layer-evals`
- Tainted branch not used: `feature/trace-layers`
- Trigger token detected: `[reasoning]`

## Operating model loaded

Repository bootstrap sources were read from `main` before implementation:

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/trace-policy.md`

The task selected these always-load bundles:

- `github-diamond`
- `researchops-developer`
- `gov-product-assistant-gold-standard`

The work was repository-operating-model and traceability focused, so no platform API bundle was required for implementation.

## Branch behaviour

The first branch created was `feature/trace-layers`, based on an older `main` commit after `main` advanced during setup.

I attempted a force update. The user correctly stopped this because force-updating branches breaches the GitHub Diamond operating model. The force update did not take effect. The branch remained behind `main` and was abandoned.

Corrective action:

- stopped using `feature/trace-layers`
- created `feature/trace-layer-evals` from current `main`
- confirmed it was identical to `main` before implementation
- made all implementation commits on `feature/trace-layer-evals`
- did not force-update any branch

## User problem addressed

The user asked for traceability that can answer deeper drift questions:

- Did the model attend to orchestration instructions?
- Did the model privilege the latest prompt over repository rules?
- Did the model internally represent bundle precedence?
- Did it ignore a loaded instruction?
- Did an instruction conflict produce unstable behaviour?
- Did the model use superficial keyword matching instead of structured rule application?

## Trace layer design

Added `.agent-operating-model/trace-layers.md` with four layers:

- `operational`: what the agent did
- `behavioural`: how the model responded under controlled evals
- `mechanistic`: hypotheses about internal causes and probes
- `training`: changes to prompts, evals, routing or training assumptions

The repository already stores the event layer value as `traceLayer`. The documentation notes that reports may display it as `trace.level`.

## Behavioural eval design

Added `.agent-operating-model/behavioural-evals.json` to test operating-model behaviour under controlled prompts.

The evals cover:

- Cloudflare routing bundle selection
- GOV.UK page design bundle selection
- `[reasoning]` trace-output requirement
- latest prompt versus repository rule precedence
- structured rule application rather than superficial keyword matching

Added `scripts/agent-operating-model/run-behavioural-evals.mjs` to execute those evals against the loader.

## Structured rule application

The previous loader selected conditional bundles by direct keyword matching.

This branch adds `.agent-operating-model/selection-rules.json` and updates `load-operating-model.mjs` so selected bundles include structured evidence:

- `ruleId`
- `selectionBasis`
- `traceLayer`
- `matchedFacets`
- `matchedPhrases`

This makes the selection auditable. It does not claim true model-internal attention evidence.

## P2 review corrections

Two review comments were left on PR #208.

### Preserve registry keyword fallback

The review found that the loader had stopped after structured-rule `anyOf` matching and no longer fell back to registry keywords. This regressed cases such as `Improve the service page`, where the GOV.UK bundle registry contains `page` but the structured rule had `page design`.

Correction:

- `load-operating-model.mjs` now evaluates structured rules first.
- If the structured rule has no phrase match, it falls back to bundle registry keywords when required facets match.
- Fallback selections are labelled with `selectionBasis: registry-keyword-fallback`.
- Fallback evidence records `matchedRegistryKeywords`.
- Regression coverage asserts that `Improve the service page` selects `govuk-design-system` via fallback.

### Enforce declared eval safeguards

The review found that `run-behavioural-evals.mjs` checked expected bundles and static `[reasoning]` output declarations, but did not enforce `expectedSafeguards`, `expectedEvidence` or `forbiddenFailureModes`.

Correction:

- `run-behavioural-evals.mjs` now validates expected safeguards against loader output.
- It validates expected evidence such as matched rule, matched condition and selected bundle.
- It validates forbidden failure modes: instruction, context, priority, tool, explanation and superficial keyword-only.
- It validates latest-prompt conflict detection for repository-rule precedence.
- It validates declared trace outputs for `[reasoning]` prompts against loader-produced `traceOutputs`.

## Mechanistic boundary

The repository cannot directly inspect model activations. Mechanistic trace entries must therefore be labelled as hypotheses unless supported by model-internal tooling.

This prevents behavioural evidence being misreported as direct mechanistic evidence.

## Files created

- `.agent-operating-model/trace-layers.md`
- `.agent-operating-model/behavioural-evals.json`
- `.agent-operating-model/selection-rules.json`
- `scripts/agent-operating-model/run-behavioural-evals.mjs`
- `docs/agent-audit/reasoning/2026/05/07/trace-layer-evals-trace.md`
- `docs/agent-audit/reasoning/2026/05/07/trace-layer-evals-trace.json`

## Files modified

- `AGENTS.md`
- `package.json`
- `scripts/validate.sh`
- `scripts/agent-operating-model/load-operating-model.mjs`
- `scripts/agent-operating-model/validate-operating-model.mjs`
- `scripts/agent-operating-model/run-behavioural-evals.mjs`
- `tests/agent-operating-model-regression.test.js`

## Validation designed

Validation now checks:

- trace-layer control files exist
- behavioural eval catalogue exists
- `agent:evals` exists in `package.json`
- behavioural evals can run through `npm run validate`
- selected bundles contain structured selection evidence
- registry keyword fallback remains available
- eval safeguards, expected evidence and forbidden failure modes are enforced
- trace layers include `operational`, `behavioural`, `mechanistic` and `training`

## Validation not claimed

I have not claimed full local `npm run lint`, `npm run validate` or `npm test` success in this environment. CI should provide the definitive result.

## Residual risks

- Behavioural evals test the repository loader, not the hidden internal state of a hosted model.
- Mechanistic claims remain hypotheses unless future tooling can inspect model-internal representations.
- The structured rules still use phrase matching as one input, but now require rule IDs, facets, matched phrases or explicit registry-keyword fallback evidence instead of returning unlabelled keyword hits.
