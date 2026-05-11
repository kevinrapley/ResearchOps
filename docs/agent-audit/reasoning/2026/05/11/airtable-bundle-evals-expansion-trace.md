# Agent trace: Airtable bundle evals expansion

Date: 2026-05-11

Branch: `claude/fetch-parallel-updates-ZbDQQ`

Pull request: #236

## Trigger

Agent task from live session. This trace records the implementation audit for PR #236.

## Request interpreted

Expand the `airtable-public-api/evals.yaml` file from its current pipeline-and-coverage structure into a full evaluation file with named behaviour evaluations, matching the quality standard introduced in the openai-platform and mcp-agent-tooling bundles.

Required outcomes:

- add a `behaviouralEvals` section with named evaluations, one per `required_behaviour` in `coverage_expectations`
- each eval carries `expectedEvidence` (`matched-rule`, `matched-signal`, `selected-bundle`, `canonical-directory`) and typed `forbiddenFailureModes`
- correct stale `coverage_expectations` counts (18/12 to 20/14) to match the committed test suite
- bump bundle version from 1.0.1 to 1.1.0 across all bundle metadata files

## Evidence checked

Repository files read:

- `.agent-operating-model/bundles/airtable-public-api/evals.yaml`
- `.agent-operating-model/bundles/airtable-public-api/tests.regression.yaml` (20 cases confirmed)
- `.agent-operating-model/bundles/airtable-public-api/tests.redteam.yaml` (14 cases confirmed)
- `.agent-operating-model/bundles/airtable-public-api/registry-manifest.yaml`
- `.agent-operating-model/bundles/airtable-public-api/prompt.spec.yaml`
- `.agent-operating-model/bundles/airtable-public-api/prompt.body.xml`
- `.agent-operating-model/bundles/airtable-public-api/CHANGELOG.md`
- `.agent-operating-model/bundles/airtable-public-api/grade.schema.json`
- `.agent-operating-model/bundles/mcp-agent-tooling/evals.yaml` (reference for mature pattern)
- `.agent-operating-model/behavioural-evals.json` (confirmed `behaviour-structured-rule-application` already references airtable bundle)
- `tests/airtable-bundle-health.test.js`

The CHANGELOG confirmed v1.0.1 was set earlier the same day when evals.yaml was first expanded from a bare suite pointer to its pipeline structure.

## Findings

The `evals.yaml` file had three evaluation pipelines, a `coverage_expectations` block, and a `schema_policy` block — but no named `behaviouralEvals` section.

The `behavioural-evals.json` `behaviour-structured-rule-application` eval already cited `airtable-public-api` as an expected bundle, creating an inbound reference with no corresponding outbound declaration in the airtable bundle itself.

`coverage_expectations` counts were stale: `minimum_regression_cases: 18` but the committed regression suite had 20 cases; `minimum_redteam_cases: 12` but the committed redteam suite had 14 cases.

The `prompt.body.xml` root element still declared `version="1.0.1"` after `prompt.spec.yaml` and `registry-manifest.yaml` were bumped by the day's earlier work, creating a version skew.

## Implementation applied

**behaviouralEvals section added** with 7 named evaluations:

| Eval ID | Behaviour | Key forbidden failure modes |
|---|---|---|
| `behaviour-airtable-endpoint-resolution` | Exact endpoint family, method, scope before implementation | `invented-endpoint`, `missing-scope` |
| `behaviour-airtable-narrowest-scope` | Narrowest viable OAuth scopes only | `all-scopes-overclaim`, `superficial-keyword-only` |
| `behaviour-airtable-pagination-batching` | offset/pageSize ≤ 100, write batches ≤ 10 | `skip-pagination`, `unbounded-write-batch` |
| `behaviour-airtable-webhook-mac` | HMAC-SHA256 MAC + `getWebhookPayloads` required | `skip-mac-verification`, `treat-notification-as-payload` |
| `behaviour-airtable-schema-write-safety` | `getBaseSchema` read gates schema mutation | `schema-write-without-read` |
| `behaviour-airtable-enterprise-boundary` | Refuses Enterprise/eDiscovery endpoint invention | `enterprise-overclaim`, `generated-undocumented-endpoint` |
| `behaviour-airtable-token-safety` | Refuses client-side PAT exposure | `client-side-token-exposure`, `hardcoded-pat` |

**Coverage counts corrected:** `minimum_regression_cases: 18 → 20`, `minimum_redteam_cases: 12 → 14`.

**Version bumped to 1.1.0** across `evals.yaml`, `prompt.spec.yaml`, `registry-manifest.yaml`, and `prompt.body.xml` root element.

**`.gitignore` updated:** `artifacts/` added so CI-generated security audit outputs do not appear as untracked files.

## CI failures resolved

After the initial commit, three CI checks failed on PR #236:

- **Node 20 / Node 22:** `tests/airtable-bundle-health.test.js` was asserting the old minimum counts (18/12) against the evals.yaml that now declared 20/14. Four assertions updated. All 4 health tests pass locally.
- **Release gate:** downstream of the Node test failures; cleared after fix.

This was identified and fixed in the same session before merge.

## Codex reviews addressed

Two Codex review comments were left on PR #236:

- **P1** — Keep Airtable bundle health tests aligned. Valid. Fixed in commit `3a31def`.
- **P2** — Bump the root prompt version too. Valid. Fixed in commit `3a31def`.

Replies with 👍 posted to both review threads confirming the fix.

## Commits recorded

```text
344cfa4 Expand airtable-public-api evals to v1.1.0 with named behaviour evaluations
3a31def Fix airtable bundle test assertions and prompt.body.xml version for v1.1.0
6541c35 Add artifacts/ to .gitignore
```

## Validation recorded

- All 4 `airtable-bundle-health` tests pass locally
- Cloudflare Pages deploy succeeded
- PR #236 merged with all CI checks green

## Current status at trace write

PR #236 merged. Merge commit: `6541c35`.
