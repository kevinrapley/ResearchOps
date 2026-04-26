#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, 'public');
const DEFAULT_MARKDOWN_PATH = path.join(ROOT, 'docs/performance/performance-inventory.md');

const TEXT_EXTENSIONS = new Set([
	'.css',
	'.html',
	'.js',
	'.json',
	'.md',
	'.mjs',
	'.svg',
	'.txt',
	'.xml'
]);

const ASSET_EXTENSIONS = new Set([
	'.avif',
	'.gif',
	'.ico',
	'.jpeg',
	'.jpg',
	'.png',
	'.svg',
	'.webp',
	'.woff',
	'.woff2'
]);

const IGNORE_DIRS = new Set([
	'.git',
	'node_modules',
	'playwright-report',
	'reports',
	'reports-site',
	'test-results'
]);

function parseArgs(argv) {
	const options = {
		format: 'markdown',
		write: '',
		maxAssetKb: 512,
		maxHtmlKb: 200,
		maxInlineScriptKb: 50
	};

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === '--json') {
			options.format = 'json';
		} else if (arg === '--markdown') {
			options.format = 'markdown';
		} else if (arg === '--write') {
			options.write = argv[++i] || DEFAULT_MARKDOWN_PATH;
		} else if (arg.startsWith('--write=')) {
			options.write = arg.slice('--write='.length) || DEFAULT_MARKDOWN_PATH;
		} else if (arg.startsWith('--max-asset-kb=')) {
			options.maxAssetKb = Number(arg.slice('--max-asset-kb='.length));
		} else if (arg.startsWith('--max-html-kb=')) {
			options.maxHtmlKb = Number(arg.slice('--max-html-kb='.length));
		} else if (arg.startsWith('--max-inline-script-kb=')) {
			options.maxInlineScriptKb = Number(arg.slice('--max-inline-script-kb='.length));
		} else if (arg === '--help' || arg === '-h') {
			printHelp();
			process.exit(0);
		}
	}

	return options;
}

function printHelp() {
	console.log(`Usage: npm run audit:performance -- [options]

Options:
  --markdown                         Print Markdown output. This is the default.
  --json                             Print JSON output.
  --write [path]                     Write Markdown output to a file.
  --max-asset-kb=<number>            Flag binary assets above this size. Default: 512.
  --max-html-kb=<number>             Flag HTML files above this size. Default: 200.
  --max-inline-script-kb=<number>    Flag inline scripts above this size. Default: 50.
`);
}

function normalisePath(filePath) {
	return path.relative(ROOT, filePath).split(path.sep).join('/');
}

function walk(dir) {
	if (!fs.existsSync(dir)) return [];

	const entries = fs.readdirSync(dir, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		if (IGNORE_DIRS.has(entry.name)) continue;

		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...walk(fullPath));
		} else if (entry.isFile()) {
			files.push(fullPath);
		}
	}

	return files.sort((a, b) => normalisePath(a).localeCompare(normalisePath(b)));
}

function bytesToKb(bytes) {
	return Number((bytes / 1024).toFixed(1));
}

function gzipSize(buffer) {
	try {
		return zlib.gzipSync(buffer).length;
	} catch {
		return 0;
	}
}

function fileRecord(filePath) {
	const buffer = fs.readFileSync(filePath);
	const ext = path.extname(filePath).toLowerCase();
	const isText = TEXT_EXTENSIONS.has(ext);

	return {
		path: normalisePath(filePath),
		extension: ext || '[none]',
		bytes: buffer.length,
		kb: bytesToKb(buffer.length),
		gzipBytes: isText ? gzipSize(buffer) : null,
		gzipKb: isText ? bytesToKb(gzipSize(buffer)) : null,
		isText,
		isAsset: ASSET_EXTENSIONS.has(ext)
	};
}

function getHtmlInlineScripts(filePath) {
	const html = fs.readFileSync(filePath, 'utf8');
	const scripts = [];
	const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
	let match;

	while ((match = scriptRegex.exec(html))) {
		const attributes = match[1] || '';
		const body = match[2] || '';
		if (/\bsrc\s*=/.test(attributes)) continue;
		if (!body.trim()) continue;

		scripts.push({
			attributes: attributes.trim(),
			bytes: Buffer.byteLength(body, 'utf8'),
			kb: bytesToKb(Buffer.byteLength(body, 'utf8'))
		});
	}

	return scripts;
}

function analyseInlineScripts(files, options) {
	return files
		.filter(filePath => path.extname(filePath).toLowerCase() === '.html')
		.map(filePath => {
			const scripts = getHtmlInlineScripts(filePath);
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
		.sort((a, b) => b.totalBytes - a.totalBytes);
}

function stripCssComments(css) {
	return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function extractCssSelectorTokens(css) {
	const selectors = new Map();
	const cleaned = stripCssComments(css);
	const blockRegex = /([^{}]+)\{/g;
	let match;

	while ((match = blockRegex.exec(cleaned))) {
		const rawSelector = match[1].trim();
		if (!rawSelector || rawSelector.startsWith('@')) continue;

		for (const selector of rawSelector.split(',')) {
			const classTokens = Array.from(selector.matchAll(/\.([_a-zA-Z][_a-zA-Z0-9-]*)/g)).map(item => item[1]);
			const idTokens = Array.from(selector.matchAll(/#([_a-zA-Z][_a-zA-Z0-9-]*)/g)).map(item => item[1]);

			for (const token of classTokens) {
				selectors.set(`.${token}`, { token: `.${token}`, kind: 'class', name: token });
			}
			for (const token of idTokens) {
				selectors.set(`#${token}`, { token: `#${token}`, kind: 'id', name: token });
			}
		}
	}

	return Array.from(selectors.values()).sort((a, b) => a.token.localeCompare(b.token));
}

function buildContentCorpus(files) {
	return files
		.filter(filePath => {
			const ext = path.extname(filePath).toLowerCase();
			return ['.html', '.js', '.mjs'].includes(ext);
		})
		.map(filePath => fs.readFileSync(filePath, 'utf8'))
		.join('\n');
}

function tokenIsUsed(token, corpus) {
	if (token.kind === 'class') {
		const classPattern = new RegExp(`(?:class|className)\\s*=\\s*['\"][^'\"]*\\b${escapeRegExp(token.name)}\\b`, 'm');
		const templatePattern = new RegExp(`\\b${escapeRegExp(token.name)}\\b`, 'm');
		return classPattern.test(corpus) || templatePattern.test(corpus);
	}

	const idPattern = new RegExp(`id\\s*=\\s*['\"]${escapeRegExp(token.name)}['\"]`, 'm');
	const selectorPattern = new RegExp(`[#]${escapeRegExp(token.name)}\\b`, 'm');
	return idPattern.test(corpus) || selectorPattern.test(corpus);
}

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function analyseCssUsage(files) {
	const screenCssPath = path.join(PUBLIC_DIR, 'css/screen.css');
	if (!fs.existsSync(screenCssPath)) {
		return {
			source: normalisePath(screenCssPath),
			selectors: 0,
			unusedCandidates: []
		};
	}

	const css = fs.readFileSync(screenCssPath, 'utf8');
	const tokens = extractCssSelectorTokens(css);
	const corpus = buildContentCorpus(files.filter(filePath => normalisePath(filePath) !== 'public/css/screen.css'));
	const unusedCandidates = tokens
		.filter(token => !tokenIsUsed(token, corpus))
		.map(token => token.token);

	return {
		source: normalisePath(screenCssPath),
		selectors: tokens.length,
		unusedCandidates: unusedCandidates.slice(0, 100),
		unusedCandidateCount: unusedCandidates.length
	};
}

function groupByExtension(records) {
	const groups = new Map();
	for (const record of records) {
		const existing = groups.get(record.extension) || { extension: record.extension, count: 0, bytes: 0, gzipBytes: 0 };
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
		.sort((a, b) => b.bytes - a.bytes);
}

function buildInventory(options) {
	const files = walk(PUBLIC_DIR);
	const records = files.map(fileRecord);
	const inlineScripts = analyseInlineScripts(files, options);
	const cssUsage = analyseCssUsage(files);
	const largeFiles = records
		.filter(record => {
			if (record.extension === '.html') return record.kb > options.maxHtmlKb;
			if (record.isAsset) return record.kb > options.maxAssetKb;
			return record.kb > options.maxHtmlKb;
		})
		.sort((a, b) => b.bytes - a.bytes);

	return {
		generatedAt: new Date().toISOString(),
		thresholds: {
			maxAssetKb: options.maxAssetKb,
			maxHtmlKb: options.maxHtmlKb,
			maxInlineScriptKb: options.maxInlineScriptKb
		},
		totals: {
			files: records.length,
			bytes: records.reduce((sum, record) => sum + record.bytes, 0),
			kb: bytesToKb(records.reduce((sum, record) => sum + record.bytes, 0)),
			textGzipKb: bytesToKb(records.reduce((sum, record) => sum + (record.gzipBytes || 0), 0))
		},
		byExtension: groupByExtension(records),
		largestFiles: records.slice().sort((a, b) => b.bytes - a.bytes).slice(0, 25),
		largeFiles,
		inlineScripts,
		cssUsage
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

	const inlineRows = inventory.inlineScripts.map(record => [
		record.path,
		record.count,
		`${record.totalKb} KB`,
		`${record.largestKb} KB`,
		record.flagged ? 'yes' : 'no'
	]);

	const largeRows = inventory.largeFiles.map(record => [
		record.path,
		`${record.kb} KB`,
		record.extension
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
- Possible unused selector tokens: ${inventory.cssUsage.unusedCandidateCount || 0}

${markdownTable(['Candidate selector token'], (inventory.cssUsage.unusedCandidates || []).map(token => [token]))}

## Notes

This is a static inventory. It does not prove that a selector is unused at runtime. Dynamic class names, third-party markup, and server-rendered future states can produce false positives.

Use this report to prioritise manual review, not to delete CSS automatically.
`;
}

function main() {
	const options = parseArgs(process.argv.slice(2));
	const inventory = buildInventory(options);
	const output = options.format === 'json' ? `${JSON.stringify(inventory, null, 2)}\n` : toMarkdown(inventory);

	if (options.write) {
		const target = path.resolve(ROOT, options.write);
		fs.mkdirSync(path.dirname(target), { recursive: true });
		fs.writeFileSync(target, output, 'utf8');
		console.log(`Wrote ${normalisePath(target)}`);
		return;
	}

	process.stdout.write(output);
}

main();
