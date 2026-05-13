# Repository operating model

This directory is the source of truth for how repository-aware agents work on ResearchOps.

Agents must not rely on chat memory, previously attached bundle files, archived ZIP files, or inferred operating rules when making repository-affecting changes.

## Bootstrap sources

Agents must load these files before repository-affecting work:

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/bootstrap-checklist.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/trace-layers.md`
- `.agent-operating-model/behavioural-evals.json`
- `.agent-operating-model/bundles/`

The extracted bundle directories under `.agent-operating-model/bundles/` are canonical. The registry resolves bundle IDs to their canonical directories, prompt specs and prompt bodies. The signal catalogue defines typed task signals. The selection rules map those signals to bundle decisions. The orchestration file defines the mandatory sequence.

## Canonical bundle directories

- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`
- `.agent-operating-model/bundles/govuk-design-system/`
- `.agent-operating-model/bundles/cloudflare/`
- `.agent-operating-model/bundles/openai/`
- `.agent-operating-model/bundles/mcp-agent-tooling/`
- `.agent-operating-model/bundles/airtable-public-api/`
- `.agent-operating-model/bundles/mural-public-api/`

Each selected bundle must resolve to a directory with its registered `prompt.spec.yaml` and `prompt.body.xml`.

## Commands

```bash
npm run agent:model -- "<task text>"
npm run agent:evals
npm run agent:bundles:validate
npm run agent:model:validate
```

## Selection model

Bundle selection must not be an unlabelled keyword hit.

The loader must:

1. infer typed task signals from the task text
2. select bundles from signal-based rules
3. resolve selected bundles to canonical directories
4. retain phrase hits as signal evidence
5. use registry keyword fallback only when explicitly labelled as fallback evidence
6. report the rule ID, selection basis, matched signals, fallback keywords and canonical path in the selection evidence

## Recent learnings

`RECENT_LEARNINGS.md` is the root repository memory for repeatable, recently discovered lessons that should change how future agents work.

Agents must consider writing to `RECENT_LEARNINGS.md` when any of the following happens:

1. a reviewer identifies a repeat mistake that the active bundles should have prevented
2. a CI, formatter, accessibility or release-gate failure reveals a reusable repository-specific rule
3. a design-system, content, security, QA or release lesson should change future implementation defaults
4. a workaround, repo convention or product decision is likely to be needed again within future branches
5. the file has not been updated recently and the current task produces a material learning

Do not use `RECENT_LEARNINGS.md` as a changelog. Use it only for lessons that are reusable beyond the current branch.

Each entry should include:

- date and short title
- context
- learning
- action for future agents

When the lesson changes a bundle rule, update both the relevant bundle and `RECENT_LEARNINGS.md`.

## Trace rule

When the user includes `[reasoning]`, the agent must create a user-readable audit trace and a machine-readable summary. The trace must record operating model loading, task signals, bundle selection, canonical bundle directories, implementation activity, validation evidence, issues and pivots.
