# Reporting review content recovery

This note records the evidence recovered from the generated visual walkthrough report before changing the reporting review model.

## Evidence source

The recovery source is the generated PDF export supplied during review:

```text
ResearchOps application visual walkthrough.pdf
Generated: 2026-05-05T17:41:16.070Z
Base URL: https://researchops.pages.dev/
Coverage: 20 pages, 37 states, 74 screenshots, 0 failures
```

The PDF contains the rendered reporting-site content, including route-level Gherkin acceptance criteria, state cards, design-risk notes and screenshot evidence. It should be treated as the recovery source for the current report state when the live reporting site is not accessible from automation or tooling.

## Recovery status

| Area | Gherkin recovered | Design-risk recovered | Notes |
| --- | --- | --- | --- |
| Home | Yes | Yes | Bespoke route-level criteria and design-risk notes are present in the default state. |
| Start research project | Yes | Yes | Full route-level criteria are present in the default state. The same design-risk note is repeated across step states. |
| Projects | Yes | Yes | Full route-level criteria and page-level design-risk notes are present. |
| Project dashboard | Yes | Yes | Criteria are generic and state-derived, but operational project context is present. |
| Add study | No route-level Gherkin visible in the recovered text | Yes | Design-risk note is present for parent-project context. |
| Add participant | Yes | Yes | Criteria are generic and state-derived. |
| Import participants | Yes | Yes | Criteria are generic and state-derived. |
| Project outcomes | Yes | Yes | Criteria are generic and state-derived. |
| Project journals | Yes | Yes | Criteria are generic and state-derived. |
| Study overview | Yes | Yes | Criteria are generic and state-derived. |
| Discussion guides | Yes | Yes | Criteria are generic and state-derived. |
| Participants | Yes | Yes | Criteria are generic and state-derived. |
| Study session | Yes | Yes | Criteria are generic and state-derived. |
| Study consent forms | Yes | Yes | Criteria are generic and state-derived. |
| Participant consent | Yes | Yes | Full route-level criteria are present in the loaded state. The same design-risk note is repeated across blocker and selected-participant states. |
| Search | Yes | Yes | Criteria are generic and state-derived. |
| Notes | Yes | Yes | Criteria are generic and state-derived. |
| Consent | Yes | Yes | Criteria are generic and state-derived. |
| Sessions | Yes | Yes | Criteria are generic and state-derived. |
| Study synthesis / Analysis | Yes | Yes | Full route-level criteria are present for the missing-study-ID state. The same design-risk note is repeated across the synthesis states. |

## Duplicated content observed

### Start research project

The recovered report places the full `Feature: Start a new research project` criteria in the default state. Later states then repeat the same design-risk note rather than supplying state-specific risk evaluation.

Repeated design-risk note:

```text
Design risk: The guided project setup could collect plausible project metadata without making privacy boundaries, required fields and AI-assistance disclosure clear enough.
Impact: Poor framing at project creation can create weak objectives, unsafe notes or project records that are difficult to use later.
Recommended change: Evaluate the journey against GOV.UK form, error-summary, hint, button and check-answers patterns before accepting the walkthrough state.
Owner: UCD team
Status: Needs UCD review
```

The group-level model should hold the journey-level criteria and this journey-level risk once. State-level records should only describe the relevant scenario, for example step 1 completed, AI rewrite shown, or check answers.

### Participant consent

The recovered report places the full `Feature: Record participant consent` criteria in the loaded consent workspace state. The same design-risk note is repeated across missing-context, no-published-consent-form, no-participants and participant-selected states.

Repeated design-risk note:

```text
Design risk: Participant consent screens may not separate setup blockers, participant selection and auditable consent recording clearly enough.
Impact: Research may proceed without clear, current and reviewable consent evidence.
Recommended change: Capture both blocker and ready states with deterministic study fixtures and review accessible status messaging.
Owner: UCD team
Status: Needs UCD review
```

The group-level model should hold the consent journey criteria and shared ethical risk once. State-level records should describe specific blockers and recovery paths.

### Study synthesis / Analysis

The recovered report places `Feature: Synthesize research evidence` criteria in the missing-study-ID state. The same design-risk note is repeated across empty evidence, evidence available, working cluster, evidence added, theme blocked and theme-created states.

Repeated design-risk note:

```text
Design risk: Synthesis states may make clusters and themes look authoritative before evidence quantity, provenance and confidence are clear.
Impact: Insights and recommendations could be accepted without sufficient traceability to source evidence.
Recommended change: Review evidence grouping, theme creation, disabled states, provenance details and GOV.UK component conformance.
Owner: UCD team
Status: Needs UCD review
```

The group-level model should hold synthesis journey criteria and shared evidence-integrity risk once. State-level records should focus on the particular analytical state: empty evidence, evidence loaded, working cluster, evidence added, blocked theme creation or theme created.

## Implementation implication

The reporting review model must not treat the generated report HTML as the source of truth for manual review decisions.

The corrected approach is:

1. Preserve recovered group-level Gherkin and design-risk content as the starting evidence.
2. Move repeated journey-level content to the group level.
3. Keep state-level content specific to the screenshot state.
4. Persist manual edits and status changes in the repository, not in generated HTML.
5. Render review statuses from repo-backed data so `Needs review`, `Approved`, `Rejected`, `Draft` and `Superseded` are controlled through PR review.
6. Validate that group-level content is not copied into state-level records.

## Reporting obligation for future iterations

When generating or changing the reporting model, the PR must state:

- whether live reporting-site content was fetched successfully;
- whether repository `reports-site` content was used as a fallback;
- whether an uploaded report export was used as recovery evidence;
- which sections were recovered exactly;
- which sections were rewritten or seeded;
- which tests were run.

This prevents the review model from drifting into plausible but unevidenced acceptance criteria or design-risk notes.