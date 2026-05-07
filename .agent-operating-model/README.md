# Repository operating model

This directory is the source of truth for how repository-aware agents work on ResearchOps.

Agents must not rely on chat memory, previously attached bundle files, or inferred operating rules when making repository-affecting changes.

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
- `docs/devops/ResearchOps-Bundle-Setup.zip`

The ZIP file is the authoritative bundle package. The registry describes bundle metadata. The signal catalogue defines typed task signals. The selection rules map those signals to bundle decisions. The orchestration file defines the mandatory sequence.

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
3. retain phrase hits as signal evidence
4. use registry keyword fallback only when explicitly labelled as fallback evidence
5. report the rule ID, selection basis, matched signals and fallback keywords in the selection evidence

## Trace rule

When the user includes `[reasoning]`, the agent must create a user-readable audit trace and a machine-readable summary. The trace must record operating model loading, task signals, bundle selection, implementation activity, validation evidence, issues and pivots.
