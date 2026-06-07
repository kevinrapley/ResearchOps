import assert from 'node:assert/strict';
import fs from 'node:fs';

const template = fs.readFileSync('src/govuk/templates/pages/repository.njk', 'utf8');
const macros = fs.readFileSync('src/govuk/templates/macros/repository.njk', 'utf8');
const stylesheet = fs.readFileSync('src/styles/repository.scss', 'utf8');
const generatedStylesheet = fs.readFileSync('public/css/repository.css', 'utf8');
const renderedPage = fs.readFileSync('public/pages/repository/index.html', 'utf8');
const renderScript = fs.readFileSync('scripts/govuk/render-govuk-pages.mjs', 'utf8');
const generatedCssTargets = fs.readFileSync('scripts/styles/generated-css-targets.mjs', 'utf8');
const headerPartial = fs.readFileSync('public/partials/header.html', 'utf8');

assert.match(renderScript, /template: 'pages\/repository\.njk'/);
assert.match(renderScript, /output: 'public\/pages\/repository\/index\.html'/);
assert.match(generatedCssTargets, /source: 'src\/styles\/repository\.scss'/);
assert.match(generatedCssTargets, /output: 'public\/css\/repository\.css'/);
assert.match(headerPartial, /data-nav="Research Repository"/);
assert.match(headerPartial, /href="\/pages\/repository\/"/);

assert.match(template, /extends "layouts\/researchops\.njk"/);
assert.match(template, /macros\/repository\.njk/);
assert.match(template, /repositoryHero\(hero\)/);
assert.match(template, /repositoryMetrics\(metrics\)/);
assert.match(template, /repositoryBrowseCards\(browseRoutes\)/);
assert.match(template, /repositoryArtefactList\(artefacts\)/);
assert.match(template, /repositoryPublicationPanel\(publication\)/);

assert.match(macros, /govuk\/components\/button\/macro\.njk/);
assert.match(macros, /govuk\/components\/checkboxes\/macro\.njk/);
assert.match(macros, /govuk\/components\/details\/macro\.njk/);
assert.match(macros, /govuk\/components\/input\/macro\.njk/);
assert.match(macros, /govuk\/components\/summary-list\/macro\.njk/);
assert.match(macros, /govuk\/components\/tag\/macro\.njk/);
assert.match(macros, /macro repositoryHero/);
assert.match(macros, /macro repositorySearch/);
assert.match(macros, /macro repositoryArtefactList/);

assert.match(stylesheet, /Route:\s+\/pages\/repository\//);
assert.match(stylesheet, /\.repository-hero/);
assert.match(stylesheet, /\.repository-search-panel/);
assert.match(stylesheet, /\.repository-card-grid/);
assert.match(stylesheet, /\.repository-artefact-list/);
assert.match(stylesheet, /\/\* transparency begins in the cascade \*\//);
assert.match(generatedStylesheet, /@charset "UTF-8";/);
assert.match(generatedStylesheet, /\.repository-hero/);
assert.match(generatedStylesheet, /\.repository-filter-panel/);

assert.match(renderedPage, /Research repository/);
assert.match(renderedPage, /src="\/partials\/header\.html"/);
assert.match(renderedPage, /vars='\{"active":"Research Repository"\}'/);
assert.match(renderedPage, /href="\/css\/repository\.css\?v=repository-front-page-20260607"/);
assert.match(renderedPage, /role="search"/);
assert.match(renderedPage, /Search published research/);
assert.match(renderedPage, /Published artefacts/);
assert.match(renderedPage, /Publication gates/);
assert.match(renderedPage, /Curator workbench/);
assert.match(renderedPage, /Only reviewed artefacts appear in the repository/);
assert.doesNotMatch(renderedPage, /Draft studies, consent records, recruitment records, session notes and recordings are part of the repository index/);
