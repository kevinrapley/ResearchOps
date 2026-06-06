import assert from 'node:assert/strict';
import fs from 'node:fs';

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const helperSource = fs.readFileSync('tests/helpers/generated-govuk-page-source.mjs', 'utf8');
const rendererSource = fs.readFileSync('scripts/govuk/render-govuk-pages.mjs', 'utf8');

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(
	packageJson.scripts.test,
	'--import ./tests/helpers/generated-govuk-page-source.mjs',
	'package test script',
);
includes(packageJson.scripts.test, '--test', 'package test script');

includes(helperSource, "import { cacheBustOutcomesPageScripts, govukPages } from '../../scripts/govuk/render-govuk-pages.mjs';", 'generated GOV.UK page test helper');
includes(helperSource, 'const originalReadFileSync = fs.readFileSync.bind(fs);', 'generated GOV.UK page test helper');
includes(helperSource, 'const renderedPageOutputs = new Map(', 'generated GOV.UK page test helper');
includes(helperSource, 'govukPages.map((page) => [normalize(resolve(root, page.output)), page])', 'generated GOV.UK page test helper');
includes(helperSource, "new nunjucks.FileSystemLoader(resolve(root, 'src/govuk/templates'))", 'generated GOV.UK page test helper');
includes(helperSource, "new nunjucks.FileSystemLoader(resolve(root, 'node_modules/govuk-frontend/dist'))", 'generated GOV.UK page test helper');
includes(helperSource, "env.addFilter('govukAttributes', govukAttributes);", 'generated GOV.UK page test helper');
includes(helperSource, "env.addGlobal('govukAttributes', govukAttributes);", 'generated GOV.UK page test helper');
includes(helperSource, 'return cacheBustOutcomesPageScripts(env.render(page.template, page.context), page);', 'generated GOV.UK page test helper');
includes(helperSource, 'fs.readFileSync = function readFileSyncWithGeneratedGovukPages(pathLike, options) {', 'generated GOV.UK page test helper');
includes(helperSource, 'if (page) return encodedContent(renderPage(page), options);', 'generated GOV.UK page test helper');
includes(helperSource, 'return originalReadFileSync(pathLike, options);', 'generated GOV.UK page test helper');

includes(rendererSource, 'export const govukPages = [', 'GOV.UK page renderer');
includes(rendererSource, 'export function cacheBustOutcomesPageScripts', 'GOV.UK page renderer');
includes(rendererSource, "output: 'public/pages/projects/journals/index.html'", 'GOV.UK page renderer');
excludes(helperSource, "originalReadFileSync('public/pages", 'generated GOV.UK page test helper');
