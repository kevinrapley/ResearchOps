/**
 * @file copilot-suggester.js
 * @module CopilotSuggester
 * @summary Local rule suggestions + Bias checks for Step 1 (client-only).
 */

/**
 * @typedef {Object} SuggOpts
 * @property {string} textarea
 * @property {string} container
 * @property {string} [manualButton]
 * @property {boolean} [biasColumn]   // render bias column if true
 * @property {number} [autoThreshold] // chars required to auto-run
 */

export function initCopilotSuggester( /** @type {SuggOpts} */ opts) {
	const ta = document.querySelector(opts.textarea);
	const root = document.querySelector(opts.container);
	const manualBtn = opts.manualButton ? document.querySelector(opts.manualButton) : null;
	if (!ta || !root) return null;

	const esc = (s) => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } [m]));

	const rulesEngine = (text) => {
		// … your existing rule checks …
		return [
			{ category: 'Scope', tip: 'State what is in and out of scope.', why: 'Prevents drift.', severity: 'high' },
			{ category: 'Outcomes & measures', tip: 'Add a numeric target and timeframe.', why: 'Enables tracking.', severity: 'high' },
			// …etc…
		];
	};

	const biasEngine = (text) => {
		// … your bias checks …
		return [
			{ category: 'Bias', tip: 'Avoid demographic proxies in sampling.', why: 'Prevents stereotyping.', severity: 'medium' },
			{ category: 'Bias', tip: 'Check device/language accessibility.', why: 'Inclusive coverage.', severity: 'medium' },
		];
	};

	const renderTwoCols = (suggs, bias) => `
    <div class="two-cols">
      <div class="col">
        <h3 class="govuk-heading-s" style="margin:0 0 .5rem 0">Suggestions</h3>
        <ul class="sugg-list">
          ${suggs.map(s => `
            <li class="sugg-item">
              <strong class="sugg-cat">${esc(s.category)}</strong> — ${esc(s.tip)}
              <div class="sugg-why">Why: ${esc(s.why)} (${esc(s.severity)})</div>
            </li>
          `).join('')}
        </ul>
      </div>
      <div class="col">
        <h3 class="govuk-heading-s" style="margin:0 0 .5rem 0">Bias checks</h3>
        <ul class="sugg-list">
          ${bias.map(b => `
            <li class="sugg-item">
              <strong class="sugg-cat">${esc(b.category)}</strong> — ${esc(b.tip)}
              <div class="sugg-why">Why: ${esc(b.why)} (${esc(b.severity)})</div>
            </li>
          `).join('')}
        </ul>
      </div>
    </div>
  `;

	const renderBiasFor = (text) => {
		const bias = biasEngine(text);
		return `
      <ul class="sugg-list">
        ${bias.map(b => `
          <li class="sugg-item">
            <strong class="sugg-cat">${esc(b.category)}</strong> — ${esc(b.tip)}
            <div class="sugg-why">Why: ${esc(b.why)} (${esc(b.severity)})</div>
          </li>
        `).join('')}
      </ul>
    `;
	};

	const run = () => {
		const text = ta.value.trim();
		const suggs = rulesEngine(text);
		const bias = biasEngine(text);
		root.innerHTML = opts.biasColumn ? renderTwoCols(suggs, bias) : renderTwoCols(suggs, []); // default 2-col
	};

	const maybeAutoSuggest = () => {
		const threshold = Number.isFinite(opts.autoThreshold) ? opts.autoThreshold : 400;
		if (ta.value.trim().length >= threshold) run();
	};

	// Manual trigger
	manualBtn?.addEventListener('click', run);

	// Expose API
	return {
		forceSuggest: run,
		maybeAutoSuggest,
		renderBiasFor
	};
}
