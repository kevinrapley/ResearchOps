/**
 * @file worker.js
 * @summary Cloudflare Worker entrypoint with hard Response guard.
 * @version 2.0.0
 *
 * Entry point for ResearchOps Worker. Delegates to router.js and ensures
 * all responses are valid Response objects (prevents 1101 errors).
 */

import { handleRequest } from "./core/router.js";

/**
 * Coerce any value to a Response object.
 * Prevents "Promise did not resolve to Response" (error 1101).
 * @param {any} res
 * @returns {Response}
 */
function coerceResponse(res) {
  if (res instanceof Response) return res;
  
  if (res === undefined || res === null) {
    console.error("[worker] Handler returned no response");
    return new Response(JSON.stringify({ error: "Handler returned no response" }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }
  
  // String, ArrayBuffer, or Uint8Array - wrap in Response
  if (typeof res === "string" || res instanceof ArrayBuffer || res instanceof Uint8Array) {
    return new Response(res);
  }
  
  // Object/other → serialize as JSON
  return new Response(JSON.stringify(res), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

/**
 * Worker export object (standard Cloudflare Workers format).
 */
export default {
  /**
   * Main fetch handler.
   * @param {Request} request
   * @param {any} env - Environment bindings (KV, secrets, etc.)
   * @param {any} ctx - Execution context
   * @returns {Promise<Response>}
   */
  async fetch(request, env, ctx) {
    try {
      console.log("[worker] Handling request:", request.method, new URL(request.url).pathname);
      const res = await handleRequest(request, env, ctx);
      const coerced = coerceResponse(res);
      console.log("[worker] Response status:", coerced.status);
      return coerced;
    } catch (e) {
      console.error("[worker] Unhandled exception:", e);
      return new Response(JSON.stringify({
        error: "Internal error",
        detail: String(e?.message || e)
      }), {
        status: 500,
        headers: { "content-type": "application/json; charset=utf-8" }
      });
    }
  }
};
