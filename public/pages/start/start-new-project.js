/**
 * @file start-new-project.js
 * @module StartNewProject
 * @summary Start → 3-step flow controller (navigation + validation + submit).
 *
 * @description
 * - Step navigation: #step1 ↔ #step2 ↔ #step3
 * - Validates Step 1 when continuing to Step 2.
 * - Builds payload and POSTs to /api/projects on Finish.
 * - Uses robust Airtable select coercion to avoid 422 errors.
 *
 * NOTE: AI assist (description/objectives) is handled by their own modules.
 */

/* =========================
 * Utilities
 * ========================= */

/** Escape for safe HTML. */
function esc(s) {
	return String(s ?? "").replace(/[&<>"']/g, c => ({
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
		"'": "&#39;"
	} [c]));
}

/** Show error in a summary panel. */
function showError(el, msg) {
	if (!el) return;
	el.innerHTML = esc(msg);
	el.style.display = "block";
}

/** Hide error summary. */
function hideError(el) {
	if (!el) return;
	el.style.display = "none";
	el.textContent = "";
}

/**
 * Mark a field as required (inline + aria-invalid).
 * @param {HTMLInputElement|HTMLTextAreaElement} field
 * @param {HTMLElement} inlineError
 * @param {string} label
 */
function requireField(field, inlineError, label) {
	const val = (field?.value || "").trim();
	const ok = val.length > 0;
	if (field) field.setAttribute("aria-invalid", ok ? "false" : "true");
	if (inlineError) {
		inlineError.style.display = ok ? "none" : "block";
		inlineError.textContent = ok ? "" : `${label} is required.`;
	}
	return ok;
}

/* =========================
 * DOM refs
 * ========================= */

// Sections
const step1 = document.querySelector("#step1");
const step2 = document.querySelector("#step2");
const step3 = document.querySelector("#step3");

// Error summary (Step 1)
const errorSummary = /** @type {HTMLElement|null} */ (document.querySelector("#error-summary"));

// Step 1 fields
const p_name = /** @type {HTMLInputElement|null} */ (document.querySelector("#p_name"));
const p_name_error = /** @type {HTMLElement|null} */ (document.querySelector("#p_name_error"));
const p_desc = /** @type {HTMLTextAreaElement|null} */ (document.querySelector("#p_desc"));
const p_desc_error = /** @type {HTMLElement|null} */ (document.querySelector("#p_desc_error"));
const p_phase = /** @type {HTMLSelectElement|null} */ (document.querySelector("#p_phase"));
const p_status = /** @type {HTMLSelectElement|null} */ (document.querySelector("#p_status"));

// Step 2 fields
const taObjectives = /** @type {HTMLTextAreaElement|null} */ (document.querySelector("#p_objectives"));
const inputUserGroups = /** @type {HTMLInputElement|null} */ (document.querySelector("#p_usergroups"));
const taStakeholders = /** @type {HTMLTextAreaElement|null} */ (document.querySelector("#p_stakeholders"));

// Step 3 fields
const leadName = /** @type {HTMLInputElement|null} */ (document.querySelector("#lead_name"));
const leadEmail = /** @type {HTMLInputElement|null} */ (document.querySelector("#lead_email"));
const notes = /** @type {HTMLTextAreaElement|null} */ (document.querySelector("#p_notes"));

// Nav buttons
const btnNext2 = /** @type {HTMLButtonElement|null} */ (document.querySelector("#next2"));
const btnPrev1 = /** @type {HTMLButtonElement|null} */ (document.querySelector("#prev1"));
const btnNext3 = /** @type {HTMLButtonElement|null} */ (document.querySelector("#next3"));
const btnPrev2 = /** @type {HTMLButtonElement|null} */ (document.querySelector("#prev2"));
const btnFinish = /** @type {HTMLButtonElement|null} */ (document.querySelector("#finish"));

/* =========================
 * Step visibility helpers
 * ========================= */

/**
 * Show one step, hide the rest, keep ARIA state tidy.
 * @param {1|2|3} n
 */
function goToStep(n) {
	const map = new Map([
		[1, step1],
		[2, step2],
		[3, step3]
	]);

	for (const [idx, el] of map.entries()) {
		if (!el) continue;
		const on = idx === n;
		el.style.display = on ? "" : "none";
		el.setAttribute("aria-hidden", on ? "false" : "true");
	}

	// Move focus to first focusable in the step (progressive)
	const target = map.get(n);
	if (target) {
		const focusable = target.querySelector("input, textarea, select, button, [tabindex]");
		if (focusable && typeof focusable.focus === "function") focusable.focus();
	}
}

/* =========================
 * Airtable select coercion
 * ========================= */

const PHASE_OPTIONS = ["Pre-Discovery", "Discovery", "Alpha", "Beta", "Live", "Retired"];
const STATUS_OPTIONS = [
	"Goal setting & problem defining",
	"Planning research",
	"Conducting research",
	"Synthesis & analysis",
	"Shared & socialised research",
	"Monitoring metrics"
];

/**
 * Coerce a free/loose value to one of the exact Airtable labels.
 * @param {string} raw
 * @param {string[]} allowed
 */
function coerceSelect(raw, allowed) {
	const norm = (s) => String(s || "").toLowerCase().replace(/[\s_-]+/g, "-").trim();
	const wanted = norm(raw);
	for (const opt of allowed)
		if (norm(opt) === wanted) return opt;
	const starts = allowed.find(o => norm(o).startsWith(wanted) || wanted.startsWith(norm(o)));
	if (starts) return starts;
	const contains = allowed.find(o => norm(o).includes(wanted) || wanted.includes(norm(o)));
	if (contains) return contains;
	return "";
}

/* =========================
 * Payload builder
 * ========================= */

/**
 * Build payload for /api/projects (omits invalid selects).
 */
function buildPayload() {
	const coercedPhase = coerceSelect(p_phase?.value, PHASE_OPTIONS);
	const coercedStatus = coerceSelect(p_status?.value, STATUS_OPTIONS);

	const objectives = (taObjectives?.value || "")
		.split("\n")
		.map(s => s.trim())
		.filter(Boolean);

	const user_groups = (inputUserGroups?.value || "")
		.split(",")
		.map(s => s.trim())
		.filter(Boolean);

	const stakeholders = (taStakeholders?.value || "")
		.split("\n")
		.map(line => line.trim())
		.filter(Boolean)
		.map(line => {
			const parts = line.split("|").map(s => s.trim());
			return { name: parts[0] || "", role: parts[1] || "", email: parts[2] || "" };
		});

	/** @type {{org?:string,name:string,description:string,phase?:string,status?:string,objectives:string[],user_groups:string[],stakeholders:any[],lead_researcher?:string,lead_researcher_email?:string,notes?:string,id?:string}} */
	const out = {
		org: "Home Office Biometrics",
		name: (p_name?.value || "").trim(),
		description: (p_desc?.value || "").trim(),
		objectives,
		user_groups,
		stakeholders,
		lead_researcher: (leadName?.value || "").trim(),
		lead_researcher_email: (leadEmail?.value || "").trim(),
		notes: (notes?.value || "").trim(),
		id: ""
	};

	if (coercedPhase) out.phase = coercedPhase;
	if (coercedStatus) out.status = coercedStatus;

	return out;
}

/* =========================
 * Fetch wrapper
 * ========================= */

/**
 * POST with timeout; structured return (json OR text).
 * @param {string} url
 * @param {any} body
 * @param {{timeoutMs?:number, headers?:Record<string,string>}} [opts]
 */
async function apiPost(url, body, opts = {}) {
	const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : 15000;
	const controller = new AbortController();
	const id = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);

	window.__ropsDebug?.log?.(`→ POST ${url}`);

	try {
		const res = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
			body: JSON.stringify(body),
			signal: controller.signal
		});

		const ct = res.headers.get("content-type") || "";
		let payload;
		if (ct.includes("application/json")) {
			payload = await res.json().catch(() => null);
		} else {
			payload = await res.text().catch(() => "");
		}

		window.__ropsDebug?.log?.(`← ${res.status} ${res.ok ? "OK" : "ERROR"}`);

		return { ok: res.ok, status: res.status, json: (payload && typeof payload === "object") ? payload : null, text: (typeof payload === "string") ? payload : "" };
	} finally {
		clearTimeout(id);
	}
}

/* =========================
 * Submit (keep createProject())
 * ========================= */

/**
 * Create the project via API and route on success.
 */
async function createProject() {
	if (!btnFinish) return;
	// Step 1 fields are critical even if user navigated back
	hideError(errorSummary);

	const okName = p_name ? requireField(p_name, p_name_error, "Project name") : true;
	const okDesc = p_desc ? requireField(p_desc, p_desc_error, "Description") : true;
	if (!okName || !okDesc) {
		showError(errorSummary, "Please fix the highlighted fields.");
		window.__ropsDebug?.show?.();
		window.__ropsDebug?.log?.("Validation failed for required Step 1 fields.");
		goToStep(1);
		return;
	}

	btnFinish.textContent = "Creating…";
	btnFinish.disabled = true;

	try {
		const payload = buildPayload();
		window.__ropsDebug?.log?.(`Submitting /api/projects payload: ${JSON.stringify(payload)}`);

		const res = await apiPost("/api/projects", payload, { timeoutMs: 15000 });

		if (!res.ok) {
			if (res.json && res.json.error) {
				const detail = String(res.json.detail || "");
				if (/INVALID_MULTIPLE_CHOICE_OPTIONS/i.test(detail)) {
					const lines = ["One or more select values are not allowed by Airtable."];
					lines.push(`Service phase must be: ${PHASE_OPTIONS.join(", ")}.`);
					lines.push(`Project status must be: ${STATUS_OPTIONS.join(", ")}.`);
					lines.push("Update the selections and try again.");
					showError(errorSummary, lines.join(" "));
					window.__ropsDebug?.show?.();
					window.__ropsDebug?.log?.(`Airtable 422 detail: ${detail}`);
					goToStep(1);
				} else {
					showError(
						errorSummary,
						`Error ${res.status}: ${esc(res.json.error)}${res.json.detail ? ` — ${esc(res.json.detail)}` : ""}`
					);
					window.__ropsDebug?.show?.();
					window.__ropsDebug?.log?.(`Server error ${res.status}: ${JSON.stringify(res.json)}`);
					goToStep(1);
				}
			} else if (res.text) {
				showError(errorSummary, `Error ${res.status}: ${esc(res.text)}`);
				window.__ropsDebug?.show?.();
				window.__ropsDebug?.log?.(`Server text error ${res.status}: ${res.text}`);
				goToStep(1);
			} else {
				showError(errorSummary, `Error ${res.status}: Request failed.`);
				window.__ropsDebug?.show?.();
				window.__ropsDebug?.log?.(`Generic failure ${res.status}`);
				goToStep(1);
			}

			btnFinish.textContent = "Create project";
			btnFinish.disabled = false;
			return;
		}

		if (res.json && res.json.ok) {
			window.__ropsDebug?.log?.(`Project created: ${res.json.project_id}`);
			window.location.href = "/pages/projects/";
			return;
		}

		showError(errorSummary, "Unexpected response from the server.");
		window.__ropsDebug?.show?.();
		window.__ropsDebug?.log?.(`Unexpected response: ${JSON.stringify(res.json || res.text || {})}`);
		btnFinish.textContent = "Create project";
		btnFinish.disabled = false;

	} catch (err) {
		const msg = (err && err.message) ? err.message : String(err);
		showError(errorSummary, `Network error: ${esc(msg)}`);
		window.__ropsDebug?.show?.();
		window.__ropsDebug?.log?.(`Network error: ${msg}`);
		btnFinish.textContent = "Create project";
		btnFinish.disabled = false;
	}
}

/* =========================
 * Navigation handlers
 * ========================= */

function onNextFromStep1() {
	hideError(errorSummary);
	const okName = p_name ? requireField(p_name, p_name_error, "Project name") : true;
	const okDesc = p_desc ? requireField(p_desc, p_desc_error, "Description") : true;
	if (!okName || !okDesc) {
		showError(errorSummary, "Please fix the highlighted fields.");
		return;
	}
	goToStep(2);
}

function onBackToStep1() {
	hideError(errorSummary);
	goToStep(1);
}

function onNextFromStep2() {
	// No hard validation here (objectives optional), just proceed
	goToStep(3);
}

function onBackToStep2() {
	goToStep(2);
}

/* =========================
 * Wire up
 * ========================= */

function wire() {
	// Initial state
	goToStep(1);

	// Buttons
	btnNext2?.addEventListener("click", onNextFromStep1);
	btnPrev1?.addEventListener("click", onBackToStep1);
	btnNext3?.addEventListener("click", onNextFromStep2);
	btnPrev2?.addEventListener("click", onBackToStep2);
	btnFinish?.addEventListener("click", createProject);

	// Basic Enter-key prevention on Step 1 inputs to avoid accidental submit
	[p_name, p_desc].forEach(el => {
		el?.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && !e.shiftKey) {
				// allow Enter in textarea to make a new line
				if (el.tagName !== "TEXTAREA") e.preventDefault();
			}
		});
	});
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", wire);
} else {
	wire();
}

// Exports for testing if needed
export {
	createProject,
	buildPayload,
	coerceSelect,
	PHASE_OPTIONS,
	STATUS_OPTIONS,
	goToStep
};
