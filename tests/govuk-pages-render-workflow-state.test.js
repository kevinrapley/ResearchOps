import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/render-govuk-pages.yml', 'utf8');
const gitignore = fs.readFileSync('.gitignore', 'utf8');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const renderer = fs.readFileSync('scripts/govuk/render-govuk-pages.mjs', 'utf8');

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
	'Determine changed GOV.UK page outputs',
	'src/govuk/templates/pages/*.njk',
	'No changed GOV.UK page templates to render.',
	'No GOV.UK renderer page registration found for:',
	'output_paths',
	'npm run build:govuk-pages',
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

for (const snippet of ['public/**', '!public/', '!public/index.html', '!public/pages/']) {
	includes(gitignore, snippet, 'gitignore rendered GOV.UK HTML policy');
}

assert.equal(
	packageJson.scripts['build:govuk-pages'],
	'node scripts/govuk/render-govuk-pages.mjs',
	'build:govuk-pages should keep rendering GOV.UK Nunjucks templates through the canonical renderer'
);

includes(renderer, "output: 'public/pages/projects/journals/index.html'", 'GOV.UK pages renderer');
includes(renderer, "template: 'pages/projects-journals.njk'", 'GOV.UK pages renderer');
