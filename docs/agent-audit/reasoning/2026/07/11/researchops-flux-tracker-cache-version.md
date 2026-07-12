# Verify rich tracker is live after merge and remediate stale cached asset.

Promotion status: promoted from validated raw trace.

Source trace: `.agent-traces/raw/atrace-20260711-133254-researchops-flux-tracker-cache-version.jsonl`.

Promoted at: 2026-07-11T13:33:01.056Z.

## Task summary

Verify rich tracker is live after merge and remediate stale cached asset.

## Run metadata

- Started: 2026-07-11T13:32:54.016Z
- Completed: 2026-07-11T13:32:54.020Z
- Event count: 15

## Bundles applied

- github-diamond
- researchops-developer-control
- multi-functional-team

## Files read

None recorded.

## Files created or modified

- public/js/flux-researchops-tracker.1.1.0.js
- public/partials/html-head.html
- tests/flux-behaviour-tracker-route-state.test.js

## Validation attempted

- node --test tests/flux-behaviour-tracker-route-state.test.js tests/govuk-page-chrome-navigation-route-state.test.js — exit 0

## Issues and pivots

- Production Pages deployment was active but the existing tracker URL served an older one-hour cached static asset.

## Validation warnings

None recorded.

## Event timeline

- - 2026-07-11T13:32:54.016Z — run.started
- - 2026-07-11T13:32:54.018Z — prompt.received: Verify rich tracker is live after merge and remediate stale cached asset.
- - 2026-07-11T13:32:54.018Z — bundle.applied: github-diamond
- - 2026-07-11T13:32:54.018Z — bundle.applied: researchops-developer-control
- - 2026-07-11T13:32:54.018Z — bundle.applied: multi-functional-team
- - 2026-07-11T13:32:54.019Z — issue.detected
- - 2026-07-11T13:32:54.019Z — decision.recorded: Version the self-hosted tracker filename and update the static shared head reference instead of weakening global JavaScript cache policy.
- - 2026-07-11T13:32:54.019Z — file.write.planned: public/js/flux-researchops-tracker.1.1.0.js
- - 2026-07-11T13:32:54.019Z — file.write.completed: public/js/flux-researchops-tracker.1.1.0.js
- - 2026-07-11T13:32:54.019Z — file.write.planned: public/partials/html-head.html
- - 2026-07-11T13:32:54.020Z — file.write.completed: public/partials/html-head.html
- - 2026-07-11T13:32:54.020Z — file.write.planned: tests/flux-behaviour-tracker-route-state.test.js
- - 2026-07-11T13:32:54.020Z — file.write.completed: tests/flux-behaviour-tracker-route-state.test.js
- - 2026-07-11T13:32:54.020Z — command.completed: node --test tests/flux-behaviour-tracker-route-state.test.js tests/govuk-page-chrome-navigation-route-state.test.js — exit 0
- - 2026-07-11T13:32:54.020Z — run.completed: Focused tracker regression tests passed.
