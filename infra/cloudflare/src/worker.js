/**
 * @file worker.js
 * @summary Cloudflare Worker entrypoint with hard Response guard.
 */

import { handleRequest } from "./core/router.js";

function coerceResponse(res) {
  if (res instanceof Response) return res;
  if (res === undefined || res === null) {
    return new Response(JSON.stringify({ error: "Handler returned no response" }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }
  if (typeof res === "string" || res instanceof ArrayBuffer || res instanceof Uint8Array) {
    return new Response(res);
  }
  // object/other → JSON
  return new Response(JSON.stringify(res), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

export default {
  async fetch(request, env, ctx) {
    try {
      const res = await handleRequest(request, env, ctx);
      return coerceResponse(res);
    } catch (e) {
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
