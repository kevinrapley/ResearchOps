/**
 * @file public/js/auth-role-assignment-page.js
 * @module AuthRoleAssignmentPage
 * @summary Team Admin UI for assigning D1-backed ResearchOps roles.
 */

const CONFIG = Object.freeze({
	API_BASE:
		document.documentElement?.dataset?.apiOrigin ||
		window.API_ORIGIN ||
		(location.hostname.endsWith("pages.dev") ? "https://rops-api.digikev-kevin-rapley.workers.dev" : location.origin),
	FETCH_TIMEOUT_MS: 12000,
	CACHE: "no-store",
});

const ROLE_DETAILS = Object.freeze({
	observer: {
		label: "Observer",
		description: "Can observe low-risk research context without participant personal data reveal.",
		sensitive: false,
		permissions: [],
	},
	researcher: {
		label: "Researcher",
		description: "Can create and edit governed research records.",
		sensitive: false,
		permissions: ["governed.create", "governed.edit"],
	},
	research_lead: {
		label: "Research Lead",
		description: "Can create, edit and review governed research records.",
		sensitive: true,
		permissions: ["governed.create", "governed.edit", "governed.review"],
	},
	approver: {
		label: "Approver",
		description: "Can approve governed research records and own accepted recommendations.",
		sensitive: true,
		permissions: ["governed.review", "governed.approve", "recommendation.own"],
	},
	safeguarding_lead: {
		label: "Safeguarding Lead",
		description: "Can view, record, resolve and audit safeguarding concerns.",
		sensitive: true,
		safeguarding: true,
		permissions: ["safeguarding.view", "safeguarding.record", "safeguarding.resolve", "safeguarding.audit.view"],
	},
	team_admin: {
		label: "Team Admin",
		description: "Can manage team membership, role assignment and general audit oversight.",
		sensitive: true,
		permissions: ["team.manage", "role.assign", "audit.view"],
	},
});

const dom = {
	context: document.getElementById("auth-context"),
	form: document.getElementById("role-assignment-form"),
	errorSummary: document.getElementById("role-assignment-error-summary"),
	errorList: document.getElementById("role-assignment-error-list"),
	result: document.getElementById("role-assignment-result"),
	roleKey: document.getElementById("role-key"),
	roleSummary: document.getElementById("role-summary"),
	sensitiveFieldset: document.getElementById("sensitive-role-fieldset"),
	safeguardingFieldset: document.getElementById("safeguarding-fieldset"),
	submit: document.getElementById("submit-role-assignment"),
};

function escapeHtml(value) {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/\"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function setBusy(element, isBusy) {
	if (!element) return;
	element.setAttribute("aria-busy", isBusy ? "true" : "false");
}

function setDisabled(isDisabled) {
	if (dom.submit) dom.submit.disabled = isDisabled;
}

function endpoint(path) {
	return `${CONFIG.API_BASE}${path}`;
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
		return { ok: response.ok, status: response.status, data };
	} finally {
		clearTimeout(timer);
	}
}

function permissionCodes(permissions) {
	return new Set((permissions || []).map((permission) => permission.code).filter(Boolean));
}

function roleLabels(roles) {
	return (roles || []).map((role) => role.label || role.key).filter(Boolean);
}

function renderAuthContext(data) {
	if (!dom.context) return;
	const user = data.user || {};
	const activeTeam = data.activeTeam || {};
	const permissions = permissionCodes(data.permissions);
	const canAssignRoles = permissions.has("role.assign");
	const roles = roleLabels(data.roles || []);

	dom.context.classList.toggle("auth-role-assignment-status__panel--ready", canAssignRoles);
	dom.context.classList.toggle("auth-role-assignment-status__panel--blocked", !canAssignRoles);
	dom.context.innerHTML = `
<p class="govuk-body"><strong>${escapeHtml(user.displayName || user.email || "Signed-in user")}</strong></p>
<p class="govuk-body">Active team: <code>${escapeHtml(activeTeam.id || "No active team")}</code></p>
<p class="govuk-body">Current roles: ${roles.length ? escapeHtml(roles.join(", ")) : "No active roles"}</p>
${canAssignRoles ? '<p class="govuk-body">You can assign team roles because you have <code>role.assign</code>.</p>' : '<p class="govuk-body">You cannot assign team roles because <code>role.assign</code> is not available in this team.</p>'}
`;
	setDisabled(!canAssignRoles);
}

function renderAuthContextError(error) {
	if (!dom.context) return;
	dom.context.classList.add("auth-role-assignment-status__panel--blocked");
	dom.context.innerHTML = `
<p class="govuk-body"><strong>Could not confirm your team role access.</strong></p>
<p class="govuk-body">${escapeHtml(error?.message || error)}</p>
`;
	setDisabled(true);
}

function roleDetail(roleKey) {
	return ROLE_DETAILS[roleKey] || null;
}

function renderRoleSummary() {
	if (!dom.roleKey || !dom.roleSummary || !dom.sensitiveFieldset || !dom.safeguardingFieldset) return;
	const detail = roleDetail(dom.roleKey.value);

	if (!detail) {
		dom.roleSummary.hidden = true;
		dom.roleSummary.innerHTML = "";
		dom.sensitiveFieldset.hidden = true;
		dom.safeguardingFieldset.hidden = true;
		return;
	}

	const permissions = detail.permissions.length
		? `<ul class="auth-role-assignment-summary__permissions">${detail.permissions.map((permission) => `<li><code>${escapeHtml(permission)}</code></li>`).join("")}</ul>`
		: '<p class="govuk-body">This role currently has no direct permissions.</p>';

	dom.roleSummary.hidden = false;
	dom.roleSummary.innerHTML = `
<h3 class="govuk-heading-s">${escapeHtml(detail.label)}</h3>
<p class="govuk-body">${escapeHtml(detail.description)}</p>
${permissions}
${detail.sensitive ? '<p class="govuk-body"><strong>This is a sensitive role.</strong></p>' : ""}
`;
	dom.sensitiveFieldset.hidden = !detail.sensitive;
	dom.safeguardingFieldset.hidden = !detail.safeguarding;
}

function clearFieldErrors() {
	document.querySelectorAll(".govuk-form-group--error").forEach((element) => {
		element.classList.remove("govuk-form-group--error");
	});
	document.querySelectorAll(".govuk-error-message").forEach((element) => {
		element.hidden = true;
		element.textContent = "";
	});
	if (dom.errorSummary && dom.errorList) {
		dom.errorSummary.hidden = true;
		dom.errorList.innerHTML = "";
	}
}

function addError(errors, field, message, href) {
	errors.push({ field, message, href });
}

function showErrors(errors) {
	for (const error of errors) {
		const group = document.getElementById(`${error.field}-group`) || document.getElementById(`${error.field}-fieldset`);
		const message = document.getElementById(`${error.field}-error`);
		if (group) group.classList.add("govuk-form-group--error");
		if (message) {
			message.hidden = false;
			message.textContent = `Error: ${error.message}`;
		}
	}

	if (dom.errorSummary && dom.errorList) {
		dom.errorList.innerHTML = errors
			.map((error) => `<li><a href="${escapeHtml(error.href)}">${escapeHtml(error.message)}</a></li>`)
			.join("");
		dom.errorSummary.hidden = false;
		dom.errorSummary.focus();
	}
}

function formValues() {
	const data = new FormData(dom.form);
	return {
		targetEmail: String(data.get("targetEmail") || "").trim(),
		targetUserId: String(data.get("targetUserId") || "").trim(),
		roleKey: String(data.get("roleKey") || "").trim(),
		requestedReason: String(data.get("requestedReason") || "").trim(),
		expiresAt: String(data.get("expiresAt") || "").trim(),
		sensitiveRoleConfirmation: data.get("sensitiveRoleConfirmation") || "",
		safeguardingConfirmation: data.get("safeguardingConfirmation") || "",
	};
}

function validate(values) {
	const errors = [];
	const detail = roleDetail(values.roleKey);

	if (!values.targetEmail && !values.targetUserId) {
		addError(errors, "target-email", "Enter a team member email or user ID.", "#target-email");
	}

	if (!values.roleKey) {
		addError(errors, "role-key", "Select a role to assign.", "#role-key");
	}

	if (values.requestedReason.length < 12) {
		addError(errors, "requested-reason", "Enter a reason of at least 12 characters.", "#requested-reason");
	}

	if (values.expiresAt && Number.isNaN(Date.parse(values.expiresAt))) {
		addError(errors, "expires-at", "Enter a valid expiry date and time.", "#expires-at");
	}

	if (detail?.sensitive && values.sensitiveRoleConfirmation !== "ASSIGN_SENSITIVE_ROLE") {
		addError(errors, "sensitive-role", "Confirm the sensitive role assignment.", "#sensitive-role-confirmation");
	}

	if (detail?.safeguarding && values.safeguardingConfirmation !== "ASSIGN_SAFEGUARDING_LEAD") {
		addError(errors, "safeguarding", "Confirm Safeguarding Lead access is required.", "#safeguarding-confirmation");
	}

	return errors;
}

function requestBody(values) {
	const body = {
		roleKey: values.roleKey,
		requestedReason: values.requestedReason,
	};

	if (values.targetEmail) body.targetEmail = values.targetEmail;
	if (values.targetUserId) body.targetUserId = values.targetUserId;
	if (values.expiresAt) body.expiresAt = new Date(values.expiresAt).toISOString();
	if (values.sensitiveRoleConfirmation) body.sensitiveRoleConfirmation = values.sensitiveRoleConfirmation;
	if (values.safeguardingConfirmation) body.safeguardingConfirmation = values.safeguardingConfirmation;

	return body;
}

function showResult(data) {
	if (!dom.result) return;
	const role = data.role || {};
	const targetUser = data.targetUser || {};
	const assignment = data.assignment || {};

	dom.result.hidden = false;
	dom.result.className = "auth-role-assignment-result auth-role-assignment-result--success";
	dom.result.innerHTML = `
<h2 class="govuk-heading-m">Role assigned</h2>
<p class="govuk-body"><strong>${escapeHtml(role.label || role.key)}</strong> was assigned to ${escapeHtml(targetUser.displayName || targetUser.email || targetUser.id)}.</p>
<p class="govuk-body">Assignment ID: <code>${escapeHtml(assignment.id)}</code></p>
<p class="govuk-body">Scope: <code>${escapeHtml(assignment.scopeId)}</code></p>
`;
	dom.result.focus?.();
}

function showServerError(data, status) {
	if (!dom.result) return;
	dom.result.hidden = false;
	dom.result.className = "auth-role-assignment-result auth-role-assignment-result--error";
	dom.result.innerHTML = `
<h2 class="govuk-heading-m">Role was not assigned</h2>
<p class="govuk-body">${escapeHtml(data?.message || `Request failed with status ${status}`)}</p>
${data?.error ? `<p class="govuk-body">Error code: <code>${escapeHtml(data.error)}</code></p>` : ""}
`;
}

async function handleSubmit(event) {
	event.preventDefault();
	clearFieldErrors();
	if (dom.result) dom.result.hidden = true;

	const values = formValues();
	const errors = validate(values);
	if (errors.length) {
		showErrors(errors);
		return;
	}

	setDisabled(true);
	try {
		const response = await fetchJson("/api/auth/role-assignments", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(requestBody(values)),
		});

		if (!response.ok || !response.data?.ok) {
			showServerError(response.data, response.status);
			return;
		}

		showResult(response.data);
		dom.form.reset();
		renderRoleSummary();
	} catch (error) {
		showServerError({ message: error?.message || error }, 0);
	} finally {
		setDisabled(false);
	}
}

async function initAuthContext() {
	if (!dom.context) return;
	setBusy(dom.context, true);
	try {
		const response = await fetchJson("/api/me");
		if (!response.ok || !response.data?.ok) {
			throw new Error(response.data?.message || `Could not load /api/me (${response.status})`);
		}
		renderAuthContext(response.data);
	} catch (error) {
		renderAuthContextError(error);
	} finally {
		setBusy(dom.context, false);
	}
}

function init() {
	if (!dom.form) return;
	dom.roleKey?.addEventListener("change", renderRoleSummary);
	dom.form.addEventListener("submit", handleSubmit);
	dom.form.addEventListener("reset", () => {
		window.setTimeout(() => {
			clearFieldErrors();
			renderRoleSummary();
			if (dom.result) dom.result.hidden = true;
		}, 0);
	});
	renderRoleSummary();
	initAuthContext();
}

init();

window.__ropsAuthRoleAssignmentPage = Object.freeze({
	CONFIG,
	ROLE_DETAILS,
	validate,
	requestBody,
});
