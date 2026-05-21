#!/usr/bin/env node

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ANNOTATIONS_PATH = '.agent-operating-model/bundles/github/source-annotations.yaml';
const ANNOTATION_FRAGMENTS_DIR = '.agent-operating-model/bundles/github/source-annotations';
const SOURCE_ROOT = 'docs/agent-operating-model/bundles/github/source';

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

function escapeHtml(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function unescapeHtml(value) {
	return String(value)
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>')
		.replaceAll('&quot;', '"')
		.replaceAll('&#39;', "'")
		.replaceAll('&amp;', '&');
}

function unquote(value) {
	const trimmed = value.trim();
	if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
		return trimmed.slice(1, -1).replaceAll('\\"', '"').replaceAll('\\\\', '\\');
	}

	return trimmed;
}

function escapeRegExp(value) {
	return value.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

function globToRegExp(pattern) {
	let output = '';
	for (let index = 0; index < pattern.length; index += 1) {
		const current = pattern[index];
		const next = pattern[index + 1];

		if (current === '*' && next === '*') {
			output += '.*';
			index += 1;
		} else if (current === '*') {
			output += '[^/]*';
		} else {
			output += escapeRegExp(current);
		}
	}

	return new RegExp(`^${output}$`);
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

function sourcePanels(html) {
	return [...html.matchAll(/<article class="source-panel[\s\S]*?<\/article>/g)].map((match) => match[0]);
}

function panelSourcePath(panelHtml) {
	const match = panelHtml.match(/<h3><code>([\s\S]*?)<\/code><\/h3>/);
	return match ? unescapeHtml(match[1].trim()) : null;
}

function replacePanel(html, originalPanel, annotation, sourceFamily) {
	const notesHtml = annotationHtml(annotation, sourceFamily);
	if (!notesHtml) return html;

	const updatedPanel = originalPanel.replace(
		/(<aside class="notes">)[\s\S]*?(<\/aside>)/,
		`$1\n${notesHtml}\n$2`,
	);

	return html.replace(originalPanel, updatedPanel);
}

async function applyAnnotationsToFamily(sourceFamily, annotations, patterns) {
	const pagePath = path.join(SOURCE_ROOT, sourceFamily, 'index.html');
	let html = await readFile(pagePath, 'utf8').catch(() => null);
	if (!html) return { applied: 0, missing: [] };

	let applied = 0;
	const missing = [];

	for (const panel of sourcePanels(html)) {
		const filePath = panelSourcePath(panel);
		if (!filePath) {
			missing.push(`${sourceFamily}: unknown panel path`);
			continue;
		}

		const annotation = annotationFor(filePath, annotations, patterns);
		if (!annotation) {
			missing.push(filePath);
			continue;
		}

		html = replacePanel(html, panel, annotation, sourceFamily);
		applied += 1;
	}

	await writeFile(pagePath, html, 'utf8');
	return { applied, missing };
}

async function main() {
	const { annotations, patterns } = await loadAnnotations();
	const governedFamilies = Object.keys(FAMILY_HEADINGS);
	const missing = [];
	let applied = 0;

	for (const sourceFamily of governedFamilies) {
		const result = await applyAnnotationsToFamily(sourceFamily, annotations, patterns);
		applied += result.applied;
		missing.push(...result.missing);
	}

	if (missing.length) {
		throw new Error(`Missing source annotations for ${missing.length} generated panels:\n${missing.slice(0, 80).join('\n')}`);
	}

	console.log(`Applied source annotations to ${applied} source panels.`);
}

main().catch((error) => {
	console.error(error.message);
	process.exitCode = 1;
});
