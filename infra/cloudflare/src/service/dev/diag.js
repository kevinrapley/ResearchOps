/**
 * @file service/dev/diag.js
 * @summary Diagnostic endpoints for Airtable connectivity and filters.
 * NOTE: Keep these endpoints temporarily; remove after verification.
 */

/**
 * GET /api/_diag/ping
 * Quick check that routing and CORS are OK.
 */
export async function ping(service, origin) {
  return service.json(
    { ok: true, time: new Date().toISOString() },
    200,
    service.corsHeaders(origin)
  );
}
