# Application visual walkthrough

The application visual walkthrough is a generated evidence site for the current ResearchOps build. It is not the same thing as the Cucumber smoke suite.

The smoke suite answers: did a small number of routes load and meet basic assertions?

The visual walkthrough answers: what does the application look like across registered pages, important interaction states, desktop layouts and mobile layouts?

## Output

The walkthrough writes to `reports-site/`:

- `index.html` — browsable report with a desktop/mobile screenshot switcher
- `manifest.json` — machine-readable run evidence
- `screenshots/desktop/*.png` — desktop captured page and state evidence
- `screenshots/mobile/*.png` — mobile captured page and state evidence

The generated report is uploaded as the `visual-walkthrough-site` workflow artifact. The heavyweight walkthrough is run from the dedicated manual `qa-bdd` workflow dispatch so normal smoke checks stay quick and stable.

## Registry

The source of truth is `visual-walkthrough.config.mjs`.

Every public HTML application route must have a page entry. The registry test fails if a new public HTML page is added without a matching walkthrough entry.

Cloudflare-generated Nunjucks pages that are not committed as `public/**/*.html` must still be registered when they are served after deployment. The research repository pages are registered from `src/govuk/data/repository-page.mjs` so a manual walkthrough run against `BASE_URL`, `PAGES_URL` or `PREVIEW_URL` captures the deployed generated routes.

The report captures every configured profile in `profiles`. The current contract is:

```js
profiles: [
	{
		id: 'desktop',
		title: 'Desktop',
		description: 'Desktop Chromium viewport, 1440 × 1200.',
		contextOptions: {
			viewport: {
				width: 1440,
				height: 1200,
			},
		},
	},
	{
		id: 'mobile',
		title: 'Mobile',
		description: 'Mobile Chromium emulation, 412 × 915, touch enabled.',
		contextOptions: {
			viewport: {
				width: 412,
				height: 915,
			},
			deviceScaleFactor: 2.625,
			hasTouch: true,
			isMobile: true,
			userAgent: '...',
		},
	},
];
```

Desktop screenshots are captured with a Chromium desktop viewport. Mobile screenshots are captured by running the same state catalogue in a Playwright mobile Chromium context.

A page entry looks like this:

```js
{
	id: 'study',
	title: 'Study overview',
	group: 'Study',
	path: '/pages/study/index.html',
	description: 'Study overview and readiness controls.',
}
```

## Adding a new page

When a new page is added under `public/`, add a matching entry to `visual-walkthrough.config.mjs` in the same PR.

The minimum required fields are:

- `id`
- `title`
- `group`
- `path`
- `description`

The `path` must match the route derived from the public HTML file. For example:

```text
public/pages/example/index.html
```

must be registered as:

```text
/pages/example/index.html
```

## Adding interaction states

Use `states` when a page has meaningful visual states beyond the default loaded page. Examples include tabs, opened panels, expanded accordions, selected filters, modal/dialog states, validation messages and enabled/disabled control states.

Example:

```js
{
	id: 'example-page',
	title: 'Example page',
	group: 'Examples',
	path: '/pages/example/index.html',
	description: 'Example page with tabs.',
	states: [
		{
			id: 'second-tab',
			title: 'Second tab selected',
			description: 'Shows the second tab panel.',
			actions: [
				{
					type: 'click',
					selector: '[data-testid="second-tab"]',
				},
			],
		},
	],
}
```

Supported action types are:

- `click`
- `fill`
- `press`
- `select`
- `check`
- `uncheck`
- `waitForSelector`
- `waitForText`
- `wait`

Prefer stable selectors such as `data-testid`, semantic landmarks, labelled controls and GOV.UK component classes. Avoid brittle selectors based on position or incidental CSS.

Each state is captured independently for every profile. A state must therefore work in both desktop and mobile layouts. Do not rely on state leakage from a previous screenshot.

## Study-scoped page states

Study-scoped pages should not use an unscoped missing-context error as their only default screenshot.

Use a deterministic study-scoped route and mocked API responses for the default operational state. Keep missing-context as an explicit named error state.

For example, participant consent uses:

```js
{
	id: 'study-participant-consent',
	title: 'Participant consent',
	path: '/pages/study/participant-consent/index.html',
	defaultState: participantConsentDefaultState,
	states: participantConsentVisualStates,
}
```

The participant consent catalogue captures:

- loaded consent workspace with project and study context
- missing study context
- no published consent form
- no participants
- participant selected for consent review

## Capturing wizard flows

Wizard flows should be captured as a sequence of named states on the same page entry.

A state should recreate all preceding steps needed to reach that point. This makes each screenshot independent and prevents state leakage between screenshots.

Example:

```js
const stepOneActions = [
	{
		type: 'fill',
		selector: '#p_name',
		value: 'Assisted Digital Support Discovery',
	},
	{
		type: 'fill',
		selector: '#p_desc',
		value: 'Research how users find and use assisted digital support.',
	},
];

const stepTwoActions = [
	...stepOneActions,
	{
		type: 'click',
		selector: '#next2',
	},
	{
		type: 'waitForSelector',
		selector: '#step2',
		state: 'visible',
	},
];
```

## Mocking AI and network-dependent states

Use `mockRoutes` for deterministic visual states that depend on an API response. This avoids making the visual walkthrough dependent on live AI responses, model latency, quota or content variation.

Prefer mocked AI responses for walkthrough evidence. Live AI calls should be reserved for integration tests where the purpose is to test the service boundary.

## Local command

Run:

```bash
npm run qa:visual-walkthrough
```

The command uses `BASE_URL`, `PAGES_URL` or `PREVIEW_URL` when provided. Otherwise it falls back to `https://researchops.pages.dev/`.

For the authenticated walkthrough, run the dedicated walkthrough profile/job against the deployed preview or production URL. Protected deployed pages need `RESEARCHOPS_QA_BDD_AUTH_CODE` configured as a GitHub Actions secret, and the deployed auth Worker must allow `qa-bdd.walkthrough@example.gov.uk` with the same 6 digit code through its QA BDD bypass settings.

The command runs the same registered page and state catalogue for each configured profile. It then writes one report with a screenshot switcher and profile-specific screenshot directories.

## CI behaviour

The `qa-bdd` workflow still runs the Cucumber smoke suite first.

When the manual walkthrough job runs, it first completes the smoke suite and then runs the application visual walkthrough. The workflow then:

1. uploads `reports-site/` as an artifact
2. checks whether the run is allowed to persist to `main`
3. stages `reports-site/`
4. prints a staged diff summary
5. commits `Update application visual walkthrough report` when files changed
6. pushes the generated report back to `main`
7. deploys the generated `reports-site/` artefact to `reopsreporting` on manual runs where `publish_reporting_site` is true

`reports-site/**` is ignored by the push trigger, so report-only commits do not create a workflow loop.

The separate `Deploy reporting site` workflow validates the committed `reports-site/` directory after every `main` push and on manual dispatch. It rejects the GOV.UK service app shell so the reporting artefact cannot silently become the main ResearchOps service. Manual dispatch also deploys `reports-site/` to the `reopsreporting` Cloudflare Pages project and verifies the live report timestamp. If the Cloudflare API token does not have Pages deployment permission, the manual deploy fails without breaking normal `main` push validation.
