import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const bundleDir = '.agent-operating-model/bundles/github';
const reportPath = join(bundleDir, 'full-release-gate-report.json');

test('GitHub bundle full release gate passes', { timeout: 180_000 }, () => {
	const result = spawnSync(
		'python3',
		[
			'scripts/release-gate.py',
			'--mode',
			'full',
			'--timeout',
			'120',
			'--report',
			'full-release-gate-report.json',
		],
		{
			cwd: bundleDir,
			encoding: 'utf8',
			env: {
				...process.env,
				PYTHONDONTWRITEBYTECODE: '1',
			},
		}
	);

	assert.equal(
		result.status,
		0,
		[
			'Expected GitHub bundle full release gate to pass.',
			`stdout:\n${result.stdout}`,
			`stderr:\n${result.stderr}`,
		].join('\n\n')
	);

	assert.equal(
		existsSync(reportPath),
		true,
		'Expected full-release-gate-report.json to be written.'
	);
	const report = JSON.parse(readFileSync(reportPath, 'utf8'));
	assert.equal(report.status, 'passed');
	assert.equal(report.mode, 'full');
});

test('GitHub bundle fallback jsonschema validates schema-valued additionalProperties', () => {
	const tempDir = mkdtempSync(join(tmpdir(), 'github-bundle-policy-'));
	const policyPath = join(tempDir, 'live-release-policy-invalid.yaml');

	writeFileSync(
		policyPath,
		[
			'version: 2.9.1',
			'profiles:',
			'  standard:',
			'    required_controls:',
			'      github_api: true',
			'      bogus_control: definitely-not-boolean',
			'  high-assurance:',
			'    required_controls:',
			'      github_api: true',
			'      workflow_lock: true',
			'      hardened_workflows: true',
			'      trusted_sbom_attestation: true',
			'      external_attestation_verification: true',
			'      accessibility_evidence: true',
			'      performance_evidence: true',
			'      evidence_to_repository_cross_check: true',
			'  regulated:',
			'    inherits: high-assurance',
			'    required_controls:',
			'      github_api: true',
			'      workflow_lock: true',
			'      hardened_workflows: true',
			'      trusted_sbom_attestation: true',
			'      external_attestation_verification: true',
			'      accessibility_evidence: true',
			'      performance_evidence: true',
			'      evidence_to_repository_cross_check: true',
			'  public-service:',
			'    inherits: high-assurance',
			'    required_controls:',
			'      github_api: true',
			'      workflow_lock: true',
			'      hardened_workflows: true',
			'      trusted_sbom_attestation: true',
			'      external_attestation_verification: true',
			'      accessibility_evidence: true',
			'      performance_evidence: true',
			'      evidence_to_repository_cross_check: true',
			'',
		].join('\n'),
		'utf8'
	);

	const result = spawnSync(
		'python3',
		['scripts/validate-live-release-policy.py', '--policy', policyPath],
		{
			cwd: bundleDir,
			encoding: 'utf8',
			env: {
				...process.env,
				PYTHONDONTWRITEBYTECODE: '1',
			},
		}
	);

	assert.notEqual(result.status, 0);
	assert.match(result.stdout, /standard\.required_controls\.bogus_control/);
	assert.match(result.stdout, /boolean/);
});
