import assert from 'node:assert/strict';
import fs from 'node:fs';

const signInPage = fs.readFileSync('public/pages/account/sign-in/index.html', 'utf8');
const signInScript = fs.readFileSync('public/js/auth-sign-in-page.js', 'utf8');

function assertSignInPageUsesGovukAccountFrontDoor() {
	assert.match(signInPage, /<title>Sign in to ResearchOps - ResearchOps Demo Suite<\/title>/);
	assert.match(signInPage, /<h1 class="govuk-heading-xl">Sign in to ResearchOps<\/h1>/);
	assert.match(signInPage, /Cloudflare Access/);
	assert.match(signInPage, /first Team Admin/);
	assert.match(signInPage, /id="sign-in-status"/);
	assert.match(signInPage, /data-auth-route="\/api\/me"/);
	assert.match(signInPage, /data-access-login-route="\/pages\/account\/sign-in\/"/);
	assert.match(signInPage, /data-team-admin-destination="\/pages\/team\/role-assignments\/"/);
	assert.match(signInPage, /id="team-admin-link"/);
	assert.match(signInPage, /href="\/pages\/team\/role-assignments\/"/);
}

function assertSignInPageDoesNotCreatePasswordAuth() {
	assert.equal(signInPage.includes('type="password"'), false);
	assert.equal(signInPage.includes('name="password"'), false);
	assert.equal(signInPage.includes('Create password'), false);
	assert.equal(signInScript.includes('password'), false);
	assert.equal(signInScript.includes('localStorage'), false);
	assert.equal(signInScript.includes('sessionStorage'), false);
}

function assertSignInActionDoesNotPointAtRawApi() {
	assert.equal(signInPage.includes('id="sign-in-check-link" href="/api/me"'), false);
	assert.match(signInPage, /id="sign-in-check-link" href="\/pages\/account\/sign-in\/"/);
	assert.match(signInScript, /ACCESS_LOGIN_URL: window\.RESEARCHOPS_ACCESS_LOGIN_URL \|\| ""/);
	assert.match(signInScript, /function accessLoginUrl\(\)/);
	assert.match(signInScript, /function configureSignInAction\(\)/);
}

function assertSignInScriptChecksAuthenticatedContext() {
	assert.match(signInScript, /fetchJson\("\/api\/me"\)/);
	assert.match(signInScript, /credentials: "include"/);
	assert.match(signInScript, /TEAM_ADMIN_PERMISSION: "role\.assign"/);
	assert.match(signInScript, /showSignedInTeamAdmin/);
	assert.match(signInScript, /showSignedInWithoutAdmin/);
	assert.match(signInScript, /showUnauthenticated/);
	assert.match(signInScript, /context\.user\.accountStatus !== "active"/);
	assert.match(signInScript, /!context\?\.activeTeam/);
	assert.match(signInScript, /permissionCodes\(context\)\.has\(CONFIG\.TEAM_ADMIN_PERMISSION\)/);
}

assertSignInPageUsesGovukAccountFrontDoor();
assertSignInPageDoesNotCreatePasswordAuth();
assertSignInActionDoesNotPointAtRawApi();
assertSignInScriptChecksAuthenticatedContext();
