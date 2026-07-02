# Sourcebook deploy heredoc fix trace

Date: 2026-07-02
Branch: `fix/sourcebook-deploy-heredoc`
Trace requirement: required by `fix/` branch prefix.

## Task

Fix the Sourcebook Cloudflare Pages deployment failure reported from GitHub Actions. The attached runner log showed the `Deploy Sourcebook to Cloudflare Pages` workflow failing in the fallback index step before Cloudflare Pages publish started.

## Operating model

Loaded repository operating-model sources:

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/github-mutation-policy.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`

Selected bundles:

- `github-diamond` at `.agent-operating-model/bundles/github/`
- `researchops-developer-control` at `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` at `.agent-operating-model/bundles/multi-functional-team/`
- `cloudflare` at `.agent-operating-model/bundles/cloudflare/`

Skipped conditional bundles: `govuk-design-system`, `openai-platform`, `mcp-agent-tooling`, `airtable-public-api`, `mural-public-api`.

Precedence: GitHub Diamond governs repository safety, branch hygiene, PR discipline and CI evidence. ResearchOps Developer Control governs repository conventions. Multi-Functional Team governs service assurance framing. Cloudflare governs Pages deployment behaviour.

## Evidence

- Attached GitHub Actions log: `Deploy Sourcebook to Cloudflare Pages` ran on `main` at `9bbd5eceb43e002f99b3eb479e20db280e8d2faa`.
- The failing shell step printed an indented heredoc terminator `HTML`.
- Bash reported: `here-document at line 2 delimited by end-of-file (wanted 'HTML')` and `syntax error: unexpected end of file`.
- `.github/workflows/deploy-sourcebook.yml` contained `cat > docs/devops/sourcebook/index.html <<'HTML'` inside a YAML `run: |` block with the `HTML` terminator indented.

## Changes made

- Replaced the workflow heredoc with a small grouped `printf` block so the fallback `index.html` can be written without heredoc indentation sensitivity.
- Added `.github/workflows/deploy-sourcebook.yml` to the workflow path filter so changing the deploy workflow can trigger a Sourcebook deploy on merge.
- Extended `tests/cloudflare-pages-output-dir.test.js` to assert:
  - the Sourcebook workflow still targets the `reops-sourcebook` Pages project
  - the workflow publishes `./docs/devops/sourcebook`
  - the workflow runs when its own deploy rules change
  - the fallback index step runs before `cloudflare/pages-action@v1`
  - the fallback guard does not use the failed heredoc pattern
  - the fallback guard writes the expected doctype line with `printf`

## Validation

Passed:

- `node --test tests/cloudflare-pages-output-dir.test.js`
- `npm run format -c`
- `npm run trace:coverage`
- `git diff --check`
- `npm run validate`

## Residual risk

The attached failing run was on `main`; this fix is delivered through a follow-up PR rather than by pushing directly to `main`.
