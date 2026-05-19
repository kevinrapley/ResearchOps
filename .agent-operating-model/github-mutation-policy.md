# GitHub mutation policy

This policy governs how agents change repository files through GitHub tooling.

## Core rule

When changing an existing file through GitHub tooling, prefer the smallest safe commit mechanism that preserves surrounding content.

Complete and auditable does not mean rewriting the whole file. It means the intended change is specific, verified and traceable.

## Surgical edits

For small changes inside an existing file, prefer a patch-capable or Git object workflow over contents-API full-file replacement.

Use this workflow when a tool provides the required primitives:

1. Fetch the current file, blob or relevant line range.
2. Identify the exact changed region.
3. Create a corrected blob for the changed file.
4. Create a tree that is based on the current branch head tree.
5. Create a commit with the current branch head as parent.
6. Update the branch ref with `force=false`.
7. Verify the resulting PR diff before reporting readiness.

## Contents API replacement

Do not use contents-API full-file replacement for large or complex source files unless all of these are true:

- the user explicitly requested a full file rewrite, or the file is intentionally being regenerated as a whole
- the file is short enough to review completely in the current context
- the complete replacement has been generated and checked without placeholders
- no patch-capable or Git object workflow is available

If a full-file replacement is used, the agent must verify the resulting changed-file list and file diff before saying the work is ready.

## Anti-patterns

Do not repeatedly retry a blocked or failed full-file `update_file` operation. After one blocked or failed full-file write, switch to a smaller Git object workflow, a patch-capable path or a clean branch strategy.

Do not create a tree from scratch for a normal repository edit unless intentionally creating a repository snapshot. A normal tree edit must be based on the current branch head tree. A partial tree can delete most of the repository.

Do not use placeholders, omissions or summary tokens inside committed code, configuration or documentation.

Do not leave a known-bad PR open as ready for testing. Close it, mark it invalid or replace it with a clean PR.

## Chat output versus repository mutation

A user preference for full rewritten files applies to code shown in chat when the user asks to see the file.

It does not require full-file repository replacement when making a small direct change in GitHub.

## Readiness gate

Before telling the user that a PR is ready for review, testing or merge, verify:

- the PR is open
- the changed-file count is plausible for the task
- the changed-file list contains only expected paths, or any extra paths are explained
- the PR body links to required trace files when trace is required
- known-bad predecessor PRs have been closed or clearly marked invalid
