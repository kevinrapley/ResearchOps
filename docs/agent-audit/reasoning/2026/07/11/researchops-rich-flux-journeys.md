# Capture click, touch, Tab, dwell time, character counts and corrections across ResearchOps without typed content.

Promotion status: promoted from validated raw trace.

Source trace: `.agent-traces/raw/atrace-20260711-132357-researchops-rich-flux-journeys.jsonl`.

Promoted at: 2026-07-11T13:25:11.225Z.

## Task summary

Capture click, touch, Tab, dwell time, character counts and corrections across ResearchOps without typed content.

## Run metadata

- Started: 2026-07-11T13:23:57.641Z
- Completed: 2026-07-11T13:23:57.644Z
- Event count: 15

## Bundles applied

- github-diamond
- researchops-developer-control
- multi-functional-team
- govuk-design-system

## Files read

None recorded.

## Files created or modified

- public/js/flux-researchops-tracker.js
- tests/flux-behaviour-tracker-route-state.test.js
- RECENT_LEARNINGS.md

## Validation attempted

- npm run build && npm test && npm run validate — exit 0

## Issues and pivots

None recorded.

## Validation warnings

None recorded.

## Event timeline

- - 2026-07-11T13:23:57.641Z — run.started
- - 2026-07-11T13:23:57.642Z — prompt.received: Capture click, touch, Tab, dwell time, character counts and corrections across ResearchOps without typed content.
- - 2026-07-11T13:23:57.642Z — bundle.applied: github-diamond
- - 2026-07-11T13:23:57.643Z — bundle.applied: researchops-developer-control
- - 2026-07-11T13:23:57.643Z — bundle.applied: multi-functional-team
- - 2026-07-11T13:23:57.643Z — bundle.applied: govuk-design-system
- - 2026-07-11T13:23:57.643Z — decision.recorded: Use explicit data-flux-key values where supplied and neutral structural element type/position keys otherwise, never labels, values, IDs or URLs.
- - 2026-07-11T13:23:57.643Z — file.write.planned: public/js/flux-researchops-tracker.js
- - 2026-07-11T13:23:57.643Z — file.write.completed: public/js/flux-researchops-tracker.js
- - 2026-07-11T13:23:57.644Z — file.write.planned: tests/flux-behaviour-tracker-route-state.test.js
- - 2026-07-11T13:23:57.644Z — file.write.completed: tests/flux-behaviour-tracker-route-state.test.js
- - 2026-07-11T13:23:57.644Z — file.write.planned: RECENT_LEARNINGS.md
- - 2026-07-11T13:23:57.644Z — file.write.completed: RECENT_LEARNINGS.md
- - 2026-07-11T13:23:57.644Z — command.completed: npm run build && npm test && npm run validate — exit 0
- - 2026-07-11T13:23:57.644Z — run.completed: Full ResearchOps validation passed after the tracker update.
