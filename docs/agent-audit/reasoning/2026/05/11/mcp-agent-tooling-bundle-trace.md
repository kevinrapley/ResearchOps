# Agent trace: MCP Agent Tooling bundle

Date: 2026-05-11

Branch: `perf/include-mcp-agent-tooling-bundle`

Pull request: #233

## Note

Retrospective trace created from commit evidence after merge. No live `[reasoning]` session was captured for this PR.

## Request interpreted

Add the MCP Agent Tooling bundle as a new canonical bundle directory and wire it fully into the operating model.

Required outcomes:

- add `mcp-agent-tooling` as a canonical bundle directory with core files, reference modules, roles, modes, templates, graders, contracts, and examples
- register selection rules and signal phrases covering MCP protocol, servers, clients, tools, sampling, roots, elicitation, and tool consent
- wire the bundle into `bundle-registry.json`, `selection-rules.json`, `task-signal-catalog.json`, operating model README, and agent instructions
- add behavioural eval `behaviour-mcp-tool-consent` with `expectedEvidence` and `forbiddenFailureModes`
- qualify trigger phrases to prevent OpenAI tool keywords from selecting the MCP bundle

## Evidence checked

Repository files checked from commit evidence:

- `.agent-operating-model/README.md`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/behavioural-evals.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/bundles/openai-platform/` (for cross-bundle boundary)

## Implementation applied

Full bundle directory created under `.agent-operating-model/bundles/mcp-agent-tooling/` including `prompt.body.xml`, `prompt.spec.yaml`, `registry-manifest.yaml`, `CHANGELOG.md`, `README.md`, `evals.yaml`, schemas, test suites, three roles (`agent-safety`, `mcp-developer`, `tool-qa`), three modes (`mcp-build`, `mcp-release`, `mcp-review`), three templates (`consent-checkpoint`, `resource-contract`, `tool-contract`), a behaviour grader, contracts, reference modules, a source catalog, and a source catalog validation script.

Operating model wiring commits in order:

1. Add MCP agent tooling bundle core files
2. Add MCP agent tooling reference modules
3. Add MCP agent tooling operational modules
4. Register MCP agent tooling bundle selection rules
5. Document MCP bundle in orchestration
6. Document MCP canonical bundle directory
7. Document MCP bundle precedence
8. Reference MCP canonical bundle in agent instructions
9. Validate MCP bundle operating model selection
10. Add MCP behavioural operating model eval
11. Test MCP bundle operating model selection
12. Qualify MCP tool selector phrases
13. Qualify MCP registry keywords
14. Test OpenAI tool wording does not select MCP

## Key decisions

MCP trigger phrases qualified after testing showed overlap with OpenAI tool-use vocabulary. A dedicated negative test (`ffdac67`) confirms OpenAI tool wording does not select the MCP bundle.

`behaviour-mcp-tool-consent` eval carries `expectedEvidence` and `forbiddenFailureModes: [superficial-keyword-only]`, consistent with the standard set by `behaviour-openai-structured-output` in PR #232.

MCP bundle assigned precedence 64, one below openai-platform (65).

## Commits recorded

```text
e95dd01 Add MCP agent tooling bundle core files
2530356 Add MCP agent tooling reference modules
fda2e61 Add MCP agent tooling operational modules
afcdc0d Register MCP agent tooling bundle selection rules
2485d66 Document MCP bundle in orchestration
3e3df2f Document MCP canonical bundle directory
9938a9d Document MCP bundle precedence
9f6ab5b Reference MCP canonical bundle in agent instructions
14bf155 Validate MCP bundle operating model selection
e71be87 Add MCP behavioural operating model eval
1798278 Test MCP bundle operating model selection
371ae23 Qualify MCP tool selector phrases
7d0a34e Qualify MCP registry keywords
ffdac67 Test OpenAI tool wording does not select MCP
16a38db Merge pull request #233
```

## Validation recorded

- Operating model selection test added for MCP bundle
- Negative test: OpenAI tool wording must not select MCP bundle
- Behavioural eval `behaviour-mcp-tool-consent` added to `behavioural-evals.json`
- Source catalog validation script added

## Current status at trace write

PR #233 merged. Merge commit: `16a38db`.
