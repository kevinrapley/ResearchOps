# Agent trace: Sourcebook deploy guard fix and templates

Date: 2026-05-11

Branch: `fix/sourcebook-index-guard-and-templates`

Pull request: #234

## Note

Retrospective trace created from commit evidence after merge. No live `[reasoning]` session was captured for this PR.

## Request interpreted

Two specific gaps were identified and fixed:

1. The `deploy-sourcebook.yml` workflow ran the `Ensure site has an index` guard step *after* the Cloudflare Pages publish step. Any fallback index file created by the guard would not be included in the deployment. The guard needed to run before publish.
2. The `docs/devops/sourcebook/templates/` directory had no files. All template links from Sourcebook pillar pages were broken 404s.

## Evidence checked

Repository files checked from commit evidence:

- `.github/workflows/deploy-sourcebook.yml`
- `docs/devops/sourcebook/` (pillar pages and existing template directory)

## Implementation applied

**Deploy guard fix:** The `Ensure site has an index` step in `deploy-sourcebook.yml` was moved before the Cloudflare Pages publish step.

**Templates directory populated** with 11 files:

| File | Format |
|---|---|
| `decision-log-template.md` | Markdown |
| `remote-research-setup-guide.md` | Markdown |
| `research-governance-roles-raci.md` | Markdown |
| `research-intake-form.docx` | Word |
| `research-maturity-self-assessment.md` | Markdown |
| `research-plan-template.docx` | Word |
| `research-roadmap-template.md` | Markdown |
| `research-shareback-patterns.md` | Markdown |
| `research-space-checklist.md` | Markdown |
| `researcher-wellbeing-risk-assessment.docx` | Word |
| `stakeholder-mapping-template.md` | Markdown |

Markdown templates are minimal starter scaffolds (579–894 bytes). `.docx` files are minimal valid Word documents verified to open and render.

## Key decisions

Full Sourcebook link inventory and a dedicated link validation script were deferred to a follow-up PR to keep this PR focused on the two known gaps.

The Sourcebook index page was not updated to surface the new templates section — also deferred.

## Commits recorded

```text
1d4ac27 Fix Sourcebook deploy guard and add templates
da88bea Merge pull request #234
```

## Validation recorded

- Deployment sequence confirmed correct: guard runs before publish
- `.docx` files verified to open and render

## Known gaps deferred

- Full Sourcebook link inventory and link validation script
- Sourcebook index page update to surface templates section

## Current status at trace write

PR #234 merged. Merge commit: `da88bea`.
