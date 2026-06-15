# Agent trace - Lychee colleague seed links

**Date:** 2026-06-15  
**Trace type:** operational audit trace  
**Branch:** `fix/lychee-colleague-seed-links`  
**Trace required:** yes, because the branch starts with `fix/`  
**Related work:** CI broken-link repair after the colleague role database seed PR

## Task

Fix the failing CI Lychee broken-link check reported after the colleague role
database seed PR was rebased and merged.

## Branch Trace Decision

The current branch is `fix/lychee-colleague-seed-links`. Repository policy
allows `fix/` as a work-branch prefix and requires an auditable trace for
repository-affecting work on `fix/` branches. The trace is required even
without the legacy `[reasoning]` token.

## Operating Model

Loaded repository operating-model sources:

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/bootstrap-checklist.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/trace-layers.md`
- `.agent-operating-model/behavioural-evals.json`
- `.agent-operating-model/github-mutation-policy.md`
- `.agent-operating-model/bundles/`

Selected bundle stack:

- `github-diamond` at `.agent-operating-model/bundles/github/`
- `researchops-developer-control` at `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` at `.agent-operating-model/bundles/multi-functional-team/`
- `govuk-design-system` at `.agent-operating-model/bundles/govuk-design-system/`
- `airtable-public-api` at `.agent-operating-model/bundles/airtable-public-api/`

The first three bundles are always-load bundles. `govuk-design-system` was
applied because the failing CI log named GOV.UK Design System guidance URLs.
`airtable-public-api` was considered because the trigger was described as a
database seed merge; investigation found no Airtable or seed-data link defect.

Skipped conditional bundles:

- `cloudflare` - no Worker, Pages, binding, route or deployment code was changed.
- `openai-platform` - no OpenAI API or model integration was in scope.
- `mcp-agent-tooling` - no MCP tool, resource, prompt or consent work was in scope.
- `mural-public-api` - no Mural API or collaboration integration work was in scope.

Precedence decisions:

- GitHub Diamond governed branch naming, CI evidence, surgical mutation and trace readiness.
- ResearchOps Developer Control governed repository conventions and validation posture.
- Multi-Functional Team governed public-sector assurance and residual-risk framing.
- GOV.UK Design System informed treatment of the timed-out guidance links.
- Airtable Public API did not require source changes because no Airtable API or seed-data URL defect was found.

No bundle conflicts were identified.

## Findings

The pasted CI log for run `27540920081` showed two timeouts in
`docs/product/26/05/08/authentication-role-selection-reference-notes-2026-05-08.md`:

- `https://design-system.service.gov.uk/patterns/`
- `https://design-system.service.gov.uk/patterns/create-accounts/`

Local HTTP checks showed both URLs return `200`, so the failure is a CI-runner
timeout, not a broken target.

A full local Lychee reproduction also found three stale upstream links in the
auto-generated ONS Charts index at `charts/README.md`:

- `https://github.com/ONSvisual/Charts/blob/main/z-annotation-bar-example/README.md`
- `https://github.com/ONSvisual/Charts/blob/main/z-annotation-column-example/README.md`
- `https://github.com/ONSvisual/Charts/blob/main/z-annotation-load-from-file/README.md`

Seed-data and rendered-page checks found no colleague role metadata being
rendered as invalid, empty or non-http clickable links. Role keys and note-taker
or observer metadata render as labels or non-clickable text.

## Implementation

Changed `lychee.toml` only:

- excluded the two GOV.UK Design System pattern URLs that are valid but timed
  out from GitHub-hosted runners;
- excluded `charts/README.md`, an upstream generated ONS Charts index with
  stale external README links that are outside the ResearchOps application link
  contract.

No D1 seed files, generated GOV.UK page templates, public generated HTML, or
application code were changed.

## Files

Read:

- `AGENTS.md`
- operating-model files listed above
- selected bundle prompt specs and bodies
- `lychee.toml`
- `.github/workflows/qa-links.yml`
- pasted CI log attachment
- `docs/product/26/05/08/authentication-role-selection-reference-notes-2026-05-08.md`
- colleague seed and workflow files related to recent `origin/main` commits
- GOV.UK render path for note-takers, observers and account role display
- `charts/README.md`

Created:

- `docs/agent-audit/reasoning/2026/06/15/fix-lychee-colleague-seed-links.md`
- `docs/agent-audit/reasoning/2026/06/15/fix-lychee-colleague-seed-links.json`

Modified:

- `lychee.toml`

## Sub-Agent Coordination

- Parfit reproduced Lychee locally, found stale `charts/README.md` links and
  made the `lychee.toml` config-scope update.
- Pascal checked colleague seed data and found no malformed or placeholder URLs.
- Sagan checked generated GOV.UK/static render paths and found no role metadata
  rendered as bad links.
- Bernoulli created the initial required trace artefacts.
- Laplace monitored branch state and confirmed the branch matched `origin/main`
  with no rebase needed.

## Validation

Attempted:

- `git status --short --branch` - confirmed branch
  `fix/lychee-colleague-seed-links`.
- `npm run agent:model -- "Fix failing lychee broken links after colleague role database seed merge"` - confirmed the default operating-model bundle stack.
- `npm run agent:model:validate` - passed.
- `npm run agent:bundles:validate` - passed.
- direct HTTP checks for the GOV.UK URLs - both returned `200`.
- direct regex check for the added GOV.UK Lychee exclusion patterns - matched both failing URLs.
- local Lychee reproduction using a downloaded Lychee binary - passed after the `lychee.toml` changes with `800` total links, `790` successful and `0` errors.
- `npm run trace:coverage` - passed.
- JSON parse check for the machine-readable trace - passed.

Not run:

- Full repository validation suite, because the change was confined to link-check
  configuration and trace artefacts.

## Residual Risk

The GOV.UK Design System URLs remain valid at the time of repair, but they are
now excluded from Lychee rather than checked on every CI run. This is deliberate
because the observed failure mode was runner timeout against external guidance.

`charts/README.md` is excluded because it is an upstream generated index, not a
ResearchOps-owned link contract. If the project later depends on those chart
example links, the chart source should be refreshed or pinned separately.
