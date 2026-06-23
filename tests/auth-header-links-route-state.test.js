import assert from 'node:assert/strict';
import fs from 'node:fs';

const headerPartial = fs.readFileSync('public/partials/header.html', 'utf8');
const headerScript = fs.readFileSync('public/js/auth-header-links.js', 'utf8');
const headerCss = fs.readFileSync('public/css/govuk/govuk-header-service-brand.css', 'utf8');
const layoutScript = fs.readFileSync('public/components/layout.js', 'utf8');
const govukInitScript = fs.readFileSync('public/js/govuk-frontend-init.js', 'utf8');
const accountPage = fs.readFileSync('public/pages/account/index.html', 'utf8');
const researchopsLayoutTemplate = fs.readFileSync('src/govuk/templates/layouts/researchops.njk', 'utf8');
const govukPageRenderer = fs.readFileSync('scripts/govuk/render-govuk-pages.mjs', 'utf8');
const servicePageNormaliser = fs.readFileSync('scripts/govuk/normalise-service-pages.mjs', 'utf8');
const authStoryTest = fs.readFileSync('tests/auth-story-1-acceptance-route-state.test.js', 'utf8');

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

function assertSharedHeaderContainsAccountNavigation() {
	includes(headerPartial, 'class="researchops-header__account"', 'shared header partial');
	includes(headerPartial, 'aria-label="Account"', 'shared header partial');
	includes(headerPartial, 'data-auth-header-account>', 'shared header partial');
	includes(headerPartial, 'href="/pages/account/sign-in/" data-auth-header-user>Sign in</a>', 'shared header partial');
	includes(headerPartial, 'data-auth-header-sign-out hidden aria-hidden="true">Sign out</a>', 'shared header partial');
	includes(
		headerPartial,
		'<script type="module" src="/js/auth-header-links.js?v=header-account-links-20260623-1"></script>',
		'shared header partial',
	);
}

function assertHeaderScriptUsesAccountContextSessionCheck() {
	includes(headerScript, "fetchJson('/api/me')", 'header auth script');
	includes(headerScript, "credentials: 'include'", 'header auth script');
	includes(headerScript, "ACCOUNT_URL: '/pages/account/'", 'header auth script');
	includes(headerScript, "SIGN_IN_URL: '/pages/account/sign-in/'", 'header auth script');
	includes(headerScript, 'response.data?.ok', 'header auth script');
	excludes(headerScript, "fetchJson('/api/me/identity')", 'header auth script');
	includes(headerScript, 'const hydratedAccountNavs = new WeakSet()', 'header auth script');
	includes(headerScript, 'hydratedAccountNavs.has(elements.accountNav)', 'header auth script');
	includes(headerScript, "elements.userLink.textContent = 'Sign in'", 'header auth script');
	includes(headerScript, "elements.userLink.setAttribute('href', CONFIG.SIGN_IN_URL)", 'header auth script');
	includes(headerScript, 'elements.userLink.textContent = name', 'header auth script');
	includes(headerScript, "elements.userLink.setAttribute('href', CONFIG.ACCOUNT_URL)", 'header auth script');
	includes(headerScript, 'setVisible(elements.signOutLink, true)', 'header auth script');
	includes(headerScript, 'setVisible(elements.signOutLink, false)', 'header auth script');
	includes(headerScript, "await fetchJson('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) });", 'header auth script');
	includes(headerScript, 'location.assign(CONFIG.SIGN_IN_URL)', 'header auth script');
	includes(headerScript, "document.addEventListener('x-include:loaded'", 'header auth script');
	includes(headerScript, 'export { initAuthHeaderLinks }', 'header auth script');
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

function assertHeaderPartialBypassesStaleIncludeCache() {
	includes(layoutScript, 'src.includes("/partials/header.html")', 'shared include loader');
	includes(layoutScript, 'return "no-store";', 'shared include loader');
	includes(layoutScript, 'new CustomEvent("x-include:loaded", { bubbles: true', 'shared include loader');
	includes(layoutScript, 'new CustomEvent("x-include:error", { bubbles: true', 'shared include loader');
	includes(accountPage, '/components/layout.js?v=header-account-links-20260623-1', 'account page');
	includes(accountPage, '/js/govuk-frontend-init.js?v=header-account-links-20260623-1', 'account page');
	includes(accountPage, '<x-include src="/partials/header.html"', 'account page');
	includes(researchopsLayoutTemplate, '{% if layoutCacheKey %}?v={{ layoutCacheKey }}{% endif %}', 'ResearchOps layout template');
	includes(govukPageRenderer, "layoutCacheKey: 'header-account-links-20260623-1'", 'GOV.UK page renderer');
	includes(servicePageNormaliser, 'function hasIncludeForPartial', 'service page normaliser');
	includes(servicePageNormaliser, '(?:\\\\?[^"\']*)?', 'service page normaliser');
}

function assertSharedInitLoadsHeaderAuthAfterInclude() {
	includes(govukInitScript, "String(src).startsWith('/partials/header.html')", 'GOV.UK frontend init');
	includes(govukInitScript, "import('/js/auth-header-links.js?v=header-account-links-20260623-1')", 'GOV.UK frontend init');
	includes(govukInitScript, 'module.initAuthHeaderLinks(event.target)', 'GOV.UK frontend init');
}

function assertAuthAcceptanceReferencesHeaderSignOut() {
	includes(authStoryTest, 'assertAC8SignOutIsAvailableAndUnderstandable', 'auth story route-state test');
}

assertSharedHeaderContainsAccountNavigation();
assertHeaderScriptUsesAccountContextSessionCheck();
assertHeaderAccountLinksAreRightAligned();
assertHeaderPartialBypassesStaleIncludeCache();
assertSharedInitLoadsHeaderAuthAfterInclude();
assertAuthAcceptanceReferencesHeaderSignOut();
