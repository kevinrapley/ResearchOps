import assert from 'node:assert/strict';
import fs from 'node:fs';
import { visualWalkthroughConfig } from '../visual-walkthrough.config.mjs';

const pageSource = fs.readFileSync('public/pages/product-proof/index.html', 'utf8');
const homeSource = fs.readFileSync('public/index.html', 'utf8');
const templateSource = fs.readFileSync('src/govuk/templates/pages/product-proof.njk', 'utf8');
const rendererSource = fs.readFileSync('scripts/govuk/render-govuk-pages.mjs', 'utf8');

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

function includesText(source, text, label) {
	assert.equal(
		source.replace(/\s+/g, ' ').includes(text),
		true,
		`Expected ${label} to include text: ${text}`
	);
}

function pageById(id) {
	return visualWalkthroughConfig.pages.find((page) => page.id === id);
}

function countOccurrences(source, text) {
	return source.split(text).length - 1;
}

const walkthroughSteps = [
	'Set up a research project',
	'Plan a study, recruitment, consent, ethics and guides',
	'Capture evidence',
	'Synthesise findings',
	'Prepare a repository candidate',
	'Curate and review',
	'Publish reusable evidence',
	'Track decision impact',
];

includes(rendererSource, "template: 'pages/product-proof.njk'", 'GOV.UK page renderer');
includes(rendererSource, "output: 'public/pages/product-proof/index.html'", 'GOV.UK page renderer');

assert.equal(
	pageById('product-proof')?.path,
	'/pages/product-proof/index.html',
	'Visual walkthrough config should register the public product proof page'
);
assert.equal(pageById('product-proof')?.authenticated, false, 'Product proof page should be captured as public');

includes(pageSource, '<h1 class="govuk-heading-xl">ResearchOps Product Proof</h1>', 'product proof page');
includes(pageSource, 'class="govuk-phase-banner', 'product proof page');
includes(pageSource, 'PROTOTYPE', 'product proof page');
includes(pageSource, 'This is a ResearchOps prototype using static demonstration content.', 'product proof page');
includes(pageSource, 'Walk through how the product works', 'product proof page');
includes(
	pageSource,
	'The walkthrough also shows choices available in the UI that are not selected in this example',
	'product proof page'
);
includes(pageSource, 'Mock screen: project setup', 'product proof page');
includes(pageSource, 'Mock screen: study readiness', 'product proof page');
includes(pageSource, 'Mock screen: session evidence board', 'product proof page');
includes(pageSource, 'Mock screen: synthesis workspace', 'product proof page');
includes(pageSource, 'Mock screen: repository candidate', 'product proof page');
includes(pageSource, 'Mock screen: curator review', 'product proof page');
includes(pageSource, 'Mock screen: published repository artefact', 'product proof page');
includes(pageSource, 'Mock screen: decision impact tracker', 'product proof page');
includes(pageSource, 'Recruitment plan', 'product proof page');
includes(pageSource, 'Informed consent', 'product proof page');
includes(pageSource, 'Ethics and safeguarding', 'product proof page');
includes(pageSource, 'Discussion guide', 'product proof page');
includes(pageSource, 'Decision the screen supports', 'product proof decision evidence');
includes(pageSource, 'Decision made in this example', 'product proof decision evidence');
includes(pageSource, 'Options available but not selected', 'product proof decision evidence');
includes(pageSource, 'Decisions available during project setup', 'product proof decision evidence');
includes(pageSource, 'Decisions available during study planning', 'product proof decision evidence');
includes(pageSource, 'Decisions available during evidence capture', 'product proof decision evidence');
includes(pageSource, 'Decisions available during synthesis', 'product proof decision evidence');
includes(
	pageSource,
	'Decisions available when preparing a repository candidate',
	'product proof decision evidence'
);
includes(pageSource, 'Decisions available during curation and review', 'product proof decision evidence');
includes(pageSource, 'Decisions available at publication', 'product proof decision evidence');
includes(pageSource, 'Decisions available during impact tracking', 'product proof decision evidence');
includes(pageSource, 'Run a policy-only review', 'product proof unselected decisions');
includes(pageSource, 'Use a staff-proxy sample', 'product proof unselected decisions');
includes(pageSource, 'Attach a full transcript', 'product proof unselected decisions');
includes(pageSource, 'Split into separate content, upload and assisted digital themes', 'product proof unselected decisions');
includes(pageSource, 'Promote the whole study', 'product proof unselected decisions');
includes(pageSource, 'Return to researcher', 'product proof unselected decisions');
includes(pageSource, 'Publish internally only', 'product proof unselected decisions');
includes(pageSource, 'Reject as out of scope', 'product proof unselected decisions');
includes(pageSource, 'data-product-proof-page', 'product proof page');
includes(pageSource, 'data-fixture-source="static-product-proof-fixture"', 'product proof page');
assert.equal(
	countOccurrences(pageSource, 'data-product-proof-decision-table'),
	8,
	'Product proof page should show decision space for all eight phases'
);
excludes(pageSource, 'Next:', 'product proof page');
excludes(templateSource, 'Next:', 'product proof template');
includes(pageSource, 'Example: Public Services Accessibility Audit', 'product proof page');
includes(pageSource, 'data-testid="mock-lead-researcher"', 'product proof page');
includes(pageSource, 'Jane Doe (Mock Lead)', 'product proof page');
includesText(
	pageSource,
	'Raw research material and participant data are restricted to authenticated users.',
	'product proof page'
);
includes(pageSource, 'Use ResearchOps with your team', 'product proof page');
includes(pageSource, 'href="/pages/account/register/"', 'product proof page');
includes(pageSource, 'href="/pages/start/overview/"', 'product proof page');
includes(homeSource, 'href="/pages/product-proof/"', 'home page public proof entry point');
includes(homeSource, 'See how ResearchOps works', 'home page public proof entry point');

for (const step of walkthroughSteps) {
	includes(pageSource, step, 'product proof lifecycle');
	includes(templateSource, step, 'product proof template lifecycle');
}

for (const proofStep of [
	'data-proof-step="project"',
	'data-proof-step="study"',
	'data-proof-step="evidence"',
	'data-proof-step="synthesis"',
	'data-proof-step="candidate"',
	'data-proof-step="review"',
	'data-proof-step="publication"',
	'data-proof-step="impact"',
]) {
	includes(pageSource, proofStep, 'product proof managed step-through');
}

for (const forbidden of [
	'/api/repository/',
	'/api/v1/repository/',
	'/api/projects',
	'/api/mural',
	'/api/auth/',
	'fetch(',
	'location.assign',
	'/pages/account/sign-in/',
]) {
	excludes(pageSource, forbidden, 'public product proof page');
	excludes(templateSource, forbidden, 'public product proof template');
}
