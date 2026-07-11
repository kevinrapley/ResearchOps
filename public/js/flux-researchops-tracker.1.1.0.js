const COLLECTOR_ENDPOINT = 'https://flux-behaviour.pages.dev/api/collect';
const TENANT_ID = 'researchops';
const PRODUCTION_HOSTS = new Set(['researchops.pages.dev', 'research-operations.com']);
const CONSENT_KEY = 'flux.behaviour.consent';
const VISITOR_KEY = 'flux.behaviour.visitor_id';
const SESSION_KEY = 'flux.behaviour.session_id';
const SAFE_KEY = /^[A-Za-z0-9._:-]{1,120}$/;
const CONTROL_SELECTOR = 'a,button,input,select,textarea,[role="button"],[tabindex]';
const focusState = new WeakMap();
let lastPointerType = 'unknown';

if (PRODUCTION_HOSTS.has(window.location.hostname)) startTracker();

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
	banner.innerHTML = '<div class="govuk-width-container"><div class="govuk-grid-row"><div class="govuk-grid-column-two-thirds"><h2 class="govuk-heading-m">Help improve ResearchOps</h2><p class="govuk-body">With your consent, Flux Behaviour records interaction metadata such as navigation, timing and character counts. It never records what you type.</p><button type="button" class="govuk-button" data-flux-consent="yes">Accept behavioural analytics</button> <button type="button" class="govuk-button govuk-button--secondary" data-flux-consent="no">Reject</button></div></div></div>';
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
	document.addEventListener('pointerdown', (event) => { lastPointerType = event.pointerType || 'mouse'; }, true);
	document.addEventListener('click', trackClick, true);
	document.addEventListener('keydown', trackKeyboard, true);
	document.addEventListener('focusin', beginFocus, true);
	document.addEventListener('focusout', endFocus, true);
}

function trackClick(event) {
	const details = targetDetails(event.target);
	if (!details) return;
	track('nav', 'control.click', {
		...details,
		pointer_type: lastPointerType,
		interaction_type: lastPointerType === 'touch' ? 'touch' : 'click',
	});
}

function trackKeyboard(event) {
	if (event.key === 'Tab') {
		const details = targetDetails(event.target);
		if (details) track('nav', 'control.tab', { ...details, pointer_type: 'keyboard', interaction_type: 'tab' });
	}
	const state = focusState.get(event.target);
	if (!state) return;
	if (event.key.length === 1) state.keyPressCount += 1;
	if (event.key === 'Backspace') state.backspaceCount += 1;
}

function beginFocus(event) {
	const details = editableTarget(event.target);
	if (!details) return;
	const previous = focusState.get(event.target);
	if (previous?.onInput) event.target.removeEventListener('input', previous.onInput);
	const state = { startedAt: performance.now(), keyPressCount: 0, backspaceCount: 0, editCount: 0, details, onInput: null };
	state.onInput = () => {
		const current = focusState.get(event.target);
		if (current === state) current.editCount += 1;
	};
	focusState.set(event.target, state);
	event.target.addEventListener('input', state.onInput);
}

function endFocus(event) {
	const state = focusState.get(event.target);
	if (!state) return;
	focusState.delete(event.target);
	event.target.removeEventListener('input', state.onInput);
	track('input', 'field.blur', {
		...state.details,
		duration_ms: Math.round(performance.now() - state.startedAt),
		key_press_count: state.keyPressCount,
		backspace_count: state.backspaceCount,
		edit_count: state.editCount,
		value_length: typeof event.target.value === 'string' ? event.target.value.length : 0,
		pointer_type: lastPointerType,
		interaction_type: 'input',
	});
}

function targetDetails(element) {
	const target = element?.closest?.(CONTROL_SELECTOR);
	if (isExcludedSensitiveInput(target)) return null;
	const key = stableKey(target);
	if (!target || !key) return null;
	return { role: target.matches('input, select, textarea') ? 'field' : 'control', element_key: key };
}

function editableTarget(element) {
	if (isExcludedSensitiveInput(element)) return null;
	const key = stableKey(element);
	return element?.matches?.('input:not([type="hidden"]), textarea, select') && key
		? { role: 'field', element_key: key }
		: null;
}

function isExcludedSensitiveInput(element) {
	if (!element?.matches?.('input')) return false;
	const type = (element.type || 'text').toLowerCase();
	const autocomplete = (element.autocomplete || '').toLowerCase();
	return ['password', 'email', 'tel'].includes(type) || ['one-time-code', 'current-password', 'new-password'].includes(autocomplete);
}

function stableKey(element) {
	if (typeof element?.dataset?.fluxKey === 'string' && SAFE_KEY.test(element.dataset.fluxKey)) return element.dataset.fluxKey;
	if (!element?.matches?.(CONTROL_SELECTOR)) return null;
	const position = [...document.querySelectorAll(CONTROL_SELECTOR)].indexOf(element);
	if (position < 0) return null;
	const kind = element.tagName.toLowerCase();
	const type = typeof element.type === 'string' && /^[a-z]+$/i.test(element.type) ? `.${element.type.toLowerCase()}` : '';
	return `auto.${kind}${type}.${position + 1}`;
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
	for (const key of ['value_length', 'edit_count', 'duration_ms', 'pointer_type', 'key_press_count', 'backspace_count']) {
		if (details[key] !== undefined) body[key] = details[key];
	}
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
