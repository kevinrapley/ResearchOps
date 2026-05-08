const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff"
};

class RoutePermissionError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function dbFor(env = {}) {
  const db = env.RESEARCHOPS_D1;
  if (!db || typeof db.prepare !== "function") {
    throw new RoutePermissionError(
      503,
      "route_permission_store_unavailable",
      "Route permissions cannot be checked right now."
    );
  }
  return db;
}

function normalisePath(pathname) {
  let path = pathname || "/";
  path = path.replace(/\/{2,}/g, "/");
  if (path.startsWith("/api/") && path.endsWith("/") && path !== "/api/") {
    path = path.slice(0, -1);
  }
  return path;
}

function parsePermissions(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((permission) => typeof permission === "string" && permission.trim())
      : [];
  } catch {
    throw new RoutePermissionError(
      500,
      "route_permission_invalid",
      "Route permission configuration is invalid."
    );
  }
}

async function readDeclaration(db, method, pathname) {
  return db
    .prepare(`
      SELECT method, route_pattern, required_permissions_json, auth_required, implementation_status
      FROM auth_route_permissions
      WHERE method = ? AND route_pattern = ?
      LIMIT 1
    `)
    .bind(method, pathname)
    .first();
}

function permissionCodesFor(context = {}) {
  return new Set(
    (context.permissions || [])
      .map((permission) => permission.code)
      .filter(Boolean)
  );
}

function missingPermissions(requiredPermissions, context) {
  const heldPermissions = permissionCodesFor(context);
  return requiredPermissions.filter((permission) => !heldPermissions.has(permission));
}

export async function resolveRoutePermissionDeclaration(request, env = {}) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const pathname = normalisePath(url.pathname);
  const declaration = await readDeclaration(dbFor(env), method, pathname);

  if (!declaration) {
    throw new RoutePermissionError(
      403,
      "route_permission_missing",
      "This route is not available because no permission rule has been declared.",
      { method, pathname }
    );
  }

  return {
    method: declaration.method,
    routePattern: declaration.route_pattern,
    requiredPermissions: parsePermissions(declaration.required_permissions_json),
    authRequired: declaration.auth_required === 1,
    implementationStatus: declaration.implementation_status
  };
}

export async function assertRoutePermission(request, env, context) {
  const declaration = await resolveRoutePermissionDeclaration(request, env);

  if (declaration.authRequired && !context?.authenticated) {
    throw new RoutePermissionError(
      401,
      "authentication_required",
      "Sign in is required to use this part of ResearchOps."
    );
  }

  const missing = missingPermissions(declaration.requiredPermissions, context);
  if (missing.length) {
    throw new RoutePermissionError(
      403,
      "permission_denied",
      "You do not have permission to use this part of ResearchOps.",
      { missingPermissions: missing }
    );
  }

  return declaration;
}

export function routePermissionErrorResponse(error, options = {}) {
  if (!(error instanceof RoutePermissionError)) throw error;

  const body = {
    ok: false,
    error: error.code,
    message: error.message
  };

  if (options.includeDiagnostics) {
    body.details = error.details;
  }

  return new Response(JSON.stringify(body), {
    status: error.status,
    headers: JSON_HEADERS
  });
}
