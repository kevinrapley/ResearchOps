# Security

This fixture shows the security guidance expected in a generated repository.

It is not a live disclosure process. It is example content used by the eval output to show that a generated repository includes a clear security posture.

## Reporting concerns

Do not report sensitive concerns through public issues.

Use the repository owner's private reporting route where one exists. If the repository has no private reporting route yet, record that as a gap in `gap-register.yaml` and do not publish sensitive technical detail in public discussion.

## Dependency and workflow checks

This repository includes dependency review and CodeQL workflow examples.

A generated repository should not treat those workflows as decorative. They are part of the expected quality gate set for this fixture.

## Secret handling

Do not commit tokens, keys, deploy hooks or credentials.

Use repository or organisation secret storage for sensitive configuration.

If a workflow needs a secret, document the secret name and where it must be configured. Do not include the value.

## Evidence expectations

Security-related claims should be represented in `agent-evidence.yaml` and, where relevant, in `conformance-matrix.yaml`.

If a security control is intentionally deferred, record the reason and owner in `gap-register.yaml`.

## Release posture

This fixture is an eval output. It does not prove live repository security settings. A real repository still needs live settings verification before release or production use.
