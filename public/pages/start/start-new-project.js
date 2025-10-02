/**
 * @file start-new-project.js
 * @module StartNewProject
 * @summary Start → 3-step project flow (client controller).
 *
 * @description
 * - Validates form inputs.
 * - Builds a clean payload for /api/projects.
 * - Coerces select values to Airtable’s exact option labels to avoid 422.
 * - Submits via fetch with timeout + detailed error handling.
 * - Routes to /pages/projects/ on success.
 *
 * Accessibility:
 * - Error summary uses role="alert" and aria-live="polite".
 *
 * Privacy:
 * - OFFICIAL-by-default: only talks to your Worker origin.
 */

/* =========================
 * Helpers (DOM + strings)
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
 * Require a field (adds aria-invalid + inline error text).
 * @param {HTMLInputElement|HTMLTextAreaElement} field
 * @param {HTMLElement} inlineError
 * @param {string} label
 */
function requireField(field, inlineError, label) {
	const val = (field?.value || "").trim();
	const ok = val.length > 0;
	field.setAttribute("aria-invalid", ok ? "false" : "true");
	if (inlineError) {
		inlineError.style.display = ok ? "none" : "block";
		inlineError.textContent = ok ? "" : `${label} is required.`;
	}
	return ok;
}

/* =========================
 * Select coercion → Airtable labels
 * ========================= */

/**
 * Coerce a user-entered choice to one of Airtable’s exact Single-select labels.
 * - Case/space/hyphen insensitive matching.
 * - Returns "" when no match (so we omit the field to avoid 422).
 * @param {string} raw
 * @param {string[]} allowed
 */
function coerceSelect(raw, allowed) {
	const norm = (s) => String(s || "")
		.toLowerCase()
		.replace(/[\s_-]+/g, "-")
		.trim();

	const wanted = norm(raw);
	for (const opt of allowed) {
		if (norm(opt) === wanted) return opt; // exact after normalisation
	}

	// also try “startsWith” / “includes” forgiving matches
	const starts = allowed.find(o => norm(o).startsWith(wanted) || wanted.startsWith(norm(o)));
	if (starts) return starts;

	const contains = allowed.find(o => norm(o).includes(wanted) || wanted.includes(norm(o)));
	if (contains) return contains;

	return ""; // no safe match
}

/** Airtable Single-select labels (must match your base exactly). */
const PHASE_OPTIONS = [
	"Pre-Discovery", "Discovery", "Alpha", "Beta", "Live", "Retired"
];

const STATUS_OPTIONS = [
	"Goal setting & problem defining",
	"Planning research",
	"Conducting research",
	"Synthesis & analysis",
	"Shared & socialised research",
	"Monitoring metrics"
];

/* =========================
 * Fetch wrapper with timeout
 * ========================= */

/**
 * POST JSON with a hard timeout and structured response.
 * @param {string} url
 * @param {any} body
 * @param {{timeoutMs?:number, headers?:Record<string,string>}} [opts]
 */
async function apiPost(url, body, opts = {}) {
	const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : 12000;
	const controller = new AbortController();
	const id = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);

	window.__ropsDebug?.log(`→ POST ${url}`);

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

		window.__ropsDebug?.log(`← ${res.status} ${res.ok ? "OK" : "ERROR"}`);

		return { ok: res.ok, status: res.status, json: (typeof payload === "object" && payload) ? payload : null, text: (typeof payload === "string") ? payload : "" };
	} finally {
		clearTimeout(id);
	}
}

/* =========================
 * Form wiring
 * ========================= */

// Step 1
const p_name = /** @type {HTMLInputElement|null} */ (document.querySelector("#p_name"));
const p_name_error = /** @type {HTMLElement|null} */ (document.querySelector("#p_name_error"));
const p_desc = /** @type {HTMLTextAreaElement|null} */ (document.querySelector("#p_desc"));
const p_desc_error = /** @type {HTMLElement|null} */ (document.querySelector("#p_desc_error"));
const p_phase = /** @type {HTMLSelectElement|null} */ (document.querySelector("#p_phase"));
const p_status = /** @type {HTMLSelectElement|null} */ (document.querySelector("#p_status"));
const errorSummary = /** @type {HTMLElement|null} */ (document.querySelector("#error-summary"));

// Step 2
const taObjectives = /** @type {HTMLTextAreaElement|null} */ (document.querySelector("#p_objectives"));
const inputUserGroups = /** @type {HTMLInputElement|null} */ (document.querySelector("#p_usergroups"));
const taStakeholders = /** @type {HTMLTextAreaElement|null} */ (document.querySelector("#p_stakeholders"));

// Step 3
const leadName = /** @type {HTMLInputElement|null} */ (document.querySelector("#lead_name"));
const leadEmail = /** @type {HTMLInputElement|null} */ (document.querySelector("#lead_email"));
const notes = /** @type {HTMLTextAreaElement|null} */ (document.querySelector("#p_notes"));

const btnFinish = /** @type {HTMLButtonElement|null} */ (document.querySelector("#finish"));

/* =========================
 * Payload builder
 * ========================= */

/**
 * Build the payload expected by /api/projects.
 * Coerces selects to valid Airtable labels; omits invalids.
 */
function buildPayload() {
	// Coerce phase/status to Airtable labels (empty string means omit)
	const coercedPhase = coerceSelect(p_phase?.value, PHASE_OPTIONS);
	const coercedStatus = coerceSelect(p_status?.value, STATUS_OPTIONS);

	// Objectives (textarea → lines)
	const objectives = (taObjectives?.value || "")
		.split("\n")
		.map(s => s.trim())
		.filter(Boolean);

	// User groups (comma separated)
	const user_groups = (inputUserGroups?.value || "")
		.split(",")
		.map(s => s.trim())
		.filter(Boolean);

	// Stakeholders (name | role | email, one per line)
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

	// Only include phase/status if we matched a valid label
	if (coercedPhase) out.phase = coercedPhase;
	if (coercedStatus) out.status = coercedStatus;

	return out;
}

/* =========================
 * Submit logic (requested to retain createProject())
 * ========================= */

/**
 * Create the project via API and route on success.
 */
async function createProject() {
	if (!btnFinish) return;
	hideError(errorSummary);

	// Validate Step 1 again for safety
	const okName = p_name ? requireField(p_name, p_name_error, "Project name") : true;
	const okDesc = p_desc ? requireField(p_desc, p_desc_error, "Description") : true;
	if (!okName || !okDesc) {
		showError(errorSummary, "Please fix the highlighted fields.");
		window.__ropsDebug?.show?.();
		window.__ropsDebug?.log("Validation failed for required Step 1 fields.");
		return;
	}

	btnFinish.textContent = "Creating…";
	btnFinish.disabled = true;

	try {
		const payload = buildPayload();
		window.__ropsDebug?.log(`Submitting /api/projects payload: ${JSON.stringify(payload)}`);

		const res = await apiPost("/api/projects", payload, { timeoutMs: 15000 });

		// Airtable 422: invalid select options → give helpful guidance
		if (!res.ok) {
			// Prefer JSON
			if (res.json && res.json.error) {
				const detail = String(res.json.detail || "");
				// Detect Airtable INVALID_MULTIPLE_CHOICE_OPTIONS
				if (/INVALID_MULTIPLE_CHOICE_OPTIONS/i.test(detail)) {
					// Which field? Phase or Status — show allowed lists.
					const phaseBad = /Phase|pre-discovery|discovery|alpha|beta|live|retired/i.test(detail) || /select option/.test(detail) && /pre-?discovery/i.test(JSON.stringify(payload));
					const statusBad = /Status|goal setting|planning research|conducting research|synthesis|shared|monitoring/i.test(detail);

					const lines = ["One or more select values are not allowed by Airtable."];
					if (phaseBad) lines.push(`Service phase must be one of: ${PHASE_OPTIONS.join(", ")}.`);
					if (statusBad) lines.push(`Project status must be one of: ${STATUS_OPTIONS.join(", ")}.`);
					lines.push("Please update the selection and try again.");

					showError(errorSummary, lines.join(" "));
					window.__ropsDebug?.show?.();
					window.__ropsDebug?.log(`Airtable 422 detail: ${detail}`);
				} else {
					showError(
						errorSummary,
						`Error ${res.status}: ${esc(res.json.error)}${res.json.detail ? ` — ${esc(res.json.detail)}` : ""}`
					);
					window.__ropsDebug?.show?.();
					window.__ropsDebug?.log(`Server error ${res.status}: ${JSON.stringify(res.json)}`);
				}
			} else if (res.text) {
				showError(errorSummary, `Error ${res.status}: ${esc(res.text)}`);
				window.__ropsDebug?.show?.();
				window.__ropsDebug?.log(`Server text error ${res.status}: ${res.text}`);
			} else {
				showError(errorSummary, `Error ${res.status}: Request failed.`);
				window.__ropsDebug?.show?.();
				window.__ropsDebug?.log(`Generic failure ${res.status}`);
			}

			btnFinish.textContent = "Create project";
			btnFinish.disabled = false;
			return;
		}

		// Successful JSON shape from worker: { ok:true, project_id: "...", ... }
		if (res.json && res.json.ok) {
			window.__ropsDebug?.log(`Project created: ${res.json.project_id}`);
			window.location.href = "/pages/projects/";
			return;
		}

		// Fallback: treat as failure if `ok` missing
		showError(errorSummary, "Unexpected response from the server.");
		window.__ropsDebug?.show?.();
		window.__ropsDebug?.log(`Unexpected response: ${JSON.stringify(res.json || res.text || {})}`);
		btnFinish.textContent = "Create project";
		btnFinish.disabled = false;

	} catch (err) {
		const msg = (err && err.message) ? err.message : String(err);
		showError(errorSummary, `Network error: ${esc(msg)}`);
		window.__ropsDebug?.show?.();
		window.__ropsDebug?.log(`Network error: ${msg}`);
		btnFinish.textContent = "Create project";
		btnFinish.disabled = false;
	}
}

/* =========================
 * Wire up
 * ========================= */

function wire() {
	// Button actions
	btnFinish?.addEventListener("click", createProject);
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", wire);
} else {
	wire();
}

// Export for tests (optional)
export { createProject, buildPayload, coerceSelect, PHASE_OPTIONS, STATUS_OPTIONS };
