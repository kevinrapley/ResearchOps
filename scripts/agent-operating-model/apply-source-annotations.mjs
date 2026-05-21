#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ANNOTATIONS_PATH = '.agent-operating-model/bundles/github/source-annotations.yaml';
const SOURCE_ROOT = 'docs/agent-operating-model/bundles/github/source';

const FAMILY_HEADINGS = {
	mode: [
		['how_agent_uses_this_file', 'How the agent uses this file'],
		['what_to_look_for', 'What to look for'],
		['completion_evidence', 'Completion evidence'],
	],
	role: [
		['how_agent_uses_this_role', 'How the agent uses this role'],
		['what_judgement_it_applies', 'What judgement it applies'],
		['escalation_signals', 'Escalation signals'],
	],
	contract: [
		['what_this_schema_controls', 'What this schema controls'],
		['what_evidence_it_validates', 'What evidence it validates'],
		['what_breaks_the_contract', 'What breaks the contract'],
	],
	grader: [
		['what_this_grader_scores', 'What this grader scores'],
		['what_causes_a_fail', 'What causes a fail'],
		['what_evidence_it_expects', 'What evidence it expects'],
	],
	template: [
		['when_this_template_is_used', 'When this template is used'],
		['what_must_be_customised', 'What must be customised'],
		['what_must_not_be_changed_blindly', 'What must not be changed blindly'],
	],
	script: [
		['what_this_script_verifies', 'What this script verifies'],
		['when_it_should_be_run', 'When it should be run'],
		['what_failure_means', 'What failure means'],
	],
};

function slug(value) {
	return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'source-file';
}

function escapeHtml(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function unquote(value) {
	const trimmed = value.trim();
	if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
		return trimmed.slice(1, -1).replaceAll('\\"', '"').replaceAll('\\\\', '\\');
	}

	return trimmed;
}

function parseAnnotations(source) {
	const annotations = new Map();
	let currentPath = null;
	let currentKey = null;

	for (const line of source.split('\n')) {
		const fileMatch = line.match(/^  "(.+)":$/);
		if (fileMatch) {
			currentPath = fileMatch[1];
			annotations.set(currentPath, {});
			currentKey = null;
			continue;
		}

		if (!currentPath) continue;

		const keyMatch = line.match(/^    ([a-z0-9_]+):(?:\s*(.*))?$/i);
		if (keyMatch) {
			const [, key, inlineValue] = keyMatch;
			currentKey = key;

			if (inlineValue && inlineValue.trim()) {
				annotations.get(currentPath)[key] = unquote(inlineValue);
			} else {
				annotations.get(currentPath)[key] = [];
			}
			continue;
		}

		const itemMatch = line.match(/^      -\s+(.+)$/);
		if (itemMatch && currentKey) {
			const entry = annotations.get(currentPath);
			if (!Array.isArray(entry[currentKey])) entry[currentKey] = [];
			entry[currentKey].push(unquote(itemMatch[1]));
		}
	}

	return annotations;
}

function annotationHtml(annotation) {
	const headings = FAMILY_HEADINGS[annotation.family];
	if (!headings) return null;

	return headings.map(([key, label]) => {
		const values = annotation[key];
		if (!Array.isArray(values) || !values.length) return '';
		return `<h4>${escapeHtml(label)}</h4>\n<ul>${values.map((value) => `<li>${escapeHtml(value)}</li>`).join('')}</ul>`;
	}).join('\n');
}

function replacePanelNotes(html, filePath, annotation) {
	const panelId = slug(filePath);
	const notesHtml = annotationHtml(annotation);

	if (!notesHtml) return html;

	const pattern = new RegExp(`(<article class="source-panel [^"]+" id="${panelId}">[\\s\\S]*?<aside class="notes">)[\\s\\S]*?(</aside>[\\s\\S]*?</article>)`);

	if (!pattern.test(html)) {
		throw new Error(`Unable to find generated source panel for ${filePath}.`);
	}

	return html.replace(pattern, `$1\n${notesHtml}\n$2`);
}

function familyPagePath(filePath) {
	const family = filePath.split('/')[0];
	return path.join(SOURCE_ROOT, family, 'index.html');
}

async function main() {
	const annotations = parseAnnotations(await readFile(ANNOTATIONS_PATH, 'utf8'));
	const grouped = new Map();

	for (const [filePath, annotation] of annotations.entries()) {
		if (!annotation.family || !FAMILY_HEADINGS[annotation.family]) continue;
		const pagePath = familyPagePath(filePath);
		if (!grouped.has(pagePath)) grouped.set(pagePath, []);
		grouped.get(pagePath).push([filePath, annotation]);
	}

	for (const [pagePath, entries] of grouped.entries()) {
		let html = await readFile(pagePath, 'utf8');
		for (const [filePath, annotation] of entries) {
			html = replacePanelNotes(html, filePath, annotation);
		}
		await writeFile(pagePath, html, 'utf8');
	}

	console.log(`Applied source annotations to ${annotations.size} files.`);
}

main().catch((error) => {
	console.error(error.message);
	process.exitCode = 1;
});
