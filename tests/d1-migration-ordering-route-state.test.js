import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const migrationsDirectory = 'infra/cloudflare/migrations';
const orderingPolicy = fs.readFileSync('docs/deployment/d1-migration-ordering.md', 'utf8');
const mainMigrations = fs
	.readdirSync(migrationsDirectory)
	.filter((fileName) => fileName.endsWith('.sql'))
	.sort();

const allowedHistoricalDuplicatePrefixes = new Map([
	['0004', ['0004_auth_identity_route.sql', '0004_auth_login_challenges_locked_status.sql']],
	['0005', ['0005_auth_registration_requests.sql', '0005_auth_team_access_requests.sql']],
]);

const migrationsByPrefix = new Map();

for (const fileName of mainMigrations) {
	const match = fileName.match(/^(\d{4})_[a-z0-9_]+\.sql$/);
	assert.ok(match, `Expected main D1 migration to use a four-digit numeric prefix: ${fileName}`);

	const prefix = match[1];
	const migrations = migrationsByPrefix.get(prefix) || [];
	migrations.push(fileName);
	migrationsByPrefix.set(prefix, migrations);
}

for (const [prefix, migrations] of migrationsByPrefix.entries()) {
	if (migrations.length === 1) continue;

	assert.deepEqual(
		migrations,
		allowedHistoricalDuplicatePrefixes.get(prefix),
		`Unexpected duplicate main D1 migration prefix ${prefix}`
	);
}

const highestMainPrefix = Math.max(...mainMigrations.map((fileName) => Number(fileName.slice(0, 4))));
const nextMainPrefix = String(highestMainPrefix + 1).padStart(4, '0');

for (const snippet of [
	'Future main D1 migrations must use a new, monotonically increasing four-digit prefix',
	'Existing duplicate prefixes `0004` and `0005` are historical',
	'Do not rename or renumber already-applied migration files',
	`The next main migration prefix after ${path.basename(mainMigrations.at(-1))} is \`${nextMainPrefix}\``,
	'Preview seed migrations under `infra/cloudflare/migrations/preview/` use an independent sequence',
]) {
	assert.ok(orderingPolicy.includes(snippet), `Expected D1 migration ordering policy to include: ${snippet}`);
}
