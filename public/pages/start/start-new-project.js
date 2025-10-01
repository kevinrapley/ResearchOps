// /js/start-new-project.js
/**
 * Orchestrator for Start a New Research Project page.
 * Centralises initialisation for Start Description Assist and Copilot Suggester,
 * avoiding double-binding and keeping sequencing explicit.
 */

import { initStartDescriptionAssist } from '/js/start-description-assist.js';
import { initCopilotSuggester } from '/js/copilot-suggester.js';

const once = (() => {
	const done = new Set();
	return (key, fn) => { if (done.has(key)) return; done.add(key); try { fn(); } catch (e) { console.error(e); } };
})();

function exists(sel) { return !!document.querySelector(sel); }

document.addEventListener('DOMContentLoaded', () => {
	// Configure endpoints/selectors here to keep HTML clean.
	const AI_ENDPOINT = 'https://rops-api.digikev-kevin-rapley.workers.dev/api/ai-rewrite';

	// Start Description Assist (idempotent in its own module; we guard here too)
	once('start-description-assist', () => {
		const req = ['#p_desc','#btn-get-suggestions','#btn-ai-rewrite','#description-suggestions','#ai-rewrite-output','#ai-rewrite-status'];
		const allPresent = req.every(exists);
		if (!allPresent) {
			console.warn('[start-new-project] Skipping StartDescriptionAssist: selectors missing');
			return;
		}
		initStartDescriptionAssist({
			textareaSelector: '#p_desc',
			manualBtnSelector: '#btn-get-suggestions',
			aiBtnSelector: '#btn-ai-rewrite',
			suggContainerSelector: '#description-suggestions',
			aiContainerSelector: '#ai-rewrite-output',
			aiStatusSelector: '#ai-rewrite-status',
			aiEndpoint: AI_ENDPOINT
		});
	});

	// Copilot Suggester â ensure it uses different UI hooks to avoid collisions
	once('copilot-suggester', () => {
		const need = ['#p_desc','#copilot-output','#btn-copilot'];
		const ok = need.every(exists);
		if (!ok) {
			console.warn('[start-new-project] Skipping CopilotSuggester: selectors missing');
			return;
		}
		initCopilotSuggester({
			sourceSelector: '#p_desc',
			outputSelector: '#copilot-output',
			triggerSelector: '#btn-copilot'
		});
	});
});
