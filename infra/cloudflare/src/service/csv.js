/**
 * @file src/service/csv.js
 * @module service/csv
 */

import { fetchWithTimeout, safeText, b64Decode, b64Encode, toCsvLine } from "../core/utils.js";

/**
 * Append a row to a GitHub CSV file (create if missing).
 * @param {import('./index.js').ResearchOpsService} svc
 * @param {{ path:string, header:string[], row:(string|number)[] }} args
 * @returns {Promise<void>}
 */
export async function githubCsvAppend(svc, { path, header, row }) {
	const { GH_OWNER, GH_REPO, GH_BRANCH, GH_TOKEN } = svc.env;
	const base = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${encodeURIComponent(path)}`;
	const headers = {
		"Authorization": `Bearer ${GH_TOKEN}`,
		"Accept": "application/vnd.github+json",
		"X-GitHub-Api-Version": svc.cfg.GH_API_VERSION,
		"Content-Type": "application/json"
	};

	// Read current file
	let sha, content = "",
		exists = false;
	const getRes = await fetchWithTimeout(`${base}?ref=${encodeURIComponent(GH_BRANCH)}`, { headers }, svc.cfg.TIMEOUT_MS);
	if (getRes.status === 200) {
		const js = await getRes.json();
		sha = js.sha;
		content = b64Decode(js.content);
		exists = true;
	} else if (getRes.status === 404) {
		content = header.join(",") + "\n";
	} else {
		const t = await getRes.text();
		throw new Error(`GitHub read ${getRes.status}: ${safeText(t)}`);
	}

	// Append
	content += toCsvLine(row);

	/** @type {any} */
	const putBody = {
		message: exists ? `chore: append row to ${path}` : `chore: create ${path} with header`,
		content: b64Encode(content),
		branch: GH_BRANCH
	};
	if (sha) putBody.sha = sha;

	const putRes = await fetchWithTimeout(base, { method: "PUT", headers, body: JSON.stringify(putBody) }, svc.cfg.TIMEOUT_MS);
	if (!putRes.ok) {
		const t = await putRes.text();
		throw new Error(`GitHub write ${putRes.status}: ${safeText(t)}`);
	}
}

/**
 * Stream a CSV file from GitHub.
 * @param {import('./index.js').ResearchOpsService} svc
 * @param {string} origin
 * @param {string} path
 * @returns {Promise<Response>}
 */
export async function streamCsv(svc, origin, path) {
	const { GH_OWNER, GH_REPO, GH_BRANCH, GH_TOKEN } = svc.env;
	const base = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${encodeURIComponent(path)}`;
	const headers = {
		"Authorization": `Bearer ${GH_TOKEN}`,
		"Accept": "application/vnd.github+json",
		"X-GitHub-Api-Version": svc.cfg.GH_API_VERSION
	};

	try {
		const getRes = await fetchWithTimeout(`${base}?ref=${encodeURIComponent(GH_BRANCH)}`, { headers }, svc.cfg.TIMEOUT_MS);

		if (getRes.status === 404) {
			svc.log.warn("csv.not_found", { path });
			return svc.json({ error: "CSV file not found" }, 404, svc.corsHeaders(origin));
		}

		if (!getRes.ok) {
			const text = await getRes.text();
			svc.log.error("github.csv.read.fail", { status: getRes.status, text: safeText(text) });
			return svc.json({ error: `GitHub ${getRes.status}`, detail: safeText(text) }, getRes.status, svc.corsHeaders(origin));
		}

		const js = await getRes.json();
		const content = b64Decode(js.content);

		const csvHeaders = {
			"Content-Type": "text/csv; charset=utf-8",
			"Content-Disposition": `attachment; filename="${path.split('/').pop() || 'data.csv'}"`,
			"Cache-Control": svc.cfg.CSV_CACHE_CONTROL,
			...svc.corsHeaders(origin)
		};

		return new Response(content, { status: 200, headers: csvHeaders });
	} catch (e) {
		svc.log.error("csv.stream.error", { err: String(e?.message || e), path });
		return svc.json({ error: "Failed to stream CSV", detail: String(e?.message || e) }, 500, svc.corsHeaders(origin));
	}
}