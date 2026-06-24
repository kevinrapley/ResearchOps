/**
 * @file start-description-assist.js
 * @module StartDescriptionAssist
 * @summary Step 1 (Description) enhancements: local suggestions + AI rewrite.
 *
 * @description
 * - Shows toolbar when description length ≥ 400.
 * - Renders local suggestions separately from the markdown AI rewrite preview.
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
import { marked } from '/lib/marked.min.js';
import DOMPurify from '/lib/purify.min.js';

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

function renderMarkdown(markdown) {
  const rawHtml = marked.parse(String(markdown || ''));
  return DOMPurify.sanitize(rawHtml);
}

function renderAiPanel(data, idPrefix = 'ai') {
  return `
    <div class="${idPrefix}-region">
      <div class="govuk-inset-text ${idPrefix}-summary"><p class="govuk-body"><strong>Review summary:</strong> ${esc(data?.summary || '')}</p></div>
      <hr class="govuk-section-break govuk-section-break--m govuk-section-break--visible">
      <h3 class="govuk-heading-s">Concise rewrite</h3>
      <div class="rewrite-block govuk-body" aria-label="AI rewrite">${renderMarkdown(data?.rewrite || '')}</div>
      <button type="button" id="apply-ai-rewrite" class="govuk-button govuk-button--secondary">Replace description with rewrite</button>
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
        aiMount.innerHTML = renderAiPanel(data, 'ai');
        const apply = aiMount.querySelector('#apply-ai-rewrite');
        apply?.addEventListener('click', () => {
          ta.value = typeof data?.rewrite === 'string' ? data.rewrite : '';
          ta.focus();
          try { sugg.forceSuggest(); } catch {}
        });
      }
      aiStatus && (aiStatus.textContent =
        data?.flags?.possible_personal_data
          ? 'Possible personal data detected in your original text.'
          : data?.flags?.ai_unavailable
            ? 'Done. Rule-based suggestions shown.'
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
