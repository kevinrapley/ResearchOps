import assert from 'node:assert/strict';
import fs from 'node:fs';

const template = fs.readFileSync('src/govuk/templates/pages/repository.njk', 'utf8');
const macros = fs.readFileSync('src/govuk/templates/macros/repository.njk', 'utf8');
const pageData = fs.readFileSync('src/govuk/data/repository-page.mjs', 'utf8');
const pageScript = fs.readFileSync('public/js/repository-page.js', 'utf8');
const stylesheet = fs.readFileSync('src/styles/repository.scss', 'utf8');
const generatedStylesheet = fs.readFileSync('public/css/repository.css', 'utf8');
const renderedPage = fs.readFileSync('public/pages/repository/index.html', 'utf8');
const renderScript = fs.readFileSync('scripts/govuk/render-govuk-pages.mjs', 'utf8');
const generatedCssTargets = fs.readFileSync('scripts/styles/generated-css-targets.mjs', 'utf8');
const headerPartial = fs.readFileSync('public/partials/header.html', 'utf8');
const repositoryService = fs.readFileSync('infra/cloudflare/src/service/repository.js', 'utf8');
const repositoryFunction = fs.readFileSync('functions/api/repository/[[path]].js', 'utf8');
const repositoryMigration = fs.readFileSync('infra/cloudflare/migrations/0014_research_repository.sql', 'utf8');

assert.match(renderScript, /template: 'pages\/repository\.njk'/);
assert.match(renderScript, /output: 'public\/pages\/repository\/index\.html'/);
assert.match(generatedCssTargets, /source: 'src\/styles\/repository\.scss'/);
assert.match(generatedCssTargets, /output: 'public\/css\/repository\.css'/);
assert.match(headerPartial, /data-nav="Research Repository"/);
assert.match(headerPartial, /href="\/pages\/repository\/"/);

assert.match(template, /extends "layouts\/researchops\.njk"/);
assert.match(template, /macros\/repository\.njk/);
assert.match(template, /repositoryHero\(hero\)/);
assert.match(template, /id="repository-metrics"/);
assert.match(template, /id="repository-results"/);
assert.match(template, /id="repository-filters"/);
assert.match(template, /id="repository-queues"/);
assert.match(template, /\/js\/repository-page\.js\?v=repository-api-20260607/);
assert.doesNotMatch(template, /repositoryDecisionCards/);
assert.doesNotMatch(template, /Team decision for this page/);

assert.match(macros, /govuk\/components\/button\/macro\.njk/);
assert.match(macros, /govuk\/components\/input\/macro\.njk/);
assert.match(macros, /macro repositoryHero/);
assert.match(macros, /macro repositorySearch/);
assert.match(macros, /repository-search-panel__row/);
assert.match(macros, /repository-search-panel__field/);
assert.match(macros, /repository-search-panel__action/);
assert.doesNotMatch(macros, /macro repositoryDecisionCards/);

assert.doesNotMatch(pageData, /Staff need clearer evidence boundaries/);
assert.doesNotMatch(pageData, /teamDecisions/);
assert.doesNotMatch(pageData, /artefacts: \[/);

assert.match(pageScript, /apiUrl\(`\/api\/repository/);
assert.match(pageScript, /credentials: "include"/);
assert.match(pageScript, /redirectToSignIn/);
assert.match(pageScript, /renderArtefacts/);
assert.match(pageScript, /renderFilters/);
assert.match(pageScript, /renderQueues/);

assert.match(repositoryService, /const ARTEFACTS_TABLE = "rops_repository_artefacts"/);
assert.match(repositoryService, /export async function listRepository/);
assert.match(repositoryService, /status = 'published'/);
assert.match(repositoryService, /pii_cleared = 1/);
assert.match(repositoryService, /consent_scope_confirmed = 1/);
assert.match(repositoryService, /d1All\(svc\.env/);
assert.doesNotMatch(repositoryService, /AIRTABLE/);

assert.match(repositoryFunction, /functions\/api\/repository/);
assert.match(repositoryFunction, /resolveAuthenticatedContext/);
assert.match(repositoryFunction, /assertRoutePermission/);
assert.match(repositoryFunction, /service\.listRepository/);
assert.match(repositoryFunction, /service\.readRepositoryArtefact/);

assert.match(repositoryMigration, /CREATE TABLE IF NOT EXISTS rops_repository_artefacts/);
assert.match(repositoryMigration, /CREATE TABLE IF NOT EXISTS rops_repository_artefact_tags/);
assert.match(repositoryMigration, /repository\.view/);
assert.match(repositoryMigration, /\/api\/repository/);

assert.match(stylesheet, /Route:\s+\/pages\/repository\//);
assert.match(stylesheet, /\.repository-search-panel__row/);
assert.match(stylesheet, /flex-direction: row/);
assert.match(stylesheet, /align-items: flex-end/);
assert.match(stylesheet, /\/\* transparency begins in the cascade \*\//);
assert.match(generatedStylesheet, /@charset "UTF-8";/);
assert.match(generatedStylesheet, /\.repository-search-panel__row/);
assert.match(generatedStylesheet, /align-items: flex-end/);

assert.match(renderedPage, /Research repository/);
assert.match(renderedPage, /src="\/partials\/header\.html"/);
assert.match(renderedPage, /vars='\{"active":"Research Repository"\}'/);
assert.match(renderedPage, /href="\/css\/repository\.css\?v=repository-api-20260607"/);
assert.match(renderedPage, /role="search"/);
assert.match(renderedPage, /Search published research/);
assert.match(renderedPage, /id="repository-metrics"/);
assert.match(renderedPage, /id="repository-results"/);
assert.match(renderedPage, /id="repository-filters"/);
assert.match(renderedPage, /id="repository-queues"/);
assert.match(renderedPage, /Only reviewed artefacts that have passed PII and consent-scope checks/);
assert.doesNotMatch(renderedPage, /Team decision for this page/);
assert.doesNotMatch(renderedPage, /Staff need clearer evidence boundaries/);
