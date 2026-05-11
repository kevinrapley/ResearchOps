import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promoteTrace } from '../scripts/agent-trace/promote-trace.mjs';

function hashEvent(event) {
	const copy = { ...event };
	delete copy.eventHash;

	return `sha256:${crypto.createHash('sha256').update(JSON.stringify(copy)).digest('hex')}`;
}

function event(eventId, eventType, previousEventHash, payload = {}) {
	const record = {
		eventId,
		eventType,
		payload,
		previousEventHash,
		timestamp: `2026-05-11T00:00:0${eventId}.000Z`,
		traceLayer: 'operational',
	};

	record.eventHash = hashEvent(record);

	return record;
}

function validTraceEvents() {
	const events = [];
	const append = (eventType, payload = {}) => {
		const previousEventHash = events.length ? events.at(-1).eventHash : null;
		const record = event(events.length + 1, eventType, previousEventHash, payload);

		events.push(record);
	};

	append('run.started', { summary: 'Promote a trace fixture' });
	append('prompt.received', { summary: 'Promote a trace fixture' });
	append('bundle.applied', { bundleId: 'github-diamond' });
	append('decision.recorded', { decision: 'Write promotion artefacts' });
	append('file.write.planned', { path: 'docs/agent-audit/reasoning/2026/05/11/promote-fixture.md' });
	append('file.write.completed', { path: 'docs/agent-audit/reasoning/2026/05/11/promote-fixture.md' });
	append('command.completed', { command: 'npm run validate', exitCode: 0 });
	append('report.rendered', { path: 'docs/agent-audit/reasoning/2026/05/11/promote-fixture.md' });
	append('run.completed', { status: 'success' });

	return events;
}

async function writeJsonl(filePath, events) {
	await fs.writeFile(filePath, `${events.map((record) => JSON.stringify(record)).join('\n')}\n`, 'utf8');
}

test('promoteTrace writes Markdown and JSON audit artefacts from a valid raw trace', async () => {
	const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'researchops-trace-promotion-'));
	const tracePath = path.join(tempDir, 'raw.jsonl');
	const outputRoot = path.join(tempDir, 'reasoning');

	await writeJsonl(tracePath, validTraceEvents());

	const result = await promoteTrace({
		date: '2026-05-11',
		input: tracePath,
		outputRoot,
		slug: 'promote-fixture',
		title: 'Promote fixture trace',
	});

	const markdown = await fs.readFile(result.markdownPath, 'utf8');
	const summary = JSON.parse(await fs.readFile(result.jsonPath, 'utf8'));

	assert.equal(path.relative(outputRoot, result.markdownPath), '2026/05/11/promote-fixture.md');
	assert.equal(path.relative(outputRoot, result.jsonPath), '2026/05/11/promote-fixture.json');
	assert.match(markdown, /# Promote fixture trace/);
	assert.match(markdown, /Promotion status: promoted from validated raw trace/);
	assert.match(markdown, /github-diamond/);
	assert.equal(summary.schemaVersion, 'agent-trace-promotion/v1');
	assert.equal(summary.eventCount, 9);
	assert.deepEqual(summary.bundles, ['github-diamond']);
	assert.deepEqual(summary.validations, ['npm run validate — exit 0']);
});

test('promoteTrace rejects invalid raw traces', async () => {
	const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'researchops-trace-promotion-invalid-'));
	const tracePath = path.join(tempDir, 'raw.jsonl');

	await writeJsonl(tracePath, [event(1, 'run.started', null, {})]);

	await assert.rejects(
		() => promoteTrace({ input: tracePath, outputRoot: tempDir }),
		/Trace is invalid:/
	);
});
