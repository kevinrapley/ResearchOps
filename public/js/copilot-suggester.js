/**
 * @file copilot-suggester.js
 * @module CopilotSuggester
 * @summary Local, client-only rule/bias suggestions for textareas (no network).
 *
 * @description
 * Watches a textarea and renders two-column suggestions:
 *  - Left: general content-design suggestions (scope, clarity, measurability…)
 *  - Right: bias & inclusion checks (accessibility, device, language…)
 * Exposes a small API: { destroy(), forceSuggest() }.
 *
 * Accessibility:
 * - Results are rendered into a container with aria-live="polite".
 * - Uses semantic <ul>/<li> with concise headings.
 *
 * Privacy:
 * - No network calls. Heuristics run entirely in the browser.
 *
 * @typedef {Object} RuleItem
 * @property {string} category
 * @property {string} tip
 * @property {string} why
 * @property {"high"|"medium"|"low"} severity
 *
 * @typedef {Object} SuggesterOptions
 * @property {string} textarea              CSS selector of the textarea to watch
 * @property {string} container             CSS selector where suggestions should render
 * @property {string} [button]              Optional selector for a “Get suggestions” button
 * @property {number} [minChars=400]        Minimum characters to auto-suggest (e.g., 400 for Step 1, 60 for Step 2)
 * @property {(text:string)=>RuleItem[]} [rules]     Function to generate general suggestions from text
 * @property {(text:string)=>RuleItem[]} [biasRules] Function to generate bias suggestions from text
 * @property {()=>void} [onShown]           Optional callback when suggestions are rendered
 */

/* =========================
 * Utilities
 * ========================= */

/**
 * Escape text for safe HTML interpolation.
 * @param {unknown} s
 * @returns {string}
 */
function esc(s) {
	return String(s ?? "").replace(/[&<>"']/g, c => ({
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
		"'": "&#39;"
	} [c]));
}

/* =========================
 * Rendering
 * ========================= */

/**
 * Render two-column suggestions (general vs bias).
 * @param {RuleItem[]} left
 * @param {RuleItem[]} right
 * @returns {string}
 */
function renderTwoColumns(left, right) {
	const col = (items, heading, emptyMsg) => `
    <section class="sugg-col" aria-label="${esc(heading)}">
      <h3 class="sugg-heading">${esc(heading)}</h3>
      <ul class="sugg-list">
        ${items.length ? items.map(s => `
          <li class="sugg-item">
            <div class="sugg-row">
              <strong class="sugg-cat">${esc(s.category || "General")}</strong>
              <span class="sugg-sev ${esc(s.severity || "medium")}">${esc(s.severity || "medium")}</span>
            </div>
            <div class="sugg-tip">${esc(s.tip || "")}</div>
            <div class="sugg-why"><span class="mono muted">Why:</span> ${esc(s.why || "")}</div>
          </li>`).join("")
        : `<li class="sugg-item"><em>${esc(emptyMsg)}</em></li>`}
      </ul>
    </section>`.trim();

	return `
    <div class="sugg-grid" role="group" aria-label="Suggestions split view">
      ${col(left, "Suggestions", "No suggestions found.")}
      ${col(right, "Bias & Inclusion", "No bias findings.")}
    </div>
  `;
}

/* =========================
 * Default rule sets
 * ========================= */

/**
 * General content-design rules (safe, lightweight heuristics).
 * @param {string} t
 * @returns {RuleItem[]}
 */
function defaultRules(t) {
	/** @type {RuleItem[]} */
	const tips = [];
	const txt = (t || "").toLowerCase().trim();

	// Scope too broad
	if (txt.includes("test everything")) {
		tips.push({
			category: "Scope",
			tip: "Replace “test everything” with 2–3 focused areas (e.g., security, satisfaction).",
			why: "Focus enables targeted research and clearer outcomes.",
			severity: "high"
		});
	}

	// Paragraphing / sentence breaks
	if (t && !/[.!?]\s/.test(t)) {
		tips.push({
			category: "Clarity",
			tip: "Use short sentences and paragraph breaks.",
			why: "Improves readability for everyone.",
			severity: "medium"
		});
	}

	// Measurability/timeframe hint (suggestion only; no invented numbers)
	if (!/(\d{1,3}%|\bQ[1-4]\b|\bby end\b|\bwithin\s+\d+\s+(days?|weeks?|months?|quarters?)\b)/i.test(t)) {
		tips.push({
			category: "Outcomes & measures",
			tip: "Add a measurable outcome and a timeframe (suggested in notes; do not invent specifics).",
			why: "Enables tracking of success.",
			severity: "high"
		});
	}

	// Duplicate ideas (very rough: repeated “also” / “and also” chains)
	if ((t.match(/\balso\b/gi) || []).length >= 3) {
		tips.push({
			category: "Clarity",
			tip: "Consolidate repeated points; avoid long chains of ‘also’.",
			why: "Keeps the description concise and scannable.",
			severity: "low"
		});
	}

	// Stakeholders vs users balance
	if (/stakeholder|policy/i.test(t) && !/user|participant/i.test(t)) {
		tips.push({
			category: "User focus",
			tip: "Re-balance towards user needs; keep stakeholder checks separate.",
			why: "Reduces organisational bias and keeps research user-centred.",
			severity: "medium"
		});
	}

	return tips.slice(0, 6);
}

/**
 * Bias & inclusion rules (applies to all steps).
 * @param {string} t
 * @returns {RuleItem[]}
 */
function defaultBiasRules(t) {
	/** @type {RuleItem[]} */
	const tips = [];
	const txt = (t || "").toLowerCase();

	// Accessibility tech
	if (!/(screen\s*reader|accessibil|wcag|voiceover|talkback)/i.test(t)) {
		tips.push({
			category: "Accessibility",
			tip: "Consider users with assistive tech (e.g., screen readers).",
			why: "Prevents disability exclusion.",
			severity: "high"
		});
	}

	// Device coverage
	if (!/(mobile|phone|android|ios)/i.test(t)) {
		tips.push({
			category: "Device coverage",
			tip: "Include mobile users where relevant.",
			why: "Avoids desktop-only bias.",
			severity: "medium"
		});
	}

	// Language inclusion
	if (!/(welsh|bilingual|translation|language)/i.test(t)) {
		tips.push({
			category: "Language inclusion",
			tip: "Consider bilingual users (e.g., Welsh/English) if service area suggests it.",
			why: "Prevents language bias.",
			severity: "low"
		});
	}

	// Browser coverage mention
	if (/(safari|firefox|chrome)/i.test(t) === false && /browser|device/i.test(t)) {
		tips.push({
			category: "Browser coverage",
			tip: "Note which browsers/devices are in scope; avoid narrowing without reason.",
			why: "Prevents test-bench bias.",
			severity: "low"
		});
	}

	return tips.slice(0, 6);
}

/* =========================
 * Public API
 * ========================= */

/**
 * Initialise a suggester instance.
 * @param {SuggesterOptions} opts
 * @returns {{destroy:()=>void, forceSuggest:()=>void}}
 */
export function initCopilotSuggester(opts) {
	const {
		textarea,
		container,
		button,
		minChars = 400,
		rules = defaultRules,
		biasRules = defaultBiasRules,
		onShown
	} = opts || {};

	/** @type {HTMLTextAreaElement|null} */
	const ta = document.querySelector(textarea);
	/** @type {HTMLElement|null} */
	const mount = document.querySelector(container);
	/** @type {HTMLButtonElement|null} */
	const btn = button ? document.querySelector(button) : null;

	if (!ta || !mount) return { destroy() {}, forceSuggest() {} };

	/**
	 * Render suggestions to the mount.
	 * @returns {void}
	 */
	const render = () => {
		const value = (ta.value || "").trim();
		/** @type {RuleItem[]} */
		const general = (rules(value) || []).slice(0, 8);
		/** @type {RuleItem[]} */
		const bias = (biasRules(value) || []).slice(0, 8);

		mount.innerHTML = renderTwoColumns(general, bias);
		mount.classList.add("sugg-visible");
		if (typeof onShown === "function") onShown();
	};

	/**
	 * Auto-render when text length crosses the threshold.
	 * @returns {void}
	 */
	const maybeAuto = () => {
		const len = (ta.value || "").trim().length;
		if (len >= minChars) render();
	};

	/** @returns {void} */
	const onInput = () => { maybeAuto(); };
	/** @returns {void} */
	const onClick = () => { render(); };

	ta.addEventListener("input", onInput);
	btn?.addEventListener("click", onClick);

	return {
		/** @returns {void} */
		destroy() {
			try {
				ta.removeEventListener("input", onInput);
				btn?.removeEventListener("click", onClick);
			} catch {}
		},
		/** @returns {void} */
		forceSuggest() { render(); }
	};
}

/* =========================
 * Suggested minimal CSS (put in screen.css)
 * =========================
 * .sugg-grid { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
 * .sugg-heading { margin:0 0 .25rem 0; font-weight:700; }
 * .sugg-list { margin:0; padding-left:1rem; }
 * .sugg-item { margin:.5rem 0; }
 * .sugg-row { display:flex; gap:.5rem; align-items:center; }
 * .sugg-sev { font-size:.85em; padding:.1rem .4rem; border-radius:.25rem; border:1px solid currentColor; }
 * .sugg-sev.high { color:#7a1212; }
 * .sugg-sev.medium { color:#6b4e00; }
 * .sugg-sev.low { color:#2a5b2b; }
 */
