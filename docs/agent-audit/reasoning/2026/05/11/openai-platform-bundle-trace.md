# Agent trace: OpenAI Platform bundle

Date: 2026-05-11

Branch: `perf/include-openai-platform-bundle`

Pull request: #232

## Note

Retrospective trace created from commit evidence after merge. No live `[reasoning]` session was captured for this PR.

## Request interpreted

Add the OpenAI Platform bundle as a new canonical bundle directory and wire it fully into the operating model.

Required outcomes:

- add `openai-platform` as a canonical bundle directory with core files: `prompt.body.xml`, `prompt.spec.yaml`, `registry-manifest.yaml`, `evals.yaml`, schemas, tests, and reference modules
- register selection rules and signal phrases covering OpenAI API, Responses API, Structured Outputs, embeddings, Batch, Realtime, and Evals surfaces
- wire the bundle into `bundle-registry.json`, `selection-rules.json`, `task-signal-catalog.json`, operating model README, and agent instructions
- add behavioural eval `behaviour-openai-structured-output` with `expectedEvidence` and `forbiddenFailureModes`
- qualify trigger phrases to prevent superficial-keyword-only bundle selection

## Evidence checked

Repository files checked from commit evidence:

- `.agent-operating-model/README.md`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/behavioural-evals.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/task-signal-catalog.json`

## Implementation applied

Core bundle files added under `.agent-operating-model/bundles/openai-platform/` including `prompt.body.xml`, `prompt.spec.yaml`, `registry-manifest.yaml`, `CHANGELOG.md`, `README.md`, `evals.yaml`, `grade.schema.json`, `output.schema.json`, `variables.schema.json`, `tests.redteam.yaml`, `tests.regression.yaml`, and supporting reference modules.

Operating model wiring commits in order:

1. Add OpenAI bundle core files
2. Add OpenAI bundle reference modules
3. Add OpenAI bundle operational modules
4. Add OpenAI bundle manifest tests and examples
5. Register OpenAI bundle selection rules
6. Document OpenAI bundle operating model
7. Validate OpenAI bundle operating model selection
8. Add OpenAI behavioural operating model eval
9. Test OpenAI bundle operating model selection
10. Reference OpenAI canonical bundle in agent instructions
11. Require OpenAI bundle files in repository validation
12. Use supported OpenAI behavioural eval failure modes
13. List OpenAI source authority URLs in catalogue

## Key decisions

Trigger phrases qualified to prevent superficial-keyword-only selection. The `behaviour-openai-structured-output` eval carries `forbiddenFailureModes: [superficial-keyword-only]` to enforce this.

`expectedEvidence` array introduced on this eval: `matched-rule`, `matched-signal`, `selected-bundle`, `canonical-directory` — establishing the evidence boundary standard subsequently adopted by mcp-agent-tooling.

OpenAI bundle assigned precedence 65, below cloudflare (70) and above airtable-public-api (60).

## Commits recorded

```text
f773122 Add OpenAI bundle core files
fc54842 Add OpenAI bundle reference modules
40374c7 Add OpenAI bundle operational modules
35a79bd Add OpenAI bundle manifest tests and examples
f9f56f8 Register OpenAI bundle selection rules
3fa856a Document OpenAI bundle operating model
8a62612 Validate OpenAI bundle operating model selection
548a1a0 Add OpenAI behavioural operating model eval
0db7551 Test OpenAI bundle operating model selection
b823329 Reference OpenAI canonical bundle in agent instructions
57a0a44 Require OpenAI bundle files in repository validation
a60516d Use supported OpenAI behavioural eval failure modes
56e8910 List OpenAI source authority URLs in catalogue
c8f85c2 Merge pull request #232
```

## Validation recorded

- Operating model selection test added for OpenAI bundle
- Behavioural eval `behaviour-openai-structured-output` added to `behavioural-evals.json`
- Repository validation updated to require OpenAI bundle files

## Current status at trace write

PR #232 merged. Merge commit: `c8f85c2`.
