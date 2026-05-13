import assert from 'node:assert/strict';
import fs from 'node:fs';

const registrationPageScript = fs.readFileSync('public/js/auth-registration-page.js', 'utf8');
const signInPageScript = fs.readFileSync('public/js/auth-sign-in-page.js', 'utf8');

function assertRegistrationUsesAccountRedirectContract() {
	assert.match(registrationPageScript, /ACCOUNT_URL: '\/pages\/account\/'/);
	assert.match(registrationPageScript, /function redirectToAccount\(\)/);
	assert.match(registrationPageScript, /location\.assign\(CONFIG\.ACCOUNT_URL\)/);
}

function assertRegistrationChecksCurrentSessionBeforeShowingForm() {
	assert.match(registrationPageScript, /async function redirectAlreadySignedInUser\(\)/);
	assert.match(registrationPageScript, /fetchJson\('\/api\/me'\)/);
	assert.match(registrationPageScript, /response\.ok && response\.data\?\.ok && response\.data\?\.authenticated/);
	assert.match(registrationPageScript, /redirectToAccount\(\)/);
	assert.match(registrationPageScript, /Checking whether you are already signed in/);
	assert.match(registrationPageScript, /if \(dom\.form\) dom\.form\.hidden = true/);
	assert.match(registrationPageScript, /if \(!\(await redirectAlreadySignedInUser\(\)\)\) showForm\(\)/);
}

function assertRegistrationMatchesSignInRedirectBehaviour() {
	assert.match(signInPageScript, /async function redirectAlreadySignedInUser\(\)/);
	assert.match(signInPageScript, /fetchJson\('\/api\/me'\)/);
	assert.match(signInPageScript, /redirectToAccount\(\)/);
	assert.match(signInPageScript, /if \(!\(await redirectAlreadySignedInUser\(\)\)\) showSignedOut\(\)/);
}

assertRegistrationUsesAccountRedirectContract();
assertRegistrationChecksCurrentSessionBeforeShowingForm();
assertRegistrationMatchesSignInRedirectBehaviour();
