# Web app seed fixture

This repository is a seed fixture for public web and accessibility-critical evals.

It represents a minimal web application signal that an agent can inspect before selecting frontend, accessibility, documentation and ethics-related repository controls.

## Fixture role

This is input material, not expected generated output.

The fixture deliberately contains only a package manifest and this README. It should cause the agent to detect a web frontend and then decide which public-service, accessibility and evidence artefacts should be generated.

## Expected agent interpretation

The agent should detect:

- web application signal from `package.json`
- frontend build and test scripts
- no existing accessibility evidence
- no harm register
- no accessibility CI workflow
- no manual keyboard or screen-reader evidence
- no generated public form implementation

The correct mode depends on the eval prompt. For the `accessibility-critical-flow` eval, the agent should use a build mode with accessibility and ethics controls.

## Expected follow-on output

A completed accessibility-critical-flow output should include accessibility evidence, public form documentation, appropriate CI, harm-register evidence where relevant, and manual accessibility-test notes.

Those completed artefacts belong in generated eval output or expected-output examples, not in this seed fixture.
