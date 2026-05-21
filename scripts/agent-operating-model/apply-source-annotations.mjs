#!/usr/bin/env node

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ANNOTATIONS_PATH = '.agent-operating-model/bundles/github/source-annotations.yaml';
const ANNOTATION_FRAGMENTS_DIR = '.agent-operating-model/bundles/github/source-annotations';
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

function globToRegExp(pattern) {
	const escaped = pattern
		.split('*')
		.map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
		.join('[^/]*');
	return new RegExp(`^${escaped}$`);
}

function parseAnnotationYaml(source) {
	const annotations = new Map();
	const patterns = [];
	let section = null;
	let current = null;
	let currentKey = null;

	for (const line of source.split('\n')) {
		if (line === 'files:') {
			section = 'files';
			current = null;
			currentKey = null;
			continue;
		}

		if (line === 'patterns:') {
			section = 'patterns';
			current = null;
			currentKey = null;
			continue;
		}

		if (section === 'files') {
			const fileMatch = line.match(/^  "(.+)":$/);
			if (fileMatch) {
				current = { kind: 'file', key: fileMatch[1], value: {} };
				annotations.set(current.key, current.value);
				currentKey = null;
				continue;
			}
		}

		if (section === 'patterns') {
			const patternMatch = line.match(/^  - match: "(.+)"$/);
			if (patternMatch) {
				current = { kind: 'pattern', key: patternMatch[1], value: { match: patternMatch[1] } };
				patterns.push(current.value);
				currentKey = null;
				continue;
			}
		}

		if (!current) continue;

		const keyMatch = line.match(/^    ([a-z0-9_]+):(?:\s*(.*))?$/i);
		if (keyMatch) {
			const [, key, inlineValue] = keyMatch;
			currentKey = key;

			if (inlineValue && inlineValue.trim()) {
				current.value[key] = unquote(inlineValue);
			} else {
				current.value[key] = [];
			}
			continue;
		}

		const itemMatch = line.match(/^      -\s+(.+)$/);
		if (itemMatch && currentKey) {
			if (!Array.isArray(current.value[currentKey])) current.value[currentKey] = [];
			current.value[currentKey].push(unquote(itemMatch[1]));
		}
	}

	return { annotations, patterns };
}

function mergeParsed(target, source) {
	for (const [filePath, annotation] of source.annotations.entries()) {
		target.annotations.set(filePath, annotation);
	}
	for (const pattern of source.patterns) {
		target.patterns.push(pattern);
	}
}

async function loadAnnotations() {
	const output = { annotations: new Map(), patterns: [] };
	mergeParsed(output, parseAnnotationYaml(await readFile(ANNOTATIONS_PATH, 'utf8')));

	const fragmentNames = await readdir(ANNOTATION_FRAGMENTS_DIR).catch(() => []);
	for (const fragmentName of fragmentNames.filter((name) => name.endsWith('.yaml')).sort()) {
		const fragmentPath = path.join(ANNOTATION_FRAGMENTS_DIR, fragmentName);
		mergeParsed(output, parseAnnotationYaml(await readFile(fragmentPath, 'utf8')));
	}

	return output;
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

function getPanelIds(html) {
	return [...html.matchAll(/<article class="source-panel [^"]+" id="([^"]+)">/g)].map((match) => match[1]);
}

function annotationFor(filePath, annotations, patterns) {
	if (annotations.has(filePath)) return annotations.get(filePath);
	const match = patterns.find((pattern) => globToRegExp(pattern.match).test(filePath));
	return match || null;
}

async function main() {
	const { annotations, patterns } = await loadAnnotations();
	const grouped = new Map();
	const familyPages = ['modes', 'roles', 'contracts', 'graders', 'templates', 'scripts'];

	for (const family of familyPages) {
		const pagePath = path.join(SOURCE_ROOT, family, 'index.html');
		const html = await readFile(pagePath, 'utf8').catch(() => null);
		if (!html) continue;

		for (const panelId of getPanelIds(html)) {
			const filePath = panelId.replaceAll('-', '/').replace(/^templates\//, 'templates/');
			const sourcePath = [...annotations.keys()].find((key) => slug(key) === panelId)
				|| patterns.find((pattern) => globToRegExp(pattern.match).test(filePath))?.match;
			if (!sourcePath) continue;
		}
	}

	for (const [filePath, annotation] of annotations.entries()) {
		if (!annotation.family || !FAMILY_HEADINGS[annotation.family]) continue;
		const pagePath = familyPagePath(filePath);
		if (!grouped.has(pagePath)) grouped.set(pagePath, []);
		grouped.get(pagePath).push([filePath, annotation]);
	}

	for (const pattern of patterns) {
		if (!pattern.family || !FAMILY_HEADINGS[pattern.family]) continue;
		const family = pattern.match.split('/')[0];
		const pagePath = path.join(SOURCE_ROOT, family, 'index.html');
		const html = await readFile(pagePath, 'utf8').catch(() => null);
		if (!html) continue;

		const ids = getPanelIds(html);
		for (const id of ids) {
			if (!id.startsWith(`${family}-`)) continue;
			const candidatePath = id.replaceAll('-', '/');
			if (!globToRegExp(pattern.match).test(candidatePath)) continue;
			if (!grouped.has(pagePath)) grouped.set(pagePath, []);
			grouped.get(pagePath).push([candidatePath, pattern]);
		}
	}

	for (const [pagePath, entries] of grouped.entries()) {
		let html = await readFile(pagePath, 'utf8');
		for (const [filePath, annotation] of entries) {
			html = replacePanelNotes(html, filePath, annotation);
		}
		await writeFile(pagePath, html, 'utf8');
	}

	console.log(`Applied source annotations to ${annotations.size} files and ${patterns.length} patterns.`);
}

main().catch((error) => {
	console.error(error.message);
	process.exitCode = 1;
});
