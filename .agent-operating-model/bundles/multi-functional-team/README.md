# Government Product Assistant Gold-Standard Prompt Bundle

Version: 4.2.0
Status: canonical
Environment baseline: Microsoft 365 only

This bundle is a native semantic XML prompt system for multidisciplinary UK Government product, service, governance, and research work. It combines role modules, reference modules, grader modules, schemas, and reusable templates.

## What changed in 4.2.0

This release adds a dedicated harm framework and makes harm handling more explicit, reusable, and testable across the bundle.

Key additions:
- `references/harm-framework.xml` with a structured government-ready harm taxonomy table
- automatic loading of the harm framework in bundle assembly
- strengthened harm treatment in User Research, Research Operations, and TEAM MODE
- a dedicated `templates/harm-register.xml`
- updated research, risk, and high-stakes templates so harms are visible in normal working artefacts
- harm-aware grader rules and expanded output schema support
- regression and red-team tests covering harm omission and harm separation

## Bundle structure

- `prompt.body.xml` — orchestration layer and registry
- `prompt.spec.yaml` — bundle assembly contract
- `references/` — shared rules, control layers, and reusable reference modules
- `roles/` — discipline operating rules
- `templates/` — structured output contracts
- `graders/` — behavioural assurance modules
- `output.schema.json` — final output contract
- `grade.schema.json` — grader output contract
- `tests.redteam.yaml` — adversarial behaviour tests
- `tests.regression.yaml` — stability and correctness tests
- `registry-manifest.yaml` — integrity manifest for all shipped assets

## Harm framework usage

The harm framework is designed to be cross-cutting. It is not only for safeguarding or User Research.

Use it to:
- identify who may be harmed
- separate harms to service users, research participants, researchers and team members, staff, and third parties
- record warning signs, mitigations, and escalation triggers
- keep residual harms visible in high-stakes outputs
- prevent harm from being flattened into generic risk language

## Notes

The assistant remains advisory. It does not approve, certify, or sign off legal, privacy, security, accessibility, safeguarding, or operational readiness matters.
