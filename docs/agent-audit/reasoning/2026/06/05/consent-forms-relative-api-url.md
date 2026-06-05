# Consent Forms Relative API URL Trace

Date: 2026-06-05  
Branch: `fix/consent-forms-relative-api-url`  
Trace requirement: required because the branch uses the `fix/` prefix.

## Task

Investigate why the diary study consent forms were still not visible after PR #350 merged and D1 hydration completed.

## Findings

Production D1 and API proxy were healthy:

- `https://rops-api.digikev-kevin-rapley.workers.dev/api/consent-forms?study=rect3o7dt` returned the two hydrated consent forms.
- `https://researchops.pages.dev/api/consent-forms?study=rect3o7dt` also returned the two hydrated consent forms through the Pages API proxy.
- GitHub Actions showed `Apply D1 Diary Study Consent Forms Seed` completed successfully on `main`.

Browser inspection of `https://researchops.pages.dev/pages/study/consent-forms/?id=rect3o7dt` showed the page failing client-side with:

`TypeError: Failed to construct 'URL': Invalid URL`

The consent forms controller used `new URL(apiUrl("/api/consent-forms"))`. On Pages, `apiUrl` can return a relative `/api/...` path, so `new URL` requires `window.location.origin` as the base.

## Implementation

Updated `public/js/consent-forms-page.js` so `loadConsentForms` constructs the list URL with:

`new URL(apiUrl("/api/consent-forms"), window.location.origin)`

Updated `tests/consent-forms-route-state.test.js` to assert this Pages-proxy-safe URL construction.

## Validation

Passed:

- `node --test tests/consent-forms-route-state.test.js tests/consent-forms-d1-runtime.test.js`
- `node node_modules/prettier/bin/prettier.cjs --check public/js/consent-forms-page.js tests/consent-forms-route-state.test.js docs/agent-audit/reasoning/2026/06/05/consent-forms-relative-api-url.md docs/agent-audit/reasoning/2026/06/05/consent-forms-relative-api-url.json`
- `node scripts/agent-trace/assert-trace-coverage.mjs`
- `git diff --check`
- `node --test` with 176 passing tests
