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

## Follow-up changes completed after the initial audit

### Performance inventory tooling

`npm run audit:performance` and `npm run audit:performance:write` now provide a repeatable inventory for large files, inline scripts, rough gzip estimates, and possible unused CSS selector tokens.

Why this helps:

- Future route extraction and CSS splitting work can be based on measured file and script weight.
- CSS review starts from an evidence queue rather than manual guessing.

### Discussion Guides context extraction

The Discussion Guides route no longer carries its page-context bootstrap inline in `public/pages/study/guides/index.html`.

That code now lives in `public/js/study-guides-context.js` and is loaded with `rel="modulepreload"`.

Why this helps:

- The Guides HTML document is smaller and easier to review.
- The page-context bootstrap becomes independently cacheable.
- A route-state test now prevents the page from regressing to inline module scripts.

### Project Dashboard route extraction

Project Dashboard inline module has been extracted to:
`public/js/project-dashboard.js`

Why this helps:

- The dashboard HTML document is smaller.
- The dashboard route behaviour is independently cacheable.
- A route-state test prevents the page from regressing to inline module scripts.

### Study Session and Journals module preload coverage

The Study Session and Journals routes already use external route modules.

They now include `rel="modulepreload"` hints for their route controllers, and route-state tests enforce that these modules remain external and discoverable.

Why this helps:

- The browser can discover key route modules earlier.
- The routes align with the loading pattern used by Projects, Project Dashboard, and Guides.
- Validation now covers Session and Journals module loading contracts.

### Search route extraction

The Search route no longer carries its page controller inline in `public/pages/search/index.html`.

That code now lives in `public/js/search-page.js` and is loaded with `rel="modulepreload"`.

Why this helps:

- The Search HTML document is smaller.
- The page no longer relies on legacy page-relative imports for the SDK and shared helpers.
- A route-state test prevents the page from regressing to inline module scripts or legacy relative imports.

### Notes route extraction

The Notes route no longer carries its page controller inline in `public/pages/notes/index.html`.

That code now lives in `public/js/notes-page.js` and is loaded with `rel="modulepreload"`.

Why this helps:

- The Notes HTML document is smaller.
- The page no longer relies on legacy page-relative imports for the SDK and shared helpers.
- Rendered note and tag content is escaped before being inserted into the DOM.
- A route-state test prevents the page from regressing to inline module scripts or legacy relative imports.

### Consent route extraction

The legacy Consent route no longer carries its page controller inline in `public/pages/consent/index.html`.

That code now lives in `public/js/consent-page.js` and is loaded with `rel="modulepreload"`.

Why this helps:

- The Consent HTML document is smaller.
- The page no longer relies on legacy page-relative imports for the SDK and shared helpers.
- Rendered consent values are escaped before being inserted into the DOM.
- The existing consent route-state test now covers the legacy Consent page module contract.

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

The highest-value remaining work is now CSS splitting and route-specific CSS coverage.

Recommended next slices:

1. Use `npm run audit:performance:write` to generate the latest inventory.
2. Start page-level CSS splitting with the highest-traffic covered routes: Projects, Project Dashboard, Study, and Guides.
3. Keep `screen.css` as the base layer until each route has browser and route-state coverage.
4. Continue extracting smaller legacy inline module pages, such as Sessions and Synthesize, in separate route-scoped PRs.

## Validation checklist

Before merging performance branches:

- Run `npm run validate`.
- Run `npm run lint`.
- Open the changed route and confirm its visible state still loads correctly.
- Open the browser network panel and verify external route modules are loaded and cached where appropriate.

## PR recommendation

Performance PRs should stay route-scoped where possible.

The PR should not claim to complete full CSS splitting or complete inline-script extraction across the entire application unless every affected route has validation coverage.

Suggested PR summary pattern:

- Extract one route script into a cacheable module.
- Add module preload for the changed route.
- Add or update route-state tests.
- Document remaining route and CSS follow-up work.
