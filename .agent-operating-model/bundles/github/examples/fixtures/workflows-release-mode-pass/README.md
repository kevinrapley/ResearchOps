# Release-mode workflow hardening pass fixture

This fixture proves that release-mode workflow hardening can pass when workflows use reviewed full-SHA action references and those references match `workflow-action-lock.yaml`.

## Fixture role

This is a workflow-hardening validator fixture.

It is not a generated repository output and it is not a normal starter repository. It exists to exercise `scripts/validate-workflow-hardening.py` in hardened release mode.

## Expected validator behaviour

The validator should inspect `.github/workflows/ci.yml`.

The validator should detect a first-party GitHub action pinned by a full 40-character SHA.

The validator should compare the workflow action pin with `workflow-action-lock.yaml`.

The validator should pass because the workflow pin and lock-file SHA match.

## Boundary

Do not replace the SHA pin with a tag such as `v4`.

Do not use placeholder SHA values such as all zeroes, all ones or all f characters.

Do not add unreviewed third-party actions to this pass fixture. Those belong in separate negative fixtures.
