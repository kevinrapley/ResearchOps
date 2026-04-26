#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

node --input-type=module - "$@" <<'NODE'
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const defaultWritePath = 'docs/performance/performance-inventory.md';

const textExtensions = new Set(['.css', '.html', '.js', '.json', '.md', '.svg', '.txt', '.xml']);
const assetExtensions = new Set(['.avif', '.gif', '.ico', '.jpeg', '.jpg', '.png', '.svg', '.webp', '.woff', '.woff2']);
const ignoredDirectories = new Set(['.git', 'node_modules', 'playwright-report', 'reports', 'reports-site', 'test-results']);

function parseArgs(argv) {
	const options = {
		format: 'markdown',
		writePath: '',
		maxAssetKb: 512,
		maxHtmlKb: 200,
		maxInlineScriptKb: 50
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];

		if (arg === '--json') {
			options.format = 'json';
		} else if (arg === '--markdown') {
			options.format = 'markdown';
		} else if (arg === '--write') {
			options.writePath = argv[index + 1] || defaultWritePath;
			index += 1;
		} else if (arg.startsWith('--write=')) {
			options.writePath = arg.slice('--write='.length) || defaultWritePath;
		} else if (arg.startsWith('--max-asset-kb=')) {
			options.maxAssetKb = Number(arg.slice('--max-asset-kb='.length));
		} else if (arg.startsWith('--max-html-kb=')) {
			options.maxHtmlKb = Number(arg.slice('--max-html-kb='.length));
		} else if (arg.startsWith('--max-inline-script-kb=')) {
			options.maxInlineScriptKb = Number(arg.slice('--max-inline-script-kb='.length));
		} else if (arg === '--help' || arg === '-h') {
			writeHelp();
			process.exit(0);
		}
	}

	return options;
}

function writeHelp() {
	process.stdout.write(`Usage: bash ./scripts/performance-audit.sh [options]

Options:
  --markdown                         Print Markdown output. This is the default.
  --json                             Print JSON output.
  --write [path]                     Write Markdown output to a file.
  --max-asset-kb=<number>            Flag binary assets above this size. Default: 512.
  --max-html-kb=<number>             Flag HTML and text files above this size. Default: 200.
  --max-inline-script-kb=<number>    Flag inline scripts above this size. Default: 50.
`);
}

function normalisePath(filePath) {
	return path.relative(root, filePath).split(path.sep).join('/');
}

function walkDirectory(directory) {
	if (!fs.existsSync(directory)) return [];

	const files = [];
	const entries = fs.readdirSync(directory, { withFileTypes: true });

	for (const entry of entries) {
		if (ignoredDirectories.has(entry.name)) continue;

		const fullPath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...walkDirectory(fullPath));
		} else if (entry.isFile()) {
			files.push(fullPath);
		}
	}

	return files.sort((first, second) => normalisePath(first).localeCompare(normalisePath(second)));
}

function bytesToKb(bytes) {
	return Number((bytes / 1024).toFixed(1));
}

function gzipBytes(buffer) {
	try {
		return zlib.gzipSync(buffer).length;
	} catch {
		return 0;
	}
}

function readFileRecord(filePath) {
	const buffer = fs.readFileSync(filePath);
	const extension = path.extname(filePath).toLowerCase() || '[none]';
	const isText = textExtensions.has(extension);
	const compressedBytes = isText ? gzipBytes(buffer) : null;

	return {
		path: normalisePath(filePath),
		extension,
		bytes: buffer.length,
		kb: bytesToKb(buffer.length),
		gzipBytes: compressedBytes,
		gzipKb: compressedBytes == null ? null : bytesToKb(compressedBytes),
		isText,
		isAsset: assetExtensions.has(extension)
	};
}

function getInlineScripts(filePath) {
	const html = fs.readFileSync(filePath, 'utf8');
	const scripts = [];
	const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
	let match;

	while ((match = scriptPattern.exec(html))) {
		const attributes = match[1] || '';
		const scriptBody = match[2] || '';
		if (/\bsrc\s*=/.test(attributes)) continue;
		if (!scriptBody.trim()) continue;

		const bytes = Buffer.byteLength(scriptBody, 'utf8');
		scripts.push({
			attributes: attributes.trim(),
			bytes,
			kb: bytesToKb(bytes)
		});
	}

	return scripts;
}

function analyseInlineScripts(files, options) {
	return files
		.filter(filePath => path.extname(filePath).toLowerCase() === '.html')
		.map(filePath => {
			const scripts = getInlineScripts(filePath);
			const totalBytes = scripts.reduce((sum, script) => sum + script.bytes, 0);

			return {
				path: normalisePath(filePath),
				count: scripts.length,
				totalBytes,
				totalKb: bytesToKb(totalBytes),
				largestKb: scripts.length ? Math.max(...scripts.map(script => script.kb)) : 0,
				flagged: scripts.some(script => script.kb > options.maxInlineScriptKb)
			};
		})
		.filter(record => record.count > 0)
		.sort((first, second) => second.totalBytes - first.totalBytes);
}

function stripCssComments(css) {
	return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function extractCssSelectorTokens(css) {
	const selectors = new Map();
	const cleanedCss = stripCssComments(css);
	const blockPattern = /([^{}]+)\{/g;
	let match;

	while ((match = blockPattern.exec(cleanedCss))) {
		const rawSelector = match[1].trim();
		if (!rawSelector || rawSelector.startsWith('@')) continue;

		for (const selector of rawSelector.split(',')) {
			for (const classMatch of selector.matchAll(/\.([_a-zA-Z][_a-zA-Z0-9-]*)/g)) {
				const name = classMatch[1];
				selectors.set(`.${name}`, { token: `.${name}`, kind: 'class', name });
			}

			for (const idMatch of selector.matchAll(/#([_a-zA-Z][_a-zA-Z0-9-]*)/g)) {
				const name = idMatch[1];
				selectors.set(`#${name}`, { token: `#${name}`, kind: 'id', name });
			}
		}
	}

	return Array.from(selectors.values()).sort((first, second) => first.token.localeCompare(second.token));
}

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildContentCorpus(files) {
	return files
		.filter(filePath => ['.html', '.js'].includes(path.extname(filePath).toLowerCase()))
		.map(filePath => fs.readFileSync(filePath, 'utf8'))
		.join('\n');
}

function tokenIsUsed(token, corpus) {
	if (token.kind === 'class') {
		const classPattern = new RegExp(`(?:class|className)\\s*=\\s*['\"][^'\"]*\\b${escapeRegExp(token.name)}\\b`, 'm');
		const plainTextPattern = new RegExp(`\\b${escapeRegExp(token.name)}\\b`, 'm');
		return classPattern.test(corpus) || plainTextPattern.test(corpus);
	}

	const idPattern = new RegExp(`id\\s*=\\s*['\"]${escapeRegExp(token.name)}['\"]`, 'm');
	const selectorPattern = new RegExp(`#${escapeRegExp(token.name)}\\b`, 'm');
	return idPattern.test(corpus) || selectorPattern.test(corpus);
}

function analyseCssUsage(files) {
	const screenCssPath = path.join(publicDir, 'css/screen.css');
	if (!fs.existsSync(screenCssPath)) {
		return {
			source: normalisePath(screenCssPath),
			selectors: 0,
			unusedCandidateCount: 0,
			unusedCandidates: []
		};
	}

	const css = fs.readFileSync(screenCssPath, 'utf8');
	const tokens = extractCssSelectorTokens(css);
	const corpus = buildContentCorpus(files.filter(filePath => normalisePath(filePath) !== 'public/css/screen.css'));
	const unusedCandidates = tokens.filter(token => !tokenIsUsed(token, corpus)).map(token => token.token);

	return {
		source: normalisePath(screenCssPath),
		selectors: tokens.length,
		unusedCandidateCount: unusedCandidates.length,
		unusedCandidates: unusedCandidates.slice(0, 100)
	};
}

function groupByExtension(records) {
	const groups = new Map();

	for (const record of records) {
		const existing = groups.get(record.extension) || {
			extension: record.extension,
			count: 0,
			bytes: 0,
			gzipBytes: 0
		};

		existing.count += 1;
		existing.bytes += record.bytes;
		existing.gzipBytes += record.gzipBytes || 0;
		groups.set(record.extension, existing);
	}

	return Array.from(groups.values())
		.map(group => ({
			...group,
			kb: bytesToKb(group.bytes),
			gzipKb: group.gzipBytes ? bytesToKb(group.gzipBytes) : null
		}))
		.sort((first, second) => second.bytes - first.bytes);
}

function buildInventory(options) {
	const files = walkDirectory(publicDir);
	const records = files.map(readFileRecord);
	const totalBytes = records.reduce((sum, record) => sum + record.bytes, 0);
	const textGzipBytes = records.reduce((sum, record) => sum + (record.gzipBytes || 0), 0);

	return {
		generatedAt: new Date().toISOString(),
		thresholds: {
			maxAssetKb: options.maxAssetKb,
			maxHtmlKb: options.maxHtmlKb,
			maxInlineScriptKb: options.maxInlineScriptKb
		},
		totals: {
			files: records.length,
			bytes: totalBytes,
			kb: bytesToKb(totalBytes),
			textGzipKb: bytesToKb(textGzipBytes)
		},
		byExtension: groupByExtension(records),
		largestFiles: records.slice().sort((first, second) => second.bytes - first.bytes).slice(0, 25),
		largeFiles: records
			.filter(record => {
				if (record.extension === '.html') return record.kb > options.maxHtmlKb;
				if (record.isAsset) return record.kb > options.maxAssetKb;
				return record.kb > options.maxHtmlKb;
			})
			.sort((first, second) => second.bytes - first.bytes),
		inlineScripts: analyseInlineScripts(files, options),
		cssUsage: analyseCssUsage(files)
	};
}

function markdownTable(headers, rows) {
	if (!rows.length) return '_None._\n';

	const headerLine = `| ${headers.join(' | ')} |`;
	const dividerLine = `| ${headers.map(() => '---').join(' | ')} |`;
	const rowLines = rows.map(row => `| ${row.map(value => String(value ?? '').replace(/\|/g, '\\|')).join(' | ')} |`);

	return [headerLine, dividerLine, ...rowLines].join('\n') + '\n';
}

function toMarkdown(inventory) {
	const largestRows = inventory.largestFiles.map(record => [
		record.path,
		`${record.kb} KB`,
		record.gzipKb == null ? 'n/a' : `${record.gzipKb} KB`,
		record.extension
	]);

	const extensionRows = inventory.byExtension.map(group => [
		group.extension,
		group.count,
		`${group.kb} KB`,
		group.gzipKb == null ? 'n/a' : `${group.gzipKb} KB`
	]);

	const largeRows = inventory.largeFiles.map(record => [record.path, `${record.kb} KB`, record.extension]);

	const inlineRows = inventory.inlineScripts.map(record => [
		record.path,
		record.count,
		`${record.totalKb} KB`,
		`${record.largestKb} KB`,
		record.flagged ? 'yes' : 'no'
	]);

	return `# Performance inventory

Generated: ${inventory.generatedAt}

## Thresholds

- Large asset threshold: ${inventory.thresholds.maxAssetKb} KB
- Large HTML/text threshold: ${inventory.thresholds.maxHtmlKb} KB
- Large inline script threshold: ${inventory.thresholds.maxInlineScriptKb} KB

## Totals

- Files scanned: ${inventory.totals.files}
- Public directory size: ${inventory.totals.kb} KB
- Text gzip estimate: ${inventory.totals.textGzipKb} KB

## Largest public files

${markdownTable(['Path', 'Size', 'Gzip estimate', 'Type'], largestRows)}

## Size by extension

${markdownTable(['Extension', 'Files', 'Size', 'Gzip estimate'], extensionRows)}

## Large file flags

${markdownTable(['Path', 'Size', 'Type'], largeRows)}

## Inline scripts in HTML

${markdownTable(['Path', 'Inline scripts', 'Total inline size', 'Largest inline script', 'Flagged'], inlineRows)}

## CSS selector usage rough check

Source: ${inventory.cssUsage.source}

- Selector tokens found: ${inventory.cssUsage.selectors}
- Possible unused selector tokens: ${inventory.cssUsage.unusedCandidateCount}

${markdownTable(['Candidate selector token'], inventory.cssUsage.unusedCandidates.map(token => [token]))}

## Notes

This is a static inventory. It does not prove that a selector is unused at runtime. Dynamic class names, third-party markup, and server-rendered future states can produce false positives.

Use this report to prioritise manual review, not to delete CSS automatically.
`;
}

const options = parseArgs(process.argv.slice(2));
const inventory = buildInventory(options);
const output = options.format === 'json' ? `${JSON.stringify(inventory, null, 2)}\n` : toMarkdown(inventory);

if (options.writePath) {
	const target = path.resolve(root, options.writePath);
	fs.mkdirSync(path.dirname(target), { recursive: true });
	fs.writeFileSync(target, output, 'utf8');
	process.stdout.write(`Wrote ${normalisePath(target)}\n`);
} else {
	process.stdout.write(output);
}
NODE
