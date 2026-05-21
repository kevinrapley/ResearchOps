# Templates

This directory is included in the eval output to show where repository-local templates can be stored after instantiation.

The directory is not a replacement for the bundle template registry. It is the generated repository's own template surface for local issue, pull request, decision or documentation patterns.

## Expected use

Use this directory for templates that are specific to the generated repository.

Examples include:

- local decision record templates
- service runbook templates
- release note templates
- support handover templates
- project-specific evidence templates

## Boundary

Do not copy the entire bundle into this directory.

Do not treat local templates as authoritative bundle source.

If a template belongs to the reusable GitHub Diamond bundle, it should remain in the bundle template registry. If a template belongs only to the generated repository, it can live here.

## Agent responsibility

An agent should only add templates here when the repository has a repeated local need.

The agent should explain why the local template is needed, where it is used, and whether it is linked to any conformance or evidence record.
