import assert from "node:assert/strict";
import fs from "node:fs";
import worker from "../infra/cloudflare/src/worker.js";

const env = {
  ALLOWED_ORIGINS: "https://researchops.pages.dev",
};

async function readJson(response) {
  return response.json();
}

async function assertMeRouteFailsClosedWithoutAccessToken() {
  const response = await worker.fetch(
    new Request("https://worker.test/api/me"),
    env,
    {},
  );

  assert.equal(response.status, 401);

  const payload = await readJson(response);
  assert.equal(payload.ok, false);
  assert.equal(payload.error, "authentication_required");
}

async function assertPermissionsRouteFailsClosedWithoutAccessToken() {
  const response = await worker.fetch(
    new Request("https://worker.test/api/me/permissions"),
    env,
    {},
  );

  assert.equal(response.status, 401);

  const payload = await readJson(response);
  assert.equal(payload.ok, false);
  assert.equal(payload.error, "authentication_required");
}

function assertWorkerRoutesAuthThroughScopedAccessResolver() {
  const workerSource = fs.readFileSync("infra/cloudflare/src/worker.js", "utf8");

  assert.match(
    workerSource,
    /import \{ handleMeRoute \} from "\.\/core\/auth\/access-scoped\.js";/,
  );
  assert.match(workerSource, /apiPath === "\/api\/me"/);
  assert.match(workerSource, /apiPath === "\/api\/me\/permissions"/);
}

function assertIdentityRoutesUseRoutePermissions() {
  const authSource = fs.readFileSync(
    "infra/cloudflare/src/core/auth/access-scoped.js",
    "utf8",
  );

  assert.match(authSource, /assertRoutePermission/);
  assert.match(authSource, /routePermissionErrorResponse/);
  assert.match(authSource, /await assertRoutePermission\(request, env, context\)/);
}

function assertNoMockIdentityModeExists() {
  const authSource = fs.readFileSync(
    "infra/cloudflare/src/core/auth/access.js",
    "utf8",
  );

  assert.equal(authSource.includes("RESEARCHOPS_AUTH_MODE"), false);
  assert.equal(authSource.includes("MOCK"), false);
  assert.equal(authSource.includes("mock"), false);
}

function assertMigrationContainsRequiredControlPlaneTables() {
  const migration = fs.readFileSync(
    "infra/cloudflare/migrations/0001_auth_foundation.sql",
    "utf8",
  );

  for (const tableName of [
    "auth_users",
    "auth_identities",
    "auth_teams",
    "auth_team_memberships",
    "auth_permissions",
    "auth_roles",
    "auth_role_permissions",
    "auth_role_assignments",
    "auth_permission_exceptions",
    "auth_events",
    "auth_audit_events",
    "auth_route_permissions",
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${tableName}`));
  }

  assert.match(
    migration,
    /scope_type TEXT NOT NULL CHECK \(scope_type IN \('team', 'project', 'study'\)\)/,
  );
  assert.match(migration, /scope_id TEXT NOT NULL/);
  assert.match(migration, /safeguarding\.audit\.view/);
  assert.match(migration, /audit\.export/);
  assert.match(migration, /participant\.pii\.export/);
}

await assertMeRouteFailsClosedWithoutAccessToken();
await assertPermissionsRouteFailsClosedWithoutAccessToken();
assertWorkerRoutesAuthThroughScopedAccessResolver();
assertIdentityRoutesUseRoutePermissions();
assertNoMockIdentityModeExists();
assertMigrationContainsRequiredControlPlaneTables();
