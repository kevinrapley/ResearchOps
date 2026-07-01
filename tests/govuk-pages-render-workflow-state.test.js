import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/render-govuk-pages.yml', 'utf8');
const gitignore = fs.readFileSync('.gitignore', 'utf8');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const renderer = fs.readFileSync('scripts/govuk/render-govuk-pages.mjs', 'utf8');
const generatedHtmlPolicy = fs.readFileSync('docs/deployment/generated-html-policy.md', 'utf8');

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

const requiredWorkflowSnippets = [
	'name: Render GOV.UK pages',
	'pull_request:',
	'workflow_dispatch: {}',
	'contents: write',
	'src/govuk/templates/**',
	'scripts/govuk/render-govuk-pages.mjs',
	'scripts/govuk/normalise-service-pages.mjs',
	'package.json',
	'package-lock.json',
	'.github/workflows/render-govuk-pages.yml',
	'Determine changed GOV.UK page outputs',
	'changed_global_sources_path',
	'changed-govuk-render-global-sources.txt',
	'Changed GOV.UK render inputs require all generated pages to be checked.',
	"awk '$0 !~ /^src\\/govuk\\/templates\\/pages\\/[^/]+\\.njk$/ { print }'",
	'src/govuk/templates/pages/*.njk',
	'No changed GOV.UK page templates to render.',
	'No GOV.UK renderer page registration found for:',
	"import { govukPages } from './scripts/govuk/render-govuk-pages.mjs';",
	'for (const page of govukPages) {',
	'byTemplate.get(page.template).push(page.output);',
	'const changedOutputs = new Set();',
	'for (const output of [...changedOutputs].sort()) {',
	'output_paths',
	'npm run build:govuk-pages',
	'if [ "$render_all" = "true" ]; then',
	'output_paths=(public/index.html public/pages)',
	'cat "$changed_global_sources_path"',
	'Render GOV.UK page templates',
	'github.event.pull_request.head.repo.full_name == github.repository',
];

for (const snippet of requiredWorkflowSnippets) {
	includes(workflow, snippet, 'GOV.UK pages render workflow');
}

const requiredCommandSnippets = [
	['git', 'diff', '--cached', '--binary', '--'],
	['git', 'reset', '--hard'],
	['git', 'pull', '--rebase', 'origin'],
	['git', 'apply', '--index', '--3way'],
	['git', 'add', '-A', '--'],
];

for (const parts of requiredCommandSnippets) {
	includes(workflow, parts.join(' '), 'GOV.UK pages render workflow');
}

excludes(workflow, 'git add -A public/index.html public/pages', 'GOV.UK pages render workflow');
excludes(
	workflow,
	'git diff --binary -- public/index.html public/pages',
	'GOV.UK pages render workflow'
);
excludes(workflow, 'const pagePattern = /', 'GOV.UK pages render workflow');

for (const snippet of ['public/**', '!public/', '!public/index.html', '!public/pages/']) {
	excludes(gitignore, snippet, 'gitignore rendered GOV.UK HTML policy');
}

for (const snippet of ['dist/', 'build/', 'coverage/', 'playwright-report/', 'test-results/']) {
	includes(gitignore, snippet, 'gitignore build-output policy');
}

assert.equal(
	packageJson.scripts['build:govuk-pages'],
	'node scripts/govuk/render-govuk-pages.mjs',
	'build:govuk-pages should keep rendering GOV.UK Nunjucks templates through the canonical renderer'
);

includes(renderer, "output: 'public/pages/projects/journals/index.html'", 'GOV.UK pages renderer');
includes(renderer, "template: 'pages/projects-journals.njk'", 'GOV.UK pages renderer');
includes(renderer, "output: 'public/pages/start/index.html'", 'GOV.UK pages renderer');
includes(renderer, "template: 'pages/start.njk'", 'GOV.UK pages renderer');

for (const snippet of [
	'Cloudflare Pages currently publishes the committed `public/` directory',
	'Do not hand-edit generated GOV.UK HTML',
	'route-state tests remain the guardrail',
	'When deployment can run `npm run build` before publishing',
	'build artefact',
]) {
	includes(generatedHtmlPolicy, snippet, 'generated GOV.UK HTML policy');
}
