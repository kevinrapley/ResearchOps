/**
 * @file start-new-project.js
 * @module StartNewProject
 * @summary Start → 4-step flow controller (navigation + validation + review + submit).
 */

function esc(value) {
	return String(value ?? "").replace(/[&<>"']/g, c => ({
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
		"'": "&#39;"
	}[c]));
}

function valueOf(field) {
	return (field?.value || "").trim();
}

const DEFAULT_PROJECT_PHASE = "Discovery";
const DEFAULT_PROJECT_STATUS = "Goal setting & problem defining";

const steps = [
	document.querySelector("#step1"),
	document.querySelector("#step2"),
	document.querySelector("#step3"),
	document.querySelector("#step4")
];

const errorSummary = document.querySelector("#error-summary");
const errorList = document.querySelector("#error-list");

const projectForm = document.querySelector("#projectForm");

const p_name = document.querySelector("#p_name");
const p_desc = document.querySelector("#p_desc");
const taStakeholders = document.querySelector("#p_stakeholders");
const taObjectives = document.querySelector("#p_objectives");
const inputUserGroups = document.querySelector("#p_usergroups");
const leadName = document.querySelector("#lead_name");
const leadEmail = document.querySelector("#lead_email");
const notes = document.querySelector("#p_notes");
const checkAnswersList = document.querySelector("#check-answers-list");

const btnPrev1 = document.querySelector("#prev1");
const btnNext3 = document.querySelector("#next3");
const btnPrev2 = document.querySelector("#prev2");
const btnNext4 = document.querySelector("#next4");
const btnPrev3 = document.querySelector("#prev3");
const btnFinish = document.querySelector("#finish");

const FIELD_META = {
	p_name: {
		field: p_name,
		group: document.querySelector("#p_name_group"),
		error: document.querySelector("#p_name_error"),
		describedBy: ["p_name_hint"],
		message: "Enter a project name."
	},
	p_desc: {
		field: p_desc,
		group: document.querySelector("#p_desc_group"),
		error: document.querySelector("#p_desc_error"),
		describedBy: ["p_desc_help"],
		message: "Enter a project description."
	},
	p_objectives: {
		field: taObjectives,
		group: document.querySelector("#p_objectives_group"),
		error: document.querySelector("#p_objectives_error"),
		describedBy: ["p_objectives_help"],
		message: "Enter at least one research objective."
	},
	p_usergroups: {
		field: inputUserGroups,
		group: document.querySelector("#p_usergroups_group"),
		error: document.querySelector("#p_usergroups_error"),
		describedBy: ["p_usergroups_help"],
		message: "Enter at least one user group."
	},
	lead_email: {
		field: leadEmail,
		group: document.querySelector("#lead_email_group"),
		error: document.querySelector("#lead_email_error"),
		describedBy: ["lead_email_hint"],
		message: "Enter a work email address in the correct format, like name@example.gov.uk."
	}
};

const PHASE_OPTIONS = ["Pre-Discovery", "Discovery", "Alpha", "Beta", "Live", "Retired"];
const STATUS_OPTIONS = [
	"Goal setting & problem defining",
	"Planning research",
	"Conducting research",
	"Synthesis & analysis",
	"Shared & socialised research",
	"Monitoring metrics"
];

function goToStep(n) {
	steps.forEach((step, index) => {
		if (!step) return;
		const isCurrent = index === n - 1;
		step.hidden = !isCurrent;
		step.setAttribute("aria-hidden", isCurrent ? "false" : "true");
	});

	const current = steps[n - 1];
	const focusable = current?.querySelector("input, textarea, button, [tabindex]");
	if (focusable && typeof focusable.focus === "function") focusable.focus();
}

function clearError(meta) {
	meta.group?.classList.remove("govuk-form-group--error");
	meta.error && (meta.error.hidden = true);
	meta.error && (meta.error.textContent = "");
	meta.field?.setAttribute("aria-invalid", "false");
	meta.field?.setAttribute("aria-describedby", meta.describedBy.filter(Boolean).join(" "));
}

function setError(meta) {
	meta.group?.classList.add("govuk-form-group--error");
	meta.error && (meta.error.hidden = false);
	meta.error && (meta.error.textContent = meta.message);
	meta.field?.setAttribute("aria-invalid", "true");
	meta.field?.setAttribute("aria-describedby", [...meta.describedBy, meta.error?.id].filter(Boolean).join(" "));
}

function clearAllErrors() {
	if (errorSummary) errorSummary.hidden = true;
	if (errorList) errorList.innerHTML = "";
	Object.values(FIELD_META).forEach(clearError);
}

function showErrorSummary(errors) {
	if (!errorSummary || !errorList || errors.length === 0) return;
	errorList.innerHTML = errors.map(meta => `<li><a href="#${esc(meta.field?.id || "main-content")}">${esc(meta.message)}</a></li>`).join("");
	errorSummary.hidden = false;
	errorSummary.focus();
}

function validateRequired(names) {
	clearAllErrors();
	const errors = names.map(name => FIELD_META[name]).filter(meta => !valueOf(meta.field));
	errors.forEach(setError);
	showErrorSummary(errors);
	return errors.length === 0;
}

function validateStep1() {
	return validateRequired(["p_name", "p_desc"]);
}

function validateStep2() {
	return validateRequired(["p_objectives", "p_usergroups"]);
}

function validateStep3() {
	clearAllErrors();
	const email = valueOf(leadEmail);
	const meta = FIELD_META.lead_email;
	const errors = email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? [meta] : [];
	errors.forEach(setError);
	showErrorSummary(errors);
	return errors.length === 0;
}

function coerceSelect(raw, allowed) {
	const norm = s => String(s || "").toLowerCase().replace(/[\s_-]+/g, "-").trim();
	const wanted = norm(raw);
	for (const opt of allowed) if (norm(opt) === wanted) return opt;
	return allowed.find(opt => norm(opt).startsWith(wanted) || wanted.startsWith(norm(opt))) || "";
}

function buildPayload() {
	const objectives = valueOf(taObjectives).split("\n").map(s => s.trim()).filter(Boolean);
	const user_groups = valueOf(inputUserGroups).split(",").map(s => s.trim()).filter(Boolean);
	const stakeholders = valueOf(taStakeholders).split("\n").map(s => s.trim()).filter(Boolean).map(line => {
		const parts = line.split("|").map(s => s.trim());
		return { name: parts[0] || "", role: parts[1] || "", email: parts[2] || "" };
	});
	return {
		org: "Home Office Biometrics",
		name: valueOf(p_name),
		description: valueOf(p_desc),
		phase: DEFAULT_PROJECT_PHASE,
		status: DEFAULT_PROJECT_STATUS,
		objectives,
		user_groups,
		stakeholders,
		lead_researcher: valueOf(leadName),
		lead_researcher_email: valueOf(leadEmail),
		notes: valueOf(notes),
		id: ""
	};
}

function summaryValue(value) {
	const text = String(value || "").trim();
	return text ? esc(text).replaceAll("\n", "<br />") : '<span class="muted">Not provided</span>';
}

function renderCheckAnswers() {
	if (!checkAnswersList) return;
	const rows = [
		["Project name", valueOf(p_name), "#p_name"],
		["Description", valueOf(p_desc), "#p_desc"],
		["Service phase", DEFAULT_PROJECT_PHASE, ""],
		["Project status", DEFAULT_PROJECT_STATUS, ""],
		["Stakeholders", valueOf(taStakeholders), "#p_stakeholders"],
		["Initial objectives", valueOf(taObjectives), "#p_objectives"],
		["User groups", valueOf(inputUserGroups), "#p_usergroups"],
		["Lead researcher", valueOf(leadName), "#lead_name"],
		["Researcher’s email", valueOf(leadEmail), "#lead_email"],
		["Notes", valueOf(notes), "#p_notes"]
	];
	checkAnswersList.innerHTML = rows.map(([key, value, href]) => `
		<div class="govuk-summary-list__row">
			<dt class="govuk-summary-list__key">${esc(key)}</dt>
			<dd class="govuk-summary-list__value">${summaryValue(value)}</dd>
			${href ? `<dd class="govuk-summary-list__actions"><a class="govuk-link" href="${esc(href)}" data-change-target="${esc(href)}">Change<span class="govuk-visually-hidden"> ${esc(key)}</span></a></dd>` : '<dd class="govuk-summary-list__actions"><span class="muted">Set by default</span></dd>'}
		</div>`).join("");
}

async function apiPost(url, body, opts = {}) {
	const controller = new AbortController();
	const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : 15000;
	const id = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);
	try {
		const res = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
			body: JSON.stringify(body),
			signal: controller.signal
		});
		const contentType = res.headers.get("content-type") || "";
		const payload = contentType.includes("application/json") ? await res.json().catch(() => null) : await res.text().catch(() => "");
		return { ok: res.ok, status: res.status, json: (payload && typeof payload === "object") ? payload : null, text: typeof payload === "string" ? payload : "" };
	} finally {
		clearTimeout(id);
	}
}

function validateBeforeCreate() {
	if (!validateStep1()) {
		goToStep(1);
		showErrorSummary([FIELD_META.p_name, FIELD_META.p_desc].filter(meta => !valueOf(meta.field)));
		return false;
	}
	if (!validateStep2()) {
		goToStep(2);
		showErrorSummary([FIELD_META.p_objectives, FIELD_META.p_usergroups].filter(meta => !valueOf(meta.field)));
		return false;
	}
	if (!validateStep3()) {
		goToStep(3);
		showErrorSummary([FIELD_META.lead_email]);
		return false;
	}
	return true;
}

async function createProject() {
	if (!btnFinish || !validateBeforeCreate()) return;
	btnFinish.textContent = "Creating…";
	btnFinish.disabled = true;

	try {
		const res = await apiPost("/api/projects", buildPayload(), { timeoutMs: 15000 });
		if (res.ok && res.json?.ok) {
			window.location.href = "/pages/projects/";
			return;
		}
		const message = res.json?.detail || res.json?.error || res.text || "Request failed.";
		showErrorSummary([{ field: btnFinish, message: `Error ${res.status}: ${message}` }]);
	} catch (err) {
		showErrorSummary([{ field: btnFinish, message: `Network error: ${(err && err.message) ? err.message : String(err)}` }]);
	} finally {
		btnFinish.textContent = "Create project";
		btnFinish.disabled = false;
	}
}

function onChangeAnswer(event) {
	const link = event.target.closest?.("[data-change-target]");
	if (!link) return;
	event.preventDefault();
	const target = link.getAttribute("data-change-target") || "";
	if (["#p_name", "#p_desc"].includes(target)) goToStep(1);
	else if (["#p_stakeholders", "#p_objectives", "#p_usergroups"].includes(target)) goToStep(2);
	else goToStep(3);
	document.querySelector(target)?.focus?.();
}

function wire() {
	goToStep(1);
	projectForm?.addEventListener("submit", event => {
		event.preventDefault();
		if (validateStep1()) goToStep(2);
	});
	btnPrev1?.addEventListener("click", () => goToStep(1));
	btnNext3?.addEventListener("click", () => validateStep2() && goToStep(3));
	btnPrev2?.addEventListener("click", () => goToStep(2));
	btnNext4?.addEventListener("click", () => {
		if (!validateStep3()) return;
		renderCheckAnswers();
		goToStep(4);
	});
	btnPrev3?.addEventListener("click", () => goToStep(3));
	btnFinish?.addEventListener("click", createProject);
	checkAnswersList?.addEventListener("click", onChangeAnswer);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
else wire();

export {
	createProject,
	buildPayload,
	coerceSelect,
	DEFAULT_PROJECT_PHASE,
	DEFAULT_PROJECT_STATUS,
	PHASE_OPTIONS,
	STATUS_OPTIONS,
	goToStep,
	renderCheckAnswers
};
