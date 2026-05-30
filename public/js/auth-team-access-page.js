/**
 * @file public/js/auth-team-access-page.js
 * @module AuthTeamAccessPage
 * @summary Request access to a ResearchOps team.
 */

function defaultApiOrigin() {
	return location.origin;
}

const API_ORIGIN = document.documentElement?.dataset?.apiOrigin || window.API_ORIGIN || defaultApiOrigin();

const CONFIG = Object.freeze({
	API_BASE: API_ORIGIN,
	CACHE: 'no-store',
	FETCH_TIMEOUT_MS: 12000,
	ACCOUNT_URL: '/pages/account/',
});

const dom = {
	form: document.getElementById('team-access-request-form'),
	teamReference: document.getElementById('team-reference'),
	teamReferenceGroup: document.getElementById('team-reference-group'),
	teamReferenceError: document.getElementById('team-reference-error'),
	message: document.getElementById('team-access-message'),
	messageGroup: document.getElementById('team-access-message-group'),
	messageError: document.getElementById('team-access-message-error'),
	errorSummary: document.getElementById('team-access-error-summary'),
	errorList: document.getElementById('team-access-error-list'),
	status: document.getElementById('team-access-status'),
	statusBody: document.getElementById('team-access-status-body'),
	submit: document.getElementById('team-access-submit'),
};

function escapeHtml(value) {
	return String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/\"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function apiUrl(path) {
	const value = String(path || '');
	if (/^https?:\/\//i.test(value)) return value;
	return `${CONFIG.API_BASE}${value.startsWith('/') ? value : `/${value}`}`;
}

function showElement(element, visible) {
	if (!element) return;
	element.hidden = !visible;
	element.setAttribute('aria-hidden', visible ? 'false' : 'true');
}

function cleanText(value) {
	return String(value || '').replace(/\s+/g, ' ').trim();
}

function clearFieldError(group, input, error) {
	group?.classList.remove('govuk-form-group--error');
	input?.classList.remove('govuk-input--error', 'govuk-textarea--error');
	if (error) {
		error.textContent = '';
		showElement(error, false);
	}
}

function setFieldError(group, input, error, message) {
	group?.classList.add('govuk-form-group--error');
	input?.classList.add(input?.tagName === 'TEXTAREA' ? 'govuk-textarea--error' : 'govuk-input--error');
	if (error) {
		error.textContent = `Error: ${message}`;
		showElement(error, true);
	}
}

function clearErrors() {
	clearFieldError(dom.teamReferenceGroup, dom.teamReference, dom.teamReferenceError);
	clearFieldError(dom.messageGroup, dom.message, dom.messageError);
	if (dom.errorList) dom.errorList.innerHTML = '';
	showElement(dom.errorSummary, false);
}

function showErrorSummary(errors) {
	if (!dom.errorSummary || !dom.errorList) return;
	dom.errorList.innerHTML = errors
		.map((error) => `<li><a href="#${escapeHtml(error.href)}">${escapeHtml(error.message)}</a></li>`)
		.join('');
	showElement(dom.errorSummary, true);
	dom.errorSummary.focus?.();
}

function validateForm() {
	const errors = [];
	const teamReference = cleanText(dom.teamReference?.value);
	const message = cleanText(dom.message?.value);

	if (!teamReference) {
		const error = { href: 'team-reference', message: 'Enter a team name or invitation code.' };
		errors.push(error);
		setFieldError(dom.teamReferenceGroup, dom.teamReference, dom.teamReferenceError, error.message);
	}

	if (message.length > 500) {
		const error = { href: 'team-access-message', message: 'Message must be 500 characters or fewer.' };
		errors.push(error);
		setFieldError(dom.messageGroup, dom.message, dom.messageError, error.message);
	}

	if (errors.length > 0) showErrorSummary(errors);
	return { errors, teamReference, message };
}

async function fetchJson(path, options = {}) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort('timeout'), CONFIG.FETCH_TIMEOUT_MS);
	try {
		const response = await fetch(apiUrl(path), {
			cache: CONFIG.CACHE,
			credentials: 'include',
			signal: controller.signal,
			...options,
			headers: {
				accept: 'application/json',
				...(options.body ? { 'content-type': 'application/json' } : {}),
				...(options.headers || {}),
			},
		});
		const text = await response.text();
		let data = {};
		try {
			data = text ? JSON.parse(text) : {};
		} catch {
			data = { ok: false, error: 'invalid_json_response', message: text };
		}
		return { data, ok: response.ok, status: response.status };
	} finally {
		clearTimeout(timer);
	}
}

function showStatus(message) {
	if (!dom.status || !dom.statusBody) return;
	dom.statusBody.innerHTML = `<p class="govuk-notification-banner__heading">${escapeHtml(message)}</p><p class="govuk-body"><a class="govuk-link" href="${CONFIG.ACCOUNT_URL}">Return to your account</a></p>`;
	showElement(dom.status, true);
	dom.status.focus?.();
}

function showServerError(message) {
	const error = { href: 'team-reference', message: message || 'Team access request could not be completed.' };
	setFieldError(dom.teamReferenceGroup, dom.teamReference, dom.teamReferenceError, error.message);
	showErrorSummary([error]);
}

async function submitRequest(event) {
	event.preventDefault();
	clearErrors();
	showElement(dom.status, false);

	const { errors, teamReference, message } = validateForm();
	if (errors.length > 0) return;

	if (dom.submit) dom.submit.disabled = true;
	try {
		const route = dom.form?.dataset?.submitRoute || '/api/team-access/requests';
		const response = await fetchJson(route, {
			method: 'POST',
			body: JSON.stringify({ teamReference, message }),
		});

		if (!response.ok || !response.data?.ok) {
			showServerError(response.data?.message);
			return;
		}

		showStatus(response.data.message || 'Your request has been sent.');
		dom.form?.reset();
	} catch (error) {
		showServerError(error?.message === 'timeout' ? 'The account service did not respond in time. Try again.' : 'ResearchOps could not contact the account service.');
	} finally {
		if (dom.submit) dom.submit.disabled = false;
	}
}

function init() {
	dom.form?.addEventListener('submit', submitRequest);
}

init();

window.__ropsAuthTeamAccessPage = Object.freeze({
	CONFIG,
	cleanText,
	defaultApiOrigin,
	validateForm,
});
