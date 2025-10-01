/**
 * @file start-description-assist.js
 * @module StartDescriptionAssist
 * @summary Step 1 (Description) enhancements: local suggestions + AI rewrite.
 *
 * @description
 * - Shows toolbar when description length ≥ 400.
 * - Two-column AI suggestions (general vs. bias) + concise rewrite preview.
 * - Calls /api/ai-rewrite?mode=description only on explicit click.
 * - Re-runs local suggestions after applying the rewrite.
 *
 * @typedef {Object} AssistConfig
 * @property {string} textareaSelector
 * @property {string} manualBtnSelector
 * @property {string} aiBtnSelector
 * @property {string} suggContainerSelector
 * @property {string} aiContainerSelector
 * @property {string} aiStatusSelector
 * @property {string} aiEndpoint
 * @property {number} minCharsForAI
 * @property {number} requestTimeoutMs
 */

import { initCopilotSuggester } from './copilot-suggester.js';

/* ---------------- Helpers ---------------- */

const DEFAULTS = Object.freeze({
  MIN_CHARS_FOR_AI: 400,
  TIMEOUT_MS: 10_000,
  ENDPOINT: '/api/ai-rewrite'
});

/** Escape HTML */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/** Split suggestions into general vs bias/inclusion */
function splitSuggestionsByBias(items = []) {
  const biasKeywords = [
    'bias','inclusion','inclusive','accessibility','accessible','assistive',
    'screen reader','screen-reader','contrast','language','bilingual','welsh',
    'device coverage','browser coverage','diversity','equality','disability',
    'low vision','motor','hearing'
  ];
  const isBiasy = (t = '') => biasKeywords.some(k => t.toLowerCase().includes(k));
  const left = [], right = [];
  for (const s of items) {
    const blob = `${s?.category ?? ''} ${s?.tip ?? ''} ${s?.why ?? ''}`.toLowerCase();
    (isBiasy(blob) ? right : left).push(s);
  }
  return { left, right };
}

function renderTwoColumnSuggestions(left = [], right = [], idPrefix = 'sugg') {
  const list = (items, empty) =>
    items?.length
      ? `<ul class="${idPrefix}-list">
          ${items.map(s => `
            <li class="${idPrefix}-item">
              <div class="${idPrefix}-row">
                <strong class="${idPrefix}-cat">${esc(s?.category || 'General')}</strong>
                <span class="${idPrefix}-sev ${esc(s?.severity || 'medium')}">${esc(s?.severity || 'medium')}</span>
              </div>
              <div class="${idPrefix}-tip">${esc(s?.tip || '')}</div>
              <div class="${idPrefix}-why"><span class="mono muted">Why:</span> ${esc(s?.why || '')}</div>
            </li>`).join('')}
        </ul>`
      : `<p class="muted">${esc(empty)}</p>`;

  return `
    <section class="${idPrefix}-grid" aria-label="Suggestions grid">
      <div class="${idPrefix}-col" aria-label="Suggestions">
        <h3 class="govuk-heading-s">Suggestions</h3>
        ${list(left, 'No general suggestions.')}
      </div>
      <div class="${idPrefix}-col" aria-label="Bias &amp; Inclusion">
        <h3 class="govuk-heading-s">Bias &amp; Inclusion</h3>
        ${list(right, 'No bias findings.')}
      </div>
    </section>
  `;
}

function renderAiPanelTwoCol(data, idPrefix = 'ai') {
  const all = Array.isArray(data?.suggestions) ? data.suggestions : [];
  const { left, right } = splitSuggestionsByBias(all);
  return `
    <div class="${idPrefix}-region">
      <div class="${idPrefix}-summary"><strong>AI summary:</strong> ${esc(data?.summary || '')}</div>
      ${renderTwoColumnSuggestions(left, right, `${idPrefix}-sugg`)}
      <hr />
      <div><strong>Concise rewrite (optional):</strong></div>
      <pre class="rewrite-block" aria-label="AI rewrite">${esc(data?.rewrite || '')}</pre>
      <button type="button" id="apply-ai-rewrite" class="btn">Replace Description with rewrite</button>
    </div>
  `;
}

async function fetchWithTimeout(resource, init, timeoutMs) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
  try {
    return await fetch(resource, { ...(init || {}), signal: controller.signal });
  } finally { clearTimeout(t); }
}

/* ---------------- Entrypoint ---------------- */

/**
 * Initialise Step 1 assistance.
 * @param {Partial<AssistConfig>} cfg
 * @returns {{destroy:()=>void}|null}
 */
export function initStartDescriptionAssist(cfg = {}) {
  const opts = {
    textareaSelector: '#p_desc',
    manualBtnSelector: '#btn-get-suggestions',
    aiBtnSelector: '#btn-ai-rewrite',
    suggContainerSelector: '#description-suggestions',
    aiContainerSelector: '#ai-rewrite-output',
    aiStatusSelector: '#ai-rewrite-status',
    aiEndpoint: DEFAULTS.ENDPOINT,
    minCharsForAI: DEFAULTS.MIN_CHARS_FOR_AI,
    requestTimeoutMs: DEFAULTS.TIMEOUT_MS,
    ...cfg
  };

  const ta = /** @type {HTMLTextAreaElement|null} */ (document.querySelector(opts.textareaSelector));
  const manualBtn = /** @type {HTMLButtonElement|null} */ (document.querySelector(opts.manualBtnSelector));
  const aiBtn = /** @type {HTMLButtonElement|null} */ (document.querySelector(opts.aiBtnSelector));
  const suggMount = /** @type {HTMLElement|null} */ (document.querySelector(opts.suggContainerSelector));
  const aiMount = /** @type {HTMLElement|null} */ (document.querySelector(opts.aiContainerSelector));
  const aiStatus = /** @type {HTMLElement|null} */ (document.querySelector(opts.aiStatusSelector));
  const toolbar = /** @type {HTMLElement|null} */ (document.querySelector('#ai-tools'));

  // Guard: required DOM
  if (!ta || !suggMount) {
    console.warn('[StartDescriptionAssist] Missing required elements', { ta: !!ta, suggMount: !!suggMount });
    return null;
  }

  // Local suggester (client-only rules). It will render when we call forceSuggest().
  const sugg = initCopilotSuggester({
    textarea: opts.textareaSelector,
    container: opts.suggContainerSelector,
    button: opts.manualBtnSelector,
    minChars: opts.minCharsForAI,
    // keep existing single-column render inside copilot-suggester; we only override AI layout here
  });

  const revealToolbarIfThreshold = () => {
    const v = (ta.value || '').trim();
    if (v.length >= opts.minCharsForAI) {
      toolbar && toolbar.classList.remove('hidden');
    }
  };

  const autoSuggestOnThreshold = () => {
    const v = (ta.value || '').trim();
    if (v.length >= opts.minCharsForAI) {
      toolbar && toolbar.classList.remove('hidden');
      try { sugg.forceSuggest(); } catch (e) {
        console.debug('[StartDescriptionAssist] forceSuggest failed (non-fatal)', e);
      }
    }
  };

  // AI click -> /api/ai-rewrite?mode=description
  const onAiClick = async () => {
    const text = (ta.value || '').trim();
    if (text.length < opts.minCharsForAI) {
      aiStatus && (aiStatus.textContent = `Enter at least ${opts.minCharsForAI} characters to try AI.`);
      ta.focus();
      return;
    }
    aiStatus && (aiStatus.textContent = 'Thinking…');
    aiMount && (aiMount.innerHTML = '');

    try {
      const res = await fetchWithTimeout(`${opts.aiEndpoint}?mode=description`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text })
      }, opts.requestTimeoutMs);

      if (!res.ok) {
        aiStatus && (aiStatus.textContent = 'Suggestions are temporarily unavailable.');
        return;
      }

      const data = await res.json();
      if (aiMount) {
        aiMount.innerHTML = renderAiPanelTwoCol(data, 'ai');
        const apply = aiMount.querySelector('#apply-ai-rewrite');
        const pre = aiMount.querySelector('.rewrite-block');
        apply?.addEventListener('click', () => {
          ta.value = pre?.textContent || '';
          ta.focus();
          try { sugg.forceSuggest(); } catch {}
        });
      }
      aiStatus && (aiStatus.textContent =
        data?.flags?.possible_personal_data
          ? '⚠️ Possible personal data detected in your original text.'
          : 'Done.');
    } catch {
      aiStatus && (aiStatus.textContent = 'Network error.');
    }
  };

  // Events
  ta.addEventListener('input', autoSuggestOnThreshold);
  ta.addEventListener('paste', () => setTimeout(autoSuggestOnThreshold, 0));
  manualBtn?.addEventListener('click', () => { try { sugg.forceSuggest(); } catch {} });
  aiBtn?.addEventListener('click', onAiClick);

  // First paint (covers server-filled text or initial paste)
  revealToolbarIfThreshold();
  autoSuggestOnThreshold();

  // Signal ready (optional hooks/analytics)
  window.dispatchEvent(new CustomEvent('start-description-assist:ready'));

  return {
    destroy() {
      try {
        ta.removeEventListener('input', autoSuggestOnThreshold);
        aiBtn?.removeEventListener('click', onAiClick);
        if (typeof sugg?.destroy === 'function') sugg.destroy();
      } catch {}
    }
  };
}

/* ---------------- Auto-init ---------------- */

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initStartDescriptionAssist());
} else {
  initStartDescriptionAssist();
}
