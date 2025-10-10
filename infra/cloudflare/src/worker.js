/**
 * @file worker.js
 * @summary Cloudflare Worker entrypoint.
 */

import { handleRequest } from "./core/router.js";

export default {
	async fetch(request, env, ctx) {
		return handleRequest(request, env, ctx);
	}
};
