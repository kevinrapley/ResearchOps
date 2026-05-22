# SBOM non-empty fixture

This fixture exists to prove that SBOM generation can produce a non-empty CycloneDX document.

It is deliberately small. The important signal is that the fixture contains a package lock with at least one dependency, licence metadata and enough package information for `scripts/generate-sbom.py` and `scripts/validate-sbom.py` to verify a non-empty SBOM.

## Fixture role

This is an SBOM validator fixture, not a generated repository output.

The release gate uses this fixture to check that SBOM generation can detect package-lock dependencies and that validation can require at least one component, purl evidence, dependency relationships, licence metadata and tool metadata.

## Expected validator behaviour

The validator should generate an SBOM from this directory.

The generated SBOM should contain at least one component.

The generated SBOM should include dependency information.

The generated SBOM should include licence metadata for the fixture dependency.

## Boundary

The dependency data is fixture-safe and synthetic.

Do not treat the dependency choice as a recommendation for production software.

Do not add private package names, private registry URLs, internal tokens or real project dependency data to this fixture.
