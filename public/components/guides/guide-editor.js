import Mustache from '/lib/mustache.min.js';
import { marked } from '/lib/marked.min.js';
import DOMPurify from '/lib/purify.min.js';

export async function renderGuide({ source, context, partials }) {
	const md = Mustache.render(source, context, partials || {});
	const raw = marked.parse(md, { mangle: false, headerIds: true, gfm: true });
	const html = DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
	return { md, html };
}

export async function buildPartials(names) {
	const partials = {};
	for (const name of names) {
		try {
			// Server pattern endpoint; fallback to client registry
			const res = await fetch(`/api/patterns/${encodeURIComponent(name)}`);
			if (res.ok) {
				const p = await res.json();
				partials[name] = p.sourceMarkdown || '';
			} else {
				const local = window.__patternRegistry?.[name];
				if (local) partials[name] = local;
			}
		} catch (e) {
			const local = window.__patternRegistry?.[name];
			if (local) partials[name] = local;
		}
	}
	return partials;
}

/* Starter source for new guides */
export const DEFAULT_SOURCE = `---
title: {{study.title}} — Round 1
language: en-GB
timebox: 60
roles: ["Facilitator","Notetaker"]
---

# {{study.title}} — Discussion guide

_Study:_ **{{study.title}}**  
_Project:_ **{{project.name}}**

{{> intro_opening_v1}}
{{> consent_standard_v2}}

## Tasks
{{#tasks}}
{{> task_observation_shell_v1}}
{{/tasks}}

## Probes
{{> probe_error_recovery_v1}}
{{> probe_trust_signals_v1}}

## Wrap-up
{{> wrapup_debrief_v1}}

{{> note_observer_grid_v1}}
`;