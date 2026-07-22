import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { visualWalkthroughConfig } from '../visual-walkthrough.config.mjs';
import {
	operationalJournalAnalysis,
	operationalJournalCodes,
	operationalJournalEntries,
	operationalJournalMemos,
	operationalPaths,
} from '../visual-walkthrough.operational-fixtures.mjs';
import { participantConsentPath } from '../visual-walkthrough.participant-consent-fixtures.mjs';
import { repositoryStaticPages } from '../src/govuk/data/repository-page.mjs';

const featureSource = fs.readFileSync('features/authenticated-walkthrough.feature', 'utf8');
const cucumberConfigSource = fs.readFileSync('cucumber.mjs', 'utf8');
const packageSource = fs.readFileSync('package.json', 'utf8');
const stepSource = fs.readFileSync('features/steps/common.steps.js', 'utf8');
const worldSource = fs.readFileSync('features/support/world.js', 'utf8');
const visualWalkthroughSource = fs.readFileSync('scripts/visual-walkthrough.mjs', 'utf8');
const visualWalkthroughConfigSource = fs.readFileSync('visual-walkthrough.config.mjs', 'utf8');
const helperSource = fs.readFileSync('scripts/walkthrough-playwright.mjs', 'utf8');
const passwordlessSource = fs.readFileSync('infra/cloudflare/src/core/auth/passwordless.js', 'utf8');
const participantConsentSource = fs.readFileSync('public/js/participant-consent-page.js', 'utf8');
const qaBddWorkflowSource = fs.readFileSync('.github/workflows/qa-bdd.yml', 'utf8');
const deployWorkerWorkflowSource = fs.readFileSync('.github/workflows/deploy-worker.yml', 'utf8');
const passwordlessPreviewWorkflowSource = fs.readFileSync(
	'.github/workflows/deploy-passwordless-preview-worker.yml',
	'utf8',
);
const cloudflareWranglerSource = fs.readFileSync('infra/cloudflare/wrangler.toml', 'utf8');
const passwordlessPreviewWranglerSource = fs.readFileSync(
	'infra/cloudflare/wrangler.passwordless-preview.toml',
	'utf8',
);

test('QA BDD walkthrough captures sign-in code and authenticated page states', () => {
	assert.match(featureSource, /@walkthrough/);
	assert.match(featureSource, /Sign-in code state is captured/);
	assert.match(featureSource, /Authenticated application states are captured/);
	assert.match(stepSource, /I request a ResearchOps sign-in code for the QA walkthrough user/);
	assert.match(stepSource, /I capture every registered ResearchOps page with authenticated QA state/);
	assert.match(worldSource, /registerWalkthroughRoutes/);
	assert.match(worldSource, /captureEvidenceScreenshot/);
});

test('Cucumber smoke profile excludes the heavyweight walkthrough feature', () => {
	assert.match(cucumberConfigSource, /not @walkthrough/);
	assert.match(cucumberConfigSource, /const walkthroughTags = '@walkthrough'/);
	assert.match(cucumberConfigSource, /export \{ walkthrough \}/);
	assert.match(packageSource, /"qa:cucumber:walkthrough": "BDD_CAPTURE_SCREENSHOTS=true cucumber-js -p walkthrough"/);
});

test('visual walkthrough uses local assets and deterministic authenticated mocks', () => {
	assert.match(visualWalkthroughSource, /registerLocalAssetRoutes/);
	assert.match(visualWalkthroughSource, /walkthroughMockRoutes/);
	assert.match(visualWalkthroughSource, /process\.env\.WALKTHROUGH_LOCAL_ASSETS === 'true'/);
	assert.match(visualWalkthroughSource, /playwrightRequest\.newContext/);
	assert.match(visualWalkthroughSource, /RESEARCHOPS_QA_BDD_AUTH_CODE/);
	assert.match(
		visualWalkthroughSource,
		/SERVER_PROTECTED_PAGE_IDS = new Set\(\['start', 'projects', 'project-dashboard', 'repository'\]\)/,
	);
	const projectsPage = visualWalkthroughConfig.pages.find((page) => page.id === 'projects');
	assert.equal(projectsPage.path, '/pages/projects/index.html');
	assert.equal(projectsPage.defaultState.path, '/pages/projects/');
	assert.deepEqual(projectsPage.defaultState.actions, [
		{ type: 'waitForText', text: 'Assisted Digital Support Discovery' },
	]);
	assert.match(visualWalkthroughConfigSource, /selector: '#apply-ai-obj-rewrite'/);
	assert.doesNotMatch(visualWalkthroughConfigSource, /Concise rewrite \(optional\):/);
	assert.match(helperSource, /operationalMockRoutes/);
	assert.match(helperSource, /typeof body === 'function'/);
	assert.match(helperSource, /SIGN_IN_EMAIL = 'qa-bdd\.walkthrough@example\.gov\.uk'/);
});

test('visual walkthrough loads below-the-fold lazy media before full-page screenshots', () => {
	assert.match(visualWalkthroughSource, /async function loadFullPageImages\(page\)/);
	assert.match(visualWalkthroughSource, /document\.images/);
	assert.match(visualWalkthroughSource, /image\.loading = 'eager'/);
	assert.match(visualWalkthroughSource, /window\.scrollTo\(0, y\)/);
	assert.match(visualWalkthroughSource, /await loadFullPageImages\(page\);\n\t\tawait page\.screenshot/);
	assert.match(visualWalkthroughSource, /loadFullPageImages,/);
});

test('visual walkthrough is a manual job with QA auth secret wiring', () => {
	const walkthroughJobIndex = qaBddWorkflowSource.indexOf('  walkthrough:');
	const walkthroughJob = qaBddWorkflowSource.slice(walkthroughJobIndex);

	assert.ok(walkthroughJobIndex > -1);
	assert.match(walkthroughJob, /github\.event_name == 'workflow_dispatch'/);
	assert.doesNotMatch(walkthroughJob, /github\.ref == 'refs\/heads\/main'/);
	assert.doesNotMatch(walkthroughJob, /github\.event\.workflow_run\.head_branch == 'main'/);
	assert.match(walkthroughJob, /RESEARCHOPS_QA_BDD_AUTH_EMAIL: qa-bdd\.walkthrough@example\.gov\.uk/);
	assert.match(walkthroughJob, /RESEARCHOPS_QA_BDD_AUTH_CODE: \$\{\{ secrets\.RESEARCHOPS_QA_BDD_AUTH_CODE \}\}/);
});

test('visual walkthrough registers Cloudflare-generated repository pages', () => {
	const registeredPaths = new Set(visualWalkthroughConfig.pages.map((page) => page.path));
	const repositoryPage = visualWalkthroughConfig.pages.find((page) => page.id === 'repository');

	assert.equal(registeredPaths.has('/pages/repository/index.html'), true);
	assert.deepEqual(repositoryPage.defaultState.actions, [
		{ type: 'waitForSelector', selector: '[data-repository-page]' },
	]);
	for (const page of repositoryStaticPages) {
		assert.equal(
			registeredPaths.has(`/pages/repository/${page.slug}/index.html`),
			true,
			`Expected repository generated route ${page.slug} to be in the walkthrough registry`,
		);
	}

	const serviceAreaPage = visualWalkthroughConfig.pages.find(
		(page) => page.id === 'repository-service-areas',
	);
	assert.match(serviceAreaPage.defaultState.path, /service_area=assisted-digital-support/);
	assert.match(visualWalkthroughSource, /new URL\(statePath, baseURL\)/);
});

test('sign-in page has an explicit code-requested visual state', () => {
	const signInPage = visualWalkthroughConfig.pages.find((page) => page.id === 'account-sign-in');

	assert.equal(signInPage.authenticated, false);
	assert.ok(signInPage.defaultState);
	assert.ok(signInPage.states.some((state) => state.id === 'code-requested'));
	assert.deepEqual(
		signInPage.states
			.find((state) => state.id === 'code-requested')
			.actions.map((action) => action.type),
		['fill', 'click', 'waitForSelector', 'waitForText'],
	);
});

test('passwordless QA BDD bypass is env gated and reuses the normal session path', () => {
	assert.match(passwordlessSource, /RESEARCHOPS_QA_BDD_AUTH_ENABLED/);
	assert.match(passwordlessSource, /RESEARCHOPS_QA_BDD_AUTH_CODE/);
	assert.match(passwordlessSource, /RESEARCHOPS_QA_BDD_AUTH_EMAILS/);
	assert.match(passwordlessSource, /deliveryProvider = qaBddChallengeBypassEnabled\(env, email\) \? 'qa-bdd' : await sendCode/);
	assert.match(passwordlessSource, /qaBddCodeAccepted/);
	assert.match(passwordlessSource, /INSERT INTO auth_sessions/);
	assert.doesNotMatch(passwordlessSource, /qa-bdd\.walkthrough@example\.gov\.uk/);
});

test('Cloudflare Worker config keeps QA BDD auth disabled in production without storing the code', () => {
	assert.match(cloudflareWranglerSource, /RESEARCHOPS_QA_BDD_AUTH_ENABLED = "false"/);
	assert.doesNotMatch(cloudflareWranglerSource, /RESEARCHOPS_QA_BDD_AUTH_EMAILS/);
	assert.doesNotMatch(cloudflareWranglerSource, /RESEARCHOPS_QA_BDD_AUTH_CODE/);
	assert.match(cloudflareWranglerSource, /RESEARCHOPS_ALLOW_PAGES_PREVIEW_ORIGINS = "false"/);
	assert.match(passwordlessPreviewWranglerSource, /RESEARCHOPS_QA_BDD_AUTH_ENABLED = "true"/);
	assert.match(passwordlessPreviewWranglerSource, /RESEARCHOPS_ALLOW_PAGES_PREVIEW_ORIGINS = "true"/);
	assert.match(
		passwordlessPreviewWranglerSource,
		/RESEARCHOPS_QA_BDD_AUTH_EMAILS = "qa-bdd\.walkthrough@example\.gov\.uk"/,
	);
	assert.doesNotMatch(passwordlessPreviewWranglerSource, /RESEARCHOPS_QA_BDD_AUTH_CODE/);
});

test('preview Worker deployment restores QA auth and preview mutation origins', () => {
	assert.match(deployWorkerWorkflowSource, /replace_pattern_once/);
	assert.match(deployWorkerWorkflowSource, /RESEARCHOPS_QA_BDD_AUTH_ENABLED\\s\*=/);
	assert.match(deployWorkerWorkflowSource, /RESEARCHOPS_QA_BDD_AUTH_ENABLED = "true"/);
	assert.match(deployWorkerWorkflowSource, /RESEARCHOPS_ALLOW_PAGES_PREVIEW_ORIGINS\\s\*=/);
	assert.match(deployWorkerWorkflowSource, /RESEARCHOPS_ALLOW_PAGES_PREVIEW_ORIGINS = "true"/);
	assert.match(deployWorkerWorkflowSource, /ALLOWED_ORIGINS\\s\*=/);
	assert.match(
		deployWorkerWorkflowSource,
		/https:\/\/rops-api-passwordless-preview\.digikev-kevin-rapley\.workers\.dev/,
	);
	assert.doesNotMatch(
		deployWorkerWorkflowSource,
		/researchops\.pages\.dev,https:\/\/rops-api\.digikev-kevin-rapley\.workers\.dev,http:\/\/localhost:8080/,
	);
	assert.match(passwordlessPreviewWorkflowSource, /WRANGLER_VERSION: "4\.90\.0"/);
	assert.match(passwordlessPreviewWorkflowSource, /Use Node\.js 22/);
	assert.match(passwordlessPreviewWorkflowSource, /node-version: 22/);
	assert.match(passwordlessPreviewWorkflowSource, /for attempt in 1 2 3/);
	assert.match(passwordlessPreviewWorkflowSource, /Deploying preview Worker \(attempt \$\{attempt\}\)/);
});

test('Cloudflare deploy workflows pass the QA BDD auth code secret to Workers', () => {
	assert.match(
		deployWorkerWorkflowSource,
		/RESEARCHOPS_QA_BDD_AUTH_CODE: \$\{\{ secrets\.RESEARCHOPS_QA_BDD_AUTH_CODE \}\}/,
	);
	assert.match(deployWorkerWorkflowSource, /missing="\$\{missing\} RESEARCHOPS_QA_BDD_AUTH_CODE"/);
	assert.match(
		deployWorkerWorkflowSource,
		/secrets: \|\n(?: {12}[A-Z0-9_]+\n)* {12}RESEARCHOPS_QA_BDD_AUTH_CODE/,
	);
	assert.match(
		passwordlessPreviewWorkflowSource,
		/RESEARCHOPS_QA_BDD_AUTH_CODE: \$\{\{ secrets\.RESEARCHOPS_QA_BDD_AUTH_CODE \}\}/,
	);
	assert.match(
		passwordlessPreviewWorkflowSource,
		/Missing required secret: RESEARCHOPS_QA_BDD_AUTH_CODE/,
	);
	assert.match(passwordlessPreviewWorkflowSource, /"RESEARCHOPS_QA_BDD_AUTH_CODE"/);
});

test('participant consent same-origin API URLs are valid during walkthrough capture', () => {
	assert.match(participantConsentSource, /new URL\(apiUrl\(path\), window\.location\.origin\)/);
	assert.match(participantConsentSource, /hasStudyContextParams/);
	assert.match(participantConsentSource, /renderLoadError\(error\)/);
	assert.doesNotMatch(participantConsentSource, /new URL\(apiUrl\(path\)\)/);
});

test('data-dependent walkthrough pages keep operational defaults and explicit error states', () => {
	const pages = new Map(visualWalkthroughConfig.pages.map((page) => [page.id, page]));
	const stateIds = (pageId) => new Set((pages.get(pageId)?.states || []).map((state) => state.id));

	assert.match(operationalPaths.addStudy, /\/pages\/study\/new\/\?id=recVisualProject001$/);
	assert.equal(pages.get('project-dashboard-add-study').defaultState.path, operationalPaths.addStudy);
	assert.equal(stateIds('project-dashboard-add-study').has('missing-project-id-error'), true);

	assert.equal(pages.get('journal-entry').defaultState.path, operationalPaths.journalEntry);
	assert.equal(stateIds('journal-entry').has('missing-journal-entry-id-error'), true);
	assert.equal(pages.get('journal-entry-edit').defaultState.path, operationalPaths.journalEntryEdit);
	assert.equal(stateIds('journal-entry-edit').has('missing-journal-entry-id-error'), true);

	assert.equal(pages.get('journals').defaultState.path, operationalPaths.journals);
	for (const stateId of [
		'codes-with-realistic-data',
		'memos-with-realistic-data',
		'analysis-timeline',
		'analysis-cooccurrence-table',
		'analysis-cooccurrence-ranked-bar-chart',
		'analysis-cooccurrence-matrix-heatmap',
		'analysis-cooccurrence-small-multiples',
		'analysis-cooccurrence-stacked-summary',
		'analysis-cooccurrence-clustered-summary',
		'analysis-code-retrieval',
		'analysis-export',
	]) {
		assert.equal(stateIds('journals').has(stateId), true, `Expected journals state ${stateId}`);
	}

	assert.equal(pages.get('study-guides').defaultState.path, operationalPaths.studyGuides);
	assert.equal(stateIds('study-guides').has('empty-guide-source-error'), true);

	assert.deepEqual(pages.get('study-session').defaultState.actions.slice(0, 2), [
		{ type: 'waitForSelector', selector: '#participant-select option[value="recVisualParticipant001"]', state: 'attached' },
		{ type: 'select', selector: '#participant-select', value: 'recVisualParticipant001' },
	]);
	assert.equal(stateIds('study-session').has('participant-consent-gate'), true);

	assert.equal(participantConsentPath, '/pages/study/participant-consent/?id=recVisualConsentStudy001');
	assert.equal(participantConsentPath.includes('pid='), false);
	assert.equal(participantConsentPath.includes('sid='), false);

	assert.equal(pages.get('team-access-requests').defaultState.path, operationalPaths.teamAccessRequests);
	assert.equal(stateIds('team-access-requests').has('decision-error'), true);
});

test('journal walkthrough fixtures contain realistic entries, codes, memos and analysis data', () => {
	const entryCategories = new Set(operationalJournalEntries.map((entry) => entry.category));
	const codeNames = new Set(operationalJournalCodes.map((code) => code.name));
	const memoTypes = new Set(operationalJournalMemos.map((memo) => memo.memoType));
	const nodeLabels = new Set(operationalJournalAnalysis.nodes.map((node) => node.label));

	assert.ok(operationalJournalEntries.length >= 12);
	assert.deepEqual(entryCategories, new Set(['perceptions', 'procedures', 'decisions', 'introspections']));
	assert.ok(operationalJournalCodes.length >= 10);
	assert.equal(codeNames.has('Analysis confidence'), true);
	assert.equal(codeNames.has('Reflexive practice'), true);
	assert.equal(codeNames.has('Traceable decisions'), true);
	assert.deepEqual(memoTypes, new Set(['analytical', 'reflexive', 'methodological', 'theoretical']));
	assert.ok(operationalJournalAnalysis.links.length >= 12);
	assert.equal(nodeLabels.has('Negative case'), true);
	assert.equal(nodeLabels.has('Evidence readiness'), true);
});
