/**
 * @file public/js/auth-account-page.js
 * @module AuthAccountPage
 * @summary Signed-in ResearchOps account dashboard.
 */

const ACTIONS = Object.freeze([
	{
		permission: 'role.assign',
		label: 'Manage team roles',
		href: '/pages/team/role-assignments/',
	},
	{
		permission: 'governed.approve',
		label: 'Review governed approvals',
		href: '/pages/projects/',
	},
	{
		permission: 'safeguarding.view',
		label: 'View safeguarding work',
		href: '/pages/projects/',
	},
	{
		permission: 'audit.view',
		label: 'View audit activity',
		href: '/pages/projects/',
	},
]);

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
	SIGN_IN_URL: '/pages/account/sign-in/',
});

const dom = {
	status: document.getElementById('account-status'),
	statusTitle: document.getElementById('account-status-title'),
	statusBody: document.getElementById('account-status-body'),
	dashboard: document.getElementById('account-dashboard'),
	title: document.getElementById('account-dashboard-title'),
	user: document.getElementById('account-user-value'),
	teamMemberships: document.getElementById('account-team-memberships'),
	actions: document.getElementById('account-actions'),
	noActions: document.getElementById('account-no-actions'),
	permissions: document.getElementById('account-permissions'),
	logout: document.getElementById('account-logout'),
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

function setVisible(element, visible) {
	if (!element) return;
	element.hidden = !visible;
	element.setAttribute('aria-hidden', visible ? 'false' : 'true');
}

function setStatus(title, bodyHtml) {
	if (dom.statusTitle) dom.statusTitle.textContent = title;
	if (dom.statusBody) dom.statusBody.innerHTML = bodyHtml;
}

function userFacingError(error) {
	const message = String(error?.message || error || '');
	if (['Load failed', 'Failed to fetch', 'NetworkError when attempting to fetch resource.'].includes(message)) {
		return 'ResearchOps could not contact the account service.';
	}
	if (message === 'timeout') return 'The account service did not respond in time. Try again.';
	return message || 'Something went wrong.';
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

function displayName(context) {
	const rawName = context?.user?.displayName || context?.user?.email || 'there';
	return String(rawName).includes('@') ? String(rawName).split('@')[0] : rawName;
}

function labelList(items, emptyLabel) {
	const labels = (items || [])
		.map((item) => item.label || item.name || item.code || item.key)
		.filter(Boolean)
		.sort((first, second) => first.localeCompare(second));
	return labels.length ? labels.join(', ') : emptyLabel;
}

function teamMemberships(context) {
	const memberships = context?.teamMemberships || context?.memberTeams || [];
	const activeTeamId = context?.activeTeam?.id;
	return memberships.map((team) => ({
		...team,
		current: Boolean(activeTeamId && team.id === activeTeamId),
	}));
}

function permissionCodes(context) {
	return new Set((context?.permissions || []).map((permission) => permission.code).filter(Boolean));
}

function permissionLabels(context) {
	return (context?.permissions || [])
		.map((permission) => permission.label || permission.code)
		.filter(Boolean)
		.sort((first, second) => first.localeCompare(second));
}

function renderTeamMemberships(context) {
	if (!dom.teamMemberships) return;
	const memberships = teamMemberships(context);

	if (memberships.length === 0) {
		dom.teamMemberships.innerHTML = '<p class="govuk-body">You are not currently a member of any team.</p>';
		return;
	}

	dom.teamMemberships.innerHTML = `
		<table class="govuk-table">
			<caption class="govuk-table__caption govuk-table__caption--s">Team membership and role access</caption>
			<thead class="govuk-table__head">
				<tr class="govuk-table__row">
					<th scope="col" class="govuk-table__header">Team</th>
					<th scope="col" class="govuk-table__header">Role or roles</th>
					<th scope="col" class="govuk-table__header">Permissions</th>
				</tr>
			</thead>
			<tbody class="govuk-table__body">
				${memberships
					.map(
						(team) => `
							<tr class="govuk-table__row">
								<th scope="row" class="govuk-table__header">
									${escapeHtml(team.name || team.id || 'Unnamed team')}
									${team.current ? '<strong class="govuk-tag govuk-tag--blue">Current</strong>' : ''}
								</th>
								<td class="govuk-table__cell">${escapeHtml(labelList(team.roles, 'No active role'))}</td>
								<td class="govuk-table__cell">${escapeHtml(labelList(team.permissions, 'No active permissions'))}</td>
							</tr>
						`,
					)
					.join('')}
			</tbody>
		</table>
	`;
}

function renderActions(context) {
	const codes = permissionCodes(context);
	const allowedActions = ACTIONS.filter((action) => codes.has(action.permission));
	if (!dom.actions || !dom.noActions) return;

	dom.actions.innerHTML = allowedActions
		.map((action) => `<a class="govuk-button" href="${escapeHtml(action.href)}">${escapeHtml(action.label)}</a>`)
		.join('');
	setVisible(dom.noActions, allowedActions.length === 0);
}

function renderPermissions(context) {
	if (!dom.permissions) return;
	const labels = permissionLabels(context);
	dom.permissions.innerHTML = labels.length
		? labels.map((label) => `<li>${escapeHtml(label)}</li>`).join('')
		: '<li>No active permissions for the current team context</li>';
}

function renderDashboard(context) {
	const name = displayName(context);
	if (dom.title) dom.title.textContent = `Welcome, ${name}. Here is your account dashboard`;
	if (dom.user) dom.user.textContent = context?.user?.displayName || context?.user?.email || 'Not available';
	renderTeamMemberships(context);
	renderActions(context);
	renderPermissions(context);
	setVisible(dom.status, false);
	setVisible(dom.dashboard, true);
}

function renderUnauthenticated() {
	location.assign(CONFIG.SIGN_IN_URL);
}

function renderAccountProblem(message) {
	setStatus('We could not load your account', `<p class="govuk-body">${escapeHtml(message)}</p>`);
	setVisible(dom.dashboard, false);
	setVisible(dom.status, true);
}

async function loadAccount() {
	setBusy(true);
	try {
		const response = await fetchJson('/api/me');
		if (response.status === 401 || response.status === 403) {
			renderUnauthenticated();
			return;
		}
		if (!response.ok || !response.data?.ok) {
			throw new Error(response.data?.message || `Could not load /api/me (${response.status})`);
		}
		renderDashboard(response.data);
	} catch (error) {
		renderAccountProblem(userFacingError(error));
	} finally {
		setBusy(false);
	}
}

async function logout() {
	if (dom.logout) dom.logout.disabled = true;
	try {
		await fetchJson('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) });
	} finally {
		location.assign(CONFIG.SIGN_IN_URL);
	}
}

function init() {
	dom.logout?.addEventListener('click', logout);
	loadAccount();
}

init();

window.__ropsAuthAccountPage = Object.freeze({
	ACTIONS,
	CONFIG,
	defaultApiOrigin,
	displayName,
	permissionCodes,
	renderDashboard,
	teamMemberships,
});
