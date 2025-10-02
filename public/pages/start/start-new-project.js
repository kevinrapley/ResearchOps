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
 * POST JSON with timeout; return unified shape { ok, status, text, json }.
 * - text: non-JSON body (string) or "" if JSON
 * - json: parsed object or null if not JSON
 * We avoid inline “split literals” for clarity.
 * @param {string} path
 * @param {any} body
 * @param {{timeoutMs?:number, base?:string}} [opts]
 * @returns {Promise<{ok:boolean,status:number,json?:any,text?:string}>}
 */
async function apiPost(url, data, opts) {
	const timeoutMs = (opts && typeof opts.timeoutMs === "number") ? opts.timeoutMs : 12000;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);

	try {
		const res = await fetch(url, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(data),
			signal: controller.signal
		});

		const ct = res.headers.get("content-type") || "";
		let text = "";
		let json = null;

		if (ct.includes("application/json")) {
			try { json = await res.json(); } catch { text = await res.text(); } // fallback: return the raw text if JSON parse fails
		} else {
			text = await res.text();
		}

		return { ok: res.ok, status: res.status, text: text, json: json };
	} finally {
		clearTimeout(timer);
	}
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
	 * - Keeps the same signature and external helpers you already use.
	 * - Adds robust response handling + optional on-screen debug logs.
	 */
	async function createProject() {
		if (!btnFinish) return;

		// Inline helpers for button state
		const setBusy = (state) => {
			btnFinish.textContent = state ? "Creating…" : "Create project";
			btnFinish.disabled = !!state;
		};

		hideError(errorSummary);

		// Re-validate required fields from Step 1
		const okName = p_name ? requireField(p_name, p_name_error, "Project name") : true;
		const okDesc = p_desc ? requireField(p_desc, p_desc_error, "Description") : true;
		if (!okName || !okDesc) {
			showError(errorSummary, "Please fix the highlighted fields.");
			return;
		}

		// Build request payload from the 3 steps
		const payload = buildPayload();
		if (window.__ropsDebug) {
			try { window.__ropsDebug.panel.show(); } catch {}
			window.__ropsDebug.log("Submitting /api/projects payload: " + JSON.stringify(payload));
		}

		setBusy(true);

		try {
			// Use your apiPost (patched below) or keep your existing one if equivalent
			const res = await apiPost("/api/projects", payload, { timeoutMs: 12000 });

			// Debug log of raw response
			if (window.__ropsDebug) {
				window.__ropsDebug.log("Response status: " + res.status);
				if (res.json) window.__ropsDebug.log("Response JSON: " + JSON.stringify(res.json));
				if (res.text && !res.json) window.__ropsDebug.log("Response TEXT: " + res.text);
			}

			// Non-2xx branch: show the most helpful message we can
			if (!res.ok) {
				// Common cause: CORS (403) because origin not in ALLOWED_ORIGINS
				if (res.status === 403) {
					showError(
						errorSummary,
						"Request was blocked (403). Check that this site origin is in your ALLOWED_ORIGINS on the API Worker."
					);
					return;
				}

				// Prefer structured error from Worker
				if (res.json && (res.json.error || res.json.detail)) {
					const base = "Error " + res.status + ": " + esc(String(res.json.error || "Request failed."));
					const det = res.json.detail ? " — " + esc(String(res.json.detail)) : "";
					showError(errorSummary, base + det);
					return;
				}

				// Fallback: show text body or a generic message
				if (res.text) {
					showError(errorSummary, "Error " + res.status + ": " + esc(res.text));
					return;
				}

				showError(errorSummary, "Error " + res.status + ": Request failed.");
				return;
			}

			// 2xx branch. Expect: { ok:true, project_id: "...", ... }
			if (res.json && res.json.ok) {
				// Success → route to project list
				window.location.assign("/pages/projects/");
				return;
			}

			// Unexpected success shape: surface it to user
			showError(
				errorSummary,
				"Unexpected response from the server. " +
				(res.json ? esc(JSON.stringify(res.json)) : res.text ? esc(res.text) : "")
			);
		} catch (err) {
			// Network, timeout, or thrown parsing errors
			const msg = (err && err.message) ? err.message : String(err);
			showError(errorSummary, "Network error: " + esc(msg));
			if (window.__ropsDebug) window.__ropsDebug.log("Network error: " + msg);
		} finally {
			setBusy(false);
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
