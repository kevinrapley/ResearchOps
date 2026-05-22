# Security

This fixture represents the security evidence expected by the high-assurance live release gate.

It is not a live disclosure process. It is a local assurance fixture used to prove that the bundle can distinguish complete high-assurance evidence from incomplete or weakened release evidence.

## Fixture security posture

The positive fixture includes security-facing evidence such as dependency review, CodeQL workflow coverage, workflow hardening, SBOM evidence and attestation evidence.

The fixture also contains trusted attestation verification evidence. That is important because high-assurance release mode should not treat declared attestation metadata as equivalent to external verification evidence.

## Sensitive information rule

Do not add real secrets, tokens, deploy hooks, private keys or production endpoints to this fixture.

All values must remain fixture-safe and non-sensitive.

## Expected validator behaviour

The positive fixture should pass when all required evidence files are present and structurally valid.

Negative fixtures should fail when a high-assurance security control is missing, placeholder-only, offline-only or not externally verified.

## Review note

If this fixture is changed, review the matching negative fixtures so each failure case still proves one specific blocker.
