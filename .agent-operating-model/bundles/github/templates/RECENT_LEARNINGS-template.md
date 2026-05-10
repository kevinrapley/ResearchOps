# Recent Learnings

This file captures high‑signal notes for future maintainers and agents.  Entries should describe project‑specific pitfalls, surprising behaviours or non‑obvious setup steps.  Keep entries concise and structured.  Move superseded learnings to the bottom section when they no longer apply.

## Active learnings

### 2026-04-27 – Example: Wrong Python environment activates

**Problem:** `uv run` inherits the wrong virtual environment when running tests.

**Signal:** Unexpected `ModuleNotFoundError` or mismatched dependency versions during local testing.

**Cause:** The global `VIRTUAL_ENV` variable pointed to a different project.

**Future agent instruction:** Unset `VIRTUAL_ENV` before running `uv` commands: `env -u VIRTUAL_ENV uv run ...`.

**Related files:** `Makefile`, `.env`.

**Status:** Active

## Superseded learnings

Move outdated or resolved entries here to prevent clutter.  Keep them for historical context.