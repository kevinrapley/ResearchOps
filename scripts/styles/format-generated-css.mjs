import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

import { generatedCssTargets } from './generated-css-targets.mjs';

const tab = '\t';

function indent(depth) {
	return tab.repeat(depth);
}

function normaliseToken(value) {
	return value
		.replace(/\s+/g, ' ')
		.replace(/^@media\(/, '@media (')
		.replace(/^@supports\(/, '@supports (')
		.trim();
}

function tokenizeCss(source) {
	const tokens = [];
	let buffer = '';
	let quote = null;
	let comment = false;

	for (let index = 0; index < source.length; index += 1) {
		const char = source[index];
		const next = source[index + 1];

		if (comment) {
			buffer += char;
			if (char === '*' && next === '/') {
				buffer += next;
				tokens.push({ type: 'comment', value: buffer.trim() });
				buffer = '';
				comment = false;
				index += 1;
			}
			continue;
		}

		if (quote) {
			buffer += char;
			if (char === quote && source[index - 1] !== '\\') {
				quote = null;
			}
			continue;
		}

		if ((char === '"' || char === "'") && !quote) {
			quote = char;
			buffer += char;
			continue;
		}

		if (char === '/' && next === '*') {
			if (buffer.trim()) {
				tokens.push({ type: 'text', value: buffer });
				buffer = '';
			}
			comment = true;
			buffer = '/*';
			index += 1;
			continue;
		}

		if (char === '{' || char === '}' || char === ';') {
			if (buffer.trim()) {
				tokens.push({ type: 'text', value: buffer });
				buffer = '';
			}
			tokens.push({ type: char, value: char });
			continue;
		}

		buffer += char;
	}

	if (buffer.trim()) {
		tokens.push({ type: 'text', value: buffer });
	}

	return tokens;
}

function pushBlankLine(lines) {
	if (lines.length && lines.at(-1) !== '') {
		lines.push('');
	}
}

function pushLine(lines, line) {
	lines.push(line);
}

export function formatGeneratedCss(source) {
	const tokens = tokenizeCss(source.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n'));
	const lines = [];
	const stack = [];
	let buffer = '';

	for (const token of tokens) {
		if (token.type === 'text') {
			buffer += token.value;
			continue;
		}

		if (token.type === 'comment') {
			if (stack.length === 0) {
				pushBlankLine(lines);
			}
			pushLine(lines, `${indent(stack.length)}${token.value}`);
			if (stack.length === 0) {
				pushBlankLine(lines);
			}
			continue;
		}

		if (token.type === '{') {
			const header = normaliseToken(buffer);
			if (header) {
				pushLine(lines, `${indent(stack.length)}${header} {`);
				stack.push(header);
			}
			buffer = '';
			continue;
		}

		if (token.type === ';') {
			const declaration = normaliseToken(buffer);
			if (declaration) {
				pushLine(lines, `${indent(stack.length)}${declaration};`);
			}
			buffer = '';
			continue;
		}

		if (token.type === '}') {
			const declaration = normaliseToken(buffer);
			if (declaration) {
				pushLine(lines, `${indent(stack.length)}${declaration};`);
			}
			buffer = '';

			if (stack.length === 0) {
				throw new Error('Unexpected closing brace while formatting generated CSS.');
			}

			pushLine(lines, `${indent(stack.length)}}`);
			stack.pop();

			if (stack.length === 0) {
				pushBlankLine(lines);
			}
		}
	}

	if (stack.length > 0) {
		throw new Error('Unclosed block while formatting generated CSS.');
	}

	while (lines.at(-1) === '') {
		lines.pop();
	}

	return `${lines.join('\n')}\n`;
}

export function formatGeneratedCssTargets({ check = false, write = false, targets = generatedCssTargets } = {}) {
	let failures = 0;

	for (const target of targets) {
		const source = fs.readFileSync(target.output, 'utf8');
		const formatted = formatGeneratedCss(source);

		if (source !== formatted) {
			if (write) {
				fs.writeFileSync(target.output, formatted);
				console.log(`formatted generated CSS: ${target.output}`);
				continue;
			}

			if (check) {
				console.error(`${target.output} is not formatted. Run npm run generated-css:format.`);
				failures += 1;
			}
		}
	}

	if (failures > 0) {
		process.exitCode = 1;
	}
}

function runCli() {
	const args = process.argv.slice(2);
	const check = args.includes('--check');
	const write = args.includes('--write') || !check;
	const requestedPaths = args.filter((arg) => !arg.startsWith('--'));
	const targets = requestedPaths.length
		? generatedCssTargets.filter((target) => requestedPaths.includes(target.output))
		: generatedCssTargets;

	if (requestedPaths.length && targets.length !== requestedPaths.length) {
		const known = new Set(generatedCssTargets.map((target) => target.output));
		const unknown = requestedPaths.filter((requestedPath) => !known.has(requestedPath));
		throw new Error(`Unknown generated CSS target: ${unknown.join(', ')}`);
	}

	formatGeneratedCssTargets({ check, write, targets });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	runCli();
}
