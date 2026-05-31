# Agent trace — Story 4 team access review

**Date:** 2026-05-31  
**Trace type:** operational audit trace  
**Branch:** `feature/team-access-request-review-v2`  
**Epic:** ROPS-AUTH-P1-000 — Governed access, permissions and audit  
**Story:** Team Admin reviews team access requests

## Evidence boundary

This trace records repository evidence, selected operating-model bundles, implementation scope, files read, files changed, validation expected and residual risk.

It does not expose private chain-of-thought.

## Task summary

Create Story 4 using the recommended core acceptance criteria and add a GOV.UK/Nunjucks page that uses GOV.UK Frontend macros where practical.

## Team position

Story 4 can approve team membership.

It must not assign roles, permissions or sensitive access.

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

ResearchOps Developer Control was selected because this changes a ResearchOps account and team administration journey.

Multi-Functional Team was selected because the story defines a governed access-control decision flow.

GOV.UK Design System was selected because the task changes Nunjucks templates, generated HTML routing, form controls, status tags, warning text, summary lists and accessibility affordances.

Cloudflare was not selected for implementation because this first slice does not add Worker routes, D1 migrations or runtime approval behaviour.

## Bundles skipped

- `.agent-operating-model/bundles/cloudflare/`
- `.agent-operating-model/bundles/openai/`
- `.agent-operating-model/bundles/mcp-agent-tooling/`
- `.agent-operating-model/bundles/airtable-public-api/`
- `.agent-operating-model/bundles/mural-public-api/`

## Files inspected

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/github-mutation-policy.md`
- `.agent-operating-model/bundles/github/prompt.spec.yaml`
- `.agent-operating-model/bundles/github/prompt.body.xml`
- `.agent-operating-model/bundles/researchops-developer-control/prompt.spec.yaml`
- `.agent-operating-model/bundles/researchops-developer-control/prompt.body.xml`
- `.agent-operating-model/bundles/multi-functional-team/prompt.spec.yaml`
- `.agent-operating-model/bundles/multi-functional-team/prompt.body.xml`
- `.agent-operating-model/bundles/govuk-design-system/prompt.spec.yaml`
- `.agent-operating-model/bundles/govuk-design-system/prompt.body.xml`
- `scripts/govuk/render-govuk-pages.mjs`
- `visual-walkthrough.config.mjs`
- `src/govuk/templates/pages/account-team-access.njk`
- `public/pages/account/team-access/index.html`

## Files changed

- `docs/product/26/05/31/auth-story-4-team-access-review.md`
- `src/govuk/templates/pages/team-access-requests.njk`
- `scripts/govuk/render-govuk-pages.mjs`
- `visual-walkthrough.config.mjs`
- `tests/auth-team-access-review-route-state.test.js`
- `docs/agent-audit/reasoning/2026/05/31/auth-story-4-team-access-review.md`
- `docs/agent-audit/reasoning/2026/05/31/auth-story-4-team-access-review.json`

## Implementation summary

The branch adds the Story 4 product document and the first Nunjucks review-page source for Team Admin review of team access requests.

The Nunjucks source uses GOV.UK Frontend macros where practical:

- `govukBreadcrumbs`
- `govukButton`
- `govukErrorSummary`
- `govukSummaryList`
- `govukTag`
- `govukTextarea`
- `govukWarningText`

The renderer now declares `src/govuk/templates/pages/team-access-requests.njk` as the source for `public/pages/team/access-requests/index.html`.

The generated HTML route has not been hand-authored. It should be produced from the Nunjucks template by the GOV.UK render workflow.

## Scope controls

This branch does not add:

- backend approval behaviour
- backend rejection behaviour
- D1 migrations
- role assignment
- permission assignment
- team creation
- email notifications
- audit viewer

## Validation expected

Run:

```bash
npm run validate
npm run lint
npm test -- --ci
```

Manual checks after render:

- open `/pages/team/access-requests/`
- confirm one clear h1
- confirm request cards use summary-list structure
- confirm `Awaiting review` status uses visible text
- confirm approve and reject controls have distinct accessible names
- confirm rejection reason privacy hint is associated with the textarea
- confirm page copy says approval does not assign a role or sensitive access

## Residual risk

Validation has not been run in this connector context.

The generated page is deliberately left to the GOV.UK render workflow so the HTML is created from the Nunjucks template rather than hand-authored. Backend approval and rejection behaviour is deliberately out of scope for this first Story 4 page/planning slice.
