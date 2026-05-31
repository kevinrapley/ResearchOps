/**
 * @file public/js/auth-team-access-review-page.js
 * @module AuthTeamAccessReviewPage
 * @summary Review, approve and reject ResearchOps team access requests.
 */

function defaultApiOrigin() {
	return location.origin;
}

const API_ORIGIN = document.documentElement?.dataset?.apiOrigin || window.API_ORIGIN || defaultApiOrigin();

const CONFIG = Object.freeze({
	API_BASE: API_ORIGIN,
	CACHE: 'no-store',
	FETCH_TIMEOUT_MS: 12000,
});

const dom = {
	errorSummary: document.getElementById('team-access-review-error-summary'),
	loading: document.getElementById('team-access-review-loading'),
	empty: document.getElementById('team-access-review-empty'),
	pending: document.getElementById('team-access-review-pending'),
	list: document.getElementById('team-access-review-list'),
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

function setVisible(element, visible) {
	if (!element) return;
	element.hidden = !visible;
	element.setAttribute('aria-hidden', visible ? 'false' : 'true');
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

function showError(message) {
	if (!dom.errorSummary) return;
	dom.errorSummary.innerHTML = `
		<div role="alert">
			<h2 class="govuk-error-summary__title">There is a problem</h2>
			<div class="govuk-error-summary__body">
				<ul class="govuk-list govuk-error-summary__list">
					<li><a href="#team-access-review-pending-title">${escapeHtml(message || 'Team access requests could not be loaded.')}</a></li>
				</ul>
			</div>
		</div>
	`;
	setVisible(dom.errorSummary, true);
	dom.errorSummary.focus?.();
}

function formatDate(value) {
	if (!value) return 'Not available';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function requestCard(request) {
	const id = escapeHtml(request.id);
	const requesterName = escapeHtml(request.requesterName || 'Unknown requester');
	const requesterEmail = escapeHtml(request.requesterEmail || 'Not available');
	const teamName = escapeHtml(request.teamName || 'Requested team');
	const requestedAt = escapeHtml(formatDate(request.requestedAt));
	const message = escapeHtml(request.message || 'No message provided.');
	const reasonId = `${id}-rejection-reason`;
	const reasonHintId = `${reasonId}-hint`;
	const reasonPrivacyId = `${reasonId}-privacy-hint`;

	return `
		<section class="govuk-summary-card" aria-labelledby="${id}-title" data-team-access-review-request="${id}">
			<div class="govuk-summary-card__title-wrapper">
				<h3 class="govuk-summary-card__title" id="${id}-title">Request from ${requesterName}</h3>
				<div class="govuk-summary-card__actions">
					<strong class="govuk-tag govuk-tag--yellow">Awaiting review</strong>
				</div>
			</div>
			<div class="govuk-summary-card__content">
				<dl class="govuk-summary-list govuk-summary-list--no-border">
					<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Requester</dt><dd class="govuk-summary-list__value">${requesterName}</dd></div>
					<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Email address</dt><dd class="govuk-summary-list__value">${requesterEmail}</dd></div>
					<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Requested team</dt><dd class="govuk-summary-list__value">${teamName}</dd></div>
					<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Requested</dt><dd class="govuk-summary-list__value">${requestedAt}</dd></div>
					<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Message</dt><dd class="govuk-summary-list__value">${message}</dd></div>
				</dl>
				<div class="govuk-warning-text">
					<span class="govuk-warning-text__icon" aria-hidden="true">!</span>
					<strong class="govuk-warning-text__text"><span class="govuk-visually-hidden">Warning</span> Approving this request will make this person a member of the team. It will not give them a role or access to sensitive information.</strong>
				</div>
				<div class="govuk-button-group">
					<button class="govuk-button" type="button" data-approve-request="${id}" aria-label="Approve ${requesterName}’s request">Approve request</button>
				</div>
				<div class="govuk-form-group">
					<label class="govuk-label govuk-label--s" for="${reasonId}">Reason for not approving this request</label>
					<div id="${reasonHintId}" class="govuk-hint">Optional. Give a short reason that will help the requester understand the decision.</div>
					<p id="${reasonPrivacyId}" class="govuk-hint">Do not include participant names, contact details or sensitive research information.</p>
					<textarea class="govuk-textarea" id="${reasonId}" name="decisionReason" rows="5" maxlength="500" aria-describedby="${reasonHintId} ${reasonPrivacyId}"></textarea>
				</div>
				<div class="govuk-button-group">
					<button class="govuk-button govuk-button--warning" type="button" data-reject-request="${id}" aria-label="Reject ${requesterName}’s request">Reject request</button>
				</div>
			</div>
		</section>
	`;
}

function renderRequests(requests) {
	setVisible(dom.loading, false);
	if (!Array.isArray(requests) || requests.length === 0) {
		if (dom.list) dom.list.innerHTML = '';
		setVisible(dom.pending, false);
		setVisible(dom.empty, true);
		return;
	}
	if (dom.list) dom.list.innerHTML = requests.map(requestCard).join('');
	setVisible(dom.empty, false);
	setVisible(dom.pending, true);
}

async function loadRequests() {
	const response = await fetchJson('/api/team-access/requests/review');
	if (!response.ok || !response.data?.ok) {
		throw new Error(response.data?.message || 'Team access requests could not be loaded.');
	}
	renderRequests(response.data.requests || []);
}

async function decideRequest(requestId, decision) {
	const path = decision === 'approved' ? '/api/team-access/requests/approve' : '/api/team-access/requests/reject';
	const textarea = document.getElementById(`${requestId}-rejection-reason`);
	const body = { requestId };
	if (decision === 'rejected') body.decisionReason = textarea?.value || '';
	const response = await fetchJson(path, {
		method: 'POST',
		body: JSON.stringify(body),
	});
	if (!response.ok || !response.data?.ok) {
		throw new Error(response.data?.message || 'The decision could not be saved.');
	}
	await loadRequests();
}

function init() {
	document.addEventListener('click', async (event) => {
		const approveId = event.target?.dataset?.approveRequest;
		const rejectId = event.target?.dataset?.rejectRequest;
		try {
			if (approveId) await decideRequest(approveId, 'approved');
			if (rejectId) await decideRequest(rejectId, 'rejected');
		} catch (error) {
			showError(error?.message || 'The decision could not be saved.');
		}
	});

	loadRequests().catch((error) => {
		setVisible(dom.loading, false);
		showError(error?.message || 'Team access requests could not be loaded.');
	});
}

init();

window.__ropsAuthTeamAccessReviewPage = Object.freeze({
	CONFIG,
	requestCard,
	renderRequests,
});
