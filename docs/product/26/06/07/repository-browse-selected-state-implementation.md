# Repository browse selected-state implementation

Date: 2026-06-07  
Status: Implementation note  
Branch: `feature/repository-browse-selected-state`

## Purpose

This document records the implementation direction for repository browse pages after the team review of the user-group selected state.

The selected state must help users decide which artefacts are relevant, current and safe to reuse. It must not behave like an undifferentiated dump of every artefact tagged to a category.

## Routes affected

The generated repository browse routes use `src/govuk/data/repository-page.mjs` and `src/govuk/templates/pages/repository-static.njk`.

The primary reviewed route is:

```text
/pages/repository/user-groups/
```

The same selected-state structure is shared with:

```text
/pages/repository/service-areas/
/pages/repository/methods/
/pages/repository/risks/
```

## Page changes

The user-group route title is now:

```text
Browse by user group
```

The selected-state results heading is:

```text
Published artefacts
```

The page includes stable Nunjucks-owned structure for:

- browse options region
- selected-state summary
- sort control
- result count
- artefact results
- pagination
- route guidance
- publication boundary

JavaScript only hydrates dynamic values and result rows.

## Selected-state behaviour

When a user selects a group, the route uses a query-string state such as:

```text
/pages/repository/user-groups/?user_group=frontline-staff&page=1&limit=10&sort=reviewed_desc
```

The page shows:

```text
Showing artefacts tagged to: Frontline staff.
```

The selected option is visually marked and receives `aria-current="true"`.

The result count uses pagination language:

```text
Showing 1 to 10 of 38 published artefacts for Frontline staff.
```

## Result card model

Each artefact result is rendered as one `article` with:

- linked title
- short summary
- confidence
- evidence maturity
- method
- source context
- review state
- up to three meaningful topic or recommendation tags

The result card no longer relies on a flat run of tags to explain the artefact.

## API changes

The repository API response now includes:

```json
{
  "selected": {
    "type": "user_group",
    "typeLabel": "User group",
    "value": "frontline-staff",
    "label": "Frontline staff"
  },
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 38
  }
}
```

The API supports:

```text
page
limit
sort
```

Supported sort values are:

```text
reviewed_desc
confidence_desc
relevance
```

D1 applies the same publication boundary before returning results:

```text
status = 'published'
active = 1
pii_cleared = 1
consent_scope_confirmed = 1
```

## Taxonomy labels

Browse labels render in sentence case, for example:

- Frontline staff
- Assisted digital users
- Public users
- Researchers
- Research operations staff

This prevents slug-derived labels such as `Frontline Staff` from appearing in the user interface.

## Acceptance criteria

A user can select a user group and see an explicit selected state.

The page says `Published artefacts`, not `Published evidence`.

The selected-state result count uses `Showing x to y of z` language.

The page requests 10 results per page by default.

Pagination is shown when the selected result set is larger than the page size.

Each result card shows structured metadata, not only tags.

Seeded labels such as `Seeded topic 00` and `Seeded recommendation 072` do not appear in the result cards.

Generated CSS and rendered HTML remain build outputs and are not committed.
