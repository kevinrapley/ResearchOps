# Agent bootstrap checklist

Before any repository-affecting response, complete this checklist.

- [ ] Read `AGENTS.md`.
- [ ] Read `.agent-operating-model/orchestration.xml`.
- [ ] Read `.agent-operating-model/bundle-registry.json`.
- [ ] Verify `docs/devops/ResearchOps-Bundle-Setup.zip` exists.
- [ ] Identify always-load bundles.
- [ ] Identify conditional bundles relevant to the task.
- [ ] Apply `.agent-operating-model/precedence-policy.md`.
- [ ] Record selected bundles if trace mode is active.
- [ ] Record skipped bundles if trace mode is active.
- [ ] Stop repository-affecting work if a required source cannot be loaded.

The repository is the operating-model source of truth. The agent must not ask the user to re-attach the bundle package when the repository is available.
