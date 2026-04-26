# Initial page load performance audit

Date: 2026-04-26
Branch: `perf/audit-initial-load`
Scope: ResearchOps public frontend and Cloudflare Worker asset behaviour.

## Summary

This audit focused on the highest-impact initial-load problems visible in the current codebase:

1. Large inline JavaScript on the Projects page.
2. Repeated uncached partial and component fetches.
3. Static assets on the public Pages site without explicit cache headers.
4. Module scripts that were not consistently marked as deferrable.
5. A global stylesheet that is shared across pages and should be split only after a route-by-route CSS usage audit.

The implemented changes prioritise safe load-time wins without changing the service routing model or the Airtable-first data path.

## Implemented changes

### 1. Extracted the Projects page inline module

The Projects page previously carried a large inline `type="module"` script inside `public/pages/projects/index.html`.

That code now lives in `public/js/projects-page.js`.

Why this helps:

- The HTML document is smaller.
- The browser can cache the Projects page behaviour separately from the HTML.
- The script can be preloaded using `rel="modulepreload"`.
- The page is easier to audit and test.

Additional benefit:

- Project data rendered into the DOM is escaped before interpolation.
- This reduces the risk of untrusted Airtable or CSV data being rendered as executable markup.

### 2. Added module preload for the Projects page script

`public/pages/projects/index.html` now preloads `/js/projects-page.js`.

Why this helps:

- The browser can discover the module earlier.
- The external module can be fetched before the parser reaches the script tag at the end of the body.

The module is still executed from the end of the body. This keeps DOM availability simple and avoids introducing a separate boot lifecycle.

### 3. Removed hard-coded API origin from the Projects page

The previous branch version added `data-api-origin="https://rops-api.digikev-kevin-rapley.workers.dev"` to the root HTML element.

That has been removed.

Why this helps:

- Local development, preview deployments, and future custom domains are not forced to call production by page markup.
- API origin resolution remains inside the JavaScript configuration path.
- The page is less coupled to a specific deployment target.

### 4. Added Cloudflare Pages cache headers

A new `public/_headers` file defines cache behaviour for the public Pages site.

HTML remains `no-store`.

Static assets use short edge/browser caching with stale revalidation:

- `/css/*`
- `/js/*`
- `/components/*`
- `/partials/*`
- common image formats
- font files

Why this helps:

- Repeat visits and cross-page navigation avoid refetching unchanged CSS, JavaScript, partials, components, images, and fonts.
- HTML remains fresh, which is safer while the prototype is changing frequently.

### 5. Improved partial/component caching in the Worker path

`infra/cloudflare/src/worker.js` now sets cache headers for static-looking asset paths served through the Worker.

`public/components/layout.js` also fetches normal partials using `force-cache` and keeps debug partials as `no-store`.

Why this helps:

- Header and footer partials are reused across many pages.
- Debug content remains fresh when explicitly requested.
- Normal includes can participate in browser caching.

### 6. Deferred shared layout module entry points

The homepage and shared HTML head partial now mark `/components/layout.js` as `defer`.

Why this helps:

- It makes the intended non-blocking behaviour explicit.
- It aligns shared entry points with the Projects page pattern.

## CSS audit finding

`public/css/screen.css` is still a large global stylesheet.

I did not split it in this change because the stylesheet contains shared rules for cards, project lists, dashboards, tables, forms, modals, Mural integration, study pages, skeleton states, accessibility helpers, and utilities.

Splitting it safely requires a route-by-route selector usage pass. Removing selectors without that pass risks breaking pages that are not covered by the current validation contract.

Recommended next step:

- Create page-level CSS bundles for the highest-traffic routes.
- Start with Projects, Project Dashboard, Study, and Guides.
- Keep `screen.css` as the base layer until each route has coverage.

## Asset compression finding

No new binary assets were added in this branch.

The audit did not identify a clear uncompressed image/font asset to optimise within the changed files.

Recommended next step:

- Add an asset inventory script that reports file size, extension, and likely optimisation opportunities.
- Fail CI only on very large new assets, not on existing legacy assets.

## Known remaining work

The codebase still contains other pages with large inline module scripts.

The highest-priority follow-up candidates are:

1. `public/pages/project-dashboard/index.html`
2. `public/pages/study/index.html`
3. `public/pages/study/guides/index.html`
4. `public/pages/study/session/index.html`
5. `public/pages/projects/journals/index.html`

Those should be extracted into route-specific modules in separate PRs. The dashboard page is large enough that a careful extraction should be treated as its own behavioural refactor, with route-state tests attached.

## Validation checklist

Before merging this branch:

- Run `npm run validate`.
- Run `npm run lint`.
- Open `/pages/projects/` and confirm the list loads from Airtable.
- Temporarily fail `/api/projects` and confirm the CSV fallback still renders.
- Open the browser network panel and verify repeat navigation uses cached `/components/layout.js`, `/partials/header.html`, `/partials/footer.html`, `/css/*`, and `/js/projects-page.js` where appropriate.

## PR recommendation

This branch is now suitable for a normal pull request focused on first-pass initial-load improvements.

The PR should not claim to complete full CSS splitting or complete inline-script extraction across the entire application.

Suggested PR title:

`Improve initial page load performance`

Suggested PR summary:

- Extract Projects page JavaScript into a cacheable module.
- Add module preload for the Projects route.
- Add Cloudflare Pages cache headers for static assets and partials.
- Improve include caching and avoid unnecessary script re-execution.
- Defer shared layout module loading on common entry points.
- Document remaining CSS and inline-script follow-up work.
