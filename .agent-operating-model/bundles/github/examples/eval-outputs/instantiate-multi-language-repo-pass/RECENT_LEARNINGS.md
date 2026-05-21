# Recent Learnings

This file records repository-specific lessons that future agents and contributors should check before making changes.

The fixture starts with an initial learning because the repository has just been instantiated by the bundle eval.

## 2026-05-21 — Initial repository scaffold created

The repository was generated as a multi-language eval output.

Evidence shows Node and Python project signals are present, so both Node and Python CI workflows were selected.

The fixture also includes conformance, documentation-quality, CodeQL and dependency-review workflows because the expected repository posture includes governance and quality evidence, not only runtime tests.

## Working notes for future changes

Check `package.json` before changing Node workflows.

Check `pyproject.toml` before changing Python workflows.

Check `github-settings.yaml` before changing expected status checks or branch protection assumptions.

Check `conformance-matrix.yaml` and `gap-register.yaml` before claiming repository readiness.

Update this file when a repeatable repository-specific trap or decision is discovered.
