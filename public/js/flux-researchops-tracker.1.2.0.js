const COLLECTOR_ENDPOINT = 'https://flux-behaviour.pages.dev/api/collect';
const TENANT_ID = 'researchops';
const PRODUCTION_HOSTS = new Set(['researchops.pages.dev', 'research-operations.com']);
const CONSENT_KEY = 'flux.behaviour.consent';
const VISITOR_KEY = 'flux.behaviour.visitor_id';
const SESSION_KEY = 'flux.behaviour.session_id';
const SESSION_ACTIVITY_KEY = 'flux.behaviour.session_activity_ms';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const SAFE_KEY = /^[A-Za-z0-9._:-]{1,120}$/;
const SAFE_ROLE = new Set(['field', 'form', 'control', 'page', 'service', 'environment']);
const SAFE_AUTH_MILESTONE = /^auth\.otp\.(requested|succeeded|failed)$/;
const SAFE_DATA_PURPOSE_VALUES = new Map([
	['data-act', new Set(['cancel-code-edit', 'cancel-delete', 'cancel-memo-edit', 'confirm-delete', 'confirm-delete-code', 'confirm-delete-memo', 'delete', 'delete-code', 'delete-memo', 'edit-code', 'edit-memo'])],
	['data-action', new Set(['ask-remove', 'cancel-remove', 'confirm-remove'])],
	['data-analysis', new Set(['co-occurrence', 'export', 'retrieval', 'timeline'])],
	['data-cooccurrence-panel', new Set(['chart', 'clustered', 'heatmap', 'small-multiples', 'stacked', 'table'])],
	['data-filter', new Set(['all', 'decisions', 'introspections', 'perceptions', 'procedures'])],
	['data-memo-filter', new Set(['all', 'analytical', 'methodological', 'reflexive', 'theoretical'])],
	['data-participants-page', new Set(['next', 'previous'])],
	['data-project-action', new Set(['start'])],
]);
const CONTROL_SELECTOR = 'a,button,input,select,textarea,[role="button"]';
const SEMANTIC_SELECTOR = `${CONTROL_SELECTOR},form,details`;
const focusState = new WeakMap();
const fieldVisits = new Map();
const recentClicks = [];
const RECENT_INTERACTION_MS = 1000;
let lastPointer = { target: null, type: 'unknown', at: Number.NEGATIVE_INFINITY };
let lastKeyboard = { target: null, at: Number.NEGATIVE_INFINITY };

window.researchOpsFlux = Object.freeze({ milestone });

if (PRODUCTION_HOSTS.has(window.location.hostname)) startTracker();

function startTracker() {
	annotateInteractiveElements(document);
	observeInteractiveElements();
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
	document.addEventListener('pointerdown', recordPointer, true);
	document.addEventListener('click', trackClick, true);
	document.addEventListener('keydown', trackKeyboard, true);
	document.addEventListener('paste', trackPaste, true);
	document.addEventListener('focusin', beginFocus, true);
	document.addEventListener('focusout', endFocus, true);
	document.addEventListener('submit', trackSubmit, true);
	document.addEventListener('invalid', trackInvalid, true);
	document.addEventListener('toggle', trackHelp, true);
}

function annotateInteractiveElements(root) {
	if (root?.matches?.(SEMANTIC_SELECTOR)) ensureSemanticAttributes(root);
	for (const element of root?.querySelectorAll?.(SEMANTIC_SELECTOR) ?? []) ensureSemanticAttributes(element);
}

function observeInteractiveElements() {
	if (typeof MutationObserver !== 'function' || !document.documentElement) return;
	const observer = new MutationObserver((records) => {
		for (const record of records) {
			for (const node of record.addedNodes) {
				if (node?.nodeType === 1) annotateInteractiveElements(node);
			}
		}
	});
	observer.observe(document.documentElement, { childList: true, subtree: true });
}

function trackClick(event) {
	const details = targetDetails(event.target);
	if (!details) return;
	track('nav', 'control.click', {
		...details,
		pointer_type: lastPointer.type,
		interaction_type: lastPointer.type === 'touch' ? 'touch' : 'click',
	});
	recordRage(details);
}

function trackKeyboard(event) {
	const details = targetDetails(event.target);
	const activationKey = event.key === 'Enter' || event.key === ' ';
	if (event.key === 'Tab' || (activationKey && !editableTarget(event.target))) {
		lastKeyboard = { target: event.target, at: performance.now() };
	}
	if (event.key === 'Tab') {
		if (details) track('nav', 'control.tab', { ...details, pointer_type: 'keyboard', interaction_type: 'tab' });
	}
	if (details && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') track('kbd', 'edit.undo', details);
	if (details && (event.metaKey || event.ctrlKey) && ['a', 'c', 'x', 'f'].includes(event.key.toLowerCase())) track('kbd', 'act.shortcut', details);
	const state = focusState.get(event.target);
	if (!state) return;
	if (event.key.length === 1) state.keyPressCount += 1;
	if (event.key === 'Backspace') state.backspaceCount += 1;
}

function recordPointer(event) {
	lastPointer = {
		target: event.target,
		type: event.pointerType || 'mouse',
		at: performance.now()
	};
}

function trackPaste(event) {
	const state = focusState.get(event.target);
	const details = state?.details ?? editableTarget(event.target);
	if (!details) return;
	if (state) state.pasteCount += 1;
	track('input', 'edit.paste', details);
}

function beginFocus(event) {
	const details = editableTarget(event.target);
	if (!details) return;
	const previous = focusState.get(event.target);
	if (previous?.onInput) event.target.removeEventListener('input', previous.onInput);
	const revisitCount = (fieldVisits.get(details.element_key) ?? 0) + 1;
	fieldVisits.set(details.element_key, revisitCount);
	if (revisitCount > 1) track('input', 'field.revisit', { ...details, revisit_count: revisitCount });
	const now = performance.now();
	const recentPointer = now - lastPointer.at <= RECENT_INTERACTION_MS;
	const recentKeyboard = now - lastKeyboard.at <= RECENT_INTERACTION_MS;
	let focusOrigin = 'programmatic';
	let focusPointerType;
	if (recentPointer && pointerInitiatedFocus(lastPointer.target, event.target)) {
		focusOrigin = 'pointer';
		focusPointerType = lastPointer.type;
	} else if (recentKeyboard) {
		focusOrigin = 'keyboard';
		focusPointerType = 'keyboard';
	} else if (event.target?.dataset?.fluxAutofocus === 'true' && recentPointer) {
		focusOrigin = 'auto';
	}
	track('focus', `field.focus.${focusOrigin}`, {
		...details,
		...(focusPointerType ? { pointer_type: focusPointerType } : {})
	});
	const state = { startedAt: performance.now(), keyPressCount: 0, backspaceCount: 0, editCount: 0, pasteCount: 0, revisitCount, details, onInput: null };
	state.onInput = () => {
		const current = focusState.get(event.target);
		if (current === state) current.editCount += 1;
	};
	focusState.set(event.target, state);
	event.target.addEventListener('input', state.onInput);
}

function pointerInitiatedFocus(pointerTarget, focusTarget) {
	return pointerTarget === focusTarget || pointerTarget?.control === focusTarget;
}

function endFocus(event) {
	const state = focusState.get(event.target);
	if (!state) return;
	focusState.delete(event.target);
	event.target.removeEventListener('input', state.onInput);
	const now = performance.now();
	const exitPointerType = now - lastPointer.at <= RECENT_INTERACTION_MS && lastPointer.target !== event.target
		? lastPointer.type
		: now - lastKeyboard.at <= RECENT_INTERACTION_MS ? 'keyboard' : 'unknown';
	track('input', 'field.blur', {
		...state.details,
		duration_ms: Math.round(performance.now() - state.startedAt),
		key_press_count: state.keyPressCount,
		backspace_count: state.backspaceCount,
		edit_count: state.editCount,
		paste_count: state.pasteCount,
		chars_per_minute: state.keyPressCount > 0 ? Math.min(2000, Math.round((state.keyPressCount * 60000) / Math.max(1, performance.now() - state.startedAt))) : 0,
		revisit_count: state.revisitCount,
		value_length: typeof event.target.value === 'string' ? event.target.value.length : 0,
		pointer_type: exitPointerType,
		interaction_type: 'input',
	});
}

function trackSubmit(event) {
	const form = event.target?.matches?.('form') ? event.target : null;
	if (form) track('nav', 'flow.submit', { role: 'form', element_key: formKey(form) });
}

function trackInvalid(event) {
	const details = editableTarget(event.target);
	if (details) track('input', 'error.invalid', details);
}

function trackHelp(event) {
	const details = event.target;
	if (details?.matches?.('details[open]')) track('assist', 'assist.help', { role: 'control', element_key: detailsKey(details) });
}

function recordRage(details) {
	const now = performance.now();
	recentClicks.push({ key: details.element_key, at: now });
	while (recentClicks.length && now - recentClicks[0].at > 700) recentClicks.shift();
	if (recentClicks.filter((click) => click.key === details.element_key).length === 3) track('nav', 'act.rage', details);
}

function targetDetails(element) {
	const target = element?.closest?.(CONTROL_SELECTOR);
	if (isExcludedSensitiveInput(target)) return null;
	const key = stableKey(target);
	if (!target || !key) return null;
	return { role: semanticRole(target, target.matches('input, select, textarea') ? 'field' : 'control'), element_key: key };
}

function editableTarget(element) {
	if (isExcludedSensitiveInput(element)) return null;
	const key = stableKey(element);
	return element?.matches?.('input:not([type="hidden"]), textarea, select') && key
		? { role: semanticRole(element, 'field'), element_key: key }
		: null;
}

function isExcludedSensitiveInput(element) {
	if (element?.dataset?.fluxSensitive === 'true') return true;
	if (!element?.matches?.('input')) return false;
	const type = (element.type || 'text').toLowerCase();
	const autocomplete = (element.autocomplete || '').toLowerCase();
	return ['password', 'email', 'tel'].includes(type) || ['one-time-code', 'current-password', 'new-password'].includes(autocomplete);
}

function stableKey(element) {
	if (typeof element?.dataset?.fluxKey === 'string' && SAFE_KEY.test(element.dataset.fluxKey)) return element.dataset.fluxKey;
	const semanticKey = ensureSemanticAttributes(element);
	if (semanticKey) return semanticKey;
	if (!element?.matches?.(SEMANTIC_SELECTOR)) return null;
	const position = [...document.querySelectorAll(CONTROL_SELECTOR)].indexOf(element);
	if (position < 0) return null;
	const kind = element.tagName.toLowerCase();
	const type = typeof element.type === 'string' && /^[a-z]+$/i.test(element.type) ? `.${element.type.toLowerCase()}` : '';
	return `auto.${kind}${type}.${position + 1}`;
}

function ensureSemanticAttributes(element) {
	if (!element?.matches?.(SEMANTIC_SELECTOR)) return null;
	const type = semanticControlType(element);
	const role = type === 'field' ? 'field' : type === 'form' ? 'form' : 'control';
	if (typeof element?.dataset?.fluxKey === 'string' && SAFE_KEY.test(element.dataset.fluxKey)) {
		if (!SAFE_ROLE.has(element.dataset.fluxRole)) element.setAttribute?.('data-flux-role', role);
		return element.dataset.fluxKey;
	}
	const purpose = semanticPurpose(element, type);
	if (!type || !purpose) return null;
	const scope = type === 'link' ? 'navigation' : pageScope();
	const key = `${type}.${scope}.${purpose}`.slice(0, 120).replace(/[.:-]+$/, '');
	if (!SAFE_KEY.test(key)) return null;
	element.setAttribute?.('data-flux-key', key);
	element.setAttribute?.('data-flux-role', role);
	return key;
}

function semanticControlType(element) {
	const tag = String(element?.tagName || '').toLowerCase();
	if (tag === 'a') return 'link';
	if (['input', 'select', 'textarea'].includes(tag)) return 'field';
	if (tag === 'form') return 'form';
	return 'button';
}

function semanticPurpose(element, type) {
	const dataPurpose = semanticDataPurpose(element);
	const hrefPurpose = type === 'link' ? semanticHref(element.getAttribute?.('href') || element.href) : '';
	const form = element.closest?.('form');
	const container = element.closest?.('nav[id], section[id], article[id], [role="region"][id]');
	const identifier = type === 'field' ? element.name || element.id : element.id || element.name;
	const candidate = identifier
		|| dataPurpose
		|| element.getAttribute?.('aria-controls')
		|| hrefPurpose
		|| form?.id
		|| form?.name
		|| container?.id
		|| (type === 'field' ? element.type || 'field' : type === 'form' ? 'form' : element.type || 'control');
	return semanticSlug(candidate);
}

function semanticDataPurpose(element) {
	for (const [name, values] of SAFE_DATA_PURPOSE_VALUES) {
		const value = element.getAttribute?.(name);
		if (!values.has(value)) continue;
		if (name === 'data-act' || name === 'data-action') return value;
		return `${name.slice(5)}-${value}`;
	}
	const name = [...(element.attributes ?? [])]
		.map((attribute) => attribute?.name || '')
		.find((attributeName) => attributeName.startsWith('data-') && !['data-flux-key', 'data-flux-role', 'data-flux-sensitive', 'data-module'].includes(attributeName));
	return name?.slice(5) || '';
}

function semanticHref(value) {
	const href = String(value || '').trim();
	if (!href || href === '#') return '';
	try {
		const origin = window.location.origin;
		const url = new URL(href, origin && origin !== 'null' ? origin : 'https://research-operations.com');
		if (url.protocol === 'mailto:') return 'contact-email';
		if (url.protocol === 'tel:') return 'contact-telephone';
		if (!['http:', 'https:'].includes(url.protocol)) return 'external-action';
		const hash = url.hash.replace(/^#/, '');
		const path = url.pathname.replace(/^\/pages\/?/, '').replace(/^\/+|\/+$/g, '');
		return hash || path || (url.pathname === '/' ? 'home' : '');
	} catch {
		return '';
	}
}

function semanticSlug(value) {
	return String(value || '')
		.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
		.toLowerCase()
		.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/g, '')
		.replace(/(^|-)(rec[a-z0-9]{10,}|[a-f0-9]{12,}|\d{4,})(?=-|$)/g, '$1')
		.replace(/^(btn|button|link|input)-/, '')
		.replace(/-(btn|button|link|input)$/, '')
		.replace(/(^|-)desc($|-)/g, '$1description$2')
		.replace(/(^|-)\d+(?=-|$)/g, '$1')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
}

function pageScope() {
	const declared = typeof document.body?.dataset?.fluxPage === 'string' && SAFE_KEY.test(document.body.dataset.fluxPage)
		? document.body.dataset.fluxPage.replace(/^page\./, '').toLowerCase()
		: '';
	const path = declared || window.location.pathname.replace(/^\/pages\/?/, '').replace(/^\/+|\/+$/g, '').toLowerCase();
	for (const [prefix, scope] of [
		['projects-journals', 'journal'],
		['journal', 'journal'],
		['project', 'project'],
		['projects', 'project'],
		['account', 'account'],
		['repository', 'repository'],
		['sourcebook', 'sourcebook'],
		['study', 'study'],
		['consent', 'consent'],
		['search', 'search'],
		['sessions', 'session'],
		['start', 'start'],
		['team', 'team'],
		['compliance', 'compliance'],
		['notes', 'notes'],
		['product-proof', 'product'],
		['home', 'home'],
	]) {
		if (path === prefix || path.startsWith(`${prefix}-`) || path.startsWith(`${prefix}/`)) return scope;
	}
	return semanticSlug(path).split('-')[0] || 'page';
}

function pageKey() {
	const declared = document.body?.dataset?.fluxPage;
	if (typeof declared === 'string' && SAFE_KEY.test(declared)) return declared;
	const key = window.location.pathname.replace(/^\/pages\/?/, '').replace(/\/?$/, '').replace(/[^A-Za-z0-9._:-]+/g, '-').replace(/^-|-$/g, '');
	return `page.${key || 'home'}`;
}

function formKey(form) {
	const declared = stableKey(form);
	if (declared) return declared;
	const position = [...document.forms].indexOf(form);
	return `form.${pageKey()}.${Math.max(0, position) + 1}`;
}

function detailsKey(details) {
	const declared = stableKey(details);
	if (declared) return declared;
	const position = [...document.querySelectorAll('details')].indexOf(details);
	return `auto.details.${Math.max(0, position) + 1}`;
}

function semanticRole(element, fallback) {
	const declared = element?.dataset?.fluxRole;
	return SAFE_ROLE.has(declared) ? declared : fallback;
}

function milestone(action) {
	try {
		if (!PRODUCTION_HOSTS.has(window.location.hostname)) return false;
		if (window.localStorage.getItem(CONSENT_KEY) !== 'yes') return false;
		if (!SAFE_AUTH_MILESTONE.test(action)) return false;
		track('trust', action, { role: 'service', element_key: 'auth.otp' });
		return true;
	} catch {
		return false;
	}
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
	for (const key of ['value_length', 'edit_count', 'duration_ms', 'pointer_type', 'key_press_count', 'backspace_count', 'paste_count', 'chars_per_minute', 'revisit_count']) {
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
	const now = Date.now();
	const existing = window.sessionStorage.getItem(SESSION_KEY);
	const lastActivity = Number(window.sessionStorage.getItem(SESSION_ACTIVITY_KEY));
	if (existing && Number.isFinite(lastActivity) && lastActivity > 0 && now - lastActivity < SESSION_TIMEOUT_MS) {
		window.sessionStorage.setItem(SESSION_ACTIVITY_KEY, now);
		return existing;
	}
	const id = `session-${crypto.randomUUID().replace(/-/g, '')}`;
	window.sessionStorage.setItem(SESSION_KEY, id);
	window.sessionStorage.setItem(SESSION_ACTIVITY_KEY, now);
	return id;
}

function persistentId(storage, key, prefix) {
	const existing = storage.getItem(key);
	if (existing) return existing;
	const id = `${prefix}-${crypto.randomUUID().replace(/-/g, '')}`;
	storage.setItem(key, id);
	return id;
}
