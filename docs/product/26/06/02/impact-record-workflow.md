# Impact record workflow

Date: 2026-06-02  
Status: production implementation branch  
Route: `/pages/projects/outcomes/`

## Purpose

Impact records connect research insight to decisions, measurable change and observed outcomes.

The workflow is designed to prevent vague impact claims. A useful record should answer:

- what changed;
- which decision or delivery artefact was influenced;
- what metric was used;
- what the baseline, target and actual values mean;
- when the actual value should be checked;
- whether the effect is planned, implemented or measured.

## User need

As a user researcher or product team member, I need to record the effect of research on service decisions and outcomes, so that research impact can be reviewed, evidenced and reused without relying on memory or anecdote.

## Data model

Impact records are stored in D1 in the `impact_records` table.

Core fields:

- `record_id`: stable internal identifier.
- `display_ref`: human-readable reference, for example `IMPCT-RCD-5f0907b5e5aa`.
- `project_id`: owning project route identifier.
- `study_id`: optional linked study identifier.
- `decision_link`: link to the decision, ticket, PRD, service decision record or other artefact.
- `metric_name`: the metric being tracked.
- `metric_unit`: the unit for baseline, target and actual.
- `metric_direction`: whether increase, decrease, range or non-directional movement is better.
- `baseline_value`: value before the research-informed change.
- `target_value`: expected value after the change.
- `actual_value`: observed value after the change.
- `measurement_window`: when the actual value should be checked.
- `impact_type`: category of change.
- `impact_scale`: reach of the change.
- `status`: lifecycle state.
- `notes`: caveats, assumptions and evidence notes.
- `created_at`, `updated_at`, `deleted_at`: audit lifecycle timestamps.

Deletion is a soft delete. Deleted records are excluded from normal list results.

## UI behaviour

The form uses GOV.UK Frontend macros from the Nunjucks source template.

The form uses appropriate affordances for expected content:

- read-only impact reference uses a short text input width;
- decision link uses URL input affordances;
- numeric values use short numeric input widths;
- single-choice fields use radio buttons;
- date captured through GOV.UK date input;
- notes use textarea.

A contextual guidance panel sits to the right of the form on wider screens. It updates when a user focuses a field. The panel explains how to make the current field useful for impact evidence. On smaller screens it stacks below the form content.

The table is not shown until at least one impact record exists. Before that, the page shows an empty-state paragraph.

## Table action pattern

The table remains focused on evidence and measurement. It does not add a separate Actions column.

Each impact record renders as two rows:

1. a data row containing the seven evidence columns;
2. an action row immediately after it.

The action row contains one cell with `colspan="7"`. That cell contains Edit and Delete controls for the record.

Delete is not immediate. Selecting Delete reveals an inline confirmation state in the action row. The destructive confirmation button uses the GOV.UK warning button style.

## API behaviour

Routes:

- `GET /api/impact?project=<project-id>` lists non-deleted impact records.
- `POST /api/impact` creates an impact record.
- `GET /api/impact/<record-id>` reads one impact record.
- `PATCH /api/impact/<record-id>` updates an impact record.
- `DELETE /api/impact/<record-id>` soft deletes an impact record.

The service creates the D1 table if it does not exist. The production migration is held in `infra/cloudflare/migrations/0010_impact_records.sql` and should be applied to the remote D1 database before relying on production traffic.

Manual apply command:

```sh
npx --yes wrangler@4.90.0 d1 execute researchops-d1 \
  --remote \
  --config infra/cloudflare/wrangler.toml \
  --file infra/cloudflare/migrations/0010_impact_records.sql
```

Post-apply check:

```sh
npx --yes wrangler@4.90.0 d1 execute researchops-d1 \
  --remote \
  --config infra/cloudflare/wrangler.toml \
  --command "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'impact_records';"
```

## Acceptance criteria

Given I open the outcomes page and there are no impact records, then I do not see an empty table.

Given I focus Baseline value, then the contextual guidance panel explains that baseline is the value before the research-informed change.

Given I focus Target value, then the contextual guidance panel explains that target is the expected value after the change.

Given I focus Actual value, then the contextual guidance panel explains that actual is the observed value after the change.

Given I save a valid impact record, then I see a full-width table containing the new record.

Given an impact record is shown in the table, then the data row is followed immediately by an action row.

Given the action row is rendered, then it contains one cell with `colspan="7"`.

Given I select Edit, then the record values load into the form and the submit button changes to Save changes.

Given I select Cancel edit, then the form resets to a new impact record.

Given I select Delete, then the row shows an inline confirmation state before the record is deleted.

Given I confirm deletion, then the record is soft deleted in D1 and removed from the table.

Given I create, update or delete an impact record, then the operation is persisted through the `/api/impact` API and not only changed in the browser.

## Privacy and governance

Do not put participant personal data in impact records.

Impact records should link to evidence or decision artefacts, not duplicate sensitive research material.

The metric model exists to reduce false precision. A record is weak if it has a metric name but no unit, direction, baseline or measurement window.
