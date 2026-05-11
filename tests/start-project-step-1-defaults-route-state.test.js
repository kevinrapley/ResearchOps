import assert from 'node:assert/strict';
import fs from 'node:fs';
import { visualWalkthroughConfig } from '../visual-walkthrough.config.mjs';

const startPage = fs.readFileSync('public/pages/start/index.html', 'utf8');
const startController = fs.readFileSync('public/pages/start/start-new-project.js', 'utf8');
const startAcceptance = fs.readFileSync('scripts/researchops-start-acceptance.mjs', 'utf8');
const reportingEvidence = fs.readFileSync('scripts/reporting-review-evidence.mjs', 'utf8');

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

function startState(id) {
	return visualWalkthroughConfig.pages
		.find((page) => page.id === 'start')
		?.states?.find((state) => state.id === id);
}

includes(startPage, 'Give the project a name and description.', 'start page');
includes(
	startPage,
	'ResearchOps will start the project in Discovery with the status Goal setting &amp; problem defining.',
	'start page'
);
includes(startPage, 'id="p_name"', 'start page');
includes(startPage, 'id="p_desc"', 'start page');
excludes(startPage, 'id="p_phase"', 'start page');
excludes(startPage, 'id="p_status"', 'start page');
excludes(startPage, '<select', 'start page');

includes(startController, 'const DEFAULT_PROJECT_PHASE = "Discovery";', 'start controller');
includes(
	startController,
	'const DEFAULT_PROJECT_STATUS = "Goal setting & problem defining";',
	'start controller'
);
includes(startController, 'phase: DEFAULT_PROJECT_PHASE,', 'start controller');
includes(startController, 'status: DEFAULT_PROJECT_STATUS,', 'start controller');
includes(startController, 'Set by default', 'start controller');
excludes(startController, 'document.querySelector("#p_phase")', 'start controller');
excludes(startController, 'document.querySelector("#p_status")', 'start controller');

assert.equal(startState('step-1-filled')?.actions?.some((action) => action.selector === '#p_name'), true);
assert.equal(startState('step-1-filled')?.actions?.some((action) => action.selector === '#p_desc'), true);
assert.equal(startState('step-1-filled')?.actions?.some((action) => action.selector === '#p_phase'), false);
assert.equal(startState('step-1-filled')?.actions?.some((action) => action.selector === '#p_status'), false);

includes(
	startAcceptance,
	'Scenario: Define the project with essential information only',
	'start acceptance criteria generator'
);
includes(startAcceptance, 'Discovery', 'start acceptance criteria generator');
includes(
	startAcceptance,
	'Goal setting & problem defining',
	'start acceptance criteria generator'
);
includes(
	startAcceptance,
	'And I should not be asked to choose a service phase or project status in Step 1',
	'start acceptance criteria generator'
);

includes(
	reportingEvidence,
	'Step 1 should ask only for the essential project name and description',
	'reporting review evidence'
);
includes(reportingEvidence, 'Goal setting & problem defining', 'reporting review evidence');
excludes(reportingEvidence, 'Service phase option group', 'reporting review evidence');
excludes(reportingEvidence, 'Project status option group', 'reporting review evidence');
