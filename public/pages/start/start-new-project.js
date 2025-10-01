// /pages/start/start-new-project.js
/**
 * Optional orchestrator.
 * If start-description-assist has already auto-booted (window.__descAssistActive),
 * this file will do nothing. Otherwise, it can explicitly boot modules.
 */

import { initStartDescriptionAssist } from '/js/start-description-assist.js';
import { initCopilotSuggester } from '/js/copilot-suggester.js';

const once = (() => {
	const done = new Set();
	return (key, fn) => { if (done.has(key)) return;
		done.add(key); try { fn(); } catch (e) { console.error(e); } };
})();

function exists(sel) { return !!document.querySelector(sel); }

function readAiEndpoint() {
	const meta = document.querySelector('meta[name="ai-endpoint"]')?.content;
	return (window.__AI_ENDPOINT || meta || 'https://rops-api.digikev-kevin-rapley.workers.dev/api/ai-rewrite');
}

document.addEventListener('DOMContentLoaded', () => {
	if (window.__descAssistActive) return; // already handled by start-description-assist.js

	once('start-description-assist', () => {
		const req = ['#p_desc', '#btn-get-suggestions', '#btn-ai-rewrite', '#description-suggestions', '#ai-rewrite-output', '#ai-rewrite-status'];
		if (!req.every(exists)) return;
		initStartDescriptionAssist({
			textareaSelector: '#p_desc',
			manualBtnSelector: '#btn-get-suggestions',
			aiBtnSelector: '#btn-ai-rewrite',
			suggContainerSelector: '#description-suggestions',
			aiContainerSelector: '#ai-rewrite-output',
			aiStatusSelector: '#ai-rewrite-status',
			aiEndpoint: readAiEndpoint()
		});
	});

	once('copilot-suggester', () => {
		const need = ['#p_desc', '#copilot-output', '#btn-copilot'];
		if (!need.every(exists)) return;
		initCopilotSuggester({
			sourceSelector: '#p_desc',
			outputSelector: '#copilot-output',
			triggerSelector: '#btn-copilot'
		});
	});
});
