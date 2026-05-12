/**
 * @file public/js/auth-registration-requests-page.js
 * @module AuthRegistrationRequestsPage
 * @summary Team Admin view of pending account registration requests.
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

const dom = {
	status: document.getElementById('registration-requests-status'),
	statusTitle: document.getElementById('registration-requests-status-title'),
	statusBody: document.getElementById('registration-requests-status-body'),
	list: document.getElementById('registration-requests-list'),
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
}

function setStatus(title, bodyHtml) {
	if (dom.statusTitle) dom.statusTitle.textContent = title;
	if (dom.statusBody) dom.statusBody.innerHTML = bodyHtml;
}

function formatDate(value) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return 'Not recorded';
	return new Intl.DateTimeFormat('en-GB', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	}).format(date);
}

function userFacingServiceError(error) {
	const message = String(error?.message || error || '');
	if (['Load failed', 'Failed to fetch', 'NetworkError when attempting to fetch resource.'].includes(message)) {
		return 'ResearchOps could not contact the account request service. Try again later.';
	}
	if (message === 'timeout') return 'The account request service did not respond in time. Try again.';
	return message || 'Account requests could not be loaded.';
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

function renderEmptyState() {
	if (!dom.list) return;
	dom.list.innerHTML = '<p class="govuk-body">There are no pending account requests.</p>';
	setStatus('No pending requests', '<p class="govuk-body">There are no pending account requests to review.</p>');
}

function renderRequest(request) {
	return `
<div class="govuk-summary-card">
	<div class="govuk-summary-card__title-wrapper">
		<h3 class="govuk-summary-card__title">${escapeHtml(request.displayName)}</h3>
	</div>
	<div class="govuk-summary-card__content">
		<dl class="govuk-summary-list">
			<div class="govuk-summary-list__row">
				<dt class="govuk-summary-list__key">Email address</dt>
				<dd class="govuk-summary-list__value">${escapeHtml(request.email)}</dd>
			</div>
			<div class="govuk-summary-list__row">
				<dt class="govuk-summary-list__key">What they need to use ResearchOps for</dt>
				<dd class="govuk-summary-list__value">${escapeHtml(request.requestedRole?.label || 'Not recorded')}</dd>
			</div>
			<div class="govuk-summary-list__row">
				<dt class="govuk-summary-list__key">Team or service</dt>
				<dd class="govuk-summary-list__value">${escapeHtml(request.teamOrService)}</dd>
			</div>
			<div class="govuk-summary-list__row">
				<dt class="govuk-summary-list__key">Why they need access</dt>
				<dd class="govuk-summary-list__value">${escapeHtml(request.requestedReason)}</dd>
			</div>
			<div class="govuk-summary-list__row">
				<dt class="govuk-summary-list__key">Submitted</dt>
				<dd class="govuk-summary-list__value">${escapeHtml(formatDate(request.submittedAt))}</dd>
			</div>
		</dl>
		<p class="govuk-body">Use <a class="govuk-link" href="/pages/team/role-assignments/">Assign a role to a team member</a> after you have checked that this person should have access.</p>
	</div>
</div>
`;
}

function renderRequests(requests) {
	if (!dom.list) return;
	if (!requests.length) {
		renderEmptyState();
		return;
	}
	dom.list.innerHTML = requests.map(renderRequest).join('');
	setStatus(
		'Pending account requests',
		`<p class="govuk-body">There ${requests.length === 1 ? 'is 1 pending account request' : `are ${requests.length} pending account requests`}.</p>`,
	);
}

async function loadRegistrationRequests() {
	setBusy(true);
	try {
		const route = dom.status?.dataset?.registrationRequestsRoute || '/api/auth/registration-requests';
		const response = await fetchJson(route);
		if (!response.ok || !response.data?.ok) {
			throw new Error(response.data?.message || 'Account requests could not be loaded.');
		}
		renderRequests(response.data.requests || []);
	} catch (error) {
		if (dom.list) dom.list.innerHTML = '<p class="govuk-body">Account requests could not be loaded.</p>';
		setStatus('There is a problem with the service', `<p class="govuk-body">${escapeHtml(userFacingServiceError(error))}</p>`);
	} finally {
		setBusy(false);
	}
}

loadRegistrationRequests();

window.__ropsAuthRegistrationRequestsPage = Object.freeze({
	CONFIG,
	apiUrl,
	defaultApiOrigin,
	formatDate,
});
