import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { visualWalkthroughConfig } from '../visual-walkthrough.config.mjs';
import {
	operationalMockRoutes,
	operationalPaths,
	operationalProjectId,
	operationalStudyId,
} from '../visual-walkthrough.operational-fixtures.mjs';
import {
	participantConsentDefaultState,
	participantConsentVisualStates,
} from '../visual-walkthrough.participant-consent-states.mjs';
import {
	participantConsentMockRoutes,
	participantConsentPath,
} from '../visual-walkthrough.participant-consent-fixtures.mjs';
import { synthesisEmptyCluster, synthesisPath } from '../visual-walkthrough.synthesis-fixtures.mjs';
import {
	synthesisDefaultState,
	synthesisVisualStates,
} from '../visual-walkthrough.synthesis-states.mjs';

function listHtmlFiles(dir) {
	if (!fs.existsSync(dir)) return [];

	const entries = fs.readdirSync(dir, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const entryPath = path.join(dir, entry.name);

		if (entry.isDirectory()) {
			files.push(...listHtmlFiles(entryPath));
			continue;
		}

		if (entry.isFile() && entry.name.endsWith('.html')) {
			files.push(entryPath);
		}
	}

	return files.sort();
}

function routeFromPublicFile(filePath) {
	const relativePath = path
		.relative(visualWalkthroughConfig.publicRoot, filePath)
		.replaceAll(path.sep, '/');

	if (relativePath === 'index.html') return '/';

	return `/${relativePath}`;
}

function stateById(stateId) {
	return synthesisVisualStates.find((state) => state.id === stateId);
}

function actionTextValues(stateId) {
	return (stateById(stateId)?.actions || [])
		.filter((action) => action.type === 'waitForText')
		.map((action) => action.text);
}

function actionSelectorValues(stateId) {
	return (stateById(stateId)?.actions || [])
		.filter((action) => action.type === 'waitForSelector')
		.map((action) => action.selector);
}

function pageById(pageId) {
	return visualWalkthroughConfig.pages.find((page) => page.id === pageId);
}

function assertDefaultStatePath(pageId, expectedPath, message) {
	const page = pageById(pageId);
	assert.equal(
		Boolean(page?.defaultState?.path),
		true,
		`Expected ${pageId} to define a default state path`
	);
	assert.equal(page.defaultState.path, expectedPath, message);
}

const discoveredRoutes = listHtmlFiles(visualWalkthroughConfig.publicRoot)
	.map(routeFromPublicFile)
	.filter((route) => !visualWalkthroughConfig.excludedRoutes.includes(route));

const registeredRoutes = visualWalkthroughConfig.pages.map((page) => page.path);
const registeredIds = visualWalkthroughConfig.pages.map((page) => page.id);
const profileIds = visualWalkthroughConfig.profiles.map((profile) => profile.id);
const synthesisStateIds = synthesisVisualStates.map((state) => state.id);
const participantConsentStateIds = participantConsentVisualStates.map((state) => state.id);
const visualWalkthroughSource = fs.readFileSync('scripts/visual-walkthrough.mjs', 'utf8');
const stateAcceptanceSource = fs.readFileSync('scripts/researchops-state-acceptance.mjs', 'utf8');

for (const route of discoveredRoutes) {
	assert.ok(
		registeredRoutes.includes(route),
		`Expected visual walkthrough registry to include public route: ${route}`
	);
}

for (const page of visualWalkthroughConfig.pages) {
	assert.equal(
		page.path.startsWith('/'),
		true,
		`Expected registered path to start with /: ${page.path}`
	);
	assert.equal(Boolean(page.title), true, `Expected registered page to have a title: ${page.id}`);
	assert.equal(Boolean(page.group), true, `Expected registered page to have a group: ${page.id}`);
	assert.equal(
		Boolean(page.designRisk?.risk),
		true,
		`Expected page to define a design risk: ${page.id}`
	);
	assert.equal(
		Boolean(page.designRisk?.impact),
		true,
		`Expected page to define design risk impact: ${page.id}`
	);
	assert.equal(
		Boolean(page.designRisk?.recommendedChange),
		true,
		`Expected page to define design risk recommendation: ${page.id}`
	);
	assert.doesNotMatch(
		`${page.designRisk.risk} ${page.designRisk.impact} ${page.designRisk.recommendedChange}`,
		/No specific design risk recorded|No additional impact has been identified|Review this state during the next design critique/,
		`Expected page to use a route-specific design-risk assessment: ${page.id}`
	);
}

assert.equal(
	new Set(registeredIds).size,
	registeredIds.length,
	'Expected registered page ids to be unique'
);

assert.deepEqual(
	profileIds,
	['desktop', 'mobile'],
	'Expected visual walkthrough to capture both desktop and mobile screenshots'
);

for (const profile of visualWalkthroughConfig.profiles) {
	assert.equal(Boolean(profile.title), true, `Expected profile to have a title: ${profile.id}`);
	assert.equal(
		Boolean(profile.contextOptions?.viewport?.width),
		true,
		`Expected profile to define viewport width: ${profile.id}`
	);
	assert.equal(
		Boolean(profile.contextOptions?.viewport?.height),
		true,
		`Expected profile to define viewport height: ${profile.id}`
	);
}

assert.equal(
	operationalMockRoutes().length >= 7,
	true,
	'Expected operational walkthrough fixtures to cover project, study, participant, guide, consent and session APIs'
);

assertDefaultStatePath(
	'project-dashboard',
	operationalPaths.projectDashboard,
	'Expected project dashboard walkthrough to capture a real project-scoped URL'
);
assertDefaultStatePath(
	'project-dashboard-add-study',
	operationalPaths.addStudy,
	'Expected add-study walkthrough to keep the parent project ID in the URL'
);
assertDefaultStatePath(
	'project-dashboard-add-participant',
	operationalPaths.addParticipant,
	'Expected add-participant walkthrough to keep the parent project ID in the URL'
);
assertDefaultStatePath(
	'project-dashboard-import-participants',
	operationalPaths.importParticipants,
	'Expected import-participants walkthrough to keep the parent project ID in the URL'
);
assertDefaultStatePath(
	'study',
	operationalPaths.study,
	'Expected study overview walkthrough to capture a project and study scoped URL'
);
assertDefaultStatePath(
	'study-guides',
	operationalPaths.studyGuides,
	'Expected discussion guides walkthrough to capture a project and study scoped URL'
);
assertDefaultStatePath(
	'study-participants',
	operationalPaths.studyParticipants,
	'Expected study participants walkthrough to capture a project and study scoped URL'
);
assertDefaultStatePath(
	'study-session',
	operationalPaths.studySession,
	'Expected study session walkthrough to capture a project and study scoped URL'
);
assertDefaultStatePath(
	'study-consent-forms',
	operationalPaths.studyConsentForms,
	'Expected consent forms walkthrough to capture a project and study scoped URL'
);

for (const pageId of [
	'project-dashboard',
	'project-dashboard-add-study',
	'project-dashboard-add-participant',
	'project-dashboard-import-participants',
	'study',
	'study-guides',
	'study-participants',
	'study-session',
	'study-consent-forms',
]) {
	const page = pageById(pageId);
	assert.ok(
		page.defaultState.path.includes(operationalProjectId),
		`Expected ${pageId} walkthrough path to include the operational project ID`
	);
}

for (const pageId of [
	'study',
	'study-guides',
	'study-participants',
	'study-session',
	'study-consent-forms',
]) {
	const page = pageById(pageId);
	assert.ok(
		page.defaultState.path.includes(operationalStudyId),
		`Expected ${pageId} walkthrough path to include the operational study ID`
	);
}

assert.match(
	visualWalkthroughSource,
	/state\.acceptanceCriteria = buildStateAcceptanceGherkin\(pageConfig, state, stateConfig\);/,
	'Expected visual walkthrough generation to attach Gherkin acceptance criteria to every state'
);

assert.match(
	visualWalkthroughSource,
	/renderStateAcceptanceCriteria\(state\)/,
	'Expected visual walkthrough rendering to output state-level acceptance criteria in each state card'
);

assert.match(
	visualWalkthroughSource,
	/data-state-acceptance-criteria/,
	'Expected visual walkthrough HTML to include a stable state acceptance criteria marker'
);

assert.match(
	visualWalkthroughSource,
	/What this screen state should support/,
	'Expected visual walkthrough HTML to label the state-level details panel by screen-state purpose'
);

assert.match(
	visualWalkthroughSource,
	/Format: Gherkin acceptance criteria/,
	'Expected state-level details panels to keep the Gherkin format label inside the panel'
);

assert.doesNotMatch(
	visualWalkthroughSource,
	/Gherkin acceptance criteria for this state/,
	'Expected state-level details panels not to use delivery-tooling wording as the summary label'
);

assert.match(
	stateAcceptanceSource,
	/ResearchOps journey/,
	'Expected generated Gherkin criteria to be framed around the user journey rather than the report artefact'
);

assert.match(
	stateAcceptanceSource,
	/Add a study to a research project/,
	'Expected generated Gherkin criteria to include project-dashboard action journeys'
);

assert.doesNotMatch(
	stateAcceptanceSource,
	/ready to work with this ResearchOps state/,
	'Expected generated Gherkin criteria not to describe the reporting site state as the user task'
);

assert.doesNotMatch(
	stateAcceptanceSource,
	/Use the state accessibly/,
	'Expected generated Gherkin criteria to avoid reporting-site state language in accessibility scenarios'
);

assert.doesNotMatch(
	stateAcceptanceSource,
	/Work with the "/,
	'Expected generated Gherkin criteria to avoid generic state wording in scenario titles'
);

assert.match(
	visualWalkthroughSource,
	/Bespoke criteria/,
	'Expected the report to expose criteria maturity tags'
);

assert.match(
	visualWalkthroughSource,
	/Needs review/,
	'Expected generated criteria to be visibly marked for UCD review'
);

assert.match(
	visualWalkthroughSource,
	/ResearchOps journeys/,
	'Expected the report to include a journey-led review section above page cards'
);

assert.match(
	visualWalkthroughSource,
	/Start research work/,
	'Expected journey-led reporting to include the start research work journey'
);

assert.match(
	visualWalkthroughSource,
	/Design-risk notes/,
	'Expected each state card to support structured design-risk notes'
);

assert.match(
	visualWalkthroughSource,
	/Recommended change/,
	'Expected design-risk notes to expose recommended changes'
);

assert.match(
	visualWalkthroughSource,
	/State-level acceptance criteria/,
	'Expected evidence type labels to separate state-level acceptance criteria from other evidence'
);

assert.match(
	visualWalkthroughSource,
	/Route-level Cucumber evidence/,
	'Expected evidence type labels to distinguish route-level Cucumber evidence'
);

assert.match(
	visualWalkthroughSource,
	/data-profile-filter="compare"/,
	'Expected the report to provide a desktop and mobile Compare view'
);

assert.match(
	visualWalkthroughSource,
	/profile !== 'compare'/,
	'Expected Compare view to show all captures for the same state together'
);

assert.match(
	visualWalkthroughSource,
	/window\.scrollY/,
	'Expected profile switching to preserve the reviewer scroll position where possible'
);

assert.match(
	visualWalkthroughSource,
	/<figcaption>/,
	'Expected screenshots to include visible captions'
);

assert.match(
	visualWalkthroughSource,
	/screenshotAltText\(page, state, capture\)/,
	'Expected screenshots to include descriptive alt text generated from page, state and viewport'
);

assert.equal(
	synthesisDefaultState.id,
	'missing-sid-error',
	'Expected synthesis walkthrough to capture the missing study ID error as its default state'
);

assert.deepEqual(
	synthesisStateIds,
	[
		'empty-evidence',
		'evidence-loaded',
		'working-cluster-created',
		'evidence-added-to-cluster',
		'theme-blocked-without-evidence',
		'theme-created',
	],
	'Expected synthesis walkthrough states to cover the production first-slice workflow'
);

assert.ok(
	actionTextValues('working-cluster-created').includes(
		`Created working cluster grouping ${synthesisEmptyCluster.label}.`
	),
	'Expected cluster creation capture to wait for the production status text'
);

assert.ok(
	actionSelectorValues('theme-blocked-without-evidence').includes(
		`[data-cluster-id="${synthesisEmptyCluster.id}"]`
	),
	'Expected blocked theme capture to wait for the visible cluster card rather than a hidden option'
);

assert.ok(
	actionTextValues('theme-blocked-without-evidence').includes(
		'Add evidence to a working cluster grouping before creating a theme.'
	),
	'Expected blocked theme capture to wait for the disabled-control hint rather than selecting a disabled control'
);

for (const state of synthesisVisualStates) {
	assert.equal(
		state.path,
		synthesisPath,
		`Expected synthesis state to use the study-scoped route: ${state.id}`
	);
	assert.ok(
		Array.isArray(state.mockRoutes) && state.mockRoutes.length >= 2,
		`Expected synthesis state to provide mocked API routes: ${state.id}`
	);
	assert.ok(
		Array.isArray(state.actions) && state.actions.length >= 1,
		`Expected synthesis state to provide capture actions: ${state.id}`
	);
}

assert.equal(
	participantConsentDefaultState.id,
	'default',
	'Expected participant consent default screenshot to be the loaded study-scoped workspace'
);

assert.equal(
	participantConsentDefaultState.path,
	participantConsentPath,
	'Expected participant consent default screenshot to use a project and study scoped route'
);

assert.ok(
	Array.isArray(participantConsentDefaultState.mockRoutes) &&
		participantConsentDefaultState.mockRoutes.length >= 5,
	'Expected participant consent default state to provide deterministic mocked API routes'
);

assert.deepEqual(
	participantConsentStateIds,
	['missing-context-error', 'no-published-consent-form', 'no-participants', 'participant-selected'],
	'Expected participant consent walkthrough states to cover route errors, setup blockers and review flow'
);

assert.equal(
	participantConsentVisualStates.find((state) => state.id === 'missing-context-error')?.path,
	undefined,
	'Expected missing-context participant consent state to use the unscoped page route'
);

for (const state of participantConsentVisualStates.filter(
	(item) => item.id !== 'missing-context-error'
)) {
	assert.equal(
		state.path,
		participantConsentPath,
		`Expected participant consent state to use the study-scoped route: ${state.id}`
	);
	assert.ok(
		Array.isArray(state.mockRoutes) && state.mockRoutes.length >= 5,
		`Expected participant consent state to provide mocked API routes: ${state.id}`
	);
	assert.ok(
		Array.isArray(state.actions) && state.actions.length >= 1,
		`Expected participant consent state to provide capture actions: ${state.id}`
	);
}

assert.equal(
	participantConsentMockRoutes().length,
	5,
	'Expected participant consent fixture to cover projects, studies, participants, consent forms and consent records'
);
