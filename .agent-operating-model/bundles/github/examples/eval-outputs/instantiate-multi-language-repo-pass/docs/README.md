# Docs

This directory is a placeholder for repository documentation in the generated eval output.

It is included to show that the bundle creates a documentation surface as part of repository instantiation. A generated repository should not rely only on the root README when there are decisions, runbooks or service notes that need more space.

## Expected contents

A real repository may expand this directory with:

- architecture notes
- local development guidance
- release notes
- operations notes
- decision records
- conformance evidence
- accessibility evidence where relevant

## Eval interpretation

For this fixture, the directory demonstrates that documentation structure exists and can be extended.

The root README remains the primary entry point. This directory is the place for supporting material that should not crowd the root README.

## Agent responsibility

An agent should add documentation here when the evidence is too detailed for the root README or when a repository decision needs durable context.

Do not invent service-specific operational details. Record unknowns or deferred documentation in `gap-register.yaml`.
