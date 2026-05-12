/**
 * @file public/js/auth-registration-page.js
 * @module AuthRegistrationPage
 * @summary Account registration request form behaviour.
 */

function defaultApiOrigin() {
	if (location.hostname.endsWith('.researchops.pages.dev') && location.hostname !== 'researchops.pages.dev') {
		return 'https://rops-api-passwordless-preview.digikev-kevin-rapley.workers.dev';
	}
	if (location.hostname.endsWith('pages.dev')) {
		return 'https://rops-api.digikev-kevin-rapley.workers.dev';
	}
	return location.origin;
}

const API_ORIGIN = document.documentElement?.dataset?.apiOrigin || window.API_ORIGIN || defaultApiOrigin();

const CONFIG = Object.freeze({
	API_BASE: API_ORIGIN,
	CACHE: 'no-store',
	FETCH_TIMEOUT_MS: 12000,
});

const ERROR_MESSAGES = Object.freeze({
	display_name_required: 'Enter your full name.',
	display_name_too_short: 'Enter your full name.',
	display_name_too_long: 'Full name must be 120 characters or fewer.',
	email_required: 'Enter your email address.',
	email_invalid: 'Enter an email address in the correct format, like name@example.com.',
	team_or_service_required: 'Enter the team or service you need access for.',
	team_or_service_too_long: 'Team or service name must be 160 characters or fewer.',
	requested_role_required: 'Select the role that best describes what you will do.',
	requested_role_invalid: 'Select the role that best describes what you will do.',
	other_role_required: 'Enter the role that best describes what you will do.',
	other_role_too_long: 'Role name must be 120 characters or fewer.',
	requested_reason_required: 'Enter why you need access.',
	requested_reason_too_short: 'Tell us a little more about why you need access.',
	requested_reason_too_long: 'Reason for access must be 800 characters or fewer.',
});

const FIELD_MAP = Object.freeze({
	display_name_required: 'display-name',
	display_name_too_short: 'display-name',
	display_name_too_long: 'display-name',
	email_required: 'registration-email',
	email_invalid: 'registration-email',
	team_or_service_required: 'team-or-service',
	team_or_service_too_long: 'team-or-service',
	requested_role_required: 'requested-role-user-researcher',
	requested_role_invalid: 'requested-role-user-researcher',
	other_role_required: 'other-role',
	other_role_too_long: 'other-role',
	requested_reason_required: 'requested-reason',
	requested_reason_too_short: 'requested-reason',
	requested_reason_too_long: 'requested-reason',
});

const GROUP_MAP = Object.freeze({
	'display-name': 'display-name-group',
	'registration-email': 'registration-email-group',
	'team-or-service': 'team-or-service-group',
	'requested-role-user-researcher': 'requested-role-group',
	'other-role': 'other-role-group',
	'requested-reason': 'requested-reason-group',
});

const ERROR_ELEMENT_MAP = Object.freeze({
	'display-name': 'display-name-error',
	'registration-email': 'registration-email-error',
	'team-or-service': 'team-or-service-error',
	'requested-role-user-researcher': 'requested-role-error',
	'other-role': 'other-role-error',
	'requested-reason': 'requested-reason-error',
});

const dom = {
	errorSummary: document.getElementById('registration-error-summary'),
	errorList: document.getElementById('registration-error-list'),
	form: document.getElementById('registration-request-form'),
	status: document.getElementById('registration-status'),
	statusTitle: document.getElementById('registration-status-title'),
	statusBody: document.getElementById('registration-status-body'),
	displayName: document.getElementById('display-name'),
	email: document.getElementById('registration-email'),
	teamOrService: document.getElementById('team-or-service'),
	otherRoleGroup: document.getElementById('other-role-group'),
	otherRole: document.getElementById('other-role'),
	requestedReason: document.getElementById('requested-reason'),
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

function setBusy(isBusy) {
	if (!dom.status) return;
	dom.status.setAttribute('aria-busy', isBusy ? 'true' : 'false');
	const submitButton = dom.form?.querySelector('button[type="submit"]');
	if (submitButton) submitButton.disabled = isBusy;
}

function setStatus(title, bodyHtml) {
	if (dom.statusTitle) dom.statusTitle.textContent = title;
	if (dom.statusBody) dom.statusBody.innerHTML = bodyHtml;
}

function selectedRoleKey() {
	return dom.form?.querySelector('input[name="requestedRoleKey"]:checked')?.value || '';
}

function setOtherRoleVisibility() {
	const visible = selectedRoleKey() === 'other';
	if (!dom.otherRoleGroup) return;
	dom.otherRoleGroup.hidden = !visible;
	dom.otherRoleGroup.setAttribute('aria-hidden', visible ? 'false' : 'true');
	if (!visible && dom.otherRole) dom.otherRole.value = '';
}

function addDescribedBy(input, errorId) {
	if (!input || !errorId) return;
	const existing = (input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
	if (!existing.includes(errorId)) existing.push(errorId);
	input.setAttribute('aria-describedby', existing.join(' '));
}

function removeDescribedBy(input, errorId) {
	if (!input || !errorId) return;
	const next = (input.getAttribute('aria-describedby') || '').split(/\s+/).filter((id) => id && id !== errorId);
	if (next.length) input.setAttribute('aria-describedby', next.join(' '));
	else input.removeAttribute('aria-describedby');
}

function clearErrors() {
	dom.errorSummary.hidden = true;
	if (dom.errorList) dom.errorList.innerHTML = '';
	document.title = document.title.replace(/^Error: /, '');
	for (const [inputId, groupId] of Object.entries(GROUP_MAP)) {
		const group = document.getElementById(groupId);
		const errorElement = document.getElementById(ERROR_ELEMENT_MAP[inputId]);
		const input = document.getElementById(inputId);
		group?.classList.remove('govuk-form-group--error');
		if (errorElement) {
			errorElement.hidden = true;
			errorElement.textContent = '';
		}
		removeDescribedBy(input, ERROR_ELEMENT_MAP[inputId]);
	}
}

function showFieldError(fieldId, message) {
	const group = document.getElementById(GROUP_MAP[fieldId]);
	const errorElement = document.getElementById(ERROR_ELEMENT_MAP[fieldId]);
	const input = document.getElementById(fieldId);
	group?.classList.add('govuk-form-group--error');
	if (errorElement) {
		errorElement.hidden = false;
		errorElement.innerHTML = `<span class="govuk-visually-hidden">Error:</span> ${escapeHtml(message)}`;
	}
	addDescribedBy(input, ERROR_ELEMENT_MAP[fieldId]);
}

function showErrorSummary(errors) {
	if (!dom.errorSummary || !dom.errorList || !errors.length) return;
	dom.errorList.innerHTML = errors
		.map((error) => `<li><a href="#${escapeHtml(error.fieldId)}">${escapeHtml(error.message)}</a></li>`)
		.join('');
	dom.errorSummary.hidden = false;
	dom.errorSummary.focus();
	if (!document.title.startsWith('Error: ')) document.title = `Error: ${document.title}`;
}

function collectClientErrors() {
	const errors = [];
	const displayName = String(dom.displayName?.value || '').trim();
	const email = String(dom.email?.value || '').trim();
	const teamOrService = String(dom.teamOrService?.value || '').trim();
	const roleKey = selectedRoleKey();
	const otherRole = String(dom.otherRole?.value || '').trim();
	const requestedReason = String(dom.requestedReason?.value || '').trim();

	if (!displayName) errors.push({ fieldId: 'display-name', message: ERROR_MESSAGES.display_name_required });
	else if (displayName.length > 120) errors.push({ fieldId: 'display-name', message: ERROR_MESSAGES.display_name_too_long });

	if (!email) errors.push({ fieldId: 'registration-email', message: ERROR_MESSAGES.email_required });
	else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push({ fieldId: 'registration-email', message: ERROR_MESSAGES.email_invalid });

	if (!teamOrService) errors.push({ fieldId: 'team-or-service', message: ERROR_MESSAGES.team_or_service_required });
	else if (teamOrService.length > 160) errors.push({ fieldId: 'team-or-service', message: ERROR_MESSAGES.team_or_service_too_long });

	if (!roleKey) errors.push({ fieldId: 'requested-role-user-researcher', message: ERROR_MESSAGES.requested_role_required });
	if (roleKey === 'other' && !otherRole) errors.push({ fieldId: 'other-role', message: ERROR_MESSAGES.other_role_required });
	else if (roleKey === 'other' && otherRole.length > 120) errors.push({ fieldId: 'other-role', message: ERROR_MESSAGES.other_role_too_long });

	if (!requestedReason) errors.push({ fieldId: 'requested-reason', message: ERROR_MESSAGES.requested_reason_required });
	else if (requestedReason.length < 12) errors.push({ fieldId: 'requested-reason', message: ERROR_MESSAGES.requested_reason_too_short });
	else if (requestedReason.length > 800) errors.push({ fieldId: 'requested-reason', message: ERROR_MESSAGES.requested_reason_too_long });

	return errors;
}

function showErrors(errors) {
	clearErrors();
	for (const error of errors) showFieldError(error.fieldId, error.message);
	showErrorSummary(errors);
}

function apiErrorToFieldError(data = {}) {
	const code = data.error || '';
	return {
		fieldId: FIELD_MAP[code] || 'requested-reason',
		message: ERROR_MESSAGES[code] || data.message || 'Check the information you have entered.',
	};
}

function userFacingServiceError(error) {
	const message = String(error?.message || error || '');
	if (['Load failed', 'Failed to fetch', 'NetworkError when attempting to fetch resource.'].includes(message)) {
		return 'ResearchOps could not contact the registration service. Try again later.';
	}
	if (message === 'timeout') return 'The registration service did not respond in time. Try again.';
	return message || 'Registration request could not be completed.';
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
			data = { ok: false, error: 'invalid_response', message: text };
		}
		return { data, ok: response.ok, status: response.status };
	} finally {
		clearTimeout(timer);
	}
}

function buildPayload() {
	return {
		displayName: dom.displayName?.value || '',
		email: dom.email?.value || '',
		teamOrService: dom.teamOrService?.value || '',
		requestedRoleKey: selectedRoleKey(),
		otherRole: dom.otherRole?.value || '',
		requestedReason: dom.requestedReason?.value || '',
	};
}

function showSuccess() {
	clearErrors();
	dom.form.hidden = true;
	setStatus(
		'Request sent',
		`
<p class="govuk-body">Your request has been sent to a Team Admin for review.</p>
<p class="govuk-body">You will not be given any ResearchOps role until a Team Admin has reviewed and approved your access.</p>
<p class="govuk-body"><a class="govuk-link" href="/pages/account/sign-in/">Go to sign in</a></p>
`,
	);
	dom.status?.focus?.();
}

async function submitRegistrationRequest(event) {
	event.preventDefault();
	const clientErrors = collectClientErrors();
	if (clientErrors.length) {
		showErrors(clientErrors);
		return;
	}

	clearErrors();
	setBusy(true);
	setStatus('Sending your request', '<p class="govuk-body">Sending your request to the review queue.</p>');

	try {
		const route = dom.status?.dataset?.registrationRoute || '/api/auth/registration-requests';
		const response = await fetchJson(route, {
			method: 'POST',
			body: JSON.stringify(buildPayload()),
		});
		if (!response.ok || !response.data?.ok) {
			showErrors([apiErrorToFieldError(response.data)]);
			setStatus('There is a problem', '<p class="govuk-body">Check the information you have entered.</p>');
			return;
		}
		showSuccess();
	} catch (error) {
		setStatus('There is a problem with the service', `<p class="govuk-body">${escapeHtml(userFacingServiceError(error))}</p>`);
	} finally {
		setBusy(false);
	}
}

function init() {
	if (!dom.form) return;
	dom.form.addEventListener('submit', submitRegistrationRequest);
	dom.form.querySelectorAll('input[name="requestedRoleKey"]').forEach((input) => {
		input.addEventListener('change', setOtherRoleVisibility);
	});
	setOtherRoleVisibility();
}

init();

window.__ropsAuthRegistrationPage = Object.freeze({
	CONFIG,
	ERROR_MESSAGES,
	apiUrl,
	collectClientErrors,
	defaultApiOrigin,
	selectedRoleKey,
});
