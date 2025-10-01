/**
 * @file copilot-suggester.js
 * @module CopilotSuggester
 * @summary Zero-cost, client-side rule-based suggester for “Step 1 of 3 — Description”.
 * @description
 * Enhances a textarea with proactive, privacy-preserving suggestions that help
 * user researchers improve a project Description before submission.
 *
 * Features:
 * - Runs entirely in the browser (no network, no cost).
 * - GOV.UK style & inclusive language nudges.
 * - Privacy guardrails (basic PII pattern detection with warnings).
 * - Debounced auto-trigger + manual trigger button.
 * - Accessible output region with aria-live="polite".
 *
 * @requires globalThis.document
 * @requires globalThis.CustomEvent
 *
 * @typedef {Object} SuggesterConfig
 * @property {string} textarea           CSS selector for the Description textarea (default '#project-description')
 * @property {string} container          Selector for the suggestions container (default '#description-suggestions')
 * @property {string} [button]           Optional selector for a “Get suggestions” button (default '#btn-get-suggestions')
 * @property {number} [minChars]         Minimum char threshold to start suggesting (default 400)
 * @property {number} [idleMs]           Idle debounce before evaluating (default 2000)
 * @property {number} [throttleMs]       Minimum time between auto runs (default 30000)
 * @property {number} [changeDelta]      Minimum relative change (0–1) to re-run within throttle window (default 0.15)
 * @property {number} [maxSuggestions]   Max number of suggestions to return (default 8)
 */

/* =========================
 * @section Configuration
 * ========================= */

/**
 * Immutable configuration defaults.
 * @constant
 * @name DEFAULTS
 * @type {Readonly<{
 *   MIN_CHARS:number,
 *   IDLE_MS:number,
 *   THROTTLE_MS:number,
 *   CHANGE_DELTA:number,
 *   MAX_SUGGESTIONS:number,
 *   READABILITY_SENTENCE_MAX:number
 * }>}
 * @default
 * @inner
 */
const DEFAULTS = Object.freeze({
	MIN_CHARS: 400,
	IDLE_MS: 2000,
	THROTTLE_MS: 30_000,
	CHANGE_DELTA: 0.15,
	MAX_SUGGESTIONS: 8,
	READABILITY_SENTENCE_MAX: 28 // rough proxy for plain English
});

/* =========================
 * @section Patterns
 * ========================= */

// Writing style
const RE_HEDGING = /\b(might|could|maybe|possibly|perhaps|potentially|try to|aim to|hope to)\b/i;
const RE_SOLUTIONING = /\b(build|ship|develop|implement|engineer|code|deploy)\b/i;
const RE_ACRONYM = /\b[A-Z]{3,}\b/g;

// Inclusion hints
const RE_USERS = /\b(user|participant|applicant|officer|caseworker|citizen)s?\b/i;
const RE_INCLUSION = /\b(accessibility|screen[- ]reader|neuro|language|assistive|device|bandwidth)\b/i;

// Outcomes & timing
const RE_NUMBER_TARGET = /\b(\d{1,3}%|\b\d{1,3}\b( participants?| users?| sessions?))\b/i;
const RE_DATE_RANGE = /\b(Q[1-4]\s?\d{4}|(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s?\d{4}|by\s(Q[1-4]|(end|mid|start)\s?of\s?\w+))\b/i;

// PII (basic)
const RE_EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const RE_NI = /\b(?!BG|GB|NK|KN|TN|NT|ZZ)[A-CEGHJ-PR-TW-Z]{2}\d{6}[A-D]\b/i;
const RE_NHS = /\b\d{3}\s?\d{3}\s?\d{4}\b/;

// Duplicates
const RE_DUP_LINE = /(.+)\n(?:.*\n)*\1\b/i;

/* =========================
 * @section Helper functions
 * ========================= */

/**
 * Escape text for safe HTML interpolation.
 * @function esc
 * @inner
 * @param {unknown} s
 * @returns {string}
 */
function esc(s) {
	return String(s ?? '').replace(/[&<>"']/g, m => ({
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;'
	} [m]));
}

/**
 * Simple debounce.
 * @function debounce
 * @inner
 * @param {Function} fn
 * @param {number} ms
 * @returns {Function}
 */
function debounce(fn, ms) {
	let t;
	return (...args) => {
		clearTimeout(t);
		t = setTimeout(() => fn(...args), ms);
	};
}

/**
 * Relative change between two strings (0–1), using shared prefix heuristic.
 * @function changedBy
 * @inner
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function changedBy(a, b) {
	if (!a) return 1;
	const al = a.length,
		bl = b.length,
		max = Math.max(al, bl);
	let same = 0;
	for (let i = 0; i < Math.min(al, bl); i++)
		if (a[i] === b[i]) same++;
	return 1 - (same / max);
}

/**
 * Count words (approximate).
 * @function wordCount
 * @inner
 * @param {string} s
 * @returns {number}
 */
function wordCount(s) {
	return (String(s).trim().match(/\b\w+\b/g) || []).length;
}

/* =========================
 * @section Rule engine
 * ========================= */

/**
 * Run static rules against input text and return a list of suggestions.
 * @function runRules
 * @inner
 * @param {string} text
 * @param {number} maxSuggestions
 * @returns {Array<{category:string, tip:string, why:string, example:string, severity:"high"|"medium"|"low"}>}
 */
function runRules(text, maxSuggestions) {
	const out = [];

	// 1) Purpose & scope
	if (RE_SOLUTIONING.test(text)) {
		out.push({
			category: "Purpose & scope",
			tip: "Reframe the problem as a user need, not a solution.",
			why: "Keeps discovery unbiased and method-agnostic.",
			example: "We need to understand why applicants abandon after identity checks, not build a new page.",
			severity: "high"
		});
	}
	if (!/in[- ]scope|out[- ]of[- ]scope/i.test(text)) {
		out.push({
			category: "Purpose & scope",
			tip: "Add one line each for in-scope and out-of-scope.",
			why: "Sets expectations for stakeholders.",
			example: "In scope: identity check step; Out of scope: payment provider changes.",
			severity: "medium"
		});
	}

	// 2) Users & inclusion
	if (!RE_USERS.test(text)) {
		out.push({
			category: "Users & inclusion",
			tip: "Name primary users and contexts of use.",
			why: "Guides recruitment and analysis.",
			example: "Primary: first-time visa applicants on mobile; include screen-reader users and low bandwidth.",
			severity: "high"
		});
	}
	if (!RE_INCLUSION.test(text)) {
		out.push({
			category: "Users & inclusion",
			tip: "Add inclusion considerations (accessibility, device, language).",
			why: "Supports equitable research.",
			example: "Include screen-reader users; test on low bandwidth and legacy Android.",
			severity: "medium"
		});
	}

	// 3) Outcomes & measures (SMART)
	if (!RE_NUMBER_TARGET.test(text) || !RE_DATE_RANGE.test(text)) {
		out.push({
			category: "Outcomes & measures",
			tip: "Make outcomes SMART: include a number and a timeframe.",
			why: "Enables testable success.",
			example: "Identify top 3 blockers and raise task completion by 20% by end of Q2.",
			severity: "high"
		});
	}

	// 4) Assumptions & risks
	if (!/\b(assumptions?|we believe|hypotheses?)\b/i.test(text)) {
		out.push({
			category: "Assumptions & risks",
			tip: "List assumptions as testable hypotheses.",
			why: "Reduces bias in interpretation.",
			example: "We believe appointment wording causes drop-offs; we’ll know if clearer copy increases completion by 20%.",
			severity: "medium"
		});
	}
	if (!/\b(risk|constraint|legal|time|data access|security|ops)\b/i.test(text)) {
		out.push({
			category: "Assumptions & risks",
			tip: "Note key risks or constraints (time, legal, ops).",
			why: "Prepares stakeholders for trade-offs.",
			example: "Constraint: limited access to live logs; Risk: incentives may bias uptake.",
			severity: "low"
		});
	}

	// 5) Ethics & privacy
	const hasPII = RE_EMAIL.test(text) || RE_NI.test(text) || RE_NHS.test(text);
	if (hasPII) {
		out.push({
			category: "Ethics & privacy",
			tip: "Remove personal data (emails/IDs) from Description.",
			why: "Protects privacy; keep PII out of planning docs.",
			example: "Replace real emails/IDs with generic roles or placeholders.",
			severity: "high"
		});
	}
	if (!/\b(consent|retention|DPIA|privacy|data)\b/i.test(text)) {
		out.push({
			category: "Ethics & privacy",
			tip: "Add consent, retention, and DPIA/DPS notes.",
			why: "Meets policy and builds trust.",
			example: "No PII in notes; store audio for 90 days with consent; DPIA checked.",
			severity: "medium"
		});
	}

	// 6) Methods fit
	if (!/\b(interviews?|usability|contextual|diary|survey|prototype|A\/B)\b/i.test(text)) {
		out.push({
			category: "Methods fit",
			tip: "State method(s) aligned to question maturity.",
			why: "Ensures the right evidence.",
			example: "Discovery: contextual interviews + journey mapping; later: usability on a prototype.",
			severity: "low"
		});
	}

	// 7) Style (Plain English)
	const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
	const longSentence = sentences.find(s => s.split(/\s+/).length > DEFAULTS.READABILITY_SENTENCE_MAX);
	const acronyms = (text.match(RE_ACRONYM) || []).filter(a => !['UK', 'HO', 'AI', 'ID', 'QA'].includes(a));
	if (longSentence) {
		out.push({
			category: "Style",
			tip: "Split very long sentences into shorter ones.",
			why: "Improves readability.",
			example: "Keep most sentences under ~20 words.",
			severity: "low"
		});
	}
	if (acronyms.length) {
		out.push({
			category: "Style",
			tip: "Expand acronyms on first use: " + [...new Set(acronyms)].slice(0, 3).join(', '),
			why: "Shared understanding across teams.",
			example: "Write ‘User Research (UR)’ on first mention.",
			severity: "low"
		});
	}
	if (RE_HEDGING.test(text)) {
		out.push({
			category: "Style",
			tip: "Reduce hedging; be specific about intent.",
			why: "Clarity for reviewers.",
			example: "Replace ‘might explore’ with ‘we will explore’.",
			severity: "low"
		});
	}

	// 8) Clarity & brevity
	if (RE_DUP_LINE.test(text)) {
		out.push({
			category: "Clarity",
			tip: "Remove duplicated lines or repeated scope statements.",
			why: "Keeps the Description concise.",
			example: "Merge repeated ‘scope’ paragraphs into one.",
			severity: "low"
		});
	}
	if (wordCount(text) > 300 && !/\b(structure|sections?|part|outline)\b/i.test(text)) {
		out.push({
			category: "Clarity",
			tip: "Add a three-part structure: Problem → Users → Outcomes.",
			why: "Faster stakeholder review.",
			example: "1) Problem… 2) Users… 3) Outcomes…",
			severity: "low"
		});
	}

	return out.slice(0, maxSuggestions);
}

/* =========================
 * @section Rendering
 * ========================= */

/**
 * Render suggestions into a container (ARIA region).
 * @function render
 * @inner
 * @param {HTMLElement} container
 * @param {{ summary:string, suggestions:Array<any>, flags?:{warning?:string} }} data
 * @returns {void}
 */
function render(container, data) {
	const { summary, suggestions, flags } = data;
	container.innerHTML = "";

	const region = document.createElement("div");
	region.setAttribute("role", "region");
	region.setAttribute("aria-live", "polite");
	region.setAttribute("aria-label", "Suggestions for Description");
	region.className = "sugg-region";

	const h = document.createElement("div");
	h.className = "sugg-summary";
	h.textContent = summary || `${suggestions.length} suggestion${suggestions.length !== 1 ? 's' : ''} available`;
	region.appendChild(h);

	const ul = document.createElement("ul");
	ul.className = "sugg-list";

	for (const s of suggestions) {
		const li = document.createElement("li");
		li.className = "sugg-item";
		li.innerHTML = `
			<strong class="sugg-cat">${esc(s.category)}</strong> — ${esc(s.tip)}
			<div class="sugg-why">Why: ${esc(s.why)}</div>
			<button type="button" class="sugg-apply" aria-label="Apply example rewrite">Apply example rewrite</button>
			<div class="sugg-ex" hidden>${esc(s.example)}</div>
		`;
		ul.appendChild(li);
	}
	region.appendChild(ul);

	if (flags?.warning) {
		const w = document.createElement("div");
		w.className = "sugg-warning";
		w.textContent = flags.warning;
		region.appendChild(w);
	}

	container.appendChild(region);

	// Bind per-suggestion "Apply example rewrite" disclosure
	container.querySelectorAll(".sugg-apply").forEach(btn => {
		btn.addEventListener("click", e => {
			const ex = e.currentTarget.nextElementSibling;
			ex.hidden = !ex.hidden;
			if (!ex.hidden) ex.setAttribute("role", "note");
		});
	});
}

/* =========================
 * @section Public API
 * ========================= */

/**
 * Initialise the Copilot Suggester on a page.
 * @function initCopilotSuggester
 * @public
 * @param {Partial<SuggesterConfig>} [opts]
 * @returns {{ forceSuggest:()=>void, destroy:()=>void }|null} Instance handle or null if elements missing.
 *
 * @example
 * import { initCopilotSuggester } from './copilot-suggester.js';
 * initCopilotSuggester({ textarea:'#project-description', container:'#description-suggestions' });
 */
export function initCopilotSuggester(opts = {}) {
	/** @type {SuggesterConfig} */
	const cfg = {
		textarea: '#project-description',
		container: '#description-suggestions',
		button: '#btn-get-suggestions',
		minChars: DEFAULTS.MIN_CHARS,
		idleMs: DEFAULTS.IDLE_MS,
		throttleMs: DEFAULTS.THROTTLE_MS,
		changeDelta: DEFAULTS.CHANGE_DELTA,
		maxSuggestions: DEFAULTS.MAX_SUGGESTIONS,
		...opts
	};

	/** @type {HTMLTextAreaElement|null} */
	const el = document.querySelector(cfg.textarea);
	/** @type {HTMLElement|null} */
	const out = document.querySelector(cfg.container);
	/** @type {HTMLButtonElement|null} */
	const btn = cfg.button ? document.querySelector(cfg.button) : null;

	if (!el || !out) return null;

	let lastText = "";
	let lastAt = 0;

	/**
	 * Build suggestion payload for rendering.
	 * @function buildResult
	 * @inner
	 * @param {string} text
	 * @returns {{summary:string, suggestions:Array<any>, flags:{warning?:string}}}
	 */
	function buildResult(text) {
		const suggestions = runRules(text, cfg.maxSuggestions);
		const flags = {};
		if (RE_EMAIL.test(text) || RE_NI.test(text) || RE_NHS.test(text)) {
			flags.warning = "Possible personal/sensitive data detected. Remove PII from planning documents.";
		}
		return {
			summary: suggestions.length ?
				"Suggestions to strengthen your Description" : "No issues found against the current rule set.",
			suggestions,
			flags
		};
	}

	/**
	 * Possibly generate suggestions (auto or manual).
	 * @async
	 * @function maybeSuggest
	 * @inner
	 * @param {"auto"|"manual"} trigger
	 * @returns {Promise<void>}
	 */
	async function maybeSuggest(trigger = "auto") {
		const text = el.value || "";
		if (text.length < cfg.minChars) return;

		const delta = changedBy(lastText, text);
		const now = performance.now();
		if (trigger === "auto" && delta < cfg.changeDelta && (now - lastAt) < cfg.throttleMs) return;

		out.dataset.state = "loading";
		out.textContent = "Generating suggestions…";

		const result = buildResult(text);
		render(out, result);

		lastText = text;
		lastAt = now;

		// Lightweight telemetry (counters only; no content)
		try {
			window.dispatchEvent(new CustomEvent("copilot-suggester:telemetry", {
				detail: {
					trigger,
					char_bucket: Math.floor(text.length / 200) * 200,
					suggestion_count: result.suggestions.length
				}
			}));
		} catch {}
	}

	// Debounced auto trigger
	const onInput = debounce(() => maybeSuggest("auto"), cfg.idleMs);
	el.addEventListener("input", onInput);

	// Manual button (optional)
	if (btn) {
		btn.addEventListener("click", () => maybeSuggest("manual"));
		btn.setAttribute("aria-label", "Get suggestions for Description");
		btn.accessKey = "g";
	}

	// Return handle
	return {
		forceSuggest: () => { void maybeSuggest("manual"); },
		destroy: () => {
			try { el.removeEventListener("input", onInput); } catch {}
			try { btn && btn.removeEventListener("click", () => maybeSuggest("manual")); } catch {}
		}
	};
}

/* =========================
 * @section Auto-init (optional)
 * ========================= */

/**
 * Progressive enhancement: auto-initialise if elements exist.
 * Safe to include globally; no-op on pages without the selectors.
 */
document.addEventListener('DOMContentLoaded', () => {
	const el = document.querySelector('#project-description');
	const out = document.querySelector('#description-suggestions');
	if (el && out) initCopilotSuggester();
});
