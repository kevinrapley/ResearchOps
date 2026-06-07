import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = {
	template: fs.readFileSync('src/govuk/templates/pages/repository.njk', 'utf8'),
	staticTemplate: fs.readFileSync('src/govuk/templates/pages/repository-static.njk', 'utf8'),
	macros: fs.readFileSync('src/govuk/templates/macros/repository.njk', 'utf8'),
	pageData: fs.readFileSync('src/govuk/data/repository-page.mjs', 'utf8'),
	pageScript: fs.readFileSync('public/js/repository-page.js', 'utf8'),
	artefactScript: fs.readFileSync('public/js/repository-artefact-page.js', 'utf8'),
	staticScript: fs.readFileSync('public/js/repository-static-page.js', 'utf8'),
	stylesheet: fs.readFileSync('src/styles/repository.scss', 'utf8'),
	renderer: fs.readFileSync('scripts/govuk/render-govuk-pages.mjs', 'utf8'),
	cssTargets: fs.readFileSync('scripts/styles/generated-css-targets.mjs', 'utf8'),
	header: fs.readFileSync('public/partials/header.html', 'utf8'),
	service: fs.readFileSync('infra/cloudflare/src/service/repository.js', 'utf8'),
	api: fs.readFileSync('functions/api/repository/[[path]].js', 'utf8'),
	worker: fs.readFileSync('infra/cloudflare/src/worker.js', 'utf8'),
	migration: fs.readFileSync('infra/cloudflare/migrations/0014_research_repository.sql', 'utf8'),
	seedMigration: fs.readFileSync('infra/cloudflare/migrations/0015_seed_research_repository.sql', 'utf8'),
	seedTagMigration: fs.readFileSync('infra/cloudflare/migrations/0016_update_repository_seed_tag_taxonomy.sql', 'utf8'),
	visualWalkthrough: fs.readFileSync('visual-walkthrough.config.mjs', 'utf8'),
	gitignore: fs.readFileSync('.gitignore', 'utf8'),
	lychee: fs.readFileSync('lychee.toml', 'utf8'),
	qaLinks: fs.readFileSync('.github/workflows/qa-links.yml', 'utf8'),
	deployWorker: fs.readFileSync('.github/workflows/deploy-worker.yml', 'utf8'),
	passwordlessPreviewWorker: fs.readFileSync('.github/workflows/deploy-passwordless-preview-worker.yml', 'utf8'),
};

function has(source, text, label) {
	assert.equal(source.includes(text), true, `${label} should include ${text}`);
}

function lacks(source, text, label) {
	assert.equal(source.includes(text), false, `${label} should not include ${text}`);
}

function workflowSection(source, startMarker, endMarker) {
	const start = source.indexOf(startMarker);
	assert.notEqual(start, -1, `Expected workflow section ${startMarker}`);
	const rest = source.slice(start);
	const end = endMarker ? rest.indexOf(endMarker) : -1;
	return end === -1 ? rest : rest.slice(0, end);
}

has(files.renderer, "template: 'pages/repository.njk'", 'renderer');
has(files.renderer, "output: 'public/pages/repository/index.html'", 'renderer');
has(files.renderer, "repositoryStaticPages.map", 'renderer');
has(files.renderer, "template: 'pages/repository-static.njk'", 'renderer');
has(files.renderer, 'public/pages/repository/${page.slug}/index.html', 'renderer');
has(files.cssTargets, "source: 'src/styles/repository.scss'", 'CSS targets');
has(files.cssTargets, "output: 'public/css/repository.css'", 'CSS targets');
has(files.header, 'href="/pages/repository/"', 'header');
has(files.header, 'data-nav="Research Repository"', 'header');

has(files.template, 'govuk/components/checkboxes/macro.njk', 'template');
has(files.template, 'The repository shows curated research artefacts', 'template');
has(files.template, 'Summary figures are calculated from published repository records', 'template');
has(files.template, 'class="govuk-heading-xl govuk-!-margin-bottom-1 repository-metric__number"', 'template');
has(files.template, 'class="govuk-body repository-metric__label"', 'template');
has(files.template, 'Published artefacts', 'template');
has(files.template, 'Linked recommendations', 'template');
has(files.template, 'Due review in 30 days', 'template');
has(files.template, 'id="repository-filter-form"', 'template');
has(files.template, 'name: \'method\'', 'template');
has(files.template, 'name: \'maturity\'', 'template');
has(files.template, "value: 'contextual-inquiry'", 'template');
has(files.template, "value: 'survey-analysis'", 'template');
has(files.template, "value: 'content-testing'", 'template');
has(files.template, "value: 'service-review'", 'template');
has(files.template, "value: 'validated-learning'", 'template');
has(files.template, "value: 'reviewed-evidence'", 'template');
has(files.template, "value: 'early-signal'", 'template');
lacks(files.template, "value: 'validated-insight'", 'template');
lacks(files.template, "value: 'evidence-pack'", 'template');
lacks(files.template, "value: 'pattern-evidence'", 'template');
lacks(files.template, "value: 'method-learning'", 'template');
has(files.template, 'href="/pages/repository/service-areas/"', 'template');
has(files.template, 'href="/pages/repository/user-groups/"', 'template');
has(files.template, 'href="/pages/repository/methods/"', 'template');
has(files.template, 'href="/pages/repository/risks/"', 'template');
has(files.template, 'Curator workbench', 'template');
has(files.template, 'data-repository-queue-count="Candidate artefacts"', 'template');
has(files.template, 'data-repository-queue-count="Due review"', 'template');
has(files.template, 'data-repository-queue-count="Withdrawn artefacts"', 'template');
has(files.template, 'data-repository-source="api:/api/repository metrics from D1 rops_repository_artefacts and rops_repository_artefact_tags"', 'template');
lacks(files.template, 'Loading repository summary', 'template');
lacks(files.template, 'Loading filters', 'template');
lacks(files.template, 'Loading curator queues', 'template');
lacks(files.template, 'Technical detail', 'template');
lacks(files.template, 'Team decision for this page', 'template');
lacks(files.template, 'Repository status', 'template');

has(files.macros, 'macro repositoryHero', 'macros');
has(files.macros, 'macro repositorySearch', 'macros');
lacks(files.macros, 'macro repositoryDecisionCards', 'macros');
lacks(files.macros, 'macro repositoryAssurancePanel', 'macros');

has(files.template, 'govuk/components/breadcrumbs/macro.njk', 'template');
has(files.template, 'id: "repository-breadcrumbs"', 'template');
has(files.staticTemplate, 'govuk/components/breadcrumbs/macro.njk', 'static repository template');
has(files.staticTemplate, 'id: "repository-breadcrumbs"', 'static repository template');
lacks(files.staticTemplate, 'govuk-back-link', 'static repository template');
lacks(files.staticTemplate, 'Open the API response for this route', 'static repository template');
lacks(files.staticTemplate, 'Repository data', 'static repository template');
lacks(files.staticTemplate, 'This page uses the repository API for dynamic data', 'static repository template');
has(files.staticTemplate, 'repository-artefact-detail', 'static repository template');
has(files.staticTemplate, '{{ detailHeading or title }}', 'static repository template');
lacks(files.staticTemplate, 'Selected artefact', 'static repository template');
has(files.staticTemplate, 'repository-artefact-page.js', 'static repository template');
has(files.staticTemplate, 'data-repository-browse-page', 'static repository template');
has(files.staticTemplate, 'repository-browse-options', 'static repository template');
has(files.staticTemplate, 'repository-browse-results', 'static repository template');
has(files.staticTemplate, 'data-repository-candidate-page', 'static repository template');
has(files.staticTemplate, 'repository-candidate-form', 'static repository template');
has(files.staticTemplate, 'candidate-source-project-id', 'static repository template');
has(files.staticTemplate, 'candidate-evidence-type', 'static repository template');
has(files.staticTemplate, 'Submit for repository review', 'static repository template');
has(files.staticTemplate, 'repository-static-page.js', 'static repository template');
has(files.pageData, 'export const repositoryStaticPages', 'page data');
has(files.pageData, "slug: 'service-areas'", 'page data');
has(files.pageData, "slug: 'artefacts'", 'page data');
has(files.pageData, 'detailRoute: true', 'page data');
has(files.pageData, "detailHeading: 'Repository artefact'", 'page data');
has(files.pageData, "browseType: 'service_area'", 'page data');
has(files.pageData, "browseType: 'user_group'", 'page data');
has(files.pageData, "browseType: 'method'", 'page data');
has(files.pageData, "browseType: 'risk_area'", 'page data');
has(files.pageData, 'candidateRoute: true', 'page data');
has(files.pageData, "slug: 'review/candidates/new'", 'page data');
has(files.pageData, "slug: 'artefacts/staff-evidence-boundaries'", 'page data');

lacks(files.pageData, 'teamDecisions', 'page data');
lacks(files.pageData, 'artefacts: [', 'page data');
lacks(files.pageData, 'assurance', 'page data');
lacks(files.pageData, 'This route loads the selected published artefact from the repository API using the artefact ID in the page URL.', 'page data');

has(files.pageScript, 'apiUrl(`/api/repository', 'page script');
has(files.pageScript, 'updateFilterCounts', 'page script');
has(files.pageScript, 'setQueueCounts', 'page script');
has(files.pageScript, 'data-repository-metric', 'page script');
has(files.pageScript, '/pages/repository/artefacts/?id=', 'page script');
lacks(files.pageScript, 'Technical detail', 'page script');
has(files.artefactScript, 'repository-artefact-detail', 'artefact script');
has(files.artefactScript, 'repository-artefact-detail-title', 'artefact script');
has(files.artefactScript, 'pageHeading.textContent = text(artefact.title)', 'artefact script');
has(files.artefactScript, 'fetch(apiUrl(`/api/repository/artefacts/${encodeURIComponent(id)}`)', 'artefact script');
has(files.artefactScript, 'credentials: "include"', 'artefact script');
has(files.staticScript, 'data-repository-browse-page', 'static page script');
has(files.staticScript, 'loadBrowseResults(type, item.value', 'static page script');
has(files.staticScript, 'repository-browse-options', 'static page script');
has(files.staticScript, 'repository-browse-results', 'static page script');
has(files.staticScript, 'repository-candidate-form', 'static page script');
has(files.staticScript, '/api/projects?limit=200', 'static page script');
has(files.staticScript, 'populateProjectSelect', 'static page script');
has(files.staticScript, 'method: "POST"', 'static page script');
has(files.staticScript, 'Candidate artefact', 'static page script');

has(files.service, 'const ARTEFACTS_TABLE = "rops_repository_artefacts"', 'service');
has(files.service, 'function airtableRecords', 'service');
has(files.service, 'function listRepositoryFromAirtable', 'service');
has(files.service, 'source: "airtable"', 'service');
has(files.service, 'const userGroup = cleanSlug(url.searchParams.get("user_group"))', 'service');
has(files.service, 'facetRows(svc, "user_group", "User group")', 'service');
has(files.service, 'function repositoryMetrics', 'service');
has(files.service, 'function facetRows', 'service');
has(files.service, 'function repositoryQueues', 'service');
has(files.service, 'function repositoryDerivation', 'service');
has(files.service, 'export async function createRepositoryCandidate', 'service');
has(files.service, 'const evidenceType = cleanSlug(payloadText(payload, "evidenceType"))', 'service');
has(files.service, "status: \"candidate\"", 'service');
has(files.service, "publicationGate: \"pending_review\"", 'service');
has(files.service, 'evidenceType', 'service');
has(files.service, "piiCleared: false", 'service');
has(files.service, "consentScopeConfirmed: false", 'service');
has(files.service, 'derivation: repositoryDerivation(showQueues)', 'service');
has(files.service, 'href: `/pages/repository/artefacts/?id=${encodeURIComponent(row.id)}`', 'service');
lacks(files.service, 'String(error?.message || error) }, 503', 'service');

has(files.api, 'resolveAuthenticatedContext', 'API');
has(files.api, 'assertRoutePermission', 'API');
has(files.api, 'service.listRepository', 'API');
has(files.api, 'service.createRepositoryCandidate', 'API');
has(files.api, "'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'", 'API');
has(files.api, 'function resolveAllowedOrigin', 'API');
has(files.api, 'origin === requestOrigin', 'API');
has(files.api, "error: 'origin_not_allowed'", 'API');
has(files.api, "'Access-Control-Allow-Credentials'] = 'true'", 'API');
lacks(files.api, "'Access-Control-Allow-Origin': origin || '*'", 'API');
has(files.api, 'repository_api_unavailable', 'API');
has(files.api, 'Repository data could not be loaded. Try again or contact the ResearchOps team if the problem continues.', 'API');
has(files.worker, 'async function ensureRepositoryAuthDeclarations', 'worker');
has(files.worker, 'async function handleRepository', 'worker');
has(files.worker, 'apiPath === "/api/repository" || apiPath.startsWith("/api/repository/")', 'worker');
has(files.worker, 'route_api_repository_artefacts_post', 'worker');
has(files.worker, 'service.createRepositoryCandidate(request, origin, authContext)', 'worker');
has(files.migration, 'CREATE TABLE IF NOT EXISTS rops_repository_artefacts', 'migration');
has(files.migration, 'repository.view', 'migration');
has(files.migration, "'route_api_repository_artefacts_post'", 'migration');
has(files.migration, 'trg_repository_seed_topic_taxonomy', 'migration');
has(files.migration, 'trg_repository_seed_recommendation_taxonomy', 'migration');
has(files.migration, 'Reduce avoidable workflow friction', 'migration');
has(files.migration, 'Explain confidence and next steps', 'migration');
has(files.migration, 'State evidence limits before reuse', 'migration');
has(files.seedMigration, 'Seed curated research repository records for realistic product evaluation.', 'seed migration');
has(files.seedMigration, "'staff-evidence-boundaries'", 'seed migration');
has(files.seedMigration, "'check-answers-review-anxiety'", 'seed migration');
has(files.seedMigration, "'consent-state-workarounds'", 'seed migration');
has(files.seedMigration, "'lightweight-capture-before-tagging'", 'seed migration');
has(files.seedMigration, "'candidate-assisted-digital-escalation'", 'seed migration');
has(files.seedMigration, "'withdrawn-outdated-channel-insight'", 'seed migration');
has(files.seedMigration, "'rec-show-triage-reason-in-queue'", 'seed migration');
has(files.seedMigration, '"publishedArtefacts":100', 'seed migration');
has(files.seedMigration, '"candidateArtefacts":20', 'seed migration');
has(files.seedMigration, '"withdrawnArtefacts":10', 'seed migration');
has(files.seedMigration, "printf('seeded-published-%03d', rn)", 'seed migration');
has(files.seedMigration, "printf('seeded-candidate-%03d', value)", 'seed migration');
has(files.seedMigration, "printf('seeded-withdrawn-%03d', value)", 'seed migration');
lacks(files.seedMigration, '@example', 'seed migration');
lacks(files.seedMigration, 'recording_url', 'seed migration');
has(files.seedTagMigration, 'Replace generated seed labels with production-like repository taxonomy labels.', 'seed tag migration');
has(files.seedTagMigration, 'Confidence and comprehension', 'seed tag migration');
has(files.seedTagMigration, 'Workflow friction', 'seed tag migration');
has(files.seedTagMigration, 'Governance and consent', 'seed tag migration');
has(files.seedTagMigration, 'Clarify handoff owner and next action', 'seed tag migration');
has(files.seedTagMigration, 'Make recovery routes explicit', 'seed tag migration');
has(files.seedTagMigration, 'State evidence limits before reuse', 'seed tag migration');
lacks(files.seedTagMigration, 'Seeded topic', 'seed tag migration');
lacks(files.seedTagMigration, 'Seeded recommendation', 'seed tag migration');

has(files.stylesheet, '.repository-search-panel__row', 'stylesheet');
has(files.stylesheet, 'align-items: flex-end', 'stylesheet');
has(files.stylesheet, '.repository-metric__number,', 'stylesheet');
has(files.stylesheet, '.repository-metric__label', 'stylesheet');
has(files.stylesheet, '.repository-browse-list__button', 'stylesheet');
has(files.stylesheet, '.repository-candidate-form', 'stylesheet');
lacks(files.stylesheet, 'font-size: 36px', 'stylesheet');
lacks(files.stylesheet, 'font-weight: 700', 'stylesheet');
lacks(files.stylesheet, 'line-height: 1', 'stylesheet');
lacks(files.stylesheet, 'repository-assurance', 'stylesheet');

has(files.visualWalkthrough, "registeredPage('repository'", 'visual walkthrough registry');
has(files.visualWalkthrough, "registeredPage('repository-service-areas'", 'visual walkthrough registry');
has(files.visualWalkthrough, "registeredPage('repository-artefact-detail'", 'visual walkthrough registry');
has(files.visualWalkthrough, "registeredPage('repository-artefact-staff-evidence-boundaries'", 'visual walkthrough registry');
has(files.gitignore, 'public/css/repository.css', 'gitignore');
has(files.gitignore, 'public/pages/repository/', 'gitignore');
has(files.lychee, '^/api/repository(?:/.*)?(?:\\?.*)?$', 'Lychee config');
has(files.qaLinks, 'Build generated pages and assets', 'Lychee workflow');
has(files.qaLinks, 'npm run build', 'Lychee workflow');

const deployWorkerPreview = workflowSection(files.deployWorker, '  deploy-preview:', null);
const deployWorkerProduction = workflowSection(files.deployWorker, '  deploy-production:', '  deploy-preview:');
has(files.deployWorker, 'REPOSITORY_SCHEMA_MIGRATION: "infra/cloudflare/migrations/0014_research_repository.sql"', 'Deploy Worker workflow');
has(files.deployWorker, 'REPOSITORY_SEED_MIGRATION: "infra/cloudflare/migrations/0015_seed_research_repository.sql"', 'Deploy Worker workflow');
has(deployWorkerPreview, 'Apply repository seed migrations to preview D1', 'Deploy Worker preview job');
has(deployWorkerPreview, 'd1 execute "${D1_PREVIEW_DATABASE_NAME}"', 'Deploy Worker preview job');
has(deployWorkerPreview, '--file "${REPOSITORY_SCHEMA_MIGRATION}"', 'Deploy Worker preview job');
has(deployWorkerPreview, '--file "${REPOSITORY_SEED_MIGRATION}"', 'Deploy Worker preview job');
lacks(deployWorkerProduction, '--file "${REPOSITORY_SEED_MIGRATION}"', 'Deploy Worker production job');
has(files.passwordlessPreviewWorker, 'REPOSITORY_SCHEMA_MIGRATION: "infra/cloudflare/migrations/0014_research_repository.sql"', 'Passwordless preview Worker workflow');
has(files.passwordlessPreviewWorker, 'REPOSITORY_SEED_MIGRATION: "infra/cloudflare/migrations/0015_seed_research_repository.sql"', 'Passwordless preview Worker workflow');
has(files.passwordlessPreviewWorker, 'Apply repository seed migrations to remote D1', 'Passwordless preview Worker workflow');
has(files.passwordlessPreviewWorker, '--file "${REPOSITORY_SCHEMA_MIGRATION}"', 'Passwordless preview Worker workflow');
has(files.passwordlessPreviewWorker, '--file "${REPOSITORY_SEED_MIGRATION}"', 'Passwordless preview Worker workflow');
