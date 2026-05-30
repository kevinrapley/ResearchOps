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
	email: document.getElementById('account-email-value'),
	accountStatus: document.getElementById('account-status-value'),
	currentTeamSection: document.getElementById('account-current-team-section'),
	currentTeam: document.getElementById('account-current-team-value'),
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
	const rawName = context?.user?.displayName || context?.user?.email || 'Not available';
	return String(rawName).includes('@') ? String(rawName).split('@')[0] : rawName;
}

function formatAccountStatus(value) {
	const status = String(value || '').trim().toLowerCase();
	if (!status) return 'Not available';
	return status
		.split(/[-_\s]+/)
		.filter(Boolean)
		.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join(' ');
}

function labelList(items, emptyLabel) {
	const labels = (items || [])
		.map((item) => item.label || item.name)
		.filter(Boolean)
		.sort((first, second) => first.localeCompare(second));
	return labels.length ? labels.join(', ') : emptyLabel;
}

function capabilityLabel(permission) {
	return permission?.label || permission?.description || '';
}

function capabilityItems(permissions = []) {
	return permissions
		.map((permission) => ({
			label: capabilityLabel(permission),
			sensitive: permission?.sensitive === true,
		}))
		.filter((permission) => permission.label)
		.sort((first, second) => first.label.localeCompare(second.label));
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
			permissions: team.permissions || team.capabilities || [],
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
		.map((permission) => capabilityLabel(permission))
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

function currentTag(team) {
	if (!team?.current) return '';
	return '<strong class="govuk-tag govuk-tag--blue">Current team</strong>';
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

function renderCapabilityList(team) {
	const capabilities = capabilityItems(team?.permissions || []);
	if (capabilities.length === 0) return '<p class="govuk-body">No active access summary for this team.</p>';
	return `
		<ul class="govuk-list govuk-list--bullet">
			${capabilities
				.map(
					(capability) => `
						<li>
							${escapeHtml(capability.label)}
							${capability.sensitive ? '<strong class="govuk-tag govuk-tag--yellow">Sensitive access</strong>' : ''}
						</li>
					`,
				)
				.join('')}
		</ul>
	`;
}

function renderTeamMembership(team) {
	return `
		<div class="govuk-summary-card">
			<div class="govuk-summary-card__title-wrapper">
				<h3 class="govuk-summary-card__title">
					${escapeHtml(team.name || team.id || 'Unnamed team')}
					${currentTag(team)}
				</h3>
			</div>
			<div class="govuk-summary-card__content">
				<dl class="govuk-summary-list govuk-summary-list--no-border">
					<div class="govuk-summary-list__row">
						<dt class="govuk-summary-list__key">Role or roles</dt>
						<dd class="govuk-summary-list__value">${escapeHtml(roleLabels(team))}</dd>
					</div>
					<div class="govuk-summary-list__row">
						<dt class="govuk-summary-list__key">What this lets you do</dt>
						<dd class="govuk-summary-list__value">${renderCapabilityList(team)}</dd>
					</div>
				</dl>
				${renderCoreAdminInset(team)}
			</div>
		</div>
	`;
}

function renderTeamMemberships(context) {
	if (!dom.teamMemberships) return;
	const memberships = teamMemberships(context);

	if (memberships.length === 0) {
		dom.teamMemberships.innerHTML = `
			<div class="govuk-inset-text">
				<p class="govuk-body">You are not currently a member of any team.</p>
				<p class="govuk-body">Ask a Team Admin to add you to a team or review your account request.</p>
			</div>
		`;
		return;
	}

	dom.teamMemberships.innerHTML = memberships.map(renderTeamMembership).join('');
}

function renderCurrentTeam(context, memberships) {
	const currentTeam = memberships.find((team) => team.current) || context?.activeTeam || null;
	if (!dom.currentTeam || !dom.currentTeamSection) return;
	if (!currentTeam?.id) {
		setVisible(dom.currentTeamSection, false);
		return;
	}
	dom.currentTeam.textContent = currentTeam.name || currentTeam.id;
	setVisible(dom.currentTeamSection, true);
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
	if (dom.user) dom.user.textContent = displayName(context);
	if (dom.email) dom.email.textContent = context?.user?.email || 'Not available';
	if (dom.accountStatus) dom.accountStatus.textContent = formatAccountStatus(context?.user?.accountStatus);
	renderCurrentTeam(context, memberships);
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
	capabilityItems,
	defaultApiOrigin,
	displayName,
	fallbackActiveTeamMembership,
	formatAccountStatus,
	permissionCodes,
	renderDashboard,
	teamMemberships,
});