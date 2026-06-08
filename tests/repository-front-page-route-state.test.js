import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = {
	template: fs.readFileSync('src/govuk/templates/pages/repository.njk', 'utf8'),
	staticTemplate: fs.readFileSync('src/govuk/templates/pages/repository-static.njk', 'utf8'),
	pageData: fs.readFileSync('src/govuk/data/repository-page.mjs', 'utf8'),
	pageScript: fs.readFileSync('public/js/repository-page.js', 'utf8'),
	staticScript: fs.readFileSync('public/js/repository-static-page.js', 'utf8'),
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
has(files.template, "params.set('hydrate', 'full')", 'repository template');
has(files.template, 'class="govuk-heading-xl govuk-!-margin-bottom-1 repository-metric__number"', 'repository template');
has(files.template, 'class="govuk-body repository-metric__label"', 'repository template');
has(files.template, 'id="repository-curator-workbench"', 'repository template');
has(files.template, "{ value: 'interviews', text: 'Moderated interviews' }", 'repository template');
lacks(files.template, 'Technical detail', 'repository template');
lacks(files.template, 'Repository status', 'repository template');

has(files.staticTemplate, 'repository-selected-state', 'static repository template');
has(files.staticTemplate, 'repository-sort-form', 'static repository template');
has(files.staticTemplate, 'repository-pagination', 'static repository template');
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
has(files.service, 'const method = searchValues(url, "method")', 'repository service');
lacks(files.service, 'String(error?.message || error) }, 503', 'repository service');

has(files.schemaMigration, 'CREATE TABLE IF NOT EXISTS rops_repository_artefacts', 'schema migration');
has(files.schemaMigration, "DELETE FROM rops_repository_artefact_tags", 'schema migration');
has(files.seedMigration, 'Seed curated research repository records for realistic product evaluation.', 'seed migration');
has(files.seedMigration, "printf('seeded-published-%03d', rn)", 'seed migration');
lacks(files.seedMigration, 'recording_url', 'seed migration');
has(files.seedCleanupMigration, 'Remove generated seed tags', 'seed cleanup migration');
has(files.seedCleanupMigration, "tag_type = 'topic'", 'seed cleanup migration');
has(files.seedCleanupMigration, "tag_type = 'recommendation'", 'seed cleanup migration');
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
