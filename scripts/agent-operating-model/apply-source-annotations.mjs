#!/usr/bin/env node

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ANNOTATIONS_ROOT = '.agent-operating-model/source-annotations/github';
const ANNOTATIONS_PATH = path.join(ANNOTATIONS_ROOT, 'source-annotations.yaml');
const ANNOTATION_FRAGMENTS_DIR = path.join(ANNOTATIONS_ROOT, 'fragments');
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
	if (annotations.has(filePath)) return { annotation: annotations.get(filePath), source: 'exact' };
	const pattern = patterns.find((entry) => globToRegExp(entry.match).test(filePath));
	if (pattern) return { annotation: pattern, source: 'pattern' };
	return { annotation: fallbackAnnotation(filePath), source: 'fallback' };
}

function fallbackAnnotation(filePath) {
	const fileName = path.basename(filePath);
	const directory = filePath.split('/').slice(0, -1).join('/') || 'bundle root';
	const sourceFamily = filePath.split('/')[0];

	if (sourceFamily === 'modes') {
		return {
			how_agent_uses_this_file: [`The agent uses ${fileName} as a mode file. It should define when this repository workflow applies and what evidence is needed before the task can be treated as complete.`],
			what_to_look_for: [`Check the entry conditions, required evidence and blocking states for ${fileName}.`],
			completion_evidence: [`Completion evidence should show that the mode was selected deliberately, run against repository facts and closed with validation or a recorded gap.`],
		};
	}

	if (sourceFamily === 'roles') {
		return {
			how_agent_uses_this_role: [`The agent uses ${fileName} as a role lens. It should change the judgement applied to the work, not just the tone of the response.`],
			what_judgement_it_applies: [`This role should define the professional standard used to assess files under ${directory}.`],
			escalation_signals: [`Escalate when the role reveals risk, weak evidence or a decision that should not be made by the agent alone.`],
		};
	}

	if (sourceFamily === 'contracts') {
		return {
			what_this_schema_controls: [`This schema controls the structure of ${fileName}. It turns a repository claim into a machine-checkable evidence shape.`],
			what_evidence_it_validates: [`It validates the fields, required values and nested objects needed before ${fileName} can support review or release evidence.`],
			what_breaks_the_contract: [`The contract breaks when required fields are missing, evidence is vague, or the recorded data cannot be traced to repository artefacts.`],
		};
	}

	if (sourceFamily === 'graders') {
		return {
			what_this_grader_scores: [`This grader scores whether the evidence for ${fileName} is strong enough to pass, fail or require revision.`],
			what_causes_a_fail: [`A fail should occur when required evidence is absent, weak, contradictory or not linked to the repository state being assessed.`],
			what_evidence_it_expects: [`It expects concrete artefacts, command results, source references or structured records that support the judgement.`],
		};
	}

	if (sourceFamily === 'templates') {
		return {
			when_this_template_is_used: [`This template is used when the bundle needs to generate or explain ${fileName} within ${directory}.`],
			what_must_be_customised: [`Customise placeholders, repository-specific paths, owner names, commands, thresholds and evidence locations before using it in a real repository.`],
			what_must_not_be_changed_blindly: [`Do not remove validation, evidence, ownership or review controls unless an equivalent repository-specific control replaces them.`],
		};
	}

	if (sourceFamily === 'scripts') {
		return {
			what_this_script_verifies: [`This script verifies or generates evidence for ${fileName}. It should turn an agent claim into a checkable repository outcome.`],
			when_it_should_be_run: [`Run it when the corresponding evidence is needed for PR review, conformance, release readiness or documentation generation.`],
			what_failure_means: [`Failure means the relevant evidence is missing, malformed or not strong enough to support the claim being made.`],
		};
	}

	return {
		how_agent_uses_this_file: [`The agent uses ${fileName} as part of the ${sourceFamily} source family.`],
		what_to_look_for: [`Check that ${fileName} still has a clear purpose and is represented accurately in the generated documentation.`],
	};
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

function panelId(panelHtml) {
	return panelHtml.match(/id="([^"]+)"/)?.[1] || null;
}

function replacePanel(html, originalPanel, annotation, sourceFamily) {
	const id = panelId(originalPanel);
	const notesHtml = annotationHtml(annotation, sourceFamily);
	if (!id || !notesHtml) return html;

	const pattern = new RegExp(`(<article class="source-panel[^"]*" id="${escapeRegExp(id)}">[\\s\\S]*?<aside class="notes">)[\\s\\S]*?(<\\/aside>)`);

	return html.replace(pattern, (_match, start, end) => `${start}\n${notesHtml}\n${end}`);
}

async function applyAnnotationsToFamily(sourceFamily, annotations, patterns) {
	const pagePath = path.join(SOURCE_ROOT, sourceFamily, 'index.html');
	let html = await readFile(pagePath, 'utf8').catch(() => null);
	if (!html) return { applied: 0, fallbacks: [] };

	let applied = 0;
	const fallbacks = [];

	for (const panel of sourcePanels(html)) {
		const filePath = panelSourcePath(panel);
		if (!filePath) continue;

		const result = annotationFor(filePath, annotations, patterns);
		html = replacePanel(html, panel, result.annotation, sourceFamily);
		applied += 1;
		if (result.source === 'fallback') fallbacks.push(filePath);
	}

	await writeFile(pagePath, html, 'utf8');
	return { applied, fallbacks };
}

async function main() {
	const { annotations, patterns } = await loadAnnotations();
	const governedFamilies = Object.keys(FAMILY_HEADINGS);
	const fallbacks = [];
	let applied = 0;

	for (const sourceFamily of governedFamilies) {
		const result = await applyAnnotationsToFamily(sourceFamily, annotations, patterns);
		applied += result.applied;
		fallbacks.push(...result.fallbacks);
	}

	if (fallbacks.length) {
		console.warn(`Used generated fallback annotations for ${fallbacks.length} panels.`);
		for (const filePath of fallbacks.slice(0, 80)) console.warn(`- ${filePath}`);
	}

	console.log(`Applied source annotations to ${applied} source panels.`);
}

main().catch((error) => {
	console.error(error.message);
	process.exitCode = 1;
});
