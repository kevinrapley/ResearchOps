# Agent bootstrap checklist

Before any repository-affecting response, complete this checklist.

- [ ] Read `AGENTS.md`.
- [ ] Read `.agent-operating-model/orchestration.xml`.
- [ ] Read `.agent-operating-model/bundle-registry.json`.
- [ ] Verify `.agent-operating-model/bundles/` exists.
- [ ] Verify selected bundle directories contain their registered `prompt.spec.yaml` and `prompt.body.xml`.
- [ ] Identify always-load bundles.
- [ ] Identify conditional bundles relevant to the task.
- [ ] Apply `.agent-operating-model/precedence-policy.md`.
- [ ] Record selected bundles and canonical paths if trace mode is active.
- [ ] Record skipped bundles if trace mode is active.
- [ ] Stop repository-affecting work if a required operating-model file or selected bundle directory cannot be loaded.

The repository is the operating-model source of truth. The agent must not ask the user to re-attach bundle packages when the repository is available.
