import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = {
	template: fs.readFileSync('src/govuk/templates/pages/repository.njk', 'utf8'),
	pageData: fs.readFileSync('src/govuk/data/repository-page.mjs', 'utf8'),
	staticScript: fs.readFileSync('public/js/repository-static-page.js', 'utf8'),
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
has(files.template, 'repository-page.js?v=repository-api-20260607', 'repository template');
has(files.template, 'class="govuk-heading-xl govuk-!-margin-bottom-1 repository-metric__number"', 'repository template');
has(files.template, 'class="govuk-body repository-metric__label"', 'repository template');
lacks(files.template, 'Technical detail', 'repository template');
lacks(files.template, 'Repository status', 'repository template');

has(files.pageData, "slug: 'user-groups'", 'page data');
has(files.pageData, "browseType: 'user_group'", 'page data');
lacks(files.pageData, 'teamDecisions', 'page data');
lacks(files.pageData, 'artefacts: [', 'page data');

has(files.staticScript, '["frontline-staff", "Frontline staff"]', 'static page script');
has(files.staticScript, '["assisted-digital-users", "Assisted digital users"]', 'static page script');
has(files.staticScript, '["research-operations-staff", "Research operations staff"]', 'static page script');

has(files.schemaMigration, 'CREATE TABLE IF NOT EXISTS rops_repository_artefacts', 'schema migration');
has(files.schemaMigration, 'trg_repository_seed_topic_taxonomy', 'schema migration');
has(files.schemaMigration, 'trg_repository_seed_recommendation_taxonomy', 'schema migration');
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
has(files.passwordlessPreviewWorker, 'REPOSITORY_SCHEMA_MIGRATION: "infra/cloudflare/migrations/0014_research_repository.sql"', 'passwordless preview workflow');
has(files.passwordlessPreviewWorker, 'REPOSITORY_SEED_MIGRATION: "infra/cloudflare/migrations/0015_seed_research_repository.sql"', 'passwordless preview workflow');

has(files.gitignore, 'public/css/repository.css', 'gitignore');
has(files.gitignore, 'public/pages/repository/', 'gitignore');
has(files.lychee, '/api/repository', 'Lychee config');
