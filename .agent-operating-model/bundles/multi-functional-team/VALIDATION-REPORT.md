# Validation Report — Multi-Functional Team Bundle v1.0.0

Validation status: passed with known evaluation-depth gaps.

Last checked: 2026-05-11.

## Scope

This bundle governs multi-disciplinary government service assurance. It frames product, delivery, design, research, technical, policy, ethics, risk, harm and governance considerations.

It sits above implementation convenience rules when public-sector risk, vulnerable users, service assurance or ethical escalation are relevant.

## Entrypoints checked

Checked entrypoints:

- `README.md`
- `CHANGELOG.md`
- `prompt.spec.yaml`
- `prompt.body.xml`
- `evals.yaml`
- `tests.regression.yaml`
- `tests.redteam.yaml`
- `variables.schema.json`
- `output.schema.json`
- `grade.schema.json`
- `registry-manifest.yaml`

## Structural checks

The bundle has a substantial prompt body and explicit evaluation orchestration.

It includes governance, assurance and role-based operating doctrine suitable for UK government product work.

The bundle is registered as a canonical always-loaded bundle in the repository operating model.

## Evaluation coverage

The eval file defines default, developer and debate pipelines.

Regression and red-team files are present.

The existing coverage is structurally valid, but government assurance behaviour needs more scenario depth than simple file presence can prove.

## Known gaps

The main gap is behavioural depth.

Future red-team expansion should include safeguarding, vulnerable users, high-stakes eligibility, accessibility conflict, delivery pressure, procurement pressure and prompt-versus-governance conflict scenarios.

## Result

The bundle is suitable for current ResearchOps assurance use, with scenario-depth expansion queued as item 5.
