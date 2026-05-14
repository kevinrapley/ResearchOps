import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
	ALLOWED_WORK_BRANCH_PREFIXES,
	TRACE_REQUIRED_BRANCH_PREFIXES,
	branchTracePolicy,
	checkTraceDir,
	normaliseBranchName,
	traceDirForDate,
} from '../scripts/agent-trace/assert-trace-coverage.mjs';

function makeTempDir() {
	return fs.mkdtempSync(path.join(os.tmpdir(), 'trace-coverage-test-'));
}

test('traceDirForDate builds correct path from date string', () => {
	assert.equal(traceDirForDate('2026-05-11'), 'docs/agent-audit/reasoning/2026/05/11');
});

test('traceDirForDate uses custom base when provided', () => {
	assert.equal(traceDirForDate('2026-05-11', '/tmp/traces'), '/tmp/traces/2026/05/11');
});

test('normaliseBranchName removes common ref prefixes', () => {
	assert.equal(normaliseBranchName('refs/heads/fix/example'), 'fix/example');
	assert.equal(normaliseBranchName('origin/feature/example'), 'feature/example');
	assert.equal(normaliseBranchName('chore/example'), 'chore/example');
});

test('allowed work branch prefixes are explicit and closed', () => {
	assert.deepEqual(ALLOWED_WORK_BRANCH_PREFIXES, [
		'feature/',
		'chore/',
		'test/',
		'fix/',
		'perf/',
		'hotfix/',
	]);
});

test('trace-required branch prefixes exclude hotfix', () => {
	assert.deepEqual(TRACE_REQUIRED_BRANCH_PREFIXES, [
		'feature/',
		'chore/',
		'test/',
		'fix/',
		'perf/',
	]);
});

test('normal development branch prefixes require traces', () => {
	for (const prefix of TRACE_REQUIRED_BRANCH_PREFIXES) {
		const result = branchTracePolicy(`${prefix}example-work`);

		assert.equal(result.allowed, true);
		assert.equal(result.requiresTrace, true);
		assert.equal(result.prefix, prefix);
		assert.equal(result.reason, 'trace-required-prefix');
	}
});

test('hotfix branches are allowed but do not require traces', () => {
	const result = branchTracePolicy('hotfix/urgent-production-repair');

	assert.equal(result.allowed, true);
	assert.equal(result.requiresTrace, false);
	assert.equal(result.prefix, 'hotfix/');
	assert.equal(result.reason, 'hotfix-no-trace');
});

test('mainline branches are exempt from work-branch prefix policy', () => {
	for (const branch of ['main', 'master']) {
		const result = branchTracePolicy(branch);

		assert.equal(result.allowed, true);
		assert.equal(result.requiresTrace, false);
		assert.equal(result.reason, 'mainline-branch');
	}
});

test('unapproved branch prefixes are blocked', () => {
	for (const branch of ['claude/update-login', 'codex/fix-ci', 'bugfix/example', 'experiment/example']) {
		const result = branchTracePolicy(branch);

		assert.equal(result.allowed, false);
		assert.equal(result.requiresTrace, false);
		assert.equal(result.reason, 'invalid-prefix');
		assert.deepEqual(result.allowedPrefixes, ALLOWED_WORK_BRANCH_PREFIXES);
	}
});

test('checkTraceDir returns missing-dir when directory does not exist', () => {
	const result = checkTraceDir('/nonexistent/path/2099/01/01');
	assert.equal(result.ok, false);
	assert.equal(result.reason, 'missing-dir');
});

test('checkTraceDir returns no-traces when directory is empty', () => {
	const tmp = makeTempDir();
	try {
		const result = checkTraceDir(tmp);
		assert.equal(result.ok, false);
		assert.equal(result.reason, 'no-traces');
	} finally {
		fs.rmSync(tmp, { recursive: true });
	}
});

test('checkTraceDir returns no-traces when directory has only non-json files', () => {
	const tmp = makeTempDir();
	try {
		fs.writeFileSync(path.join(tmp, 'trace.md'), '# trace');
		fs.writeFileSync(path.join(tmp, 'trace.jsonl'), '{}');
		const result = checkTraceDir(tmp);
		assert.equal(result.ok, false);
		assert.equal(result.reason, 'no-traces');
	} finally {
		fs.rmSync(tmp, { recursive: true });
	}
});

test('checkTraceDir returns ok with count when .json files are present', () => {
	const tmp = makeTempDir();
	try {
		fs.writeFileSync(path.join(tmp, 'trace-a.json'), '{}');
		fs.writeFileSync(path.join(tmp, 'trace-b.json'), '{}');
		fs.writeFileSync(path.join(tmp, 'trace-a.md'), '# trace');
		const result = checkTraceDir(tmp);
		assert.equal(result.ok, true);
		assert.equal(result.count, 2);
	} finally {
		fs.rmSync(tmp, { recursive: true });
	}
});

test('checkTraceDir count includes only .json files, not .md or .jsonl', () => {
	const tmp = makeTempDir();
	try {
		fs.writeFileSync(path.join(tmp, 'trace.json'), '{}');
		fs.writeFileSync(path.join(tmp, 'trace.md'), '# trace');
		fs.writeFileSync(path.join(tmp, 'raw.jsonl'), '{}');
		const result = checkTraceDir(tmp);
		assert.equal(result.ok, true);
		assert.equal(result.count, 1);
	} finally {
		fs.rmSync(tmp, { recursive: true });
	}
});

test("today's trace directory passes coverage check", () => {
	const today = new Date().toISOString().slice(0, 10);
	const dir = traceDirForDate(today);
	const result = checkTraceDir(dir);
	assert.equal(
		result.ok,
		true,
		`Expected trace artefacts for ${today} in ${dir} but found: ${result.reason ?? 'none'}`
	);
	assert.ok(result.count >= 1, `Expected at least 1 trace, got ${result.count}`);
});
