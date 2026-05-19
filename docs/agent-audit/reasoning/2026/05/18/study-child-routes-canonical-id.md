# Agent trace — Study child routes canonical Study ID

**Date:** 2026-05-18  
**Branch:** `fix/projects-team-scoped-access`  
**PR:** #252  
**Mode:** `rops-fix`  
**Trace type:** operational audit trace

## Evidence boundary

This is an operational trace. It records inspectable repository work, implementation decisions, validation status and residual risk. It does not expose private chain-of-thought.

## Task

The Study landing page now works with a canonical Study record route, for example:

`/pages/study/?id=rect3o7dt`

The next task was to carry that same canonical routing model into the Study child pages:

- `/pages/study/consent-forms/?id=<study-record-id>`
- `/pages/study/guides/?id=<study-record-id>`
- `/pages/study/participant-consent/?id=<study-record-id>`
- `/pages/study/participants/?id=<study-record-id>`
- `/pages/study/synthesis/?id=<study-record-id>`

The legacy synthesis page `/pages/synthesize/` should no longer be the primary surface. It should redirect into `/pages/study/synthesis/`.

## Policy clarification

The user clarified that the policy intent is to block tool access until explicit consent or permission gates are satisfied. The intent is not to remove API tool access entirely.

This implementation preserves tool-capable routes and APIs. It keeps access dependent on the correct route context, authentication, permission checks, and consent gates. It does not introduce a blanket removal of API access.

## Operating model and bundles applied

Loaded operating model sources included:

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`

Selected bundles:

- GitHub Diamond
- ResearchOps Developer Control
- Multi-Functional Team
- GOV.UK Design System
- Cloudflare
- Airtable Public API

Task signals:

- `ui-or-content-change`
- `runtime-or-deployment-change`
- `external-api-or-data-change`

## Files inspected

- `public/js/study-route-context.js`
- `public/js/study-canonical-url-bridge.js`
- `public/js/study-page.js`
- `public/js/project-dashboard.js`
- `public/js/study-guides-context.js`
- `public/js/consent-forms-page.js`
- `public/js/participant-consent-page.js`
- `public/js/synthesize-page.js`
- `public/components/participants/participants-page.js`
- `public/pages/study/participants/scheduler.js`
- `public/pages/study/consent-forms/index.html`
- `public/pages/study/guides/index.html`
- `public/pages/study/participant-consent/index.html`
- `public/pages/study/participants/index.html`
- `public/pages/study/synthesis/index.html`
- `public/pages/synthesize/index.html`
- `tests/study-page-route-state.test.js`
- `tests/project-dashboard-route-state.test.js`

## Findings

The Study landing page already generated canonical child links using `id=<study-record-id>`.

Several child pages still imported their controllers directly. Some of those controllers or downstream modules still expected legacy `pid` and `sid` route values during boot.

The safer route was not to rewrite every controller at once. The safer route was to create route-loader modules that:

1. load the canonical Study URL bridge first;
2. resolve the Study record from `id`;
3. expose the derived Project record ID and Study record ID in `window.__studyRouteContext`;
4. then import the existing page controller.

This preserves existing controller behaviour while making the public URL canonical.

The shared Study route context still contained a production Worker fallback for `pages.dev` hosts. That was unsafe for branch previews because preview pages must call the branch preview API proxy. Otherwise, the page can silently call production or stale API code.

## Decisions

1. Use `?id=<Study record ID>` for Study child routes.
2. Derive the Project record ID from the Study record rather than duplicating it in the URL.
3. Keep legacy `pid` and `sid` compatibility only inside the resolver and only when the linked records match.
4. Use route-loader modules so the canonical bridge runs before old controller assumptions execute.
5. Keep `/pages/synthesize/` as a redirect into `/pages/study/synthesis/`.
6. Remove the `pages.dev` production API fallback from shared Study route context.
7. Add a route-state test that pins the child route contract.

## Changes made

Created `public/js/participants-route-loader.js`.

Confirmed and used these route loaders:

- `public/js/consent-forms-route-loader.js`
- `public/js/guides-route-loader.js`
- `public/js/participant-consent-route-loader.js`
- `public/js/participants-route-loader.js`
- `public/js/synthesis-route-loader.js`

Updated `public/js/study-route-context.js` to keep API calls same-origin unless an explicit API origin is configured.

Updated `public/js/consent-forms-page.js` so it resolves Study context through `resolveStudyContextFromUrl()` and binds breadcrumbs and save payloads to the canonical Study record.

Updated `public/js/participant-consent-page.js` so participant consent loads from the canonical Study record route and links onwards using `id=<study-record-id>`.

Updated `public/pages/study/consent-forms/index.html` so it loads through `/js/consent-forms-route-loader.js?v=study-record-id-routing-20260518`.

Updated `public/pages/study/guides/index.html` so it loads through `/js/guides-route-loader.js?v=study-record-id-routing-20260518`.

Updated `public/pages/study/participant-consent/index.html` so it loads through `/js/participant-consent-route-loader.js?v=study-record-id-routing-20260518`.

Updated `public/pages/study/synthesis/index.html` so it loads through `/js/synthesis-route-loader.js?v=study-record-id-routing-20260518` and removed the direct `synthesize-page.js` import.

Created `tests/study-child-route-state.test.js` to pin:

- the Study landing page child routes use `id` only;
- child pages load their route-loader modules;
- child pages do not hard-code `pid` and `sid` query strings;
- synthesis lives under `/pages/study/synthesis/`;
- `/pages/synthesize/` is bridged to the Study synthesis route;
- same-origin preview API behaviour is preserved.

Created this trace pair:

- `docs/agent-audit/reasoning/2026/05/18/study-child-routes-canonical-id.json`
- `docs/agent-audit/reasoning/2026/05/18/study-child-routes-canonical-id.md`

## Commits in this segment

- `17961bdb21b13e02fcfbf32b92aee29da8ef7f23` — consent forms page controller uses canonical Study route context.
- `db0b7d2f296e9f87c4fb92217b9079cc78694579` — participant consent page loads through canonical Study route loader.
- `17c44779fe6fcb91a738b59d3a57db0d33f7b34c` — consent forms page loads through canonical Study route loader.
- `27718fbd7d284346cca67b9b99833535e3f246bd` — synthesis page loads through canonical Study route loader.
- `a11065f25105277e3a474d10f262d87ee92c2b37` — route-state test for Study child routes.
- `a1cea43ed067559d3055239b0a39b03e788d01a4` — JSON trace for Study child route migration.

## Validation status

After the route-state test commit, the following checks were observed as in progress on commit `a11065f25105277e3a474d10f262d87ee92c2b37`:

- CI
- Worker CI
- Validate ResearchOps
- Release Gate
- Format pull request
- QA — Broken links
- Accessibility audit
- qa-bdd

Checks must be re-read after this trace commit because the PR head moved to `a1cea43ed067559d3055239b0a39b03e788d01a4`.

## Manual preview validation targets

Use the branch preview host and the known Study record ID `rect3o7dt`:

- `/pages/study/consent-forms/?id=rect3o7dt`
- `/pages/study/guides/?id=rect3o7dt`
- `/pages/study/participant-consent/?id=rect3o7dt`
- `/pages/study/participants/?id=rect3o7dt`
- `/pages/study/synthesis/?id=rect3o7dt`

Legacy redirect check:

- `/pages/synthesize/?pid=recgdpwEI5hFO7bUZ&sid=rect3o7dt`

Expected behaviour:

- each Study child page uses the Study record ID only in the visible URL;
- each child page derives Project context through the Study record;
- API calls go to same-origin `/api/*` on the preview Pages host;
- `/pages/synthesize/` redirects to `/pages/study/synthesis/?id=rect3o7dt` where the Study record resolves.

## Residual risks

Some controllers still contain legacy compatibility code. This is deliberate for this step. The public route contract is now canonical, while the bridge preserves old module expectations during the migration.

The session runner route still uses `pid` and `sid`. It was kept out of this change because the requested set was consent forms, guides, participant consent, participants and synthesis.

Airtable remains rate-limited in preview. Child pages that depend on Airtable-backed tables may show empty or error states unless D1 coverage exists for that table.

The legacy `/pages/synthesize/` redirect can only fully canonicalise when the Study record resolves. If it cannot resolve, it falls back to `id=<sid>` as a best-effort route to the new page.

## Next steps

1. Re-read workflow runs for the current PR head.
2. Fix any failing route-state, format or validation test.
3. Confirm the branch preview deploy has picked up the route loaders.
4. Manually test the five Study child pages from the Study landing page.
5. Only then consider removing more legacy `pid` and `sid` compatibility from the controllers.
