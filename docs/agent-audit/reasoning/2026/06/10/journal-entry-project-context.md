# Journal entry project context trace

- Date: 2026-06-10
- Repository: `kevinrapley/ResearchOps`
- Branch: `fix/journal-entry-project-context`
- Pull request: #387
- Trace layer: operational

## Task summary

Preserve project context on the journal entry page so breadcrumbs and return links point back to the project-scoped Journal and analysis page. Refine the breadcrumb so the project crumb displays the project name, for example Test Project 1, instead of the generic text Project Dashboard. Remove the duplicate Back to Journal and analysis link above the entry heading.

## Operating model loaded

Loaded `AGENTS.md`, orchestration, bundle registry, task signal catalog, selection rules, bootstrap checklist, precedence policy, trace policy, trace layers, GitHub mutation policy and selected bundle specs/bodies.

## Bundles selected

- `github-diamond`
- `researchops-developer-control`
- `multi-functional-team`
- `govuk-design-system`
- `cloudflare`

## Files modified

- `public/js/journal-entry.js`
- `src/govuk/templates/pages/journal-entry.njk`
- `public/pages/journal/entry/index.html`
- `tests/journal-entry-page-route-state.test.js`

## Implementation summary

The entry route now resolves project context from route query parameters, the journal page referrer, session storage and the entry API payload. It stores the resolved project ID in session storage so refreshes keep the return-link context.

The project breadcrumb now hydrates from `/api/projects/:id` and replaces the generic Project Dashboard label with the project name when available. The standalone Back to Journal and analysis link was removed from the Nunjucks template and committed rendered HTML, leaving the breadcrumb and bottom return link as the navigation pattern.

The route-state test now asserts support for project query parameters, referrer-based recovery, session storage, project-scoped return links, project-name breadcrumb hydration and removal of the duplicate back link.

## Validation status

CI polling required after latest commits.
