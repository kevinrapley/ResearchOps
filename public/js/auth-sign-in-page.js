/**
 * @file public/js/auth-sign-in-page.js
 * @module AuthSignInPage
 * @summary Sign-in status page for the first ResearchOps Team Admin.
 */

const CONFIG = Object.freeze({
	API_BASE: document.documentElement?.dataset?.apiOrigin || window.API_ORIGIN || "",
	FETCH_TIMEOUT_MS: 12000,
	CACHE: "no-store",
	TEAM_ADMIN_PERMISSION: "role.assign",
});

const dom = {
	status: document.getElementById("sign-in-status"),
	statusTitle: document.getElementById("sign-in-status-title"),
	statusBody: document.getElementById("sign-in-status-body"),
	signInLink: document.getElementById("sign-in-check-link"),
	teamAdminLink: document.getElementById("team-admin-link"),
};

function escapeHtml(value) {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/\"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function endpoint(path) {
	return `${CONFIG.API_BASE}${path}`;
}

function setBusy(isBusy) {
	if (!dom.status) return;
	dom.status.setAttribute("aria-busy", isBusy ? "true" : "false");
}

function setStatus(title, bodyHtml, modifier = "") {
	if (dom.statusTitle) dom.statusTitle.textContent = title;
	if (dom.statusBody) dom.statusBody.innerHTML = bodyHtml;
	if (!dom.status) return;
	dom.status.classList.remove("govuk-notification-banner--success");
	if (modifier) dom.status.classList.add(modifier);
}

async function fetchJson(path, options = {}) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort("timeout"), CONFIG.FETCH_TIMEOUT_MS);

	try {
		const response = await fetch(endpoint(path), {
			cache: CONFIG.CACHE,
			credentials: "include",
			signal: controller.signal,
			...options,
			headers: {
				accept: "application/json",
				...(options.headers || {}),
			},
		});
		const text = await response.text();
		let data = {};
		try {
			data = text ? JSON.parse(text) : {};
		} catch {
			data = { ok: false, error: "invalid_json_response", message: text };
		}
		return { data, ok: response.ok, status: response.status };
	} finally {
		clearTimeout(timer);
	}
}

function permissionCodes(context) {
	return new Set((context?.permissions || []).map((permission) => permission.code).filter(Boolean));
}

function roleLabels(context) {
	return (context?.roles || []).map((role) => role.label || role.key).filter(Boolean);
}

function activeTeamLabel(context) {
	return context?.activeTeam?.name || context?.activeTeam?.id || "No active team";
}

function showUnauthenticated(message) {
	setStatus(
		"Sign in required",
		`
<p class="govuk-body">${escapeHtml(message || "You need to sign in before ResearchOps can check your account.")}</p>
<p class="govuk-body">Use the sign-in button. Cloudflare Access will ask you to prove your identity if you are not already signed in.</p>
`,
	);
	if (dom.signInLink) dom.signInLink.hidden = false;
	if (dom.teamAdminLink) dom.teamAdminLink.hidden = true;
}

function showSignedInWithoutAdmin(context) {
	const roles = roleLabels(context);
	setStatus(
		"You are signed in",
		`
<p class="govuk-body">Signed in as <strong>${escapeHtml(context.user?.displayName || context.user?.email || "this user")}</strong>.</p>
<p class="govuk-body">Active team: <strong>${escapeHtml(activeTeamLabel(context))}</strong>.</p>
<p class="govuk-body">Current role${roles.length === 1 ? "" : "s"}: ${escapeHtml(roles.join(", ") || "No active role")}</p>
<p class="govuk-body">This account does not currently have permission to assign roles.</p>
`,
		"govuk-notification-banner--success",
	);
	if (dom.signInLink) dom.signInLink.hidden = true;
	if (dom.teamAdminLink) dom.teamAdminLink.hidden = true;
}

function showSignedInTeamAdmin(context) {
	const roles = roleLabels(context);
	setStatus(
		"You are signed in as a Team Admin",
		`
<p class="govuk-body">Signed in as <strong>${escapeHtml(context.user?.displayName || context.user?.email || "this user")}</strong>.</p>
<p class="govuk-body">Active team: <strong>${escapeHtml(activeTeamLabel(context))}</strong>.</p>
<p class="govuk-body">Current role${roles.length === 1 ? "" : "s"}: ${escapeHtml(roles.join(", ") || "Team Admin")}</p>
<p class="govuk-body">You can now manage role assignments for this team.</p>
`,
		"govuk-notification-banner--success",
	);
	if (dom.signInLink) dom.signInLink.hidden = true;
	if (dom.teamAdminLink) dom.teamAdminLink.hidden = false;
}

function renderAuthenticatedContext(context) {
	if (context?.user?.accountStatus && context.user.accountStatus !== "active") {
		setStatus(
			"Account is not active",
			`
<p class="govuk-body">Signed in as <strong>${escapeHtml(context.user.displayName || context.user.email)}</strong>.</p>
<p class="govuk-body">This ResearchOps account is currently <strong>${escapeHtml(context.user.accountStatus)}</strong>.</p>
`,
		);
		return;
	}

	if (!context?.activeTeam) {
		setStatus(
			"No active team found",
			`
<p class="govuk-body">Signed in as <strong>${escapeHtml(context?.user?.displayName || context?.user?.email || "this user")}</strong>.</p>
<p class="govuk-body">This account does not currently have an active ResearchOps team membership.</p>
`,
		);
		return;
	}

	if (permissionCodes(context).has(CONFIG.TEAM_ADMIN_PERMISSION)) {
		showSignedInTeamAdmin(context);
		return;
	}

	showSignedInWithoutAdmin(context);
}

async function refreshSignInStatus() {
	setBusy(true);
	try {
		const response = await fetchJson("/api/me");
		if (response.status === 401) {
			showUnauthenticated(response.data?.message);
			return;
		}
		if (!response.ok || !response.data?.ok) {
			throw new Error(response.data?.message || `Could not check sign-in status (${response.status})`);
		}
		renderAuthenticatedContext(response.data);
	} catch (error) {
		setStatus(
			"We cannot check your account right now",
			`
<p class="govuk-body">${escapeHtml(error?.message || error)}</p>
<p class="govuk-body">Try again. If this continues, check the Cloudflare Access and D1 configuration.</p>
`,
		);
		if (dom.signInLink) dom.signInLink.hidden = false;
		if (dom.teamAdminLink) dom.teamAdminLink.hidden = true;
	} finally {
		setBusy(false);
	}
}

function init() {
	if (!dom.status) return;
	refreshSignInStatus();
}

init();

window.__ropsAuthSignInPage = Object.freeze({
	CONFIG,
	activeTeamLabel,
	permissionCodes,
	roleLabels,
	renderAuthenticatedContext,
});
