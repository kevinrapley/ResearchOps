/**
 * @file public/js/auth-role-assignment-page.js
 * @module AuthRoleAssignmentPage
 * @summary Team Admin UI for assigning D1-backed ResearchOps roles.
 */

const PREVIEW_API_ORIGIN = "https://rops-api-passwordless-preview.digikev-kevin-rapley.workers.dev";
const PRODUCTION_API_ORIGIN = "https://rops-api.digikev-kevin-rapley.workers.dev";
const FALLBACK_API_ORIGINS = Object.freeze([PREVIEW_API_ORIGIN, PRODUCTION_API_ORIGIN]);

function configuredApiOrigin() {
	const value = document.documentElement?.dataset?.apiOrigin || window.API_ORIGIN || "";
	return String(value || "").replace(/\/$/, "");
}

function defaultApiOrigin() {
	return configuredApiOrigin();
}

const CONFIG = Object.freeze({
	API_BASE: defaultApiOrigin(),
	FETCH_TIMEOUT_MS: 12000,
	CACHE: "no-store",
});

const ROLE_DETAILS = Object.freeze({
	observer: {
		label: "Observer",
		sensitive: false,
		abilities: ["Observe low-risk research context without seeing participant personal data."],
	},
	researcher: {
		label: "Researcher",
		sensitive: false,
		abilities: ["Create governed research records.", "Update governed research records."],
	},
	research_lead: {
		label: "Research Lead",
		sensitive: true,
		abilities: ["Create governed research records.", "Update governed research records.", "Review governed research records."],
	},
	approver: {
		label: "Approver",
		sensitive: true,
		abilities: ["Review governed research records.", "Approve governed research records.", "Own accepted recommendations."],
	},
	safeguarding_lead: {
		label: "Safeguarding Lead",
		sensitive: true,
		safeguarding: true,
		abilities: [
			"View restricted safeguarding details.",
			"Record safeguarding observations.",
			"Resolve safeguarding concerns.",
			"View safeguarding audit events.",
		],
	},
	team_admin: {
		label: "Team Admin",
		sensitive: true,
		abilities: ["Manage team members and team settings.", "Assign roles.", "View general audit events."],
	},
});

const DURATION_LABELS = Object.freeze({
	30: "30 days",
	60: "60 days",
	90: "90 days",
	180: "180 days",
	custom: "Until a specific date",
});

const ROLE_ASSIGNMENT_SERVER_MESSAGES = Object.freeze({
	active_team_required: "Choose an active team before assigning a role.",
	invalid_expiry: "Enter a real expiry date.",
	role_assignment_reason_required: "Enter why you are assigning this role.",
	role_assignment_store_unavailable: "ResearchOps cannot assign roles right now. Try again later.",
	role_assignment_transaction_unavailable: "ResearchOps cannot safely assign this role right now. Try again later.",
	role_not_found: "Select a role that exists in ResearchOps.",
	safeguarding_role_confirmation_required: "Confirm Safeguarding Lead access is required.",
	sensitive_role_confirmation_required: "Confirm this sensitive role assignment is intentional.",
	target_identifier_conflict: "Check the email address and user ID belong to the same person.",
	target_not_team_member: "ResearchOps could not add this person to the team before assigning the role. Try again later.",
	target_required: "Enter a team member's email address or user ID.",
	target_user_inactive: "This person cannot be assigned a role. Contact a team admin.",
	target_user_not_found: "ResearchOps could not find an account for this person. Check their email address or ask them to request an account.",
});

const state = {
	context: null,
	reviewValues: null,
	reviewBody: null,
};

const dom = {
	context: document.getElementById("auth-context"),
	form: document.getElementById("role-assignment-form"),
	formSection: document.getElementById("role-assignment-form-section"),
	errorSummary: document.getElementById("role-assignment-error-summary"),
	errorList: document.getElementById("role-assignment-error-list"),
	result: document.getElementById("role-assignment-result"),
	roleSummary: document.getElementById("role-summary"),
	sensitiveFieldset: document.getElementById("sensitive-role-fieldset"),
	safeguardingFieldset: document.getElementById("safeguarding-fieldset"),
	customExpiryDateGroup: document.getElementById("custom-expiry-date-group"),
	submit: document.getElementById("submit-role-assignment"),
	review: document.getElementById("role-assignment-review"),
	reviewBody: document.getElementById("role-assignment-review-body"),
	confirm: document.getElementById("confirm-role-assignment"),
	change: document.getElementById("change-role-assignment"),
};

function escapeHtml(value) {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/\"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function isProductionPagesHost(hostname = location.hostname) {
	return hostname === "researchops.pages.dev";
}

function isResearchOpsBranchPreviewHost(hostname = location.hostname) {
	return hostname.endsWith(".researchops.pages.dev") && !isProductionPagesHost(hostname);
}

function shouldUseFallbackApiOrigin() {
	return !CONFIG.API_BASE && location.hostname.endsWith("pages.dev");
}

function apiBaseCandidates() {
	if (CONFIG.API_BASE) return [CONFIG.API_BASE];
	if (isProductionPagesHost()) return [PRODUCTION_API_ORIGIN];
	if (isResearchOpsBranchPreviewHost()) return [PREVIEW_API_ORIGIN];
	if (shouldUseFallbackApiOrigin()) return [PRODUCTION_API_ORIGIN];
	return [""];
}

function endpoint(path, base = CONFIG.API_BASE) {
	if (/^https?:\/\//i.test(path)) return path;
	if (!base) return path.startsWith("/") ? path : `/${path}`;
	return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function setBusy(element, isBusy) {
	if (!element) return;
	element.setAttribute("aria-busy", isBusy ? "true" : "false");
}

function setDisabled(isDisabled) {
	if (dom.submit) dom.submit.disabled = isDisabled;
	if (dom.confirm) dom.confirm.disabled = isDisabled;
}

function shouldTryNextApiBase(response, data, attemptIndex, totalAttempts) {
	if (attemptIndex >= totalAttempts - 1) return false;
	if (data?.error === "invalid_json_response") return true;
	return [404, 405, 502, 503, 504].includes(response.status);
}

async function fetchJsonFromBase(path, base, options = {}) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort("timeout"), CONFIG.FETCH_TIMEOUT_MS);

	try {
		const response = await fetch(endpoint(path, base), {
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
		return { ok: response.ok && data?.error !== "invalid_json_response", status: response.status, data };
	} finally {
		clearTimeout(timer);
	}
}

async function fetchJson(path, options = {}) {
	const bases = apiBaseCandidates();
	let lastError;
	for (let index = 0; index < bases.length; index += 1) {
		try {
			const response = await fetchJsonFromBase(path, bases[index], options);
			if (shouldTryNextApiBase(response, response.data, index, bases.length)) continue;
			return response;
		} catch (error) {
			lastError = error;
			if (index >= bases.length - 1) throw error;
		}
	}
	throw lastError || new Error("Request could not be completed.");
}

function permissionCodes(permissions) {
	return new Set((permissions || []).map((permission) => permission.code).filter(Boolean));
}

function activeTeamLabel(context) {
	return context?.activeTeam?.name || context?.activeTeam?.id || "No active team";
}

function renderAuthContext(data) {
	if (!dom.context) return;
	state.context = data;
	const permissions = permissionCodes(data.permissions);
	const canAssignRoles = permissions.has("role.assign");
	const activeTeam = data.activeTeam || {};

	dom.context.classList.toggle("auth-role-assignment-scope__panel--blocked", !canAssignRoles);
	dom.context.innerHTML = canAssignRoles
		? `
<p class="govuk-body">You are assigning roles in <strong>${escapeHtml(activeTeam.name || activeTeam.id || "your active team")}</strong>.</p>
`
		: `
<p class="govuk-body"><strong>You cannot assign roles.</strong></p>
<p class="govuk-body">You do not have permission to assign roles for ${escapeHtml(activeTeam.name || activeTeam.id || "this team")}.</p>
`;
	setDisabled(!canAssignRoles);
	if (dom.form) dom.form.hidden = !canAssignRoles;
	if (dom.review) dom.review.hidden = true;
}

function renderAuthContextError(error) {
	if (!dom.context) return;
	dom.context.classList.add("auth-role-assignment-scope__panel--blocked");
	dom.context.innerHTML = `
<p class="govuk-body"><strong>You cannot assign roles.</strong></p>
<p class="govuk-body">${escapeHtml(error?.message || error)}</p>
`;
	setDisabled(true);
	if (dom.form) dom.form.hidden = true;
	if (dom.review) dom.review.hidden = true;
}

function roleDetail(roleKey) {
	return ROLE_DETAILS[roleKey] || null;
}

function selectedRoleKey() {
	return document.querySelector('input[name="roleKey"]:checked')?.value || "";
}

function selectedDurationPreset() {
	return document.querySelector('input[name="durationPreset"]:checked')?.value || "";
}

function renderRoleSummary() {
	if (!dom.roleSummary || !dom.sensitiveFieldset || !dom.safeguardingFieldset) return;
	const detail = roleDetail(selectedRoleKey());

	if (!detail) {
		dom.roleSummary.hidden = true;
		dom.roleSummary.innerHTML = "";
		dom.sensitiveFieldset.hidden = true;
		dom.safeguardingFieldset.hidden = true;
		return;
	}

	dom.roleSummary.hidden = false;
	dom.roleSummary.innerHTML = detail.abilities.length
		? `<p class="govuk-body">This role can:</p><ul class="govuk-list govuk-list--bullet auth-role-assignment-summary__abilities">${detail.abilities
				.map((ability) => `<li>${escapeHtml(ability)}</li>`)
				.join("")}</ul>`
		: '<p class="govuk-body">This role does not add any direct capabilities.</p>';
	dom.sensitiveFieldset.hidden = !detail.sensitive;
	dom.safeguardingFieldset.hidden = !detail.safeguarding;
}

function renderDurationControls() {
	if (!dom.customExpiryDateGroup) return;
	dom.customExpiryDateGroup.hidden = selectedDurationPreset() !== "custom";
}

function makeRadioHintSelectable(event) {
	const hint = event.target.closest(".auth-role-assignment-radios .govuk-radios__hint");
	if (!hint) return;
	const item = hint.closest(".govuk-radios__item");
	const input = item?.querySelector(".govuk-radios__input");
	if (!input || input.disabled) return;
	input.checked = true;
	input.dispatchEvent(new Event("change", { bubbles: true }));
}

function clearFieldErrors() {
	document.querySelectorAll(".govuk-form-group--error, .govuk-fieldset--error").forEach((element) => {
		element.classList.remove("govuk-form-group--error");
		element.classList.remove("govuk-fieldset--error");
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

function groupElementFor(field) {
	return document.getElementById(`${field}-group`) || document.getElementById(`${field}-fieldset`);
}

function showErrors(errors) {
	for (const error of errors) {
		const group = groupElementFor(error.field);
		const message = document.getElementById(`${error.field}-error`);
		if (group) {
			group.classList.add(group.tagName === "FIELDSET" ? "govuk-fieldset--error" : "govuk-form-group--error");
		}
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
		roleKey: selectedRoleKey(),
		requestedReason: String(data.get("requestedReason") || "").trim(),
		durationPreset: selectedDurationPreset(),
		expiryDay: String(data.get("expiryDay") || "").trim(),
		expiryMonth: String(data.get("expiryMonth") || "").trim(),
		expiryYear: String(data.get("expiryYear") || "").trim(),
		sensitiveRoleConfirmation: data.get("sensitiveRoleConfirmation") || "",
		safeguardingConfirmation: data.get("safeguardingConfirmation") || "",
	};
}

function applyQueryPrefill() {
	if (!dom.form) return;
	const params = new URLSearchParams(location.search);
	const prefill = {
		targetEmail: params.get("targetEmail") || "",
		targetUserId: params.get("targetUserId") || "",
		requestedReason: params.get("requestedReason") || "",
		roleKey: params.get("roleKey") || "",
	};

	if (prefill.targetEmail) document.getElementById("target-email").value = prefill.targetEmail;
	if (prefill.targetUserId) document.getElementById("target-user-id").value = prefill.targetUserId;
	if (prefill.requestedReason) document.getElementById("requested-reason").value = prefill.requestedReason;
	if (prefill.roleKey) {
		document.querySelectorAll('input[name="roleKey"]').forEach((input) => {
			if (input.value === prefill.roleKey) input.checked = true;
		});
	}
}

function customDateParts(values) {
	const day = Number(values.expiryDay);
	const month = Number(values.expiryMonth);
	const year = Number(values.expiryYear);

	if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return null;
	const date = new Date(year, month - 1, day, 23, 59, 59, 999);
	if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
	return date;
}

function expiresAtFor(values) {
	if (["30", "60", "90", "180"].includes(values.durationPreset)) {
		const date = new Date();
		date.setDate(date.getDate() + Number(values.durationPreset));
		date.setHours(23, 59, 59, 999);
		return date;
	}

	if (values.durationPreset === "custom") {
		return customDateParts(values);
	}

	return null;
}

function expiryLabelFor(values) {
	const expiry = expiresAtFor(values);
	if (!expiry) return "Not set";
	return expiry.toLocaleDateString("en-GB", {
		day: "numeric",
		month: "long",
		year: "numeric",
	});
}

function validate(values) {
	const errors = [];
	const detail = roleDetail(values.roleKey);

	if (!values.targetEmail && !values.targetUserId) {
		addError(errors, "target-email", "Enter a team member's email address or user ID.", "#target-email");
	}

	if (!values.roleKey) {
		addError(errors, "role-key", "Select the role they need.", "#role-key-observer");
	}

	if (!values.durationPreset) {
		addError(errors, "role-duration", "Select how long this role should last.", "#duration-30");
	}

	if (values.durationPreset === "custom" && !customDateParts(values)) {
		addError(errors, "custom-expiry-date", "Enter a real expiry date.", "#expiry-day");
	}

	if (values.requestedReason.length < 12) {
		addError(errors, "requested-reason", "Enter why you are assigning this role.", "#requested-reason");
	}

	if (detail?.sensitive && values.sensitiveRoleConfirmation !== "ASSIGN_SENSITIVE_ROLE") {
		addError(errors, "sensitive-role", "Confirm this sensitive role assignment is intentional.", "#sensitive-role-confirmation");
	}

	if (detail?.safeguarding && values.safeguardingConfirmation !== "ASSIGN_SAFEGUARDING_LEAD") {
		addError(errors, "safeguarding", "Confirm Safeguarding Lead access is required.", "#safeguarding-confirmation");
	}

	return errors;
}

function requestBody(values) {
	const expiry = expiresAtFor(values);
	const body = {
		roleKey: values.roleKey,
		requestedReason: values.requestedReason,
	};

	if (values.targetEmail) body.targetEmail = values.targetEmail;
	if (values.targetUserId) body.targetUserId = values.targetUserId;
	if (expiry) body.expiresAt = expiry.toISOString();
	if (values.sensitiveRoleConfirmation) body.sensitiveRoleConfirmation = values.sensitiveRoleConfirmation;
	if (values.safeguardingConfirmation) body.safeguardingConfirmation = values.safeguardingConfirmation;

	return body;
}

function reviewSummaryRows(values) {
	const detail = roleDetail(values.roleKey) || {};
	return [
		["Team member email", values.targetEmail || "Not provided", "#target-email"],
		["User ID", values.targetUserId || "Not provided", "#target-user-id"],
		["Team", activeTeamLabel(state.context), ""],
		["Role", detail.label || values.roleKey, "#role-key-observer"],
		["Access duration", DURATION_LABELS[values.durationPreset] || "Not set", "#duration-30"],
		["Expiry date", expiryLabelFor(values), values.durationPreset === "custom" ? "#expiry-day" : "#duration-custom"],
		["Reason", values.requestedReason, "#requested-reason"],
	];
}

function renderSummaryAction(key, href) {
	if (!href) return '<dd class="govuk-summary-list__actions"></dd>';
	return `
<dd class="govuk-summary-list__actions">
	<a class="govuk-link" href="${escapeHtml(href)}">Change<span class="govuk-visually-hidden"> ${escapeHtml(key.toLowerCase())}</span></a>
</dd>
`;
}

function renderReview(values) {
	if (!dom.review || !dom.reviewBody) return;
	const rows = reviewSummaryRows(values)
		.map(
			([key, value, href]) => `
<div class="govuk-summary-list__row">
	<dt class="govuk-summary-list__key">${escapeHtml(key)}</dt>
	<dd class="govuk-summary-list__value">${escapeHtml(value)}</dd>
	${renderSummaryAction(key, href)}
</div>
`
		)
		.join("");

	state.reviewValues = values;
	state.reviewBody = requestBody(values);
	dom.reviewBody.innerHTML = `
<dl class="govuk-summary-list auth-role-assignment-review__list">
${rows}
</dl>
`;
	dom.review.hidden = false;
	dom.review.focus();
}

function hideReview() {
	state.reviewValues = null;
	state.reviewBody = null;
	if (dom.review) dom.review.hidden = true;
}

function showResult(data) {
	if (!dom.result) return;
	const role = data.role || {};
	const targetUser = data.targetUser || {};
	const assignment = data.assignment || {};
	const membership = data.teamMembership || {};

	dom.result.hidden = false;
	dom.result.className = "auth-role-assignment-result auth-role-assignment-result--success";
	dom.result.innerHTML = `
<h2 class="govuk-heading-m">Role assigned</h2>
<p class="govuk-body"><strong>${escapeHtml(role.label || role.key)}</strong> was assigned to ${escapeHtml(targetUser.displayName || targetUser.email || targetUser.id)}.</p>
${membership.createdOrReactivated ? '<p class="govuk-body">They were also added as an active member of this team.</p>' : ""}
<p class="govuk-body">Assignment ID: <code>${escapeHtml(assignment.id)}</code></p>
<p class="govuk-body">Scope: <code>${escapeHtml(assignment.scopeId)}</code></p>
`;
	dom.result.focus?.();
}

function roleAssignmentServerMessage(data, status) {
	const mappedMessage = ROLE_ASSIGNMENT_SERVER_MESSAGES[data?.error];
	if (mappedMessage) return mappedMessage;
	if (status === 401 || status === 403) return "You do not have permission to assign this role.";
	if (status === 404) return "ResearchOps could not find the account or role. Check the details and try again.";
	if (status === 409) return "This role could not be assigned because the account cannot receive roles right now.";
	if (status >= 500) return "ResearchOps cannot assign roles right now. Try again later.";
	return "ResearchOps could not assign this role. Check the details and try again.";
}

function showServerError(data, status) {
	if (!dom.result) return;
	dom.result.hidden = false;
	dom.result.className = "auth-role-assignment-result auth-role-assignment-result--error";
	dom.result.innerHTML = `
<h2 class="govuk-heading-m">Role was not assigned</h2>
<p class="govuk-body">${escapeHtml(roleAssignmentServerMessage(data, status))}</p>
`;
}

function prepareReview(event) {
	event.preventDefault();
	clearFieldErrors();
	hideReview();
	if (dom.result) dom.result.hidden = true;

	const values = formValues();
	const errors = validate(values);
	if (errors.length) {
		showErrors(errors);
		return;
	}

	renderReview(values);
}

async function submitAssignment() {
	if (!state.reviewBody) return;

	setDisabled(true);
	try {
		const response = await fetchJson("/api/auth/role-assignments", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(state.reviewBody),
		});

		if (!response.ok || !response.data?.ok) {
			showServerError(response.data, response.status);
			return;
		}

		showResult(response.data);
		dom.form.reset();
		renderRoleSummary();
		renderDurationControls();
		hideReview();
	} catch {
		showServerError({}, 0);
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
	applyQueryPrefill();
	document.querySelectorAll('input[name="roleKey"]').forEach((input) => input.addEventListener("change", renderRoleSummary));
	document
		.querySelectorAll('input[name="durationPreset"]')
		.forEach((input) => input.addEventListener("change", renderDurationControls));
	document.querySelectorAll(".auth-role-assignment-radios .govuk-radios__hint").forEach((hint) => {
		hint.dataset.clicksRadio = "true";
	});
	dom.form.addEventListener("click", makeRadioHintSelectable);
	dom.form.addEventListener("submit", prepareReview);
	dom.confirm?.addEventListener("click", submitAssignment);
	dom.change?.addEventListener("click", () => {
		hideReview();
		dom.form.focus?.();
	});
	renderRoleSummary();
	renderDurationControls();
	initAuthContext();
}

init();

window.__ropsAuthRoleAssignmentPage = Object.freeze({
	CONFIG,
	ROLE_DETAILS,
	DURATION_LABELS,
	ROLE_ASSIGNMENT_SERVER_MESSAGES,
	FALLBACK_API_ORIGINS,
	PREVIEW_API_ORIGIN,
	PRODUCTION_API_ORIGIN,
	apiBaseCandidates,
	applyQueryPrefill,
	configuredApiOrigin,
	defaultApiOrigin,
	endpoint,
	isProductionPagesHost,
	isResearchOpsBranchPreviewHost,
	roleAssignmentServerMessage,
	validate,
	requestBody,
	expiresAtFor,
});
