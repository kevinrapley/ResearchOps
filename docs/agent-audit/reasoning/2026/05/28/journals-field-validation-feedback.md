# Journals field validation feedback trace

## Run metadata

- Date: 2026-05-28
- Repository: `kevinrapley/ResearchOps`
- Branch: `fix/journals-field-validation-feedback`
- Trace requirement: required by `fix/` branch policy
- Trace layer: operational

## Task summary

Convert journals page form validation feedback to GOV.UK field-level validation.

## Problem

The journals page now places general system failures correctly in the page-level feedback area, but form validation failures for journal entries, codes and memos are still shown as blue notification banners. These are validation errors and should use GOV.UK error summary plus inline field errors.

## Intended behaviour

- Code form validation uses a red error summary linked to the code name field and an inline code-name error message.
- Memo form validation uses a red error summary linked to the memo textarea and an inline memo error message.
- Journal-entry validation uses red error summary items linked to category and/or entry fields, with inline field errors.
- Retrieval validation remains a linked field-level error targeting `#retrieval-q`.
- System/load/export failures remain plain page-level errors rather than field errors.

## Validation plan

- Update runtime validation helpers and route-state coverage.
- Open a PR to `main`.
- Verify the full GitHub Actions suite before reporting readiness.
