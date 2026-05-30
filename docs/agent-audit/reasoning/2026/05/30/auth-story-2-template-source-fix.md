# Agent trace addendum — Story 2 account template source fix

**Date:** 2026-05-30  
**Branch:** `feature/account-access-summary`  
**PR:** #313  
**Story:** See my account, teams, roles and access summary

## Decision recorded

The first PR run failed because the account page route-state test expected Story 2 account-summary content in `public/pages/account/index.html`, but the CI build regenerates that file from the GOV.UK source template.

The source of truth for the rendered account page is:

```text
src/govuk/templates/pages/account.njk
```

## Fix applied

The Story 2 account-summary structure has been moved into the GOV.UK source template so build output and committed route-state expectations align.

The template now includes:

- account identity fields
- current team context section
- teams and roles section
- account actions section
- technical permission details disclosure
- updated Story 2 script cache key

## Residual risk

CI is rerunning on the updated branch head. Manual browser checks are still required for no-team, one-team, multi-team, no-role and sensitive-capability states.
