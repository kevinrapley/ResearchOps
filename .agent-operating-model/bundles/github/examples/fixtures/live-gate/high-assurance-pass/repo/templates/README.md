# Templates

This directory is part of the high-assurance live-gate passing fixture.

It represents the place where a live repository could keep repository-local templates that support release evidence, operational handover and assurance reporting.

## Fixture role

This directory is included to prove the repository has a local template surface.

It is not the bundle template registry. Reusable bundle templates remain in the GitHub Diamond bundle. Repository-local templates belong here only when they are specific to the generated or validated repository.

## Example local template uses

A real high-assurance repository might include templates for:

- release evidence notes
- rollback summaries
- accessibility review records
- performance review records
- incident handover notes
- support readiness notes
- assurance exception records

## Boundary

Do not copy the whole bundle into this directory.

Do not use local templates as a substitute for structured validation evidence.

The live gate should continue to rely on structured artefacts such as `agent-evidence.yaml`, `workflow-action-lock.yaml`, `accessibility-evidence.yaml`, `performance-results.yaml`, `sbom.json`, and attestation evidence.
