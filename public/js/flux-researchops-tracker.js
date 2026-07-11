const COLLECTOR_ENDPOINT = 'https://flux-behaviour.pages.dev/api/collect';
const TENANT_ID = 'researchops';
const PRODUCTION_HOSTS = new Set(['researchops.pages.dev', 'research-operations.com']);
const CONSENT_KEY = 'flux.behaviour.consent';
const VISITOR_KEY = 'flux.behaviour.visitor_id';
const SESSION_KEY = 'flux.behaviour.session_id';
const SAFE_KEY = /^[A-Za-z0-9._:-]{1,120}$/;

if (PRODUCTION_HOSTS.has(window.location.hostname)) {
	startTracker();
}

function startTracker() {
	if (window.localStorage.getItem(CONSENT_KEY) === 'yes') {
		instrument();
		return;
	}
	if (window.localStorage.getItem(CONSENT_KEY) !== 'no') showConsentBanner();
}

function showConsentBanner() {
	const banner = document.createElement('section');
	banner.className = 'govuk-cookie-banner';
	banner.setAttribute('aria-label', 'Behavioural analytics consent');
	banner.setAttribute('role', 'region');
	banner.innerHTML = '<div class="govuk-width-container"><div class="govuk-grid-row"><div class="govuk-grid-column-two-thirds"><h2 class="govuk-heading-m">Help improve ResearchOps</h2><p class="govuk-body">With your consent, Flux Behaviour records interaction metadata such as navigation and timing. It never records what you type.</p><button type="button" class="govuk-button" data-flux-consent="yes">Accept behavioural analytics</button> <button type="button" class="govuk-button govuk-button--secondary" data-flux-consent="no">Reject</button></div></div></div>';
	document.body.prepend(banner);
	banner.addEventListener('click', (event) => {
		const choice = event.target?.dataset?.fluxConsent;
		if (!choice) return;
		window.localStorage.setItem(CONSENT_KEY, choice);
		banner.remove();
		if (choice === 'yes') instrument();
	});
}

function instrument() {
	track('nav', 'page.loaded', { role: 'page', element_key: pageKey() });
	document.addEventListener('click', (event) => {
		const details = targetDetails(event.target);
		if (details) track('nav', 'control.click', details);
	}, true);
	document.addEventListener('focusout', (event) => {
		const details = targetDetails(event.target);
		if (details?.role === 'field') track('input', 'field.blur', details);
	}, true);
}

function targetDetails(element) {
	const target = element?.closest?.('[data-flux-key]');
	const key = target?.dataset?.fluxKey;
	if (!key || !SAFE_KEY.test(key)) return null;
	return { role: target.matches('input, select, textarea') ? 'field' : 'control', element_key: key };
}

function pageKey() {
	const key = window.location.pathname.replace(/[^A-Za-z0-9._:-]+/g, '-').replace(/^-|-$/g, '');
	return key || 'home';
}

function track(eventClass, action, details) {
	const body = {
		schema_version: '1.1.0',
		session_id: sessionId(),
		visitor_id: visitorId(),
		tenant_id: TENANT_ID,
		consent: 'yes',
		origin: 'sdk',
		event_class: eventClass,
		action,
		role: details.role,
		element_key: details.element_key,
		timestamp_ms: Date.now(),
	};
	void window.fetch(COLLECTOR_ENDPOINT, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
		keepalive: true,
		credentials: 'omit',
	});
}

function visitorId() {
	return persistentId(window.localStorage, VISITOR_KEY, 'visitor');
}

function sessionId() {
	return persistentId(window.sessionStorage, SESSION_KEY, 'session');
}

function persistentId(storage, key, prefix) {
	const existing = storage.getItem(key);
	if (existing) return existing;
	const id = `${prefix}-${crypto.randomUUID().replace(/-/g, '')}`;
	storage.setItem(key, id);
	return id;
}
