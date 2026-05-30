# Agent trace — Team access request copy tightening

**Date:** 2026-05-30  
**Trace type:** operational audit trace  
**Branch:** `content/team-access-request-copy-v2`  
**Related PR:** #315  
**Story:** Story 3 follow-up — Request access to a team

## Evidence boundary

This trace records repository evidence, selected operating-model bundles, implementation scope, files changed, validation expected and residual risk.

It does not expose private chain-of-thought.

## Task summary

Tighten the team access request page content while keeping the agreed single input field for team name or invitation code.

## Team position

The single field remains acceptable for this slice.

The page copy should make the input purpose clear, avoid implying search, and make the sensitive-information warning available to screen reader users at the point of input.

## Operating model files loaded

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/github-mutation-policy.md`

## Selected bundles

Always-load bundles:

- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`

Conditional bundles:

- `.agent-operating-model/bundles/govuk-design-system/`

## Bundle selection rationale

GitHub Diamond was selected because this is repository-affecting branch work.

ResearchOps Developer Control was selected because the page is part of the ResearchOps account and access journey.

Multi-Functional Team was selected because the copy affects a governed access flow.

GOV.UK Design System was selected because the changes affect GOV.UK page copy, hint text, form affordances and accessible descriptions.

Cloudflare was not selected because this branch does not change Worker, D1 or API behaviour.

## Files inspected

- `src/govuk/templates/pages/account-team-access.njk`
- `public/pages/account/team-access/index.html`
- `tests/auth-team-access-request-route-state.test.js`

## Files changed

- `src/govuk/templates/pages/account-team-access.njk`
- `public/pages/account/team-access/index.html`
- `tests/auth-team-access-request-route-state.test.js`
- `docs/agent-audit/reasoning/2026/05/30/team-access-request-copy-tightening.md`
- `docs/agent-audit/reasoning/2026/05/30/team-access-request-copy-tightening.json`

## Implementation summary

The branch:

- keeps one field labelled `Team name or invitation code`
- replaces `team-scoped ResearchOps features` with plainer copy about research records that belong to a team
- adds a `What happens next` section
- improves the team-name or invitation-code hint
- improves the optional message hint
- adds a sensitive-information warning for the message field
- links the sensitive-information warning to the textarea using `aria-describedby`
- wraps the submit button and cancel link in a GOV.UK button group
- updates route-state coverage for the revised copy and accessibility contract

## Scope controls

This branch does not add:

- separate team-name and invitation-code fields
- team search
- invitation-code validation
- approval workflow
- role assignment
- team creation
- backend behaviour changes

## Validation expected

Run:

```bash
npm run validate
npm run lint
npm test -- --ci
```

## Residual risk

Validation has not been run in this connector context.

Manual browser checks should confirm that the privacy warning is read with the message textarea by assistive technology and that the page still keeps a single input field for team name or invitation code.
