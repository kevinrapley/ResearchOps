# Projects auth redirect trace

- Branch: `fix/projects-auth-redirect-pr-unified`
- Task: Redirect logged out user from `/pages/projects/` to `/pages/account/sign-in/`.
- Signals: authentication, route-behaviour, frontend-page-logic.
- Selected bundles: github, researchops-developer-control, cloudflare, multi-functional-team, govuk-design-system.
- Change summary:
  - Added sign-in redirect helper in `public/js/projects-page.js`.
  - Trigger redirect when `/api/projects` returns HTTP 401.
  - Avoid rendering transient error when redirect is in progress.
- Validation:
  - `npm run lint -- public/js/projects-page.js` completed with existing repository warnings only.
