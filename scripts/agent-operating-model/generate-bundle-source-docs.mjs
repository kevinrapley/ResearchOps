#!/usr/bin/env node

import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_BUNDLE = 'github';
const DEFAULT_SOURCE_ROOT = '.agent-operating-model/bundles';
const DEFAULT_DOCS_ROOT = 'docs/agent-operating-model/bundles';
const DEFAULT_MAX_FILE_BYTES = 1024 * 1024;

const TEXT_EXTENSIONS = new Set([
	'.css',
	'.csv',
	'.html',
	'.js',
	'.json',
	'.jsonc',
	'.md',
	'.mjs',
	'.py',
	'.txt',
	'.xml',
	'.yaml',
	'.yml'
]);

const SKIPPED_DIRECTORIES = new Set(['.git', 'node_modules', '.cache', '.wrangler']);
const SKIPPED_FILES = new Set(['.DS_Store']);

function parseArgs(argv) {
	const args = {
		bundle: DEFAULT_BUNDLE,
		sourceRoot: DEFAULT_SOURCE_ROOT,
		docsRoot: DEFAULT_DOCS_ROOT,
		maxFileBytes: DEFAULT_MAX_FILE_BYTES,
		dryRun: false
	};

	for (let index = 0; index < argv.length; index += 1) {
		const current = argv[index];

		if (current === '--bundle') {
			args.bundle = argv[index + 1];
			index += 1;
			continue;
		}

		if (current === '--source-root') {
			args.sourceRoot = argv[index + 1];
			index += 1;
			continue;
		}

		if (current === '--docs-root') {
			args.docsRoot = argv[index + 1];
			index += 1;
			continue;
		}

		if (current === '--max-file-bytes') {
			args.maxFileBytes = Number(argv[index + 1]);
			index += 1;
			continue;
		}

		if (current === '--dry-run') {
			args.dryRun = true;
			continue;
		}

		throw new Error(`Unknown argument: ${current}`);
	}

	if (!args.bundle) throw new Error('Missing bundle identifier.');
	if (!Number.isFinite(args.maxFileBytes) || args.maxFileBytes < 1) throw new Error('Invalid --max-file-bytes value.');

	return args;
}

function normalisePath(value) {
	return value.split(path.sep).join('/');
}

function escapeHtml(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function safePathSegment(segment) {
	const visible = segment.startsWith('.') ? `_dot_${segment.slice(1)}` : segment;
	return encodeURIComponent(visible).replaceAll('%20', '-');
}

function safeRelativeHtmlPath(relativePath) {
	return normalisePath(relativePath)
		.split('/')
		.map(safePathSegment)
		.join('/');
}

function pagePathForSourceFile(relativePath) {
	return path.join('source', 'files', `${safeRelativeHtmlPath(relativePath)}.html`);
}

function titleForBundle(bundle) {
	if (bundle === 'github') return 'GitHub Diamond bundle';
	return `${bundle} bundle`;
}

function categoryForFile(relativePath) {
	const parts = normalisePath(relativePath).split('/');
	if (parts.length === 1) return 'bundle root';
	return parts[0];
}

function purposeForFile(relativePath) {
	const category = categoryForFile(relativePath);
	const name = path.basename(relativePath);

	if (name === 'prompt.body.xml') return 'Core bundle doctrine and behavioural instructions.';
	if (name === 'prompt.spec.yaml') return 'Bundle assembly manifest and module loading contract.';
	if (name === 'registry-manifest.yaml') return 'Auditable inventory of bundle files and checksums.';
	if (name === 'template-registry.yaml') return 'Template selection map linking source templates, destinations, contracts and graders.';
	if (name === 'VALIDATION-REPORT.md') return 'Human-readable validation status and assurance summary.';
	if (name === 'CHANGELOG.md') return 'Version history and release trace.';
	if (name === 'README.md') return 'Human-facing bundle overview and operating instructions.';
	if (category === 'modes') return 'Mode runbook. Defines task inputs, actions, outputs, failure states, contracts and graders.';
	if (category === 'roles') return 'Role lens. Defines responsibilities and escalation expectations.';
	if (category === 'references') return 'Reference module. Supplies policy, doctrine or implementation guidance.';
	if (category === 'contracts') return 'JSON Schema contract. Defines a checkable artefact shape.';
	if (category === 'graders') return 'Grader module. Defines thresholds, evidence, scoring and blocking failures.';
	if (category === 'templates') return 'Template file used when scaffolding or updating repositories.';
	if (category === 'scripts') return 'Executable utility used for generation, validation or assurance.';
	if (category === 'examples') return 'Example fixture or demonstration artefact.';
	if (category === 'fixtures') return 'Validation fixture used by scripts, tests or evals.';
	return 'Bundle source file.';
}

function usageForFile(relativePath) {
	const category = categoryForFile(relativePath);
	const name = path.basename(relativePath);

	if (name === 'prompt.body.xml') return 'Loaded by the operating model as the primary behavioural contract for this bundle.';
	if (name === 'prompt.spec.yaml') return 'Read before task execution so the agent knows which module families exist and how they assemble.';
	if (name === 'registry-manifest.yaml') return 'Used to check bundle file coverage and detect source drift.';
	if (name === 'template-registry.yaml') return 'Used by repository instantiation and update tasks to select scaffolds without inventing destinations.';
	if (category === 'modes') return 'Selected by task type. The agent should use it as a completion checklist.';
	if (category === 'roles') return 'Applied as an expert review lens when judging the task or output.';
	if (category === 'references') return 'Consulted when the task touches this policy area.';
	if (category === 'contracts') return 'Validated by scripts or graders before evidence can be trusted.';
	if (category === 'graders') return 'Used after work is produced to decide whether evidence passes, passes with gaps, or fails.';
	if (category === 'templates') return 'Copied or adapted through the template registry into target repositories.';
	if (category === 'scripts') return 'Run locally, in CI, or during release assurance to verify claims.';
	return 'Included in the generated source browser so reviewers can inspect the canonical bundle source.';
}

async function collectFiles(directory, root = directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		if (entry.name.startsWith('.') && entry.name !== '.github') continue;
		if (SKIPPED_FILES.has(entry.name)) continue;

		const fullPath = path.join(directory, entry.name);

		if (entry.isDirectory()) {
			if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
			files.push(...await collectFiles(fullPath, root));
			continue;
		}

		if (!entry.isFile()) continue;

		files.push({
			absolutePath: fullPath,
			relativePath: normalisePath(path.relative(root, fullPath))
		});
	}

	return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function isTextFile(file, buffer) {
	const extension = path.extname(file.relativePath).toLowerCase();
	if (TEXT_EXTENSIONS.has(extension)) return true;
	return !buffer.includes(0);
}

function lineRows(content) {
	const lines = content.split('\n');
	return lines.map((line, index) => {
		const lineNumber = index + 1;
		return `<tr id="L${lineNumber}"><th scope="row"><a href="#L${lineNumber}">${lineNumber}</a></th><td><code>${escapeHtml(line || ' ')}</code></td></tr>`;
	}).join('\n');
}

function relativeStylesheetLink(outputFile, bundleDocsDirectory) {
	const cssPath = path.join(bundleDocsDirectory, 'assets', 'styles.css');
	return normalisePath(path.relative(path.dirname(outputFile), cssPath));
}

function relativeIndexLink(outputFile, sourceIndexPath) {
	return normalisePath(path.relative(path.dirname(outputFile), sourceIndexPath));
}

function sourcePageHtml({ bundle, file, content, byteLength, outputFile, sourceIndexPath, bundleDocsDirectory }) {
	const stylesheet = relativeStylesheetLink(outputFile, bundleDocsDirectory);
	const sourceIndex = relativeIndexLink(outputFile, sourceIndexPath);
	const canonicalPath = `.agent-operating-model/bundles/${bundle}/${file.relativePath}`;
	const title = `${file.relativePath} · ${titleForBundle(bundle)}`;

	return `<!doctype html>
<html lang="en-GB">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>${escapeHtml(title)}</title>
	<link rel="stylesheet" href="${escapeHtml(stylesheet)}">
	<style>
		.source-code-table { width: 100%; border-collapse: collapse; font-size: 15px; }
		.source-code-table th { width: 4.5rem; text-align: right; user-select: none; background: #f3f2f1; color: #505a5f; }
		.source-code-table td { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre; overflow-x: auto; }
		.source-code-table th, .source-code-table td { border-bottom: 1px solid #e5e5e5; padding: 0.25rem 0.5rem; vertical-align: top; }
		.source-code-table code { background: transparent; padding: 0; }
		.source-meta { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; margin: 1.5rem 0; }
		@media (max-width: 800px) { .source-meta { grid-template-columns: 1fr; } }
	</style>
</head>
<body>
	<a class="skip-link" href="#main">Skip to main content</a>
	<header class="site-header">
		<div class="site-header__inner">
			<p class="site-header__product">ResearchOps · ${escapeHtml(titleForBundle(bundle))}</p>
			<h1>${escapeHtml(file.relativePath)}</h1>
			<p class="site-header__lede">Generated source extraction page for a canonical bundle file.</p>
		</div>
	</header>
	<p class="generated-warning">This page is generated documentation. The canonical source is <code>${escapeHtml(canonicalPath)}</code>.</p>
	<main id="main" class="wrapper">
		<nav class="breadcrumbs" aria-label="Breadcrumbs">
			<a href="${escapeHtml(sourceIndex)}">Source browser</a><span>${escapeHtml(file.relativePath)}</span>
		</nav>
		<section class="source-meta" aria-label="Source file metadata">
			<article class="card"><h2>Purpose</h2><p>${escapeHtml(purposeForFile(file.relativePath))}</p></article>
			<article class="card"><h2>How the agent uses it</h2><p>${escapeHtml(usageForFile(file.relativePath))}</p></article>
			<article class="card"><h2>File details</h2><p><code>${escapeHtml(canonicalPath)}</code></p><p>${byteLength.toLocaleString('en-GB')} bytes</p></article>
		</section>
		<section>
			<h2>Extracted source</h2>
			<table class="source-code-table" aria-label="Source code for ${escapeHtml(file.relativePath)}">
				<tbody>
${lineRows(content)}
				</tbody>
			</table>
		</section>
	</main>
	<footer class="site-footer"><div class="site-footer__inner">Generated source page. Canonical source remains under <code>.agent-operating-model/bundles/${escapeHtml(bundle)}/</code>.</div></footer>
</body>
</html>
`;
}

function binaryPageHtml({ bundle, file, byteLength, outputFile, sourceIndexPath, bundleDocsDirectory }) {
	const stylesheet = relativeStylesheetLink(outputFile, bundleDocsDirectory);
	const sourceIndex = relativeIndexLink(outputFile, sourceIndexPath);
	const canonicalPath = `.agent-operating-model/bundles/${bundle}/${file.relativePath}`;

	return `<!doctype html>
<html lang="en-GB">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>${escapeHtml(file.relativePath)} · binary source</title>
	<link rel="stylesheet" href="${escapeHtml(stylesheet)}">
</head>
<body>
	<a class="skip-link" href="#main">Skip to main content</a>
	<header class="site-header"><div class="site-header__inner"><p class="site-header__product">ResearchOps · ${escapeHtml(titleForBundle(bundle))}</p><h1>${escapeHtml(file.relativePath)}</h1><p class="site-header__lede">Binary or oversized file detected.</p></div></header>
	<p class="generated-warning">This page is generated documentation. The canonical source is <code>${escapeHtml(canonicalPath)}</code>.</p>
	<main id="main" class="wrapper">
		<nav class="breadcrumbs" aria-label="Breadcrumbs"><a href="${escapeHtml(sourceIndex)}">Source browser</a><span>${escapeHtml(file.relativePath)}</span></nav>
		<p>This file was not rendered as source because it is binary, not recognised as text, or exceeds the configured source extraction size limit.</p>
		<p>File size: ${byteLength.toLocaleString('en-GB')} bytes.</p>
	</main>
	<footer class="site-footer"><div class="site-footer__inner">Generated source page. Canonical source remains under <code>.agent-operating-model/bundles/${escapeHtml(bundle)}/</code>.</div></footer>
</body>
</html>
`;
}

function sourceIndexHtml({ bundle, generatedAt, files, pages, bundleDocsDirectory, sourceIndexPath }) {
	const stylesheet = normalisePath(path.relative(path.dirname(sourceIndexPath), path.join(bundleDocsDirectory, 'assets', 'styles.css')));
	const grouped = new Map();

	for (const file of files) {
		const category = categoryForFile(file.relativePath);
		if (!grouped.has(category)) grouped.set(category, []);
		grouped.get(category).push(file);
	}

	const categorySections = [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([category, categoryFiles]) => {
		const rows = categoryFiles.map((file) => {
			const page = pages.get(file.relativePath);
			const href = normalisePath(path.relative(path.dirname(sourceIndexPath), page));
			return `<tr><td><a href="${escapeHtml(href)}"><code>${escapeHtml(file.relativePath)}</code></a></td><td>${escapeHtml(purposeForFile(file.relativePath))}</td><td>${file.byteLength.toLocaleString('en-GB')} bytes</td></tr>`;
		}).join('\n');

		return `<section>
			<h2>${escapeHtml(category)}</h2>
			<table>
				<thead><tr><th>File</th><th>Purpose</th><th>Size</th></tr></thead>
				<tbody>
${rows}
				</tbody>
			</table>
		</section>`;
	}).join('\n');

	return `<!doctype html>
<html lang="en-GB">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>${escapeHtml(titleForBundle(bundle))} source browser</title>
	<link rel="stylesheet" href="${escapeHtml(stylesheet)}">
</head>
<body>
	<a class="skip-link" href="#main">Skip to main content</a>
	<header class="site-header">
		<div class="site-header__inner">
			<p class="site-header__product">ResearchOps · ${escapeHtml(titleForBundle(bundle))}</p>
			<h1>Source browser</h1>
			<p class="site-header__lede">Generated source extraction pages for every readable canonical bundle file.</p>
		</div>
	</header>
	<p class="generated-warning">This section is generated documentation. The canonical source is <code>.agent-operating-model/bundles/${escapeHtml(bundle)}/</code>.</p>
	<main id="main" class="wrapper">
		<nav class="breadcrumbs" aria-label="Breadcrumbs"><a href="../index.html">GitHub bundle</a><span>Source browser</span></nav>
		<p class="lede">Generated at ${escapeHtml(generatedAt)}. ${files.length} bundle files were indexed.</p>
${categorySections}
	</main>
	<footer class="site-footer"><div class="site-footer__inner">Generated source browser. Canonical source remains under <code>.agent-operating-model/bundles/${escapeHtml(bundle)}/</code>.</div></footer>
</body>
</html>
`;
}

async function writeGeneratedMetadata({ bundle, generatedAt, files, outputDirectory, dryRun }) {
	const metadata = {
		siteId: `${bundle}-bundle-source-browser`,
		generatedAt,
		bundle,
		canonicalSourcePath: `.agent-operating-model/bundles/${bundle}/`,
		outputPath: normalisePath(outputDirectory),
		fileCount: files.length,
		files: files.map((file) => ({
			path: file.relativePath,
			page: normalisePath(path.relative(outputDirectory, pagePathForSourceFile(file.relativePath).replace(/^source\//, ''))),
			bytes: file.byteLength,
			category: categoryForFile(file.relativePath),
			purpose: purposeForFile(file.relativePath)
		}))
	};

	const metadataPath = path.join(outputDirectory, 'source-metadata.json');
	if (dryRun) return metadataPath;
	await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
	return metadataPath;
}

async function generateBundleSourceDocs(options) {
	const repositoryRoot = process.cwd();
	const sourceDirectory = path.resolve(repositoryRoot, options.sourceRoot, options.bundle);
	const bundleDocsDirectory = path.resolve(repositoryRoot, options.docsRoot, options.bundle);
	const outputDirectory = path.join(bundleDocsDirectory, 'source');
	const filesDirectory = path.join(outputDirectory, 'files');
	const sourceIndexPath = path.join(outputDirectory, 'index.html');
	const sourceStats = await stat(sourceDirectory).catch(() => null);

	if (!sourceStats?.isDirectory()) {
		throw new Error(`Source bundle directory not found: ${normalisePath(path.relative(repositoryRoot, sourceDirectory))}`);
	}

	const files = await collectFiles(sourceDirectory);
	const pages = new Map();
	const generatedAt = new Date().toISOString();

	if (!options.dryRun) {
		await rm(outputDirectory, { recursive: true, force: true });
		await mkdir(filesDirectory, { recursive: true });
	}

	for (const file of files) {
		const buffer = await readFile(file.absolutePath);
		const pagePath = path.join(outputDirectory, pagePathForSourceFile(file.relativePath).replace(/^source\//, ''));
		file.byteLength = buffer.byteLength;
		pages.set(file.relativePath, pagePath);

		if (options.dryRun) continue;

		await mkdir(path.dirname(pagePath), { recursive: true });

		const renderAsText = buffer.byteLength <= options.maxFileBytes && isTextFile(file, buffer);
		const html = renderAsText
			? sourcePageHtml({
				bundle: options.bundle,
				file,
				content: buffer.toString('utf8'),
				byteLength: buffer.byteLength,
				outputFile: pagePath,
				sourceIndexPath,
				bundleDocsDirectory
			})
			: binaryPageHtml({
				bundle: options.bundle,
				file,
				byteLength: buffer.byteLength,
				outputFile: pagePath,
				sourceIndexPath,
				bundleDocsDirectory
			});

		await writeFile(pagePath, html, 'utf8');
	}

	if (!options.dryRun) {
		const index = sourceIndexHtml({
			bundle: options.bundle,
			generatedAt,
			files,
			pages,
			bundleDocsDirectory,
			sourceIndexPath
		});

		await writeFile(sourceIndexPath, index, 'utf8');
		await writeGeneratedMetadata({ bundle: options.bundle, generatedAt, files, outputDirectory, dryRun: options.dryRun });
	}

	return {
		bundle: options.bundle,
		files: files.length,
		outputDirectory: normalisePath(path.relative(repositoryRoot, outputDirectory)),
		dryRun: options.dryRun
	};
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	const result = await generateBundleSourceDocs(options);
	console.log(`Generated source documentation for ${result.bundle}: ${result.files} files -> ${result.outputDirectory}`);
	if (result.dryRun) console.log('Dry run only. No files were written.');
}

main().catch((error) => {
	console.error(error.message);
	process.exitCode = 1;
});
