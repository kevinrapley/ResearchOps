import assert from 'node:assert/strict';
import fs from 'node:fs';

const headerPartial = fs.readFileSync('public/partials/header.html', 'utf8');
const headerScript = fs.readFileSync('public/js/auth-header-links.js', 'utf8');
const headerCss = fs.readFileSync('public/css/govuk/govuk-header-service-brand.css', 'utf8');
const authStoryTest = fs.readFileSync('tests/auth-story-1-acceptance-route-state.test.js', 'utf8');

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

function assertSharedHeaderContainsSignedInAccountNavigation() {
	includes(headerPartial, 'class="researchops-header__account"', 'shared header partial');
	includes(headerPartial, 'aria-label="Account"', 'shared header partial');
	includes(headerPartial, 'data-auth-header-account hidden', 'shared header partial');
	includes(headerPartial, 'href="/pages/account/" data-auth-header-user>User name</a>', 'shared header partial');
	includes(headerPartial, 'data-auth-header-sign-out>Sign out</a>', 'shared header partial');
	includes(headerPartial, '<script type="module" src="/js/auth-header-links.js"></script>', 'shared header partial');
}

function assertHeaderScriptUsesIdentityOnlySessionCheck() {
	includes(headerScript, "fetchJson('/api/me/identity')", 'header auth script');
	includes(headerScript, "credentials: 'include'", 'header auth script');
	includes(headerScript, "ACCOUNT_URL: '/pages/account/'", 'header auth script');
	includes(headerScript, "SIGN_IN_URL: '/pages/account/sign-in/'", 'header auth script');
	includes(headerScript, 'response.data?.authenticated', 'header auth script');
	includes(headerScript, 'elements.userLink.textContent = name', 'header auth script');
	includes(headerScript, "elements.userLink.setAttribute('href', CONFIG.ACCOUNT_URL)", 'header auth script');
	includes(headerScript, "await fetchJson('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) });", 'header auth script');
	includes(headerScript, 'location.assign(CONFIG.SIGN_IN_URL)', 'header auth script');
	excludes(headerScript, 'localStorage', 'header auth script');
	excludes(headerScript, 'sessionStorage', 'header auth script');
}

function assertHeaderAccountLinksAreRightAligned() {
	includes(headerCss, '.govuk-header__container', 'header stylesheet');
	includes(headerCss, 'display: flex;', 'header stylesheet');
	includes(headerCss, 'align-items: center;', 'header stylesheet');
	includes(headerCss, '.govuk-header__logo', 'header stylesheet');
	includes(headerCss, 'width: auto;', 'header stylesheet');
	includes(headerCss, '.researchops-header__account', 'header stylesheet');
	includes(headerCss, 'justify-content: flex-end;', 'header stylesheet');
	includes(headerCss, 'gap: 30px;', 'header stylesheet');
	includes(headerCss, 'margin-left: auto;', 'header stylesheet');
	includes(headerCss, '.researchops-header__account[hidden]', 'header stylesheet');
	includes(headerCss, 'display: none;', 'header stylesheet');
	includes(headerCss, '.researchops-header__account-link', 'header stylesheet');
	includes(headerCss, 'white-space: nowrap;', 'header stylesheet');
}

function assertAuthAcceptanceReferencesHeaderSignOut() {
	includes(authStoryTest, 'assertAC8SignOutIsAvailableAndUnderstandable', 'auth story route-state test');
}

assertSharedHeaderContainsSignedInAccountNavigation();
assertHeaderScriptUsesIdentityOnlySessionCheck();
assertHeaderAccountLinksAreRightAligned();
assertAuthAcceptanceReferencesHeaderSignOut();
