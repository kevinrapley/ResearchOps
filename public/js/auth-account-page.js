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
	actionsSection: document.getElementById('account-actions-section'),
	actions: document.getElementById('account-actions'),
	permissionsDetails: document.getElementById('account-permissions-details'),
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

function fallbackActiveTeamMembership(context) {
	if (!context?.activeTeam?.id) return [];
	return [
		{
			...context.activeTeam,
			roles: context.roles || [],
			permissions: context.permissions || [],
			current: true,
			fallbackFromActiveTeam: true,
		},
	];
}

function teamMemberships(context) {
	const explicitMemberships = context?.teamMemberships || context?.memberTeams || [];
	const memberships = explicitMemberships.length ? explicitMemberships : fallbackActiveTeamMembership(context);
	const activeTeamId = context?.activeTeam?.id;
	const seen = new Set();
	const normalised = [];

	for (const team of memberships) {
		if (!team?.id || seen.has(team.id)) continue;
		seen.add(team.id);
		normalised.push({
			...team,
			roles: team.roles || [],
			permissions: team.permissions || [],
			current: Boolean(team.current || (activeTeamId && team.id === activeTeamId)),
		});
	}

	return normalised;
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

function hasRole(team, roleKey) {
	return (team?.roles || []).some((role) => role.key === roleKey || role.roleKey === roleKey);
}

function isResearchOpsCoreTeam(team) {
	return team?.id === 'team_researchops_core' || team?.name === 'ResearchOps Core Team';
}

function isResearchOpsCoreTeamAdmin(team) {
	return isResearchOpsCoreTeam(team) && hasRole(team, 'team_admin');
}

function hasResearchOpsCoreTeamAdmin(memberships) {
	return (memberships || []).some(isResearchOpsCoreTeamAdmin);
}

function currentTag(team, membershipCount) {
	if (!team?.current || membershipCount <= 1) return '';
	return '<strong class="govuk-tag govuk-tag--blue">Current</strong>';
}

function roleLabels(team) {
	return labelList(team?.roles, 'No active role');
}

function renderCoreAdminInset(team) {
	if (!isResearchOpsCoreTeamAdmin(team)) return '';
	return `
		<div class="govuk-inset-text">
			You are a Team Admin in ResearchOps Core Team. You can manage roles across teams and create new teams.
		</div>
	`;
}

function renderSingleTeamMembership(team) {
	return `
		<h3 class="govuk-heading-s">Your team</h3>
		<dl class="govuk-summary-list govuk-!-margin-bottom-6">
			<div class="govuk-summary-list__row">
				<dt class="govuk-summary-list__key">Team</dt>
				<dd class="govuk-summary-list__value">${escapeHtml(team.name || team.id || 'Unnamed team')}</dd>
			</div>
			<div class="govuk-summary-list__row">
				<dt class="govuk-summary-list__key">Role or roles</dt>
				<dd class="govuk-summary-list__value">${escapeHtml(roleLabels(team))}</dd>
			</div>
		</dl>
		${renderCoreAdminInset(team)}
	`;
}

function renderMultipleTeamMemberships(memberships) {
	return `
		<h3 class="govuk-heading-s">Your teams</h3>
		<p class="govuk-body">You have different access in each team.</p>
		<ul class="govuk-list govuk-list--spaced">
			${memberships
				.map(
					(team) => `
						<li>
							<h4 class="govuk-heading-s govuk-!-margin-bottom-1">
								${escapeHtml(team.name || team.id || 'Unnamed team')}
								${currentTag(team, memberships.length)}
							</h4>
							<p class="govuk-body govuk-!-margin-bottom-0">${escapeHtml(roleLabels(team))}</p>
							${renderCoreAdminInset(team)}
						</li>
					`,
				)
				.join('')}
		</ul>
	`;
}

function renderTeamMemberships(context) {
	if (!dom.teamMemberships) return;
	const memberships = teamMemberships(context);

	if (memberships.length === 0) {
		dom.teamMemberships.innerHTML = '<p class="govuk-body">You are not currently a member of any team.</p>';
		return;
	}

	dom.teamMemberships.innerHTML =
		memberships.length === 1 ? renderSingleTeamMembership(memberships[0]) : renderMultipleTeamMemberships(memberships);
}

function allowedActions(context) {
	const codes = permissionCodes(context);
	return ACTIONS.filter((action) => codes.has(action.permission));
}

function renderActions(context) {
	const actions = allowedActions(context);
	if (!dom.actions || !dom.actionsSection) return;

	dom.actions.innerHTML = actions
		.map((action) => `<a class="govuk-button" href="${escapeHtml(action.href)}">${escapeHtml(action.label)}</a>`)
		.join('');
	setVisible(dom.actionsSection, actions.length > 0);
}

function renderPermissions(context, memberships) {
	if (!dom.permissions || !dom.permissionsDetails) return;
	const labels = permissionLabels(context);
	const showPermissionDetails = hasResearchOpsCoreTeamAdmin(memberships) && labels.length > 0;

	dom.permissions.innerHTML = labels.map((label) => `<li>${escapeHtml(label)}</li>`).join('');
	setVisible(dom.permissionsDetails, showPermissionDetails);
}

function renderDashboard(context) {
	const memberships = teamMemberships(context);
	if (dom.title) dom.title.textContent = 'Your ResearchOps account';
	if (dom.user) dom.user.textContent = context?.user?.displayName || context?.user?.email || 'Not available';
	renderTeamMemberships(context);
	renderActions(context);
	renderPermissions(context, memberships);
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
	allowedActions,
	defaultApiOrigin,
	displayName,
	fallbackActiveTeamMembership,
	permissionCodes,
	renderDashboard,
	teamMemberships,
});
