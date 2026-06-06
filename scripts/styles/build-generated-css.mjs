import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { formatGeneratedCssTargets } from './format-generated-css.mjs';
import { generatedCssTargets } from './generated-css-targets.mjs';

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

export function buildGeneratedCss({ requestedOutputs = [] } = {}) {
	const sassExecutable = resolveSassExecutable();
	const targets = resolveRequestedTargets(requestedOutputs);

	for (const target of targets) {
		fs.mkdirSync(path.dirname(target.output), { recursive: true });
		execFileSync(
			sassExecutable,
			[
				'--load-path=node_modules',
				'--silence-deprecation=import',
				'--no-source-map',
				target.source,
				target.output,
			],
			{ stdio: 'inherit' }
		);
	}

	formatGeneratedCssTargets({ write: true, targets });
}

function runCli() {
	buildGeneratedCss({ requestedOutputs: process.argv.slice(2) });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	runCli();
}
