# Empty Node seed fixture

This repository is a seed fixture for GitHub Diamond bundle evals.

It represents the smallest useful Node repository that an agent can inspect before selecting repository templates, CI workflows and governance artefacts.

## Fixture role

This is input material, not expected generated output.

The fixture deliberately contains only a package manifest and this README. It should cause the agent to detect a Node project and then decide which repository controls should be generated.

## Expected agent interpretation

The agent should detect:

- Node project signal from `package.json`
- no existing GitHub workflows
- no existing CODEOWNERS file
- no conformance matrix
- no gap register
- no agent evidence file

The correct mode for an instantiation eval is `repo-instantiate`.

## Expected follow-on output

A completed eval output should add repository documentation, CI, ownership routing, settings evidence, conformance evidence and a gap register. Those completed artefacts belong in `examples/eval-outputs/`, not in this seed fixture.
