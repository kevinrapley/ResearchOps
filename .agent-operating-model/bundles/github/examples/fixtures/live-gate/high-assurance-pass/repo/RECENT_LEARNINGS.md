# Recent Learnings

This file records fixture-specific lessons for the high-assurance live-gate positive case.

## 2026-05-21 — Positive live-gate fixture must remain complete

The positive fixture is intentionally complete for the high-assurance release profile.

It should include workflow lock evidence, trusted SBOM attestation evidence, external attestation verification evidence, accessibility evidence, performance evidence, repository evidence and workflow evidence.

Do not remove an evidence file from this fixture to create a new failure case. Use a separate `negative-*` fixture instead.

## 2026-05-21 — Negative fixtures should isolate one blocker

Each negative live-gate fixture should fail for one primary reason.

That makes validator failures easier to diagnose and prevents one broken fixture from hiding several unrelated assurance gaps.

## 2026-05-21 — Fixture evidence is not live infrastructure

This fixture uses local files to represent high-assurance evidence.

It does not prove production branch protection, deployment policy, real-world attestation verification or live repository permissions. A real release gate must still observe live GitHub API state where the selected profile requires it.
