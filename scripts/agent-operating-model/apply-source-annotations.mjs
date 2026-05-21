#!/usr/bin/env node

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ANNOTATIONS_PATH = '.agent-operating-model/bundles/github/source-annotations.yaml';
const ANNOTATION_FRAGMENTS_DIR = '.agent-operating-model/bundles/github/source-annotations';
const SOURCE_BUNDLE_ROOT = '.agent-operating-model/bundles/github';
const SOURCE_ROOT = 'docs/agent-operating-model/bundles/github/source';
const TEXT_EXTENSIONS = new Set(['.css', '.csv', '.html', '.js', '.json', '.jsonc', '.md', '.mjs', '.py', '.txt', '.xml', '.yaml', '.yml']);

const FAMILY_HEADINGS = {
	modes: {
		family: 'mode',
		headings: [
			['how_agent_uses_this_file', 'How the agent uses this file'],
			['what_to_look_for', 'What to look for'],
			['completion_evidence', 'Completion evidence'],
		],
	},
	roles: {
		family: 'role',
		headings: [
			['how_agent_uses_this_role', 'How the agent uses this role'],
			['what_judgement_it_applies', 'What judgement it applies'],
			['escalation_signals', 'Escalation signals'],
		],
	},
	contracts: {
		family: 'contract',
		headings: [
			['what_this_schema_controls', 'What this schema controls'],
			['what_evidence_it_validates', 'What evidence it validates'],
			['what_breaks_the_contract', 'What breaks the contract'],
		],
	},
	graders: {
		family: 'grader',
		headings: [
			['what_this_grader_scores', 'What this grader scores'],
			['what_causes_a_fail', 'What causes a fail'],
			['what_evidence_it_expects', 'What evidence it expects'],
		],
	},
	templates: {
		family: 'template',
		headings: [
			['when_this_template_is_used', 'When this template is used'],
			['what_must_be_customised', 'What must be customised'],
			['what_must_not_be_changed_blindly', 'What must not be changed blindly'],
		],
	},
	scripts: {
		family: 'script',
		headings: [
			['what_this_script_verifies', 'What this script verifies'],
			['when_it_should_be_run', 'When it should be run'],
			['what_failure_means', 'What failure means'],
		],
	},
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
				current = { value: {} };
				annotations.set(fileMatch[1], current.value);
				currentKey = null;
				continue;
			}
		}

		if (section === 'patterns') {
			const patternMatch = line.match(/^  - match: "(.+)"$/);
			if (patternMatch) {
				current = { value: { match: patternMatch[1] } };
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
			current.value[key] = inlineValue && inlineValue.trim() ? unquote(inlineValue) : [];
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
	for (const [filePath, annotation] of source.annotations.entries()) target.annotations.set(filePath, annotation);
	for (const pattern of source.patterns) target.patterns.push(pattern);
}

async function loadAnnotations() {
	const output = { annotations: new Map(), patterns: [] };
	mergeParsed(output, parseAnnotationYaml(await readFile(ANNOTATIONS_PATH, 'utf8')));

	const fragmentNames = await readdir(ANNOTATION_FRAGMENTS_DIR).catch(() => []);
	for (const fragmentName of fragmentNames.filter((name) => name.endsWith('.yaml')).sort()) {
		mergeParsed(output, parseAnnotationYaml(await readFile(path.join(ANNOTATION_FRAGMENTS_DIR, fragmentName), 'utf8')));
	}

	return output;
}

async function walk(directory, root = directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		if (entry.name.startsWith('.') && entry.name !== '.github') continue;
		const fullPath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...await walk(fullPath, root));
		} else if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
			files.push(fullPath.split(path.sep).join('/').replace(`${root.split(path.sep).join('/')}/`, ''));
		}
	}

	return files.sort();
}

function annotationFor(filePath, annotations, patterns) {
	if (annotations.has(filePath)) return annotations.get(filePath);
	return patterns.find((pattern) => globToRegExp(pattern.match).test(filePath)) || null;
}

function annotationHtml(annotation, sourceFamily) {
	const config = FAMILY_HEADINGS[sourceFamily];
	if (!config) return null;

	return config.headings.map(([key, label]) => {
		const values = annotation[key];
		if (!Array.isArray(values) || !values.length) return '';
		return `<h4>${escapeHtml(label)}</h4>\n<ul>${values.map((value) => `<li>${escapeHtml(value)}</li>`).join('')}</ul>`;
	}).filter(Boolean).join('\n');
}

function replacePanelNotes(html, filePath, annotation, sourceFamily) {
	const notesHtml = annotationHtml(annotation, sourceFamily);
	if (!notesHtml) return html;

	const panelId = slug(filePath);
	const pattern = new RegExp(`(<article class="source-panel [^"]+" id="${panelId}">[\\s\\S]*?<aside class="notes">)[\\s\\S]*?(</aside>[\\s\\S]*?</article>)`);

	if (!pattern.test(html)) throw new Error(`Unable to find generated source panel for ${filePath}.`);
	return html.replace(pattern, `$1\n${notesHtml}\n$2`);
}

function familyPagePath(sourceFamily) {
	return path.join(SOURCE_ROOT, sourceFamily, 'index.html');
}

async function main() {
	const { annotations, patterns } = await loadAnnotations();
	const sourceFiles = await walk(SOURCE_BUNDLE_ROOT);
	const grouped = new Map();

	for (const filePath of sourceFiles) {
		const sourceFamily = filePath.split('/')[0];
		if (!FAMILY_HEADINGS[sourceFamily]) continue;

		const annotation = annotationFor(filePath, annotations, patterns);
		if (!annotation) continue;

		const pagePath = familyPagePath(sourceFamily);
		if (!grouped.has(pagePath)) grouped.set(pagePath, []);
		grouped.get(pagePath).push([filePath, annotation, sourceFamily]);
	}

	for (const [pagePath, entries] of grouped.entries()) {
		let html = await readFile(pagePath, 'utf8');
		for (const [filePath, annotation, sourceFamily] of entries) {
			html = replacePanelNotes(html, filePath, annotation, sourceFamily);
		}
		await writeFile(pagePath, html, 'utf8');
	}

	console.log(`Applied source annotations to ${[...grouped.values()].flat().length} source panels.`);
}

main().catch((error) => {
	console.error(error.message);
	process.exitCode = 1;
});
