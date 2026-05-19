# Footer include defaults race trace

- Branch: `fix/footer-include-defaults-race`
- Task: Fix intermittent footer rendering where only `© ·` appears instead of the full footer text.
- Branch trace decision: `fix/` branch, trace required.

## Operating model files loaded

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/github-mutation-policy.md`

## Selected bundles

- `github-diamond`
- `researchops-developer-control`
- `multi-functional-team`
- `govuk-design-system`

## Files read

- `public/components/layout.js`
- `public/partials/footer.html`
- `public/index.html`
- `package.json`

## Root cause

`<x-include>` renders observed attributes as soon as the custom element upgrades. For existing markup such as `<x-include src="/partials/footer.html"></x-include>`, `attributeChangedCallback()` can run before `connectedCallback()`.

The footer default variables are added in `connectedCallback()` by `_maybeApplyFooterDefaults()`. That meant an early attribute-triggered render could fetch and render `/partials/footer.html` with an empty data object before `year`, `org` and `build` were set.

If that stale render completed after the later connected render, it could overwrite the correct footer with the blank-template output: `© ·`.

## Change summary

- Added a connected-state guard so attribute changes do not render includes before the element has connected.
- Added render queuing so initial footer defaults and rendering are coalesced into a single microtask.
- Added render IDs so stale fetches cannot overwrite newer rendered content.
- Aborted an in-flight include fetch when a newer render supersedes it.
- Added a regression test that guards the lifecycle and stale-render protections.

## Expected outcome

The footer partial should always render with defaults:

`© 2026 Home Office Biometrics · ResearchOps v1.0.0`

It should no longer intermittently render as `© ·`.

## Validation

Local validation was not executed in this ChatGPT environment. CI should run `node --test` and formatting checks after the PR is opened.
