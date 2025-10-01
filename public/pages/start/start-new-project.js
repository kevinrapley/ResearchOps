/**
 * @file start-new-project.js
 * @module StartNewProject
 * @summary Page controller for “Start a new research project” (Steps 1–3).
 * @description
 * Enhances the Start flow with:
 * - Step 1 validation (name + description)
 * - AI assistance toolbars (Step 1: Description; Step 2: Objectives)
 * - Step navigation (1 ⇄ 2 ⇄ 3)
 * - POST to ResearchOps API (Airtable primary + CSV dual-write on the server)
 *
 * Accessibility:
 * - Inline error messaging with `aria-invalid` and referenced error nodes
 * - Status line on Step 3 with live, human-readable progress
 *
 * @requires globalThis.fetch
 * @requires globalThis.document
 * @requires globalThis.crypto
 */

/* =========================
 * @section Typedefs
 * ========================= */

/**
 * Mapping of internal codes to display labels.
 * @typedef {Record<string, string>} LabelMap
 */

/**
 * Project payload posted to `/api/projects`.
 * @typedef {Object} ProjectPayload
 * @property {string} org
 * @property {string} name
 * @property {string} description
 * @property {string} phase
 * @property {string} status
 * @property {Array<{name:string,role?:string,email?:string}>} stakeholders
 * @property {string[]} objectives
 * @property {string[]} user_groups
 * @property {string} [lead_researcher]
 * @property {string} [lead_researcher_email]
 * @property {string} [notes]
 * @property {string} created ISO timestamp
 * @property {string} id Local UUID for traceability
 */

/**
 * Minimal API response contract.
 * @typedef {Object} ApiCreateProjectResponse
 * @property {boolean} ok
 * @property {string} [project_id]
 */

/* =========================
 * @section Configuration
 * ========================= */

/**
 * Immutable configuration defaults.
 * @constant
 * @name DEFAULTS
 * @type {Readonly<{
 *   API_BASE:string,
 *   MIN_DESC_CHARS:number,
 *   MIN_OBJ_CHARS:number
 * }>}
 * @default
 * @inner
 */
const DEFAULTS = Object.freeze({
	API_BASE: "https://rops-api.digikev-kevin-rapley.workers.dev",
	MIN_DESC_CHARS: 400, // Step 1 AI tools threshold
	MIN_OBJ_CHARS: 60 // Step 2 AI tools threshold (gentler)
});

/* =========================
 * @section DOM helpers
 * ========================= */

/**
 * Shorthand for `document.getElementById`.
 * @function $
 * @inner
 * @param {string} id
 * @returns {HTMLElement|null}
 */
const $ = (id) => document.getElementById(id);

/* =========================
 * @section Label maps
 * ========================= */

/** @type {LabelMap} */
const PHASE_LABEL = Object.freeze({
	"pre-discovery": "Pre-Discovery",
	"discovery": "Discovery",
	"alpha": "Alpha",
	"beta": "Beta",
	"live": "Live",
	"retired": "Retired"
});

/** @type {LabelMap} */
const STATUS_LABEL = Object.freeze({
	"goal-setting": "Goal setting & problem defining",
	"planning": "Planning research",
	"conducting": "Conducting research",
	"synthesis": "Synthesis & analysis",
	"shared": "Shared & socialised research",
	"monitoring": "Monitoring metrics"
});

/* =========================
 * @section Helpers (pure)
 * ========================= */

/**
 * Set or clear an inline validation error.
 * @function setInlineError
 * @inner
 * @param {HTMLElement} input
 * @param {HTMLElement} errEl
 * @param {string} message
 * @returns {void}
 */
function setInlineError(input, errEl, message) {
	if (!input || !errEl) return;
	if (message) {
		input.setAttribute('aria-invalid', 'true');
		errEl.textContent = message;
		errEl.style.display = '';
	} else {
		input.setAttribute('aria-invalid', 'false');
		errEl.textContent = '';
		errEl.style.display = 'none';
	}
}

/**
 * Parse Stakeholders textarea into structured rows.
 * Format: `name | role | email` (one per line).
 * @function parseStakeholders
 * @inner
 * @param {string} text
 * @returns {Array<{name:string, role?:string, email?:string}>}
 */
function parseStakeholders(text) {
	return String(text || "")
		.split(/\r?\n/)
		.map(line => {
			const [name = "", role = "", email = ""] = line.split("|").map(s => s.trim());
			return { name, role, email };
		})
		.filter(s => s.name);
}

/**
 * Convert comma-separated list into array.
 * @function csvListToArray
 * @inner
 * @param {string} text
 * @returns {string[]}
 */
function csvListToArray(text) {
	return String(text || "")
		.split(",")
		.map(s => s.trim())
		.filter(Boolean);
}

/**
 * Convert newline-separated list into array.
 * @function linesToArray
 * @inner
 * @param {string} text
 * @returns {string[]}
 */
function linesToArray(text) {
	return String(text || "")
		.split(/\r?\n/)
		.map(s => s.trim())
		.filter(Boolean);
}

/**
 * POST to ResearchOps API `/api/projects`.
 * Throws on HTTP error; returns parsed JSON on success.
 * @async
 * @function postToAirtable
 * @inner
 * @param {ProjectPayload} project
 * @returns {Promise<ApiCreateProjectResponse>}
 * @throws {Error}
 */
async function postToAirtable(project) {
	const res = await fetch(`${DEFAULTS.API_BASE}/api/projects`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(project),
		credentials: "omit"
	});
	const text = await res.text();
	if (!res.ok) {
		let detail = "";
		try { detail = JSON.parse(text).detail || text; } catch { detail = text; }
		throw new Error(`Airtable error ${res.status}: ${detail}`);
	}
	try { return JSON.parse(text); } catch { return /** @type {any} */ ({ ok: true }); }
}

/* =========================
 * @section AI helpers
 * ========================= */

/**
 * Call AI rewrite endpoint.
 * @async
 * @function callAi
 * @param {"description"|"objectives"} mode
 * @param {string} text
 * @returns {Promise<any>}
 * @throws {Error}
 */
async function callAi(mode, text) {
	const res = await fetch(`${DEFAULTS.API_BASE}/api/ai-rewrite?mode=${mode}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ text })
	});
	if (!res.ok) throw new Error(`AI error ${res.status}`);
	return res.json();
}

/**
 * Wire AI assist actions (suggest + rewrite) for a textarea section.
 * @function wireAiSection
 * @param {{
 *   mode:"description"|"objectives",
 *   textarea: HTMLTextAreaElement|null,
 *   btnSuggest: HTMLElement|null,
 *   btnRewrite: HTMLElement|null,
 *   statusEl: HTMLElement|null,
 *   msgSuggest: string,
 *   msgSuggestDone: string,
 *   msgRewrite: string,
 *   msgRewriteDone: string
 * }} opts
 * @returns {void}
 */
function wireAiSection({
	mode,
	textarea,
	btnSuggest,
	btnRewrite,
	statusEl,
	msgSuggest,
	msgSuggestDone,
	msgRewrite,
	msgRewriteDone
}) {
	if (!textarea) return;

	btnSuggest?.addEventListener('click', async () => {
		try {
			if (statusEl) statusEl.textContent = msgSuggest;
			const out = await callAi(mode, textarea.value);
			// Hook: render suggestions panel if desired
			console.log(`[AI][${mode}] suggestions`, out.suggestions);
			if (statusEl) statusEl.textContent = msgSuggestDone;
		} catch (e) {
			console.error(e);
			if (statusEl) statusEl.textContent = "AI unavailable.";
		}
	});

	btnRewrite?.addEventListener('click', async () => {
		try {
			if (statusEl) statusEl.textContent = msgRewrite;
			const out = await callAi(mode, textarea.value);
			if (typeof out?.rewrite === "string" && out.rewrite.trim()) {
				textarea.value = out.rewrite.trim();
				textarea.dispatchEvent(new Event('input')); // keep any counters/toggles in sync
			}
			if (statusEl) statusEl.textContent = msgRewriteDone;
		} catch (e) {
			console.error(e);
			if (statusEl) statusEl.textContent = "AI unavailable.";
		}
	});
}

/* =========================
 * @section Initialiser
 * ========================= */

/**
 * Initialise the Start page controller once the DOM is ready.
 * Wires validation, AI tools visibility, navigation, and submit.
 * @function initStartPage
 * @returns {void}
 */
function initStartPage() {
	// Sections & nav
	const step1 = $('step1');
	const step2 = $('step2');
	const step3 = $('step3');

	const next2 = $('next2');
	const prev1 = $('prev1');
	const next3 = $('next3');
	const prev2 = $('prev2');
	const finish = $('finish');

	// Step 1 fields
	/** @type {HTMLInputElement|null}    */
	const nameEl = /** @type {any} */ ($('p_name'));
	/** @type {HTMLTextAreaElement|null} */
	const descEl = /** @type {any} */ ($('p_desc'));
	/** @type {HTMLSelectElement|null}   */
	const phaseEl = /** @type {any} */ ($('p_phase'));
	/** @type {HTMLSelectElement|null}   */
	const statusEl = /** @type {any} */ ($('p_status'));

	// Step 1 errors
	/** @type {HTMLElement|null} */
	const nameErr = $('p_name_error');
	/** @type {HTMLElement|null} */
	const descErr = $('p_desc_error');

	// Step 1 AI toolbar
	/** @type {HTMLElement|null} */
	const aiTools = $('ai-tools');
	const btnDescSuggest = $('btn-get-suggestions');
	const btnDescRewrite = $('btn-ai-rewrite');
	const aiDescStatus = $('ai-rewrite-status');

	// Step 2 fields
	/** @type {HTMLTextAreaElement|null} */
	const stakeholdersEl = /** @type {any} */ ($('p_stakeholders'));
	/** @type {HTMLTextAreaElement|null} */
	const objectivesEl = /** @type {any} */ ($('p_objectives'));
	/** @type {HTMLInputElement|null}    */
	const groupsEl = /** @type {any} */ ($('p_usergroups'));

	// Step 2 AI toolbar
	/** @type {HTMLElement|null} */
	const aiToolsObj = $('ai-objectives-tools');
	const btnObjSuggest = $('btn-obj-suggestions');
	const btnObjRewrite = $('btn-obj-ai-rewrite');
	const aiObjStatus = $('ai-obj-status');

	// Step 3 fields
	/** @type {HTMLInputElement|null}    */
	const leadNameEl = /** @type {any} */ ($('lead_name'));
	/** @type {HTMLInputElement|null}    */
	const leadEmailEl = /** @type {any} */ ($('lead_email'));
	/** @type {HTMLTextAreaElement|null} */
	const notesEl = /** @type {any} */ ($('p_notes'));

	// Step 3 status line (create on demand)
	let statusLine = $('status');
	if (!statusLine) {
		statusLine = document.createElement('p');
		statusLine.id = 'status';
		statusLine.className = 'lede';
		step3?.appendChild(statusLine);
	}

	/** @function setStatus */
	function setStatus(msg) {
		if (statusLine) statusLine.textContent = msg;
	}

	/** @function validateStep1 */
	function validateStep1(opts = {}) {
		const showInline = Boolean(opts.showInline);
		const name = (nameEl?.value || "").trim();
		const desc = (descEl?.value || "").trim();

		const nameError = !name ? 'Enter a project name.' : '';
		const descError = !desc ? 'Enter a short project description.' : '';

		if (showInline) {
			if (nameEl && nameErr) setInlineError(nameEl, nameErr, nameError);
			if (descEl && descErr) setInlineError(descEl, descErr, descError);
		} else {
			if (nameEl && nameErr) setInlineError(nameEl, nameErr, '');
			if (descEl && descErr) setInlineError(descEl, descErr, '');
		}

		if (next2) next2.disabled = Boolean(nameError || descError);

		if (showInline) {
			if (nameError && nameEl) { nameEl.focus(); return false; }
			if (descError && descEl) { descEl.focus(); return false; }
		}
		return !(nameError || descError);
	}

	/**
	 * Show/hide the Step 1 AI tools based on Description length.
	 * @function toggleAiToolsDesc
	 */
	function toggleAiToolsDesc() {
		if (!descEl || !aiTools) return;
		const len = (descEl.value || "").trim().length;
		aiTools.classList.toggle('hidden', len < DEFAULTS.MIN_DESC_CHARS);
	}

	/**
	 * Show/hide the Step 2 AI tools based on Objectives length.
	 * @function toggleAiToolsObj
	 */
	function toggleAiToolsObj() {
		if (!objectivesEl || !aiToolsObj) return;
		const len = (objectivesEl.value || "").trim().length;
		aiToolsObj.classList.toggle('hidden', len < DEFAULTS.MIN_OBJ_CHARS);
	}

	// === Event wiring ===

	// Reactive validation (Step 1)
	[nameEl, descEl].forEach(el => {
		el?.addEventListener('input', () => validateStep1({ showInline: false }));
		el?.addEventListener('blur', () => validateStep1({ showInline: false }));
	});
	validateStep1({ showInline: false });

	// AI toolbars visibility
	descEl?.addEventListener('input', toggleAiToolsDesc);
	descEl?.addEventListener('blur', toggleAiToolsDesc);
	toggleAiToolsDesc();

	objectivesEl?.addEventListener('input', toggleAiToolsObj);
	objectivesEl?.addEventListener('blur', toggleAiToolsObj);
	toggleAiToolsObj();

	// Step navigation
	next2?.addEventListener('click', () => {
		const ok = validateStep1({ showInline: true });
		if (!ok) return;
		if (step1) step1.style.display = 'none';
		if (step2) step2.style.display = 'block';
		stakeholdersEl?.focus();
	});

	prev1?.addEventListener('click', () => {
		if (step2) step2.style.display = 'none';
		if (step1) step1.style.display = 'block';
		nameEl?.focus();
	});

	next3?.addEventListener('click', () => {
		if (step2) step2.style.display = 'none';
		if (step3) step3.style.display = 'block';
		leadNameEl?.focus();
	});

	prev2?.addEventListener('click', () => {
		if (step3) step3.style.display = 'none';
		if (step2) step2.style.display = 'block';
	});

	// Submit (Finish)
	finish?.addEventListener('click', async () => {
		if (!validateStep1({ showInline: true })) {
			if (step2) step2.style.display = 'none';
			if (step3) step3.style.display = 'none';
			if (step1) step1.style.display = 'block';
			return;
		}

		const phaseLabel = PHASE_LABEL[phaseEl?.value || ""] ?? "Discovery";
		const statusLabel = STATUS_LABEL[statusEl?.value || ""] ?? "Planning research";

		/** @type {ProjectPayload} */
		const project = {
			org: "Home Office Biometrics",
			name: (nameEl?.value || "").trim(),
			description: (descEl?.value || "").trim(),
			phase: phaseLabel,
			status: statusLabel,
			stakeholders: parseStakeholders(stakeholdersEl?.value || ""),
			objectives: linesToArray(objectivesEl?.value || ""),
			user_groups: csvListToArray(groupsEl?.value || ""),
			lead_researcher: (leadNameEl?.value || "").trim() || undefined,
			lead_researcher_email: (leadEmailEl?.value || "").trim() || undefined,
			notes: (notesEl?.value || "").trim() || undefined,
			created: new Date().toISOString(),
			id: (crypto.randomUUID?.() || String(Date.now()))
		};

		try {
			setStatus("Saving project…");
			const out = await postToAirtable(project);
			setStatus("Saved. Redirecting…");
			localStorage.setItem("rops.lastProjectId", out?.project_id || "");
			window.location.href = "/pages/projects";
		} catch (e) {
			console.error(e);
			setStatus("Failed to create project: " + ( /** @type {any} */ (e)?.message || e));
		}
	});

	// === Wire AI sections ===
	wireAiSection({
		mode: "description",
		textarea: descEl,
		btnSuggest: btnDescSuggest,
		btnRewrite: btnDescRewrite,
		statusEl: aiDescStatus,
		msgSuggest: "Getting suggestions…",
		msgSuggestDone: "Suggestions ready.",
		msgRewrite: "Rewriting description…",
		msgRewriteDone: "Description rewritten."
	});

	wireAiSection({
		mode: "objectives",
		textarea: objectivesEl,
		btnSuggest: btnObjSuggest,
		btnRewrite: btnObjRewrite,
		statusEl: aiObjStatus,
		msgSuggest: "Getting suggestions…",
		msgSuggestDone: "Suggestions ready.",
		msgRewrite: "Rewriting objectives…",
		msgRewriteDone: "Objectives rewritten."
	});
}

/* =========================
 * @section Bootstrap
 * ========================= */

/**
 * Run initialiser when DOM is ready (safe if script moves to <head>).
 */
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initStartPage);
} else {
	initStartPage();
}
