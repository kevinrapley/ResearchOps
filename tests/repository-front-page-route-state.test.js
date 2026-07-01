import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = {
	headerPartial: fs.readFileSync('public/partials/header.html', 'utf8'),
	layout: fs.readFileSync('src/govuk/templates/layouts/researchops.njk', 'utf8'),
	renderPages: fs.readFileSync('scripts/govuk/render-govuk-pages.mjs', 'utf8'),
	normalisePages: fs.readFileSync('scripts/govuk/normalise-service-pages.mjs', 'utf8'),
	template: fs.readFileSync('src/govuk/templates/pages/repository.njk', 'utf8'),
	staticTemplate: fs.readFileSync('src/govuk/templates/pages/repository-static.njk', 'utf8'),
	repositoryMacro: fs.readFileSync('src/govuk/templates/macros/repository.njk', 'utf8'),
	pageData: fs.readFileSync('src/govuk/data/repository-page.mjs', 'utf8'),
	styles: fs.readFileSync('src/styles/repository.scss', 'utf8'),
	heroStyles: fs.readFileSync('src/styles/_hero-phase-banner.scss', 'utf8'),
	compiledStyles: fs.readFileSync('public/css/repository.css', 'utf8'),
	pageScript: fs.readFileSync('public/js/repository-page.js', 'utf8'),
	staticScript: [
		'public/js/repository-static-page.js',
		'public/js/repository-static/shared.js',
		'public/js/repository-static/browse.js',
		'public/js/repository-static/candidate.js',
		'public/js/repository-static/review.js',
	]
		.map((file) => fs.readFileSync(file, 'utf8'))
		.join('\n'),
	artefactScript: fs.readFileSync('public/js/repository-artefact-page.js', 'utf8'),
	service: fs.readFileSync('infra/cloudflare/src/service/repository.js', 'utf8'),
	schemaMigration: fs.readFileSync('infra/cloudflare/migrations/0014_research_repository.sql', 'utf8'),
	seedMigration: fs.readFileSync('infra/cloudflare/migrations/0015_seed_research_repository.sql', 'utf8'),
	seedCleanupMigration: fs.readFileSync(
		'infra/cloudflare/migrations/0016_update_repository_seed_tag_taxonomy.sql',
		'utf8'
	),
	deployWorker: fs.readFileSync('.github/workflows/deploy-worker.yml', 'utf8'),
	passwordlessPreviewWorker: fs.readFileSync(
		'.github/workflows/deploy-passwordless-preview-worker.yml',
		'utf8'
	),
	gitignore: fs.readFileSync('.gitignore', 'utf8'),
	lychee: fs.readFileSync('lychee.toml', 'utf8'),
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

has(files.template, 'Research repository', 'repository template');
has(files.template, 'Published artefacts', 'repository template');
has(files.template, 'repository-page.js?v=repository-api-20260607c', 'repository template');
has(files.template, 'repository.css?v=repository-hero-seam-20260626', 'repository template');
has(files.template, "params.set('hydrate', 'full')", 'repository template');
has(files.template, '<div class="app-masthead repository-masthead">', 'repository template');
has(files.template, '{{ repositoryHero(hero) }}', 'repository template');
has(files.template, 'class="govuk-heading-xl govuk-!-margin-bottom-1 repository-metric__number"', 'repository template');
has(files.template, 'class="govuk-body repository-metric__label"', 'repository template');
has(files.template, 'id="repository-curator-workbench"', 'repository template');
has(files.template, "{ value: 'interviews', text: 'Moderated interviews' }", 'repository template');
has(files.template, "name: 'maturity'", 'repository template');
has(files.template, "text: 'Evidence maturity'", 'repository template');
has(files.template, "text: 'Apply filters'", 'repository template');
lacks(files.template, 'Technical detail', 'repository template');
lacks(files.template, 'Repository status', 'repository template');

has(files.headerPartial, '<header class="govuk-template__header govuk-header" role="banner" data-module="govuk-header">', 'header partial');
lacks(files.headerPartial, '<div class="govuk-header" role="banner" data-module="govuk-header">', 'header partial');
has(files.headerPartial, '<section class="govuk-service-navigation"', 'header partial');
has(files.headerPartial, '</section>\n</header>', 'header partial');

has(files.layout, '<body class="govuk-template__body{% if bodyClass %} {{ bodyClass }}{% endif %}">', 'shared researchops layout');
has(files.renderPages, "bodyClass: 'researchops-repository-front-page'", 'GOV.UK page renderer');
has(files.normalisePages, "mergeClassValue(classMatch[1], 'govuk-template__body')", 'GOV.UK page normaliser');

has(files.repositoryMacro, 'repository-hero__image-column', 'repository macro');
has(files.repositoryMacro, 'src="/images/repository-masthead-illustration.svg"', 'repository macro');
has(files.repositoryMacro, 'role="presentation"', 'repository macro');

has(files.styles, '.repository-filter-panel .govuk-button--secondary', 'repository stylesheet');
has(files.styles, 'background: #ffffff;', 'repository stylesheet');
has(files.styles, '.researchops-repository-front-page', 'repository stylesheet');
has(files.styles, '.repository-masthead', 'repository stylesheet');
has(files.styles, 'border-bottom: 10px solid var(--govuk-brand-colour, #1d70b8);', 'repository stylesheet');
has(files.styles, 'background: var(--govuk-brand-colour, #1d70b8);', 'repository stylesheet');
has(files.styles, '.repository-masthead .govuk-breadcrumbs__link', 'repository stylesheet');
has(files.styles, "@use 'hero-phase-banner' as hero;", 'repository stylesheet');
has(
	files.styles,
	"@include hero.researchops-hero-page('.researchops-repository-front-page', 'Research Repository');",
	'repository stylesheet'
);
has(files.heroStyles, '@mixin researchops-hero-page($page-selector, $active-nav)', 'shared hero stylesheet');
has(
	files.compiledStyles,
	'.researchops-repository-front-page .govuk-template__header .govuk-service-navigation[data-active="Research Repository"]',
	'compiled repository stylesheet'
);
has(
	files.compiledStyles,
	'border-bottom: 1px solid rgba(255, 255, 255, 0.35);',
	'compiled repository stylesheet'
);
has(
	files.compiledStyles,
	'.researchops-repository-front-page .govuk-phase-banner__content',
	'compiled repository stylesheet'
);
has(files.compiledStyles, 'clip-path: inset(0 -100vmax -1px);', 'compiled repository stylesheet');
has(files.styles, '.repository-hero__image-column', 'repository stylesheet');
has(files.styles, '@media (min-width: 48.0625em)', 'repository stylesheet');


has(files.staticTemplate, 'repository-selected-state', 'static repository template');
lacks(files.staticTemplate, 'researchops-repository-front-page', 'static repository template');
has(files.staticTemplate, 'repository-sort-form', 'static repository template');
has(files.staticTemplate, 'repository-pagination', 'static repository template');
has(files.staticTemplate, 'id="candidate-confidence" name="confidence"', 'static repository template');
has(files.staticTemplate, 'id="candidate-evidence-maturity" name="evidenceMaturity"', 'static repository template');
has(files.staticTemplate, 'id="candidate-source-synthesis-id" name="sourceSynthesisId"', 'static repository template');
has(files.staticTemplate, 'id="candidate-impact-record-id" name="impactRecordId"', 'static repository template');
has(files.staticTemplate, 'Do not paste sensitive internal decision links', 'static repository template');
has(files.staticTemplate, "{{ resultsHeading or 'Published artefacts' }}", 'static repository template');
lacks(files.staticTemplate, 'Published evidence', 'static repository template');

has(files.pageData, "title: 'Browse by user group'", 'page data');
has(files.pageData, "resultsHeading: 'Published artefacts'", 'page data');
has(files.pageData, "browseType: 'user_group'", 'page data');
lacks(files.pageData, 'teamDecisions', 'page data');
lacks(files.pageData, 'artefacts: [', 'page data');

has(files.pageScript, 'function displayTags', 'repository page script');
has(files.pageScript, 'const workbench = document.getElementById("repository-curator-workbench");', 'repository page script');
has(files.pageScript, 'if (workbench) workbench.hidden = !canCurate;', 'repository page script');
has(files.pageScript, '!/seeded/i.test(text(tag.text))', 'repository page script');
has(files.pageScript, 'fetchWithTimeout(repositoryRequestUrl(params))', 'repository page script');
has(files.pageScript, 'let latestRepositoryRequest = 0', 'repository page script');
has(files.pageScript, 'let repositoryCatalogue = null', 'repository page script');
has(files.pageScript, 'next.set("hydrate", "full")', 'repository page script');
has(files.pageScript, 'if (repositoryCatalogue)', 'repository page script');
has(files.pageScript, 'renderRepositoryState(localRepositoryState(params))', 'repository page script');
has(files.pageScript, 'window.__repositoryPrefetch', 'repository page script');
has(files.pageScript, 'window.history.pushState', 'repository page script');
has(files.pageScript, 'params.append(input.name, input.value)', 'repository page script');
has(files.staticScript, 'selectedValueFor(type)', 'static page script');
has(files.staticScript, 'renderSelectedState(selected)', 'static page script');
has(files.staticScript, 'renderPagination(type, value', 'static page script');
has(files.staticScript, 'repository-result-meta', 'static page script');
has(files.staticScript, 'Showing artefacts tagged to:', 'static page script');
has(files.staticScript, 'limit: String(PAGE_SIZE)', 'static page script');
has(files.staticScript, 'async function loadBrowseState(page)', 'static page script');
has(files.staticScript, 'window.__repositoryPrefetch', 'static page script');
has(files.staticScript, 'repositoryJson(requestPath)', 'static page script');
has(files.staticScript, 'window.history.pushState', 'static page script');
has(files.staticScript, 'window.addEventListener("popstate"', 'static page script');
has(files.staticScript, 'function candidatePrefillFromQuery()', 'static page script');
has(files.staticScript, '["sourceSynthesisId", ["sourceSynthesisId", "sourceRecommendationId", "synthesisId", "recommendationId"]]', 'static page script');
has(files.staticScript, '["impactRecordId", ["impactRecordId", "impactId", "impactRef"]]', 'static page script');
has(files.staticScript, 'applyCandidatePrefill(form)', 'static page script');
has(files.staticScript, '["frontline-staff", "Frontline staff"]', 'static page script');
has(files.staticScript, '["assisted-digital-users", "Assisted digital users"]', 'static page script');
has(files.staticScript, '["research-operations-staff", "Research operations staff"]', 'static page script');
has(files.artefactScript, 'function displayTags', 'artefact page script');
has(files.artefactScript, '!/seeded/i.test(text(tag.text))', 'artefact page script');
lacks(files.artefactScript, '!/confidence$/i.test(text(tag.text))', 'artefact page script');

has(files.service, 'const ARTEFACTS_TABLE = "rops_repository_artefacts"', 'repository service');
has(files.service, 'function selectedFacet', 'repository service');
has(files.service, 'function pagination', 'repository service');
has(files.service, 'const schemaReadyByDatabase = new WeakMap()', 'repository service');
has(files.service, 'const publishedSnapshotByDatabase = new WeakMap()', 'repository service');
has(files.service, 'const PUBLISHED_SNAPSHOT_TTL_MS = 30_000', 'repository service');
has(files.service, 'const filtered = sortArtefacts(allArtefacts.filter((artefact) => matchesSearch(artefact, url)), sort);', 'repository service');
has(files.service, 'const queues = showQueues ? await repositoryQueues(svc) : [];', 'repository service');
has(files.service, 'pagination: { page: pager.page, limit: pager.limit, total: pager.total }', 'repository service');
has(files.service, 'selected: selectedFacet(url)', 'repository service');
has(files.service, 'catalogue: hydrate === HYDRATE_FULL_MODE ? { artefacts: allArtefacts } : undefined', 'repository service');
has(files.service, 'const HYDRATE_FULL_MODE = "full"', 'repository service');
has(files.service, 'const snapshot = await publishedRepositorySnapshot(svc);', 'repository service');
has(files.service, 'invalidateRepositorySnapshotCache(svc);', 'repository service');
has(files.service, 'sourceProvenance: {', 'repository service');
has(files.service, 'sourceSynthesisOrRecommendationId: sourceSynthesisId', 'repository service');
has(files.service, 'impactSourceFromPayload(payload)', 'repository service');
has(files.service, 'if (impactSource) artefact.impactSource = impactSource;', 'repository service');
has(files.service, 'candidateDraft: {', 'repository service');
has(files.service, 'pii: "pending"', 'repository service');
has(files.service, 'consent: "pending"', 'repository service');
has(files.service, 'const method = searchValues(url, "method")', 'repository service');
has(
	files.service,
	'facetFromArtefacts(allArtefacts, "maturity", "Evidence maturity", "evidenceMaturity")',
	'repository service'
);
lacks(files.service, 'facetFromArtefacts(allArtefacts, "evidence_maturity", "Evidence maturity", "evidenceMaturity")', 'repository service');
lacks(files.service, 'String(error?.message || error) }, 503', 'repository service');

has(files.schemaMigration, 'CREATE TABLE IF NOT EXISTS rops_repository_artefacts', 'schema migration');
has(files.schemaMigration, "DELETE FROM rops_repository_artefact_tags", 'schema migration');
has(files.schemaMigration, "source_project_id LIKE 'proj-seeded-%'", 'schema migration');
has(files.seedMigration, 'Seed curated research repository records for realistic product evaluation.', 'seed migration');
has(files.seedMigration, "printf('%s-%s-%s-%s', service_area, user_group, method, risk_area)", 'seed migration');
has(files.seedMigration, "id LIKE 'seeded-published-%'", 'seed migration');
has(files.seedMigration, "source_project_id LIKE 'proj-seeded-%'", 'seed migration');
lacks(files.seedMigration, "printf('seeded-published-%03d', rn)", 'seed migration');
lacks(files.seedMigration, 'recording_url', 'seed migration');
has(files.seedCleanupMigration, 'Remove generated seed tags', 'seed cleanup migration');
has(files.seedCleanupMigration, "tag_type = 'topic'", 'seed cleanup migration');
has(files.seedCleanupMigration, "tag_type = 'recommendation'", 'seed cleanup migration');
has(files.seedCleanupMigration, "source_project_id LIKE 'proj-seeded-%'", 'seed cleanup migration');
has(files.seedCleanupMigration, 'remove_repository_seed_tags', 'seed cleanup migration');
lacks(files.seedCleanupMigration, 'Seeded topic', 'seed cleanup migration');
lacks(files.seedCleanupMigration, 'Seeded recommendation', 'seed cleanup migration');
lacks(files.seedCleanupMigration, 'Confidence and comprehension', 'seed cleanup migration');

const deployWorkerPreview = workflowSection(files.deployWorker, '  deploy-preview:', null);
const deployWorkerProduction = workflowSection(files.deployWorker, '  deploy-production:', '  deploy-preview:');
has(files.deployWorker, 'REPOSITORY_SCHEMA_MIGRATION: "infra/cloudflare/migrations/0014_research_repository.sql"', 'deploy workflow');
has(files.deployWorker, 'REPOSITORY_SEED_MIGRATION: "infra/cloudflare/migrations/0015_seed_research_repository.sql"', 'deploy workflow');
has(files.deployWorker, 'REPOSITORY_SEED_CLEANUP_MIGRATION: "infra/cloudflare/migrations/0016_update_repository_seed_tag_taxonomy.sql"', 'deploy workflow');
has(deployWorkerPreview, '--file "${REPOSITORY_SEED_CLEANUP_MIGRATION}"', 'deploy preview workflow');
lacks(deployWorkerProduction, '--file "${REPOSITORY_SEED_MIGRATION}"', 'deploy production workflow');
has(
	files.passwordlessPreviewWorker,
	'REPOSITORY_SEED_CLEANUP_MIGRATION: "infra/cloudflare/migrations/0016_update_repository_seed_tag_taxonomy.sql"',
	'passwordless preview workflow'
);
has(
	files.passwordlessPreviewWorker,
	'--file "${REPOSITORY_SEED_CLEANUP_MIGRATION}"',
	'passwordless preview workflow'
);

has(files.gitignore, 'public/css/repository.css', 'gitignore');
has(files.gitignore, 'public/pages/repository/', 'gitignore');
has(files.lychee, '/api/repository', 'Lychee config');
