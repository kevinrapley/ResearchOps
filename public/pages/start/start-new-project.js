/**
 * @file start-new-project.js
 * @module StartNewProject
 * @summary Page controller for “Start a new research project” (Steps 1–3).
 *
 * @description
 * - Collects data across three steps and POSTs to `/api/projects`.
 * - Shows clear, on-page error messages (no browser console required).
 * - On success, routes to `/pages/projects/`.
 * - Uses GOV.UK tone: plain English, short sentences, accessible.
 *
 * Accessibility:
 * - Uses an alert panel (`#error-summary`) with `aria-live="polite"`.
 * - Keeps focus on the triggering control after errors when possible.
 *
 * Privacy:
 * - Sends only the fields needed by the API.
 * - No third-party calls; API base is same origin unless overridden by `window.__API_BASE`.
 *
 * Customisation:
 * - Override the API base by setting `window.__API_BASE = 'https://your-worker.workers.dev'`
 *   before this script runs. Otherwise we default to the current origin.
 */

/* =========================
 * Helpers
 * ========================= */

/**
 * Escape text for safe HTML interpolation.
 * @param {unknown} s
 * @returns {string}
 */
function esc(s) {
	return String(s ?? "").replace(/[&<>"']/g, m => ({
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		"\"": "&quot;",
		"'": "&#39;"
	} [m]));
}

/**
 * Fetch wrapper with a hard timeout.
 * @param {RequestInfo|URL} url
 * @param {RequestInit} init
 * @param {number} timeoutMs
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, init, timeoutMs) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);
	try {
		const initSafe = Object.assign({}, init || {});
		initSafe.signal = controller.signal;
		return await fetch(url, initSafe);
	} finally {
		clearTimeout(timer);
	}
}

/**
 * POST JSON to the API and return a structured result.
 * We avoid inline “split literals” for clarity.
 * @param {string} path
 * @param {any} body
 * @param {{timeoutMs?:number, base?:string}} [opts]
 * @returns {Promise<{ok:boolean,status:number,json?:any,text?:string}>}
 */
async function apiPost(path, body, opts = {}) {
	const base = (typeof window !== "undefined" && window.__API_BASE) ? String(window.__API_BASE).replace(/\/+$/, "") : "";
	const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : 10000;
	const url = (opts.base || base) + path;

	const res = await fetchWithTimeout(url, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body)
	}, timeoutMs);

	// Read body once, then decide how to shape return
	const raw = await res.text();
	/** @type {{ok:boolean,status:number,json?:any,text?:string}} */
	const shaped = { ok: res.ok, status: res.status };

	try {
		const parsed = JSON.parse(raw);
		shaped.json = parsed;
	} catch {
		shaped.text = raw;
	}

	return shaped;
}

/**
 * Show an error message in the alert panel.
 * @param {HTMLElement|null} panel
 * @param {string} message
 */
function showError(panel, message) {
	if (!panel) return;
	panel.innerHTML = esc(message);
	panel.style.display = "block";
}

/**
 * Hide error panel.
 * @param {HTMLElement|null} panel
 */
function hideError(panel) {
	if (!panel) return;
	panel.style.display = "none";
	panel.textContent = "";
}

/**
 * Basic required-field validator.
 * Adds inline error text and aria-invalid on fields.
 * @param {HTMLInputElement|HTMLTextAreaElement} el
 * @param {HTMLElement|null} errEl
 * @param {string} label
 * @returns {boolean}
 */
function requireField(el, errEl, label) {
	const ok = Boolean((el.value || "").trim());
	el.setAttribute("aria-invalid", ok ? "false" : "true");
	if (errEl) {
		errEl.textContent = ok ? "" : `${label} is required.`;
		errEl.style.display = ok ? "none" : "block";
	}
	return ok;
}

/* =========================
 * DOM bindings
 * ========================= */

/**
 * Wire up the Start page.
 */
function initStartNewProject() {
	// Step sections
	const step1 = /** @type {HTMLElement|null} */ (document.querySelector("#step1"));
	const step2 = /** @type {HTMLElement|null} */ (document.querySelector("#step2"));
	const step3 = /** @type {HTMLElement|null} */ (document.querySelector("#step3"));

	// Error summary
	const errorSummary = /** @type {HTMLElement|null} */ (document.querySelector("#error-summary"));

	// Step 1 fields
	const p_name = /** @type {HTMLInputElement|null} */ (document.querySelector("#p_name"));
	const p_name_error = /** @type {HTMLElement|null} */ (document.querySelector("#p_name_error"));

	const p_desc = /** @type {HTMLTextAreaElement|null} */ (document.querySelector("#p_desc"));
	const p_desc_error = /** @type {HTMLElement|null} */ (document.querySelector("#p_desc_error"));

	const p_phase = /** @type {HTMLSelectElement|null} */ (document.querySelector("#p_phase"));
	const p_status = /** @type {HTMLSelectElement|null} */ (document.querySelector("#p_status"));

	// Step navigation
	const btnNext2 = /** @type {HTMLButtonElement|null} */ (document.querySelector("#next2"));
	const btnPrev1 = /** @type {HTMLButtonElement|null} */ (document.querySelector("#prev1"));
	const btnNext3 = /** @type {HTMLButtonElement|null} */ (document.querySelector("#next3"));
	const btnPrev2 = /** @type {HTMLButtonElement|null} */ (document.querySelector("#prev2"));
	const btnFinish = /** @type {HTMLButtonElement|null} */ (document.querySelector("#finish"));

	// Step 2 fields
	const p_stakeholders = /** @type {HTMLTextAreaElement|null} */ (document.querySelector("#p_stakeholders"));
	const p_objectives = /** @type {HTMLTextAreaElement|null} */ (document.querySelector("#p_objectives"));
	const p_usergroups = /** @type {HTMLInputElement|null} */ (document.querySelector("#p_usergroups"));

	// Step 3 fields
	const lead_name = /** @type {HTMLInputElement|null} */ (document.querySelector("#lead_name"));
	const lead_email = /** @type {HTMLInputElement|null} */ (document.querySelector("#lead_email"));
	const p_notes = /** @type {HTMLTextAreaElement|null} */ (document.querySelector("#p_notes"));

	// Guard: if we don't have step1, abort wiring
	if (!step1) return;

	// Helpers to switch steps
	const show = (el) => { if (el) el.style.display = ""; };
	const hide = (el) => { if (el) el.style.display = "none"; };

	/**
	 * Move to Step 2 if Step 1 required fields are valid.
	 */
	function goToStep2() {
		hideError(errorSummary);
		const okName = p_name ? requireField(p_name, p_name_error, "Project name") : true;
		const okDesc = p_desc ? requireField(p_desc, p_desc_error, "Description") : true;

		if (!okName || !okDesc) {
			showError(errorSummary, "Please fix the highlighted fields.");
			return;
		}
		hide(step1);
		show(step2);
		hide(step3);
	}

	/**
	 * Move to Step 3 (no required fields on Step 2 by default).
	 */
	function goToStep3() {
		hideError(errorSummary);
		hide(step1);
		hide(step2);
		show(step3);
	}

	/**
	 * Move back to Step 1.
	 */
	function backToStep1() {
		hideError(errorSummary);
		show(step1);
		hide(step2);
		hide(step3);
		if (p_name) p_name.focus();
	}

	/**
	 * Move back to Step 2.
	 */
	function backToStep2() {
		hideError(errorSummary);
		hide(step1);
		show(step2);
		hide(step3);
		if (p_objectives) p_objectives.focus();
	}

	/**
	 * Parse stakeholders textarea (name | role | email, one per line).
	 * @param {string} raw
	 * @returns {Array<{name:string,role:string,email:string}>}
	 */
	function parseStakeholders(raw) {
		const arr = [];
		const lines = String(raw || "").split("\n");
		for (const line of lines) {
			const parts = line.split("|").map(s => s.trim()).filter(Boolean);
			if (!parts.length) continue;
			const name = parts[0] || "";
			const role = parts[1] || "";
			const email = parts[2] || "";
			if (name) arr.push({ name, role, email });
		}
		return arr;
	}

	/**
	 * Build the payload for /api/projects.
	 */
	function buildPayload() {
		const objectives = (p_objectives?.value || "")
			.split("\n")
			.map(s => s.trim())
			.filter(Boolean);

		const user_groups = (p_usergroups?.value || "")
			.split(",")
			.map(s => s.trim())
			.filter(Boolean);

		const stakeholders = parseStakeholders(p_stakeholders?.value || "");

		return {
			org: "Home Office Biometrics",
			name: p_name?.value || "",
			description: p_desc?.value || "",
			phase: p_phase?.value || "",
			status: p_status?.value || "",
			objectives,
			user_groups,
			stakeholders,
			lead_researcher: lead_name?.value || "",
			lead_researcher_email: lead_email?.value || "",
			notes: p_notes?.value || "",
			// Optional: include a local UUID/slug if your frontend has one
			id: ""
		};
	}

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
			return;
		}

		btnFinish.textContent = "Creating…";
		btnFinish.disabled = true;

		try {
			const payload = buildPayload();
			const res = await apiPost("/api/projects", payload, { timeoutMs: 12000 });

			// Prefer JSON if present
			if (!res.ok) {
				if (res.json && res.json.error) {
					showError(errorSummary, `Error ${res.status}: ${esc(res.json.error)}${res.json.detail ? ` — ${esc(res.json.detail)}` : ""}`);
				} else if (res.text) {
					showError(errorSummary, `Error ${res.status}: ${esc(res.text)}`);
				} else {
					showError(errorSummary, `Error ${res.status}: Request failed.`);
				}
				btnFinish.textContent = "Create project";
				btnFinish.disabled = false;
				return;
			}

			// Successful JSON shape from worker: { ok:true, project_id: "...", ... }
			if (res.json && res.json.ok) {
				// Route to project list
				window.location.href = "/pages/projects/";
				return;
			}

			// Fallback: treat as failure if `ok` missing
			showError(errorSummary, "Unexpected response from the server.");
			btnFinish.textContent = "Create project";
			btnFinish.disabled = false;

		} catch (err) {
			showError(errorSummary, `Network error: ${esc(err && err.message ? err.message : String(err))}`);
			btnFinish.textContent = "Create project";
			btnFinish.disabled = false;
		}
	}

	/* =========================
	 * Wire events
	 * ========================= */

	btnNext2?.addEventListener("click", goToStep2);
	btnPrev1?.addEventListener("click", backToStep1);
	btnNext3?.addEventListener("click", goToStep3);
	btnPrev2?.addEventListener("click", backToStep2);
	btnFinish?.addEventListener("click", createProject);

	// Default view: Step 1 visible
	show(step1);
	hide(step2);
	hide(step3);
}

/* =========================
 * Auto-init
 * ========================= */

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initStartNewProject);
} else {
	initStartNewProject();
}
