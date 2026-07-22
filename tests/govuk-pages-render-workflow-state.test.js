import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/render-govuk-pages.yml', 'utf8');
const gitignore = fs.readFileSync('.gitignore', 'utf8');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const generatedHtmlPolicy = fs.readFileSync('docs/deployment/generated-html-policy.md', 'utf8');

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

for (const snippet of [
	'name: Render GOV.UK pages',
	'pull_request:',
	'workflow_dispatch: {}',
	'contents: write',
	'src/govuk/templates/**',
	'src/govuk/data/compliance-readiness.mjs',
	'docs/compliance/soc2-iso27001-readiness/availability-and-monitoring/**',
	'docs/compliance/soc2-iso27001-readiness/incident-response/**',
	'docs/compliance/soc2-iso27001-readiness/privacy-and-data-protection/**',
	'docs/compliance/soc2-iso27001-readiness/supplier-assurance/**',
	'src/govuk/data/sourcebook.mjs',
	'sourcebook/sourcebook-index.json',
	'scripts/govuk/render-govuk-pages.mjs',
	'scripts/govuk/govuk-page-filesystem-output.mjs',
	'scripts/govuk/page-publisher/**',
	'package.json',
	'package-lock.json',
	'.github/workflows/render-govuk-pages.yml',
	'npm run build:govuk-pages',
	'output_paths=(public/index.html public/pages)',
	'Render GOV.UK page templates',
	'github.event.pull_request.head.repo.full_name == github.repository',
]) {
	includes(workflow, snippet, 'GOV.UK pages render workflow');
}

for (const parts of [
	['git', 'diff', '--cached', '--binary', '--'],
	['git', 'reset', '--hard'],
	['git', 'pull', '--rebase', 'origin'],
	['git', 'apply', '--index', '--3way'],
	['git', 'add', '-A', '--'],
]) {
	includes(workflow, parts.join(' '), 'GOV.UK pages render workflow');
}

excludes(workflow, 'git add -A public/index.html public/pages', 'GOV.UK pages render workflow');
excludes(
	workflow,
	'git diff --binary -- public/index.html public/pages',
	'GOV.UK pages render workflow'
);
excludes(workflow, 'import { govukPages }', 'GOV.UK pages render workflow');

for (const snippet of ['public/**', '!public/', '!public/index.html', '!public/pages/']) {
	excludes(gitignore, snippet, 'gitignore rendered GOV.UK HTML policy');
}

for (const snippet of ['dist/', 'build/', 'coverage/', 'playwright-report/', 'test-results/']) {
	includes(gitignore, snippet, 'gitignore build-output policy');
}

assert.equal(
	packageJson.scripts['build:govuk-pages'],
	'node scripts/govuk/render-govuk-pages.mjs',
	'build:govuk-pages should publish GOV.UK Nunjucks templates through the canonical command'
);

for (const snippet of [
	'Cloudflare Pages currently publishes the committed `public/` directory',
	'Do not hand-edit generated GOV.UK HTML',
	'in-memory output adapter',
	'final, post-normalised page byte-for-byte',
	'When deployment can run `npm run build` before publishing',
	'build artefact',
]) {
	includes(generatedHtmlPolicy, snippet, 'generated GOV.UK HTML policy');
}
