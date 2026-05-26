# Project Dashboard GOV.UK Frontend migration

Date: 2026-05-25
Branch: `chore/govuk-frontend-integration`
PR: #262

## Task

Move `/pages/project-dashboard/` to the GOV.UK Frontend integration model while preserving the existing dashboard content and interaction model.

## Operating model

The work followed the repository agent operating model and selected these relevant bundles:

- GitHub Diamond
- ResearchOps developer control
- Multi-functional team
- GOV.UK Design System
- Mural Public API, as a reference bundle only

## Design decision

The approved prototype uses the existing Project Dashboard model rather than adding new dashboard capabilities.

The migrated page keeps:

- project details
- project area links
- reflexive journal route
- Mural account and board state
- stakeholder management
- objectives
- user groups
- participants
- studies
- insights and outcomes

It deliberately removes invented concepts from earlier prototypes, including:

- Add a project note
- Setup checks
- generic dashboard metrics

## Implementation summary

Added `src/govuk/templates/pages/project-dashboard.njk` as the Nunjucks source page.

Updated `scripts/govuk/render-govuk-pages.mjs` so the Project Dashboard is rendered with the other GOV.UK Nunjucks pages.

Committed generated output at `public/pages/project-dashboard/index.html` so Cloudflare Pages preview serves the GOV.UK Frontend version directly from `public/`.

Added `src/styles/project-dashboard.scss` and generated `public/css/project-dashboard.css` for route-specific layout support only.

Updated `public/js/project-dashboard.js` so dynamic study list items render as GOV.UK-compatible list entries with:

- linked study title
- truncated description
- GOV.UK tag status

Added `public/components/project-dashboard-mural-state.js` to keep the visible GOV.UK status tags and separated Mural actions in sync with the existing Mural integration component.

## Reflexive journal and Mural model

The page now separates three user actions:

1. Open the ResearchOps reflexive journal.
2. Create a linked Mural board for visual journaling.
3. Open the linked Mural board once it exists.

The Mural board is presented as a visual support artefact. The ResearchOps journal remains the system record.

## Validation guardrails

Updated `tests/project-dashboard-route-state.test.js` to guard that the page:

- uses GOV.UK Frontend CSS
- uses the Nunjucks source template
- keeps shared `x-include` header and footer chrome
- does not load the legacy clone CSS stack
- keeps required dashboard DOM hooks
- keeps the Mural integration hook
- keeps the separated journal and Mural actions
- does not contain invented Add a project note or Setup checks content
- keeps route CSS limited to Project Dashboard support rules

## Risk notes

The migration preserves existing API and progressive-enhancement responsibilities.

The renderer now includes Project Dashboard directly. Any future page added to the Nunjucks system should follow the same source-and-generated-output contract.
