import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { visualWalkthroughConfig } from '../visual-walkthrough.config.mjs';

const featureSource = fs.readFileSync('features/authenticated-walkthrough.feature', 'utf8');
const stepSource = fs.readFileSync('features/steps/common.steps.js', 'utf8');
const worldSource = fs.readFileSync('features/support/world.js', 'utf8');
const visualWalkthroughSource = fs.readFileSync('scripts/visual-walkthrough.mjs', 'utf8');
const helperSource = fs.readFileSync('scripts/walkthrough-playwright.mjs', 'utf8');
const passwordlessSource = fs.readFileSync('infra/cloudflare/src/core/auth/passwordless.js', 'utf8');
const participantConsentSource = fs.readFileSync('public/js/participant-consent-page.js', 'utf8');

test('QA BDD walkthrough captures sign-in code and authenticated page states', () => {
	assert.match(featureSource, /Sign-in code state is captured/);
	assert.match(featureSource, /Authenticated application states are captured/);
	assert.match(stepSource, /I request a ResearchOps sign-in code for the QA walkthrough user/);
	assert.match(stepSource, /I capture every registered ResearchOps page with authenticated QA state/);
	assert.match(worldSource, /registerWalkthroughRoutes/);
	assert.match(worldSource, /captureEvidenceScreenshot/);
});

test('visual walkthrough uses local assets and deterministic authenticated mocks', () => {
	assert.match(visualWalkthroughSource, /registerLocalAssetRoutes/);
	assert.match(visualWalkthroughSource, /walkthroughMockRoutes/);
	assert.match(visualWalkthroughSource, /process\.env\.WALKTHROUGH_LOCAL_ASSETS !== 'false'/);
	assert.match(helperSource, /operationalMockRoutes/);
	assert.match(helperSource, /SIGN_IN_EMAIL = 'qa-bdd\.walkthrough@example\.gov\.uk'/);
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

test('participant consent same-origin API URLs are valid during walkthrough capture', () => {
	assert.match(participantConsentSource, /new URL\(apiUrl\(path\), window\.location\.origin\)/);
	assert.doesNotMatch(participantConsentSource, /new URL\(apiUrl\(path\)\)/);
});
