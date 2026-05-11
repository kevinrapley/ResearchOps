#!/usr/bin/env node
/**
 * @file promote-trace.mjs
 * @module PromoteTrace
 * @summary Promotes a validated raw JSONL trace into checked-in audit artefacts.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readEvents, validateTrace } from './trace-validator.mjs';

const DEFAULT_OUTPUT_ROOT = 'docs/agent-audit/reasoning';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseArgs(argv) {
	const options = {};
	const positionals = [];

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];

		if (arg.startsWith('--')) {
			const [name, inlineValue] = arg.split('=', 2);
			const key = name.slice(2);
			const value = inlineValue ?? argv[index + 1];

			if (inlineValue === undefined) {
				index += 1;
			}

			options[key] = value;
			continue;
		}

		positionals.push(arg);
	}

	if (!options.input && positionals[0]) {
		options.input = positionals[0];
	}

	return options;
}

function toIsoDate(value) {
	if (value && DATE_PATTERN.test(value)) {
		return value;
	}

	const date = value ? new Date(value) : new Date();

	if (Number.isNaN(date.getTime())) {
		throw new Error(`Invalid trace date: ${value}`);
	}

	return date.toISOString().slice(0, 10);
}

function dateSegments(dateText) {
	const [year, month, day] = toIsoDate(dateText).split('-');

	return { day, month, year };
}

function slugify(value) {
	return String(value || 'agent-trace')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 120);
}

function payloadValue(event, keys) {
	for (const key of keys) {
		const value = event.payload?.[key];

		if (typeof value === 'string' && value.trim()) {
			return value.trim();
		}
	}

	return '';
}

function unique(values) {
	return [...new Set(values.filter(Boolean))];
}

function pathFromPayload(event) {
	return payloadValue(event, ['path', 'filePath', 'relativePath', 'targetPath']);
}

function commandFromPayload(event) {
	const command = payloadValue(event, ['command', 'cmd']);
	const exitCode = event.payload?.exitCode;

	if (command && Number.isInteger(exitCode)) {
		return `${command} — exit ${exitCode}`;
	}

	return command;
}

function taskSummary(events, fallback) {
	const prompt = events.find((event) => event.eventType === 'prompt.received');
	const summary = prompt ? payloadValue(prompt, ['summary', 'taskSummary', 'title']) : '';

	return summary || fallback;
}

function runTimestamp(events, eventType) {
	return events.find((event) => event.eventType === eventType)?.timestamp || '';
}

function eventLabel(event) {
	const detail =
		pathFromPayload(event) ||
		commandFromPayload(event) ||
		payloadValue(event, ['bundleId', 'id', 'summary', 'decision', 'message']);

	return detail ? `${event.eventType}: ${detail}` : event.eventType;
}

function renderList(items, emptyText = 'None recorded.') {
	if (!items.length) {
		return emptyText;
	}

	return items.map((item) => `- ${item}`).join('\n');
}

function eventTypeIn(eventTypes) {
	return (event) => eventTypes.includes(event.eventType);
}

function buildSummary({ events, inputPath, markdownPath, jsonPath, title, warnings }) {
	const bundles = unique(
		events
			.filter((event) => event.eventType === 'bundle.applied')
			.map((event) => payloadValue(event, ['bundleId', 'id', 'name']))
	);
	const filesRead = unique(
		events.filter(eventTypeIn(['file.read', 'file.read.completed'])).map(pathFromPayload)
	);
	const filesWritten = unique(
		events.filter((event) => event.eventType === 'file.write.completed').map(pathFromPayload)
	);
	const validations = unique(events.filter((event) => event.eventType === 'command.completed').map(commandFromPayload));
	const issues = unique(
		events
			.filter((event) => ['issue.detected', 'pivot.recorded'].includes(event.eventType))
			.map((event) => payloadValue(event, ['summary', 'message', 'issue', 'pivot']))
	);

	return {
		schemaVersion: 'agent-trace-promotion/v1',
		title,
		sourceTrace: path.relative(process.cwd(), inputPath),
		markdownReport: path.relative(process.cwd(), markdownPath),
		jsonSummary: path.relative(process.cwd(), jsonPath),
		promotedAt: new Date().toISOString(),
		eventCount: events.length,
		run: {
			startedAt: runTimestamp(events, 'run.started'),
			completedAt: runTimestamp(events, 'run.completed'),
			taskSummary: taskSummary(events, title),
		},
		bundles,
		filesRead,
		filesWritten,
		validations,
		issues,
		warnings,
	};
}

function renderMarkdown(summary, events) {
	const timeline = events.map((event) => `- ${event.timestamp || 'no timestamp'} — ${eventLabel(event)}`);

	return `# ${summary.title}

Promotion status: promoted from validated raw trace.

Source trace: \`${summary.sourceTrace}\`.

Promoted at: ${summary.promotedAt}.

## Task summary

${summary.run.taskSummary}

## Run metadata

- Started: ${summary.run.startedAt || 'Not recorded.'}
- Completed: ${summary.run.completedAt || 'Not recorded.'}
- Event count: ${summary.eventCount}

## Bundles applied

${renderList(summary.bundles)}

## Files read

${renderList(summary.filesRead)}

## Files created or modified

${renderList(summary.filesWritten)}

## Validation attempted

${renderList(summary.validations)}

## Issues and pivots

${renderList(summary.issues)}

## Validation warnings

${renderList(summary.warnings)}

## Event timeline

${renderList(timeline)}
`;
}

async function writeJson(filePath, value) {
	await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function promoteTrace(options) {
	if (!options.input) {
		throw new Error('Missing required --input path.');
	}

	const inputPath = path.resolve(options.input);
	const validation = await validateTrace(inputPath);

	if (!validation.valid) {
		throw new Error(`Trace is invalid: ${validation.failures.join('; ')}`);
	}

	const events = await readEvents(inputPath);
	const fallbackTitle = path.basename(inputPath, path.extname(inputPath));
	const title = options.title || taskSummary(events, fallbackTitle);
	const slug = slugify(options.slug || title || fallbackTitle);
	const selectedDate = toIsoDate(options.date || runTimestamp(events, 'run.started'));
	const { day, month, year } = dateSegments(selectedDate);
	const outputRoot = path.resolve(options.outputRoot || DEFAULT_OUTPUT_ROOT);
	const outputDir = path.join(outputRoot, year, month, day);
	const markdownPath = path.join(outputDir, `${slug}.md`);
	const jsonPath = path.join(outputDir, `${slug}.json`);

	await fs.mkdir(outputDir, { recursive: true });

	const summary = buildSummary({
		events,
		inputPath,
		jsonPath,
		markdownPath,
		title,
		warnings: validation.warnings,
	});
	const markdown = renderMarkdown(summary, events);

	await fs.writeFile(markdownPath, markdown, 'utf8');
	await writeJson(jsonPath, summary);

	return {
		jsonPath,
		markdownPath,
		summary,
	};
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	const result = await promoteTrace(options);

	console.log(`Promoted trace Markdown: ${path.relative(process.cwd(), result.markdownPath)}`);
	console.log(`Promoted trace JSON: ${path.relative(process.cwd(), result.jsonPath)}`);
}

const currentFile = fileURLToPath(import.meta.url);

if (process.argv[1] === currentFile) {
	main().catch((error) => {
		console.error(error.message);
		process.exit(1);
	});
}
