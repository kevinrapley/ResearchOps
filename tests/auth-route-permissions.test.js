import assert from "node:assert/strict";
import {
  assertRoutePermission,
  resolveRoutePermissionDeclaration,
  routePermissionErrorResponse,
} from "../infra/cloudflare/src/core/auth/route-permissions.js";

function createD1(declaration) {
  return {
    prepare() {
      return {
        bind(method, pathname) {
          return {
            async first() {
              if (!declaration) return null;

              return {
                method,
                route_pattern: pathname,
                required_permissions_json:
                  declaration.required_permissions_json ?? "[]",
                auth_required: declaration.auth_required ?? 1,
                implementation_status:
                  declaration.implementation_status ?? "implemented",
              };
            },
          };
        },
      };
    },
  };
}

function requestFor(path, method = "GET") {
  return new Request(`https://worker.test${path}`, { method });
}

async function assertDeclaredRouteIsResolved() {
  const env = {
    RESEARCHOPS_D1: createD1({
      required_permissions_json: '["audit.view"]',
      auth_required: 1,
    }),
  };

  const declaration = await resolveRoutePermissionDeclaration(
    requestFor("/api/audit/team-events"),
    env,
  );

  assert.equal(declaration.method, "GET");
  assert.equal(declaration.routePattern, "/api/audit/team-events");
  assert.deepEqual(declaration.requiredPermissions, ["audit.view"]);
  assert.equal(declaration.authRequired, true);
}

async function assertMissingRouteFailsClosed() {
  const env = { RESEARCHOPS_D1: createD1(null) };

  try {
    await assertRoutePermission(requestFor("/api/unknown-protected-route"), env, {
      authenticated: true,
      permissions: [{ code: "audit.view" }],
    });
    assert.fail("Expected missing route permission declaration to fail closed");
  } catch (error) {
    const response = routePermissionErrorResponse(error);
    assert.equal(response.status, 403);

    const body = await response.json();
    assert.equal(body.ok, false);
    assert.equal(body.error, "route_permission_missing");
    assert.equal(Object.hasOwn(body, "details"), false);
  }
}

async function assertMissingPermissionIsDeniedWithoutDetails() {
  const env = {
    RESEARCHOPS_D1: createD1({
      required_permissions_json: '["safeguarding.audit.view"]',
      auth_required: 1,
    }),
  };

  try {
    await assertRoutePermission(requestFor("/api/safeguarding/audit"), env, {
      authenticated: true,
      permissions: [{ code: "audit.view" }],
    });
    assert.fail("Expected missing safeguarding permission to be denied");
  } catch (error) {
    const response = routePermissionErrorResponse(error);
    assert.equal(response.status, 403);

    const body = await response.json();
    assert.equal(body.ok, false);
    assert.equal(body.error, "permission_denied");
    assert.equal(Object.hasOwn(body, "details"), false);
  }
}

async function assertDiagnosticsCanIncludeMissingPermissionCodes() {
  const env = {
    RESEARCHOPS_D1: createD1({
      required_permissions_json: '["role.assign"]',
      auth_required: 1,
    }),
  };

  try {
    await assertRoutePermission(
      requestFor("/api/auth/role-assignments", "POST"),
      env,
      {
        authenticated: true,
        permissions: [],
      },
    );
    assert.fail("Expected role assignment permission to be denied");
  } catch (error) {
    const response = routePermissionErrorResponse(error, {
      includeDiagnostics: true,
    });
    assert.equal(response.status, 403);

    const body = await response.json();
    assert.deepEqual(body.details.missingPermissions, ["role.assign"]);
  }
}

async function assertMatchingPermissionAllowsRoute() {
  const env = {
    RESEARCHOPS_D1: createD1({
      required_permissions_json: '["audit.view"]',
      auth_required: 1,
    }),
  };

  const declaration = await assertRoutePermission(
    requestFor("/api/audit/team-events"),
    env,
    {
      authenticated: true,
      permissions: [{ code: "audit.view" }],
    },
  );

  assert.equal(declaration.routePattern, "/api/audit/team-events");
  assert.deepEqual(declaration.requiredPermissions, ["audit.view"]);
}

await assertDeclaredRouteIsResolved();
await assertMissingRouteFailsClosed();
await assertMissingPermissionIsDeniedWithoutDetails();
await assertDiagnosticsCanIncludeMissingPermissionCodes();
await assertMatchingPermissionAllowsRoute();
