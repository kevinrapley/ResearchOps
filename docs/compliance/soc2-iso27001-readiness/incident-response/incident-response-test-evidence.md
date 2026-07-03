# ResearchOps incident response test evidence

This record defines the incident response test evidence needed before ResearchOps can claim the incident process has been tested.

Exercise status: planned, not yet completed.

This document is not completed test evidence. It is the test plan and evidence structure. A completed test evidence record must be added after a tabletop or simulated incident has been run with the right Home Office service, security, privacy and technical roles.

## Exercise objective

Demonstrate that ResearchOps can:

- detect and triage a suspected security or privacy incident
- preserve useful evidence without spreading personal data
- contain the issue through the right technical and operational actions
- start the personal data breach handling process early
- involve service owner, information asset owner, security and privacy roles
- make and record notification decisions
- identify improvements and assign follow-up actions

## Minimum exercise scenario

Use this scenario for the first tabletop exercise:

A researcher reports that a participant consent artefact appears visible to a user who should only have access to another project. The artefact includes a participant identifier, contact detail and consent state. The same deployment also changed route-permission checks and audit-log behaviour.

The exercise should walk through:

1. how the report enters the incident route
2. how the team confirms the affected route and data class
3. how access is contained
4. how audit and deployment evidence is preserved
5. how the team decides whether this is a personal data breach
6. how the authorised route decides whether ICO notification is required
7. how affected-person notification would be considered
8. how the fix, tests, release evidence and lessons are captured

## Participants required

The first exercise should include, or explicitly record delegate coverage for:

- ResearchOps service owner
- information asset owner or agreed data owner route
- senior risk owner or delegated risk route
- security representative
- privacy representative or Data Protection Officer route
- technical maintainer
- ResearchOps practitioner who can explain the affected workflow

## Evidence to record after the exercise

Add a dated exercise outcome section with:

- exercise date and duration
- participants and roles
- scenario used
- key timeline decisions
- containment decision
- breach assessment decision
- ICO notification decision route
- affected-person notification decision route
- evidence retained
- controls that worked
- controls that failed or were unclear
- follow-up actions, owners and due dates
- sign-off decision

## Passing criteria

The exercise can be treated as passed only when:

- the team starts breach assessment before all facts are known
- the team identifies the likely personal data classes and affected people
- containment actions are proportionate and evidence-preserving
- the authorised privacy route owns the ICO and affected-person notification decisions
- decisions not to report, or reasons for delayed reporting, would be recorded
- follow-up actions have named owners
- the service owner and security representative accept the outcome

## Current gap

The process remains partially evidenced until the exercise is run and the dated outcome is added.
