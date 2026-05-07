import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { BundleRecorder } from "../scripts/agent-trace/bundle-recorder.mjs";
import { renderTrace } from "../scripts/agent-trace/trace-renderer.mjs";
import { hashValue } from "../scripts/agent-trace/trace-redactor.mjs";
import { validateTrace } from "../scripts/agent-trace/trace-validator.mjs";
import { AgentTraceWriter } from "../scripts/agent-trace/trace-writer.mjs";
import { TracedFilesystem } from "../scripts/agent-trace/traced-fs.mjs";

const FIXTURE_DATE = new Date("2026-05-06T21:17:00Z");
const SECRET_FIXTURE = "Authorization: Bearer secret-token\nuser@example.com\n";

async function readJsonl(filePath) {
	const text = await fs.readFile(filePath, "utf8");

	return text
		.split("\n")
		.filter(Boolean)
		.map((line) => JSON.parse(line));
}

function createTrace(rootDir) {
	return new AgentTraceWriter({
		actor: {
			id: "test-agent",
			kind: "agent",
			model: "test-model",
		},
		date: FIXTURE_DATE,
		rootDir,
		slug: "agent-audit-control",
	});
}

test("agent trace control records auditable evidence", async () => {
	const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "agent-trace-"));
	const sourcePath = path.join(rootDir, "AGENTS.md");

	await fs.writeFile(sourcePath, SECRET_FIXTURE, "utf8");

	const trace = createTrace(rootDir);
	const tracedFs = new TracedFilesystem(trace, { rootDir });
	const bundles = new BundleRecorder(trace);

	trace.startRun({
		branch: "feature/agent-audit-trace-control",
		interpretedTask: "Build robust agent audit trace control.",
		repository: "kevinrapley/ResearchOps",
		title: "Agent audit trace control",
	});
	trace.event("prompt.received", {
		promptHash: hashValue("[reasoning] build trace"),
		safeExcerpt: "[reasoning] build trace",
	});
	trace.event("trigger.detected", {
		token: "[reasoning]",
	});
	trace.event("context.lookup.completed", {
		authorization: "Bearer secret-token",
		ownerEmail: "user@example.com",
	});
	trace.event("command.completed", {
		command: "test-command",
		exitCode: 0,
		purpose: "Exercise bare bearer redaction.",
		stderr: "Bearer stderr-secret-token",
		stdout: "Bearer stdout-secret-token",
	});
	bundles.apply(
		{
			id: "github-diamond",
			name: "GitHub Diamond",
			version: "2.9.1",
		},
		{
			appliedRules: [
				"discover before change",
				"do not fabricate validation evidence",
			],
		},
	);
	trace.recordDecision({
		decision: "Use append-only JSONL trace events.",
		rationale:
			"Structured events are easier to validate than a self-reported summary.",
	});

	const content = await tracedFs.readTextFile(
		"AGENTS.md",
		"Check repository agent instructions.",
	);
	await tracedFs.writeTextFile(
		"out/report.txt",
		content,
		"Exercise traced file write.",
	);

	await assert.rejects(
		tracedFs.writeTextFile(
			"../outside.txt",
			"escape",
			"Reject path traversal.",
		),
		/escapes root/,
	);
	await assert.rejects(
		tracedFs.writeTextFile(
			path.join(rootDir, "absolute.txt"),
			"escape",
			"Reject absolute path.",
		),
		/must be relative/,
	);

	const externalDir = await fs.mkdtemp(path.join(os.tmpdir(), "agent-trace-outside-"));
	const externalFile = path.join(externalDir, "outside.txt");

	await fs.writeFile(externalFile, "outside", "utf8");
	await fs.symlink(externalDir, path.join(rootDir, "link"), "dir");
	await assert.rejects(
		tracedFs.readTextFile("link/outside.txt", "Reject symlink read."),
		/escapes root/,
	);
	await assert.rejects(
		tracedFs.writeTextFile("link/pwn.txt", "escape", "Reject symlink write."),
		/escapes root/,
	);

	const reportDir = path.join(rootDir, "docs", "agent-audit", "reasoning");
	const markdownPath = path.join(reportDir, `${trace.traceId}.md`);
	const summaryPath = path.join(reportDir, `${trace.traceId}.json`);

	await renderTrace(trace.eventPath, markdownPath, summaryPath);
	trace.event("report.rendered", {
		outputPath: path.relative(rootDir, markdownPath),
	});
	trace.completeRun({
		status: "completed",
	});

	const validation = await validateTrace(trace.eventPath);
	const events = await readJsonl(trace.eventPath);
	const markdown = await fs.readFile(markdownPath, "utf8");
	const serialisedEvents = JSON.stringify(events);

	assert.equal(validation.valid, true, validation.failures.join("\n"));
	assert.match(markdown, /Agent audit trace control/);
	assert.match(markdown, /Bundle orchestration/);
	assert.match(serialisedEvents, /\[REDACTED\]/);
	assert.match(serialisedEvents, /\[REDACTED_EMAIL\]/);
	assert.match(serialisedEvents, /"token":"\[reasoning\]"/);
	assert.doesNotMatch(serialisedEvents, /secret-token/);
	assert.doesNotMatch(serialisedEvents, /stderr-secret-token/);
	assert.doesNotMatch(serialisedEvents, /stdout-secret-token/);
	assert.doesNotMatch(serialisedEvents, /user@example.com/);
	assert.equal(events[0].previousEventHash, null);
	assert.equal(events[1].previousEventHash, events[0].eventHash);
});
