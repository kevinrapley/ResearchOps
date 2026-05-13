# Agent trace — Account dashboard second design iteration and DaaS correction

**Date:** 2026-05-13  
**Trace type:** operational audit trace  
**Branch:** `fix/account-auth-redirect-and-team-selection`  
**PR:** #250  
**Scope:** account dashboard design iteration, preview D1 correction for `kevin.rapley@research-operations.com`

## Evidence boundary

This trace records the observable work completed after the second account-dashboard review.

It does not expose private chain-of-thought.

## Trigger

The account dashboard successfully displayed teams and roles, but the design was still judged to be too system-led.

The review identified these issues:

- the page title was too wordy and product-like
- `Account summary` only contained one row
- single-team users still saw a `Current` tag
- users with no actions saw an empty actions section
- permissions were shown as primary page content
- `kevin.rapley@research-operations.com` was shown in `ResearchOps Core Team`, but should be in `DaaS`

## Team-role review applied

### GOV.UK Design System

Use task-appropriate components. Avoid tables or heavy components when the user only needs a simple account summary. Use details to hide supporting information that is not needed by most users.

### Interaction design

Reduce cognitive load. A single-team user should not see multi-team affordances or empty action areas.

### Content design

Use a direct page title: `Your ResearchOps account`. Avoid product-like greeting copy. Keep role labels separate from permission detail.

### Information architecture

Make identity, team membership, actions and permissions distinct layers of information. Do not present permission labels as the core account summary.

### Service design

ResearchOps Core Team Admin remains a distinct state with more functionality, but that does not require exposing all permissions as primary content.

## Implementation changes

### Account page HTML

Updated `public/pages/account/index.html`.

Changes:

- page H1 changed to `Your ResearchOps account`
- lead text changed to `Check your teams, roles and available actions.`
- removed the one-row `Account summary` heading
- kept `Signed in as` as a summary-list row under the lead text
- made `Actions you can take` hidden by default
- replaced primary `Current permissions` section with a hidden GOV.UK details component labelled `View permission details`
- cache-busted account page JavaScript to `account-dashboard-20260513-teams-v3`

### Account dashboard JavaScript

Updated `public/js/auth-account-page.js`.

Changes:

- single-team users no longer receive a `Current` tag
- `Actions you can take` is only shown when actions exist
- permission details are only shown for ResearchOps Core Team Admin users with permissions
- permissions remain separate from team-membership rendering
- removed the unused dynamic greeting title logic

### Preview D1 data correction

Added `infra/cloudflare/migrations/preview/0002_correct_research_operations_user_daas_team.sql`.

The correction:

- creates or reuses the active `DaaS` team
- activates `kevin.rapley@research-operations.com` as a member of `DaaS`
- assigns the `Observer` role in `DaaS`
- revokes the erroneous `Observer` role in `ResearchOps Core Team`
- removes the ResearchOps Core Team membership for that user where no active roles remain
- writes a preview data-correction audit event

### Preview deploy workflow

Updated `.github/workflows/deploy-worker.yml`.

The preview deploy job now applies the DaaS correction after the preview first-Team-Admin seed.

The production job does not apply this preview-only file.

## Tests and contracts updated

Updated `tests/auth-account-dashboard-route-state.test.js` to require:

- direct page title
- no one-row `Account summary` heading
- no single-team `Current` tag
- hidden actions section when no actions exist
- permission details behind a GOV.UK details component
- no table-based or summary-card-based account membership display

Updated `tests/auth-registration-requests-route-state.test.js` to require:

- preview-only DaaS correction file exists
- workflow applies it to preview D1
- production job does not apply it
- correction is scoped to `kevin.rapley@research-operations.com`
- `Observer` in `ResearchOps Core Team` is revoked for that preview user

## Product documentation added or updated

Updated:

- `docs/product/26/05/13/account-dashboard-adaptive-team-role-presentation.md`

Added:

- `docs/product/26/05/13/preview-daas-account-data-correction.md`

## Residual risk

The preview-only SQL correction has not been directly verified through an ad hoc D1 query in this chat because no Cloudflare D1 execution tool is available here.

It will be applied through the preview Worker deployment workflow and should be verified in the preview UI after the workflow completes.

## Expected preview result

When signed in as `kevin.rapley@research-operations.com`, the dashboard should show:

- team: `DaaS`
- role: `Observer`
- no actions section
- no permission details section

When signed in as the first Team Admin account, the dashboard should show:

- team: `ResearchOps Core Team`
- roles: `Safeguarding Lead, Team Admin`
- action buttons
- ResearchOps Core Team Admin explanatory inset
- `View permission details` as a details component
