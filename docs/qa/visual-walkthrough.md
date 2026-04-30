# Application visual walkthrough

The application visual walkthrough is a generated evidence site for the current ResearchOps build. It is not the same thing as the Cucumber smoke suite.

The smoke suite answers: did a small number of routes load and meet basic assertions?

The visual walkthrough answers: what does the application look like across registered pages and important interaction states?

## Output

The walkthrough writes to `reports-site/`:

- `index.html` — browsable report
- `manifest.json` — machine-readable run evidence
- `screenshots/*.png` — captured page and state evidence

The generated report is uploaded as the `visual-walkthrough-site` workflow artifact. On main branch runs, `reports-site/` is committed back to the repository when generated output changes.

## Registry

The source of truth is `visual-walkthrough.config.mjs`.

Every public HTML application route must have a page entry. The registry test fails if a new public HTML page is added without a matching walkthrough entry.

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

Example:

```js
{
	id: 'objectives-ai-rewrite-shown',
	title: 'Objectives AI rewrite shown',
	description: 'Shows the AI rewrite panel after the objectives threshold is met.',
	mockRoutes: [
		{
			url: '**/api/ai-rewrite**',
			method: 'POST',
			body: {
				summary: 'The objectives are clear and researchable.',
				suggestions: [
					{
						category: 'Focus',
						severity: 'medium',
						tip: 'Make each objective test one decision or assumption.',
						why: 'This helps the team trace findings back to specific service decisions.',
					},
				],
				rewrite: '1. Understand where users need support.\n2. Identify operational signals.',
				flags: {
					possible_personal_data: false,
				},
			},
		},
	],
	actions: [
		{
			type: 'click',
			selector: '#btn-obj-ai-rewrite',
		},
		{
			type: 'waitForText',
			text: 'Concise rewrite (optional):',
		},
	],
}
```

Prefer mocked AI responses for walkthrough evidence. Live AI calls should be reserved for integration tests where the purpose is to test the service boundary.

## Local command

Run:

```bash
npm run qa:visual-walkthrough
```

The command uses `BASE_URL`, `PAGES_URL` or `PREVIEW_URL` when provided. Otherwise it falls back to `https://researchops.pages.dev/`.

## CI behaviour

The `qa-bdd` workflow still runs the Cucumber smoke suite first.

If smoke passes, the walkthrough job runs the application visual walkthrough. The workflow then:

1. uploads `reports-site/` as an artifact
2. checks whether the run is allowed to persist to `main`
3. stages `reports-site/`
4. prints a staged diff summary
5. commits `Update application visual walkthrough report` when files changed
6. pushes the generated report back to `main`
7. deploys to `reopsreporting` only on manual runs where `publish_reporting_site` is true

`reports-site/**` is ignored by the push trigger, so report-only commits do not create a workflow loop.
