import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const bundleDir = '.agent-operating-model/bundles/github';
const reportPath = join(bundleDir, 'full-release-gate-report.json');

test('GitHub bundle full release gate passes', { timeout: 180_000 }, () => {
	const result = spawnSync(
		'python3',
		['scripts/release-gate.py', '--mode', 'full', '--timeout', '120', '--report', 'full-release-gate-report.json'],
		{
			cwd: bundleDir,
			encoding: 'utf8',
			env: {
				...process.env,
				PYTHONDONTWRITEBYTECODE: '1'
			}
		}
	);

	assert.equal(
		result.status,
		0,
		[
			'Expected GitHub bundle full release gate to pass.',
			`stdout:\n${result.stdout}`,
			`stderr:\n${result.stderr}`
		].join('\n\n')
	);

	assert.equal(existsSync(reportPath), true, 'Expected full-release-gate-report.json to be written.');
	const report = JSON.parse(readFileSync(reportPath, 'utf8'));
	assert.equal(report.status, 'passed');
	assert.equal(report.mode, 'full');
});
