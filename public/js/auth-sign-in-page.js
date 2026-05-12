/**
 * @file public/js/auth-sign-in-page.js
 * @module AuthSignInPage
 * @summary ResearchOps-owned passwordless sign-in page.
 */

function defaultApiOrigin() {
	if (location.hostname === "fix-team-admin-sign-in-journ.researchops.pages.dev") {
		return "https://rops-api-passwordless-preview.digikev-kevin-rapley.workers.dev";
	}
	if (location.hostname.endsWith("pages.dev")) {
		return "https://rops-api.digikev-kevin-rapley.workers.dev";
	}
	return location.origin;
}

const API_ORIGIN = document.documentElement?.dataset?.apiOrigin || window.API_ORIGIN || defaultApiOrigin();

const CONFIG = Object.freeze({
	API_BASE: API_ORIGIN,
	CACHE: "no-store",
	FETCH_TIMEOUT_MS: 12000,
	TEAM_ADMIN_PERMISSION: "role.assign",
});

const dom = {
	status: document.getElementById("sign-in-status"),
	statusTitle: document.getElementById("sign-in-status-title"),
	statusBody: document.getElementById("sign-in-status-body"),
	startForm: document.getElementById("email-code-start-form"),
	verifyForm: document.getElementById("email-code-verify-form"),
	emailInput: document.getElementById("sign-in-email"),
	codeInput: document.getElementById("sign-in-code"),
	challengeInput: document.getElementById("email-code-challenge-id"),
	changeEmailButton: document.getElementById("email-code-change-email"),
	signedInActions: document.getElementById("signed-in-actions"),
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

function apiUrl(path) {
	const value = String(path || "");
	if (/^https?:\/\//i.test(value)) return value;
	return `${CONFIG.API_BASE}${value.startsWith("/") ? value : `/${value}`}`;
}

function setBusy(isBusy) {
	if (!dom.status) return;
	dom.status.setAttribute("aria-busy", isBusy ? "true" : "false");
}

function setVisible(element, visible) {
	if (!element) return;
	element.hidden = !visible;
	element.setAttribute("aria-hidden", visible ? "false" : "true");
	element.style.display = visible ? "" : "none";
}

function setStatus(title, bodyHtml, modifier = "") {
	if (dom.statusTitle) dom.statusTitle.textContent = title;
	if (dom.statusBody) dom.statusBody.innerHTML = bodyHtml;
	if (!dom.status) return;
	dom.status.classList.remove("govuk-notification-banner--success");
	if (modifier) dom.status.classList.add(modifier);
}

function apiErrorMessage(response, fallback) {
	const data = response?.data || {};
	return data.message || data.detail || data.error || (response?.status ? `Request failed with status ${response.status}.` : fallback);
}

function userFacingError(error) {
	const message = String(error?.message || error || "");
	if (["Load failed", "Failed to fetch", "NetworkError when attempting to fetch resource."].includes(message)) {
		return "ResearchOps could not contact the sign-in service. The preview sign-in API may not be deployed yet, or this preview is not allowed to call it.";
	}
	if (message === "timeout") {
		return "The sign-in service did not respond in time. Try again.";
	}
	return message || "Something went wrong.";
}

async function fetchJson(path, options = {}) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort("timeout"), CONFIG.FETCH_TIMEOUT_MS);
	try {
		const response = await fetch(apiUrl(path), {
			cache: CONFIG.CACHE,
			credentials: "include",
			signal: controller.signal,
			...options,
			headers: {
				accept: "application/json",
				...(options.body ? { "content-type": "application/json" } : {}),
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

function showEmailForm() {
	setVisible(dom.startForm, true);
	setVisible(dom.verifyForm, false);
	setVisible(dom.signedInActions, false);
	dom.emailInput?.focus();
}

function showCodeForm(challengeId, email) {
	if (dom.challengeInput) dom.challengeInput.value = challengeId;
	setStatus(
		"Check your email",
		`
<p class="govuk-body">We sent a 6 digit code to <strong>${escapeHtml(email)}</strong>.</p>
<p class="govuk-body">Enter the code to finish signing in.</p>
`,
	);
	setVisible(dom.startForm, false);
	setVisible(dom.verifyForm, true);
	setVisible(dom.signedInActions, false);
	dom.codeInput?.focus();
}

function showSignedOut(message = "Enter your email address to get a sign-in code.") {
	setStatus("Sign in", `<p class="govuk-body">${escapeHtml(message)}</p>`);
	showEmailForm();
}

function showAccountNotReady(context) {
	setStatus(
		"Your account is not ready yet",
		`
<p class="govuk-body">You are signed in as <strong>${escapeHtml(context.user?.displayName || context.user?.email || "this user")}</strong>.</p>
<p class="govuk-body">Ask a Team Admin to activate your account and assign you to the right team.</p>
`,
	);
	setVisible(dom.startForm, false);
	setVisible(dom.verifyForm, false);
	setVisible(dom.signedInActions, false);
}

function showSignedInWithoutAdmin(context) {
	const roles = roleLabels(context);
	setStatus(
		"You are signed in",
		`
<p class="govuk-body">You are signed in as <strong>${escapeHtml(context.user?.displayName || context.user?.email || "this user")}</strong>.</p>
<p class="govuk-body">Your active team is <strong>${escapeHtml(activeTeamLabel(context))}</strong>.</p>
<p class="govuk-body">Current role${roles.length === 1 ? "" : "s"}: ${escapeHtml(roles.join(", ") || "No active role")}</p>
<p class="govuk-body">You cannot manage team roles with this account.</p>
`,
		"govuk-notification-banner--success",
	);
	setVisible(dom.startForm, false);
	setVisible(dom.verifyForm, false);
	setVisible(dom.signedInActions, false);
}

function showSignedInTeamAdmin(context) {
	const roles = roleLabels(context);
	setStatus(
		"You are signed in",
		`
<p class="govuk-body">You are signed in as <strong>${escapeHtml(context.user?.displayName || context.user?.email || "this user")}</strong>.</p>
<p class="govuk-body">Your active team is <strong>${escapeHtml(activeTeamLabel(context))}</strong>.</p>
<p class="govuk-body">Current role${roles.length === 1 ? "" : "s"}: ${escapeHtml(roles.join(", ") || "Team Admin")}</p>
<p class="govuk-body">You can now manage team roles.</p>
`,
		"govuk-notification-banner--success",
	);
	setVisible(dom.startForm, false);
	setVisible(dom.verifyForm, false);
	setVisible(dom.signedInActions, true);
}

function renderAuthenticatedContext(context) {
	if (context?.user?.accountStatus && context.user.accountStatus !== "active") {
		showAccountNotReady(context);
		return;
	}
	if (!context?.activeTeam) {
		showAccountNotReady(context);
		return;
	}
	if (permissionCodes(context).has(CONFIG.TEAM_ADMIN_PERMISSION)) {
		showSignedInTeamAdmin(context);
		return;
	}
	showSignedInWithoutAdmin(context);
}

async function refreshSignInStatusAfterVerification() {
	setBusy(true);
	try {
		const response = await fetchJson("/api/me");
		if (!response.ok || !response.data?.ok) {
			throw new Error(apiErrorMessage(response, "We could not check your account after verifying the code."));
		}
		renderAuthenticatedContext(response.data);
	} catch (error) {
		setStatus(
			"We could not finish signing you in",
			`
<p class="govuk-body">${escapeHtml(userFacingError(error))}</p>
<p class="govuk-body">Your code may have been accepted, but ResearchOps could not load your account details.</p>
`,
		);
		setVisible(dom.startForm, false);
		setVisible(dom.verifyForm, true);
		setVisible(dom.signedInActions, false);
	} finally {
		setBusy(false);
	}
}

async function submitStart(event) {
	event.preventDefault();
	const email = dom.emailInput?.value || "";
	setBusy(true);
	try {
		const route = dom.status?.dataset?.startRoute || "/api/auth/email/start";
		const response = await fetchJson(route, {
			method: "POST",
			body: JSON.stringify({ email }),
		});
		if (!response.ok || !response.data?.ok) {
			throw new Error(apiErrorMessage(response, "We could not send a sign-in code."));
		}
		showCodeForm(response.data.challengeId, email);
	} catch (error) {
		setStatus("There is a problem", `<p class="govuk-body">${escapeHtml(userFacingError(error))}</p>`);
		showEmailForm();
	} finally {
		setBusy(false);
	}
}

async function submitVerify(event) {
	event.preventDefault();
	setBusy(true);
	try {
		const route = dom.status?.dataset?.verifyRoute || "/api/auth/email/verify";
		const response = await fetchJson(route, {
			method: "POST",
			body: JSON.stringify({
				challengeId: dom.challengeInput?.value || "",
				code: dom.codeInput?.value || "",
			}),
		});
		if (!response.ok || !response.data?.ok) {
			throw new Error(apiErrorMessage(response, "The code could not be verified."));
		}
		await refreshSignInStatusAfterVerification();
	} catch (error) {
		setStatus("There is a problem", `<p class="govuk-body">${escapeHtml(userFacingError(error))}</p>`);
		setVisible(dom.startForm, false);
		setVisible(dom.verifyForm, true);
		setVisible(dom.signedInActions, false);
		dom.codeInput?.focus();
	} finally {
		setBusy(false);
	}
}

function init() {
	if (!dom.status) return;
	dom.startForm?.addEventListener("submit", submitStart);
	dom.verifyForm?.addEventListener("submit", submitVerify);
	dom.changeEmailButton?.addEventListener("click", () => showSignedOut());
	showSignedOut();
}

init();

window.__ropsAuthSignInPage = Object.freeze({
	CONFIG,
	apiErrorMessage,
	apiUrl,
	defaultApiOrigin,
	permissionCodes,
	renderAuthenticatedContext,
	userFacingError,
});
