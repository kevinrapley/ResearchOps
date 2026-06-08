import assert from 'node:assert/strict';
import fs from 'node:fs';

const schemaMigration = fs.readFileSync(
	'infra/cloudflare/migrations/0014_research_repository.sql',
	'utf8'
);
const taxonomyMigration = fs.readFileSync(
	'infra/cloudflare/migrations/0016_update_repository_seed_tag_taxonomy.sql',
	'utf8'
);
const staticPageScript = fs.readFileSync('public/js/repository-static/shared.js', 'utf8');

function includes(source, expected, label) {
	assert.equal(source.includes(expected), true, `${label} should include ${expected}`);
}

function excludes(source, unexpected, label) {
	assert.equal(source.includes(unexpected), false, `${label} should not include ${unexpected}`);
}

includes(schemaMigration, 'trg_repository_seed_user_group_taxonomy', 'schema migration');
includes(schemaMigration, "user_group = 'research-operations-staff'", 'schema migration');
includes(
	schemaMigration,
	"REPLACE(title, 'ResearchOps reviewers', 'research operations staff')",
	'schema migration'
);
includes(schemaMigration, 'trg_repository_seed_topic_taxonomy', 'schema migration');
includes(schemaMigration, 'trg_repository_seed_recommendation_taxonomy', 'schema migration');
includes(schemaMigration, 'Confidence and comprehension', 'schema migration');
includes(schemaMigration, 'Workflow friction', 'schema migration');
includes(schemaMigration, 'State evidence limits before reuse', 'schema migration');

includes(taxonomyMigration, "user_group = 'research-operations-staff'", 'taxonomy migration');
includes(taxonomyMigration, "tag_type = 'topic'", 'taxonomy migration');
includes(taxonomyMigration, "tag_type = 'recommendation'", 'taxonomy migration');
includes(taxonomyMigration, 'remove_repository_seed_tags', 'taxonomy migration');
excludes(taxonomyMigration, 'Seeded topic', 'taxonomy migration');
excludes(taxonomyMigration, 'Seeded recommendation', 'taxonomy migration');
excludes(taxonomyMigration, 'Confidence and comprehension', 'taxonomy migration');
excludes(taxonomyMigration, 'Workflow friction', 'taxonomy migration');
excludes(taxonomyMigration, 'State evidence limits before reuse', 'taxonomy migration');

includes(staticPageScript, '["frontline-staff", "Frontline staff"]', 'static page script');
includes(
	staticPageScript,
	'["assisted-digital-users", "Assisted digital users"]',
	'static page script'
);
includes(staticPageScript, '["public-users", "Public users"]', 'static page script');
includes(
	staticPageScript,
	'["research-operations-team", "Research operations staff"]',
	'static page script'
);
includes(
	staticPageScript,
	'["research-operations-staff", "Research operations staff"]',
	'static page script'
);
excludes(staticPageScript, 'UpperCase()}${part.slice(1)}', 'static page script');
