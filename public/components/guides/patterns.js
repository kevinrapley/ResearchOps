/* Minimal client-side registry so the page works before server patterns exist.
   Replace these with real pattern content or load dynamically. */
const REGISTRY = {
	'intro_opening_v1': `## Welcome and how we’ll run this
- Thank you for joining today.
- We’re exploring **{{project.name}}**. We’re testing the service, not you.
- There are no right or wrong answers.
- Please think aloud as you go.`,
	'consent_standard_v2': `## Consent
- Purpose: to understand how people use the service.
- Recording: audio/screen for analysis only.
- Your data will be handled per UK GDPR. You may withdraw at any time.`,
	'warmup_daily_routines_v1': `## Warm-up
- Tell me about the last time you did something like this online.
- Are there any preferences or needs you want me to be aware of today?`,
	'task_observation_shell_v1': `### Task {{index}}{{#name}} — {{name}}{{/name}}
**Goal:** {{goal}}

**Success signals**
{{#successSignals}}- {{.}}
{{/successSignals}}

**Prompts**
- “Talk me through what you expect to happen.”
- “What, if anything, felt hard or slow?”

**Accessibility checks (WCAG 2.2 AA)**
- Keyboard path? Focus order? Labels? Errors? Contrast?`,
	'probe_error_recovery_v1': `### Probe: Error recovery
- What would help you recover from an error here?
- How confident do you feel after reading the message?`,
	'probe_trust_signals_v1': `### Probe: Trust signals
- What makes this page feel trustworthy or not?
- Are you comfortable sharing personal details here? Why?`,
	'wrapup_debrief_v1': `## Wrap-up
- If you could change one thing, what would it be and why?
- Anything we didn’t ask that we should have?`,
	'note_observer_grid_v1': `## Observer notes (optional)
| Time | Behaviour | Quote | Issue? |
|------|-----------|-------|--------|`
};

export function listStarterPatterns() {
	return Object.keys(REGISTRY).map(name => ({
		name,
		version: name.match(/_v(\d+)$/)?.[1] || 1,
		title: pretty(name),
		category: category(name)
	}));
}

export function searchPatterns(q) {
	const items = listStarterPatterns();
	if (!q) return items;
	return items.filter(p => (p.title + ' ' + p.category + ' ' + p.name).toLowerCase().includes(q));
}

function pretty(k) {
	return k.replace(/_/g, ' ').replace(/ v(\d+)$/, ' v$1')
		.replace(/\b([a-z])/g, (_, c) => c.toUpperCase());
}

function category(k) {
	if (k.startsWith('intro')) return 'intro';
	if (k.startsWith('consent')) return 'consent';
	if (k.startsWith('warmup')) return 'warmup';
	if (k.startsWith('task')) return 'task';
	if (k.startsWith('probe')) return 'probe';
	if (k.startsWith('wrapup')) return 'wrap-up';
	if (k.startsWith('note')) return 'note';
	return 'other';
}

/* Expose to editor builder */
if (!window.__patternRegistry) window.__patternRegistry = {};
for (const [k, v] of Object.entries(REGISTRY)) {
	window.__patternRegistry[k] = v;
}