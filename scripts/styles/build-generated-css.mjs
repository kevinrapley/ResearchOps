import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { formatGeneratedCssTargets } from './format-generated-css.mjs';
import { generatedCssPaths, generatedCssTargets } from './generated-css-targets.mjs';

function resolveSassExecutable() {
	const executable = process.platform === 'win32' ? 'sass.cmd' : 'sass';
	return path.join('node_modules', '.bin', executable);
}

function resolveRequestedTargets(requestedOutputs) {
	if (!requestedOutputs.length) {
		return generatedCssTargets;
	}

	const targetsByOutput = new Map(generatedCssTargets.map((target) => [target.output, target]));
	const targets = [];

	for (const output of requestedOutputs) {
		const target = targetsByOutput.get(output);
		if (!target) {
			throw new Error(`Unknown generated CSS target: ${output}`);
		}
		targets.push(target);
	}

	return targets;
}

function isFormatWorkflowCommitEnabled() {
	if (process.env.GITHUB_ACTIONS !== 'true') return false;
	if (process.env.GITHUB_WORKFLOW !== 'Format pull request') return false;
	if (process.env.GITHUB_EVENT_NAME === 'pull_request_target') return true;
	return process.env.GITHUB_EVENT_NAME === 'push' && process.env.GITHUB_REF_NAME !== 'main';
}

function commitGeneratedCssIfNeeded() {
	if (!isFormatWorkflowCommitEnabled()) return;

	const targetRef = process.env.GITHUB_HEAD_REF || process.env.PR_HEAD_REF || process.env.GITHUB_REF_NAME || '';
	if (!targetRef) return;

	try {
		execFileSync('git', ['diff', '--quiet', '--', ...generatedCssPaths], { stdio: 'ignore' });
		return;
	} catch {
		// git diff exits non-zero when generated CSS has changed.
	}

	execFileSync('git', ['config', 'user.name', 'github-actions[bot]'], { stdio: 'inherit' });
	execFileSync('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'], { stdio: 'inherit' });
	execFileSync('git', ['add', ...generatedCssPaths], { stdio: 'inherit' });
	execFileSync('git', ['commit', '-m', 'chore: update generated CSS'], { stdio: 'inherit' });
	execFileSync('git', ['push', 'origin', `HEAD:${targetRef}`], { stdio: 'inherit' });
}

export function buildGeneratedCss({ requestedOutputs = [] } = {}) {
	const sassExecutable = resolveSassExecutable();
	const targets = resolveRequestedTargets(requestedOutputs);

	for (const target of targets) {
		fs.mkdirSync(path.dirname(target.output), { recursive: true });
		execFileSync(
			sassExecutable,
			['--load-path=node_modules', '--no-source-map', target.source, target.output],
			{ stdio: 'inherit' }
		);
	}

	formatGeneratedCssTargets({ write: true, targets });
	commitGeneratedCssIfNeeded();
}

function runCli() {
	buildGeneratedCss({ requestedOutputs: process.argv.slice(2) });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	runCli();
}
