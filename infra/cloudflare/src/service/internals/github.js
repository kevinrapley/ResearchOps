/**
 * @file internals/github.js
 * @module service/internals/github
 * @summary GitHub Content API helpers (read/write/encode).
 *
 * These helpers are consumed by higher-level CSV or data-export modules.
 * They centralise the Content API base URL, headers, Base64 encode/decode,
 * and error wrapping to keep feature code concise.
 */

import { fetchWithTimeout, b64Decode, b64Encode, safeText } from "../../core/utils.js";
import { DEFAULTS } from "../../core/constants.js";

/**
 * Compute the GitHub Content API base URL for a file path.
 *
 * @param {import("../index.js").Env} env
 * @param {string} path
 * @returns {string}
 */
export function contentApiBase(env, path) {
	const { GH_OWNER, GH_REPO } = env;
	return `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${encodeURIComponent(path)}`;
}

/**
 * Build headers for the GitHub Content API.
 *
 * @param {import("../index.js").Env} env
 * @returns {Record<string,string>}
 */
export function contentHeaders(env) {
	return {
		"Authorization": `Bearer ${env.GH_TOKEN}`,
		"Accept": "application/vnd.github+json",
		"X-GitHub-Api-Version": DEFAULTS.GH_API_VERSION,
		"Content-Type": "application/json"
	};
}

/**
 * Read a file via the GitHub Content API and return decoded content + sha.
 *
 * @async
 * @param {import("../index.js").Env} env
 * @param {string} path
 * @param {number} [timeoutMs=DEFAULTS.TIMEOUT_MS]
 * @returns {Promise<{ok:true, status:200, content:string, sha:string|null, raw:any} |
 *                   {ok:false, status:number, message:string}>}
 */
export async function readContent(env, path, timeoutMs = DEFAULTS.TIMEOUT_MS) {
	const base = contentApiBase(env, path);
	const ref = env.GH_BRANCH;
	const res = await fetchWithTimeout(`${base}?ref=${encodeURIComponent(ref)}`, {
		headers: contentHeaders(env)
	}, timeoutMs);

	const txt = await res.text();

	if (res.status === 404) {
		return { ok: false, status: 404, message: "Not found" };
	}

	if (!res.ok) {
		return { ok: false, status: res.status, message: safeText(txt) };
	}

	let js;
	try { js = JSON.parse(txt); } catch { js = {}; }

	const content = js?.content ? b64Decode(js.content) : "";
	const sha = js?.sha || null;

	return { ok: true, status: 200, content, sha, raw: js };
}

/**
 * Create or update a file via the GitHub Content API.
 *
 * @async
 * @param {import("../index.js").Env} env
 * @param {{ path:string, content:string, message:string, sha?:string|null }} args
 * @param {number} [timeoutMs=DEFAULTS.TIMEOUT_MS]
 * @returns {Promise<{ok:true, status:number, raw:any} | {ok:false, status:number, message:string}>}
 */
export async function writeContent(env, args, timeoutMs = DEFAULTS.TIMEOUT_MS) {
	const base = contentApiBase(env, args.path);
	const headers = contentHeaders(env);

	const body = {
		message: args.message,
		content: b64Encode(args.content),
		branch: env.GH_BRANCH
	};
	if (args.sha) body.sha = args.sha;

	const res = await fetchWithTimeout(base, {
		method: "PUT",
		headers,
		body: JSON.stringify(body)
	}, timeoutMs);

	const txt = await res.text();
	if (!res.ok) {
		return { ok: false, status: res.status, message: safeText(txt) };
	}

	let js;
	try { js = JSON.parse(txt); } catch { js = {}; }
	return { ok: true, status: res.status, raw: js };
}

/**
 * Convenience helper: append a CSV line (creates file with header if missing).
 *
 * @async
 * @param {import("../index.js").Env} env
 * @param {{ path:string, header:string[], newLine:string }} args
 * @param {number} [timeoutMs=DEFAULTS.TIMEOUT_MS]
 * @returns {Promise<{ok:true} | {ok:false, status:number, message:string}>}
 */
export async function appendCsvLine(env, args, timeoutMs = DEFAULTS.TIMEOUT_MS) {
	// 1) Read (or 404)
	const read = await readContent(env, args.path, timeoutMs);
	let content = "";
	let sha = null;

	if (read.ok) {
		content = read.content;
		sha = read.sha;
	} else if (read.status === 404) {
		content = args.header.join(",") + "\n";
	} else {
		return read; // propagate the error {ok:false,...}
	}

	// 2) Append
	content += args.newLine;

	// 3) Write
	const write = await writeContent(env, {
		path: args.path,
		content,
		message: sha ? `chore: append row to ${args.path}` : `chore: create ${args.path} with header`,
		sha
	}, timeoutMs);

	return write.ok ? { ok: true } : write;
}