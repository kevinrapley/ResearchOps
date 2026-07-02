# Sourcebook Pages routing trace

Date: 2026-07-02
Branch: `feature/govuk-static-utility-pages`
Trace requirement: required by `feature/` branch prefix.

## Task

Point `https://reops-sourcebook.pages.dev/` at `docs/devops/sourcebook` instead of the root `public/` app output, and register `https://sourcebook.research-operations.com` for the same Sourcebook Pages project.

## Operating model

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

Selected bundles:

- `github-diamond` at `.agent-operating-model/bundles/github/`
- `researchops-developer-control` at `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` at `.agent-operating-model/bundles/multi-functional-team/`
- `cloudflare` at `.agent-operating-model/bundles/cloudflare/`

Skipped conditional bundles: `govuk-design-system`, `openai-platform`, `mcp-agent-tooling`, `airtable-public-api`, `mural-public-api`.

Precedence: repository and trace governance from `github-diamond`; ResearchOps deployable conventions from `researchops-developer-control`; operational safety from `multi-functional-team`; Cloudflare Pages and DNS implementation from `cloudflare`.

## Evidence

- Cloudflare project `reops-sourcebook` had `build_config.destination_dir = "public"` before the change.
- Live `https://reops-sourcebook.pages.dev/` returned the ResearchOps app home page before deployment.
- Local sourcebook content exists under `docs/devops/sourcebook`, including `index.html`.
- `.github/workflows/deploy-sourcebook.yml` publishes `./docs/devops/sourcebook` to the `reops-sourcebook` Pages project.
- A Git-connected deployment with `root_dir = docs/devops/sourcebook` failed because Cloudflare still read the root `wrangler.toml` and resolved `public` outside the repository.

## Changes made

Cloudflare:

- Updated Pages project `reops-sourcebook` build config to `root_dir = "docs/devops/sourcebook"` and `destination_dir = "."`.
- Added Pages custom domain record for `sourcebook.research-operations.com`; Cloudflare returned domain ID `89869820-3736-42d6-8313-cf5d8e46b289`, status `pending`.
- Deployed `docs/devops/sourcebook` directly with `wrangler@4.34.0`, creating deployment `466a217d-6867-43c2-926b-fd71a6150ca3`.

Repository:

- Added `docs/devops/sourcebook/wrangler.toml` so future sourcebook-root builds do not inherit the root app `wrangler.toml`.
- Updated `tests/cloudflare-pages-output-dir.test.js` to assert the sourcebook Pages config targets `reops-sourcebook` and deploys `.`.

## Validation

Passed:

- `npm run sourcebook:validate`
- `node --test tests/cloudflare-pages-output-dir.test.js`
- `curl https://reops-sourcebook.pages.dev/` returned `<title>Research Operations Sourcebook | Index</title>`.

Blocked:

- `sourcebook.research-operations.com` still does not resolve.
- Cloudflare Pages domain status is `pending` with `verification_data.error_message = "CNAME record not set"`.
- Attempts to create the required DNS CNAME through `/zones/{zone_id}/dns_records` returned Cloudflare `10000: Authentication error`; token verification also returned `1000: Invalid API Token`, although Pages API read/write calls succeeded.

## Residual risk

The Sourcebook Pages project is live on `reops-sourcebook.pages.dev`. The custom domain is attached to the Pages project but cannot become active until DNS contains a proxied CNAME from `sourcebook.research-operations.com` to `reops-sourcebook.pages.dev`.
