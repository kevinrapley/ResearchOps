# Repository operating model

This directory is the source of truth for how repository-aware agents work on ResearchOps.

Agents must not rely on chat memory, previously attached bundle files, or inferred operating rules when making repository-affecting changes.

## Bootstrap sources

Agents must load these files before repository-affecting work:

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/bootstrap-checklist.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `docs/devops/ResearchOps-Bundle-Setup.zip`

The ZIP file is the authoritative bundle package. The registry describes how to select and layer the bundles. The orchestration file defines the mandatory sequence.

## Commands

```bash
npm run agent:model -- "<task text>"
npm run agent:bundles:validate
npm run agent:model:validate
```

## Trace rule

When the user includes `[reasoning]`, the agent must create a user-readable audit trace and a machine-readable summary. The trace must record operating model loading, bundle selection, implementation activity, validation evidence, issues and pivots.
