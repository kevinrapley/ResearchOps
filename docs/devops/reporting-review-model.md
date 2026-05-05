# Reporting review model

The visual walkthrough reporting site separates review evidence into two levels.

## Group-level review evidence

Use group-level review evidence for the acceptance criteria and design-risk notes that apply to the whole journey area.

Examples:

- `start`: the full guided process for starting a research project.
- `participant-consent`: all states involved in consent capture and recovery.
- `analysis`: evidence loading, grouping, clustering, theme creation and blocked analysis states.

Group-level content should explain the whole ResearchOps user need, the expected GOV.UK Design System and accessibility behaviour, and the service risk being evaluated.

## State-level review evidence

Use state-level review evidence only for what is specific to that screen state.

State-level content must not duplicate the group-level acceptance criteria or design-risk notes. It should describe the scenario shown by the screenshot, such as a missing-context error, a participant-selected state, or a blocked theme-creation state.

## Status values

The supported review statuses are:

- `draft`
- `needs-review`
- `approved`
- `rejected`
- `superseded`

These statuses are deliberately repo-backed. They should be changed in `config/reporting-review-overrides.json`, reviewed through a PR, and then picked up by the next report generation.

## Manual editing approach

Do not make generated report HTML the source of truth.

Generated reports can expose review state and make it easier to identify weak criteria, but persistent edits should live in the repository. This keeps review history auditable, avoids browser-only changes being lost, and keeps the generated report reproducible.

The current source of truth for manual review overrides is:

```text
config/reporting-review-overrides.json
```

The utility module that normalises, merges and validates review content is:

```text
scripts/reporting-review-model.mjs
```

The model supports a generated base review model plus repo-backed overrides. Overrides can change titles, acceptance criteria, design-risk notes and statuses at either group or state level.

## Duplication rule

Group-level acceptance criteria and design-risk notes should not be copied into each state.

The validation utility flags:

- `duplicated-group-acceptance-criteria`
- `duplicated-group-design-risk-notes`
- `missing-group-acceptance-criteria`
- `missing-group-design-risk-notes`

This is intended to prevent the Start research project, Participant consent and Analysis sections from repeating the same evidence across every screenshot state.
