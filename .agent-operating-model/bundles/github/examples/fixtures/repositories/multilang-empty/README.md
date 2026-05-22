# Empty multi-language seed fixture

This repository is the seed input for the `instantiate-multi-language-repo` eval.

It represents a compact repository with Node and Python project signals but without generated governance, CI or evidence artefacts.

## Fixture role

This is input material, not expected generated output.

The agent should start from this repository, detect both languages, select the appropriate templates, and generate the completed repository state under `examples/eval-outputs/instantiate-multi-language-repo-pass/`.

## Expected agent interpretation

The agent should detect:

- Node project signal from `package.json`
- Python project signal from `pyproject.toml`
- no GitHub workflow directory
- no CODEOWNERS file
- no repository settings evidence
- no conformance matrix
- no gap register
- no agent evidence file

The correct mode is `repo-instantiate`.

## Expected template pressure

This fixture should cause the agent to consider:

- Node CI
- Python CI
- documentation quality checks
- conformance checks
- dependency review
- CodeQL
- CODEOWNERS
- README, CONTRIBUTING and SECURITY documentation
- GitHub settings evidence
- conformance and gap tracking

## Boundary

Do not add generated output artefacts to this fixture. Generated artefacts belong in `examples/eval-outputs/instantiate-multi-language-repo-pass/`.
