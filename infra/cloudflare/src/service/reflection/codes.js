/**
 * @file src/service/reflection/codes.js
 * @module service/reflection/codes
 * @summary Codes CRUD-lite + retrieval/co-occurrence helpers for CAQDAS UI.
 *
 * Routes:
 *   GET  /api/codes?project=<rec...>
 *   POST /api/codes            { name, projectId, color?, description?, parentId? }
 */

import { listAll } from "../internals/airtable.js";

/** quick table-id detector */
const isTableId = (s) => typeof s === "string" && /^tbl[a-zA-Z0-9]{14,}$/.test(s);

/** minimal Airtable POST (kept local to this module to avoid changing internals) */
async function airtableCreate(env, tableRef, fields, timeoutMs = 120000) {
	const base = env.AIRTABLE_BASE_ID;
	const token = env.AIRTABLE_API_KEY || env.AIRTABLE_ACCESS_TOKEN;
	if (!base || !token) throw new Error("Airtable credentials missing");

	const url = `https://api.airtable.com/v0/${encodeURIComponent(base)}/${encodeURIComponent(tableRef)}`;
	const body = JSON.stringify({ fields });
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), timeoutMs);

	const res = await fetch(url, {
		method: "POST",
		headers: {
			"authorization": `Bearer ${token}`,
			"content-type": "application/json"
		},
		body,
		signal: ctrl.signal
	}).catch((e) => { throw new Error(`Airtable POST failed: ${String(e)}`); });
	clearTimeout(t);

	const text = await res.text();
	if (!res.ok) throw new Error(`Airtable ${res.status}: ${text}`);
	return JSON.parse(text);
}

/**
 * GET /api/codes?project=rec...
 */
export async function listCodes(svc, origin, url) {
	const projectId = url.searchParams.get("project") || url.searchParams.get("id") || "";
	if (!projectId) {
		return svc.json({ ok: false, error: "Missing ?project" }, 400, svc.corsHeaders(origin));
	}

	// dev-friendly noop
	if (!svc?.env?.AIRTABLE_BASE_ID || !(svc?.env?.AIRTABLE_API_KEY || svc?.env?.AIRTABLE_ACCESS_TOKEN)) {
		return svc.json({ ok: true, codes: [] }, 200, svc.corsHeaders(origin));
	}

	const tableId = svc.env.AIRTABLE_TABLE_CODES_ID || "";
	const tableName = svc.env.AIRTABLE_TABLE_CODES || "Codes";
	const tableRef = isTableId(tableId) ? tableId : tableName;

	try {
		const { records } = await listAll(svc.env, tableRef, { pageSize: 100 }, svc.cfg?.TIMEOUT_MS);
		const LINK_FIELDS = ["Project", "Projects"];
		const out = [];

		for (const r of records) {
			const f = r?.fields || {};
			const linked = LINK_FIELDS.some((lf) => Array.isArray(f[lf]) && f[lf].includes(projectId));
			if (!linked) continue;

			out.push({
				id: r.id,
				name: f.Name || "—",
				color: f.Color || "",
				description: f.Description || "",
				parentId: (Array.isArray(f.Parent) && f.Parent[0]) || "",
				projectIds: LINK_FIELDS.flatMap((lf) => Array.isArray(f[lf]) ? f[lf] : [])
			});
		}

		// basic stable sort
		out.sort((a, b) => a.name.localeCompare(b.name));
		return svc.json({ ok: true, codes: out }, 200, svc.corsHeaders(origin));
	} catch (err) {
		const msg = String(err || "");
		const status = /Airtable\s+40[13]/i.test(msg) ? 502 : 500;
		svc.log?.error?.("codes.list.error", { err: msg });
		return svc.json({ ok: false, error: msg }, status, svc.corsHeaders(origin));
	}
}

/**
 * POST /api/codes
 * Body: { name, projectId, color?, description?, parentId? }
 */
export async function createCode(svc, req, origin) {
	let payload = {};
	try { payload = await req.json(); } catch { /* ignore */ }

	const name = (payload.name || "").trim();
	const projectId = (payload.projectId || "").trim();
	const color = (payload.color || "").trim();
	const description = (payload.description || "").trim();
	const parentId = (payload.parentId || "").trim();

	if (!name || !projectId) {
		return svc.json({ ok: false, error: "Missing 'name' or 'projectId'." }, 400, svc.corsHeaders(origin));
	}

	// dev-friendly stub if env missing
	if (!svc?.env?.AIRTABLE_BASE_ID || !(svc?.env?.AIRTABLE_API_KEY || svc?.env?.AIRTABLE_ACCESS_TOKEN)) {
		const fake = {
			id: `dev_${Date.now()}`,
			name,
			color,
			description,
			parentId,
			projectIds: [projectId]
		};
		return svc.json({ ok: true, code: fake, dev: true }, 200, svc.corsHeaders(origin));
	}

	const tableId = svc.env.AIRTABLE_TABLE_CODES_ID || "";
	const tableName = svc.env.AIRTABLE_TABLE_CODES || "Codes";
	const tableRef = isTableId(tableId) ? tableId : tableName;

	try {
		const fields = {
			"Name": name,
			"Project": [projectId]
		};
		if (color) fields["Color"] = color;
		if (description) fields["Description"] = description;
		if (parentId) fields["Parent"] = [parentId];

		const rec = await airtableCreate(svc.env, tableRef, fields, svc.cfg?.TIMEOUT_MS);
		const r = rec?.id ? rec : (rec?.records?.[0] || rec); // support bulk/one

		const out = {
			id: r.id,
			name,
			color,
			description,
			parentId,
			projectIds: [projectId]
		};
		return svc.json({ ok: true, code: out }, 201, svc.corsHeaders(origin));
	} catch (err) {
		const msg = String(err || "");
		const status = /Airtable\s+40[13]/i.test(msg) ? 502 : 500;
		svc.log?.error?.("codes.create.error", { err: msg });
		return svc.json({ ok: false, error: msg }, status, svc.corsHeaders(origin));
	}
}