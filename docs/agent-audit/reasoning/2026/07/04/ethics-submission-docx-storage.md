# Ethics Submission DOCX Storage

## Context

- Branch: `feature/ethics-submission-docx-storage`
- Base: `origin/main` after PR #468 was merged.
- Task: prepare the completed ethics submission workflow to generate a Word document from saved ResearchOps data, store the generated copy in Cloudflare storage, and keep document metadata in the database.

## Operating Model

- Loaded repository bootstrap: `AGENTS.md`, `.agent-operating-model/orchestration.xml`, `.agent-operating-model/bundle-registry.json`, `.agent-operating-model/task-signal-catalog.json`, `.agent-operating-model/selection-rules.json`, `.agent-operating-model/precedence-policy.md`, `.agent-operating-model/github-mutation-policy.md`.
- Selected bundles:
  - `.agent-operating-model/bundles/github/`
  - `.agent-operating-model/bundles/researchops-developer-control/`
  - `.agent-operating-model/bundles/multi-functional-team/`
  - `.agent-operating-model/bundles/govuk-design-system/`
  - `.agent-operating-model/bundles/cloudflare/`
- Verified each selected bundle has `prompt.spec.yaml` and `prompt.body.xml`.
- Branch trace required because the branch starts with `feature/`.

## Implementation

- Kept the previously merged ethics risk next-steps workflow intact and layered document generation onto the final full ethics submission action.
- Added checked-in copies of the supplied `Research_Ethics_approval_form_v3.docx` template for sourcebook assets and public preview assets.
- Added a Cloudflare R2 binding named `RESEARCHOPS_DOCUMENTS_R2`.
- Added D1 migration `0026_ethics_submission_documents.sql` for generated ethics submission document metadata and route permissions.
- Added `infra/cloudflare/src/service/ethics-submission-documents.js` to generate a completed DOCX from the checked-in template, write the generated file to R2 and store metadata, submission snapshot, risk outcome and Sourcebook clause context in D1.
- Added Worker routes:
  - `POST /api/study-ethics-risk/submissions`
  - `GET /api/study-ethics-risk/submissions/:id`
- Updated the full ethics submission submit action so the page calls the Worker endpoint and only marks the version submitted after the generated Word document is saved.
- Added a visible status message for document generation success or failure.
- Tightened the ethics next-steps outcome panel text so body, trigger and tag text render consistently small.

## Design And Storage Note

- The supplied Word template does not contain structured content controls. The safe implementation keeps the original template intact and appends a generated `ResearchOps completed submission` section with project, study, risk, Sourcebook and submission-section data.
- A future template revision can add content controls if the ethics board requires exact in-place population of named fields.

## Validation

- `node tests/study-ethics-risk-route-state.test.js` passed.
- `node tests/study-child-route-state.test.js` passed.
- `node tests/study-ethics-submission-documents-runtime.test.js` passed.
- `npm run generated-css:check` passed.
- `git diff --check` passed.
- `npm run lint` passed with existing repository warnings only.
- Playwright using system Edge against `https://research-operations/pages/study/ethics-risk/next-steps/?id=rect3o7dt&project=recgdpwEI5hFO7bUZ` confirmed the synced preview loads `study-ethics-risk-next-steps-20260704-17`, the outcome panel summary, tag and trigger text render at `16px/20px`, and there is no horizontal overflow.

## Residual Risk

- Production deployment requires the `RESEARCHOPS_DOCUMENTS_R2` bucket binding to exist in the Cloudflare environment.
- Ethics advice and extra-control route progress still need a production-backed persistence follow-up; this change adds storage for completed full ethics submission documents.
