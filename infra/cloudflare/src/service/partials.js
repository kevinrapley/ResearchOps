/**
 * @file src/service/partials.js
 * @module service/partials
 * @summary Partials endpoints (Airtable-backed).
 */

import { fetchWithTimeout, safeText } from "../core/utils.js";
import { getRecord } from "./internals/airtable.js";

/**
 * List all partials (for pattern drawer).
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {string} origin
 * @returns {Promise<Response>}
 */
export async function listPartials(svc, origin) {
	const base = svc.env.AIRTABLE_BASE_ID;
	const table = encodeURIComponent(svc.env.AIRTABLE_TABLE_PARTIALS || "Partials");
	const url = `https://api.airtable.com/v0/${base}/${table}?sort%5B0%5D%5Bfield%5D=Category&sort%5B1%5D%5Bfield%5D=Name`;

	const res = await fetchWithTimeout(url, {
		headers: { "Authorization": `Bearer ${svc.env.AIRTABLE_API_KEY}` }
	}, svc.cfg.TIMEOUT_MS);

	if (!res.ok) {
		const txt = await res.text();
		svc.log.error("airtable.partials.list.fail", { status: res.status, text: safeText(txt) });
		return svc.json({ error: `Airtable ${res.status}`, detail: safeText(txt) }, res.status, svc.corsHeaders(origin));
	}

	const { records = [] } = await res.json();
	const partials = records.map(r => ({
		id: r.id,
		name: r.fields.Name || "",
		title: r.fields.Title || "",
		category: r.fields.Category || "Uncategorised",
		version: r.fields.Version || 1,
		status: r.fields.Status || "draft"
	}));

	return svc.json({ ok: true, partials }, 200, svc.corsHeaders(origin));
}

/**
 * Read a partial by Airtable record id.
 * Uses resilient getRecord() with RECORD_ID() fallback.
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {string} origin
 * @param {string} id
 * @returns {Promise<Response>}
 */
export async function readPartial(env, corsHeaders, id) {
	if (!id) {
		return new Response(JSON.stringify({ error: "Missing partial id" }), {
			status: 400,
			headers: { "Content-Type": "application/json", ...corsHeaders("") }
		});
	}

	try {
		const rec = await getRecord(env, env.AIRTABLE_TABLE_PARTIALS, id);
		const fields = rec?.fields || {};

		const payload = {
			ok: true,
			partial: {
				id: rec.id,
				name: fields.name || fields.Name || "",
				title: fields.title || fields.Title || "",
				category: fields.category || fields.Category || "",
				version: fields.version ?? fields.Version ?? 1,
				status: fields.status || fields.Status || "Draft",
				source: fields.source || fields.Source || ""
			}
		};

		return new Response(JSON.stringify(payload), {
			status: 200,
			headers: { "Content-Type": "application/json", ...corsHeaders("") }
		});

	} catch (err) {
		const msg = String(err?.message || "");
		const isNotFound = /Airtable\s*404/i.test(msg) || /NOT_FOUND/i.test(msg);
		const body = isNotFound ?
			{ error: "Airtable 404", detail: JSON.stringify({ error: "NOT_FOUND" }) } :
			{ error: "Airtable error", detail: msg };

		return new Response(JSON.stringify(body), {
			status: isNotFound ? 404 : 500,
			headers: { "Content-Type": "application/json", ...corsHeaders("") }
		});
	}
}

/**
 * Create a new partial.
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {Request} request
 * @param {string} origin
 * @returns {Promise<Response>}
 */
export async function createPartial(svc, request, origin) {
	const body = await request.arrayBuffer();
	let p;
	try { p = JSON.parse(new TextDecoder().decode(body)); } catch {
		return svc.json({ error: "Invalid JSON" }, 400, svc.corsHeaders(origin));
	}

	if (!p.name || !p.title || !p.source) {
		return svc.json({ error: "Missing required fields: name, title, source" }, 400, svc.corsHeaders(origin));
	}

	const base = svc.env.AIRTABLE_BASE_ID;
	const table = encodeURIComponent(svc.env.AIRTABLE_TABLE_PARTIALS || "Partials");
	const url = `https://api.airtable.com/v0/${base}/${table}`;

	const fields = {
		Name: p.name,
		Title: p.title,
		Category: p.category || "Uncategorised",
		Version: p.version || 1,
		Source: p.source,
		Description: p.description || "",
		Status: p.status || "draft"
	};

	const res = await fetchWithTimeout(url, {
		method: "POST",
		headers: {
			"Authorization": `Bearer ${svc.env.AIRTABLE_API_KEY}`,
			"Content-Type": "application/json"
		},
		body: JSON.stringify({ records: [{ fields }] })
	}, svc.cfg.TIMEOUT_MS);

	if (!res.ok) {
		const txt = await res.text();
		return svc.json({ error: `Airtable ${res.status}`, detail: safeText(txt) }, res.status, svc.corsHeaders(origin));
	}

	const { records = [] } = await res.json();
	const id = records[0]?.id;
	return svc.json({ ok: true, id }, 200, svc.corsHeaders(origin));
}

/**
 * Update a partial (partial update).
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {Request} request
 * @param {string} origin
 * @param {string} id
 * @returns {Promise<Response>}
 */
export async function updatePartial(svc, request, origin, id) {
	const body = await request.arrayBuffer();
	let p;
	try { p = JSON.parse(new TextDecoder().decode(body)); } catch {
		return svc.json({ error: "Invalid JSON" }, 400, svc.corsHeaders(origin));
	}

	const fields = {};
	if (p.title !== undefined) fields.Title = p.title;
	if (p.source !== undefined) fields.Source = p.source;
	if (p.description !== undefined) fields.Description = p.description;
	if (p.status !== undefined) fields.Status = p.status;
	if (p.category !== undefined) fields.Category = p.category;

	if (Object.keys(fields).length === 0) {
		return svc.json({ error: "No fields to update" }, 400, svc.corsHeaders(origin));
	}

	const base = svc.env.AIRTABLE_BASE_ID;
	const table = encodeURIComponent(svc.env.AIRTABLE_TABLE_PARTIALS || "Partials");
	const url = `https://api.airtable.com/v0/${base}/${table}`;

	const res = await fetchWithTimeout(url, {
		method: "PATCH",
		headers: {
			"Authorization": `Bearer ${svc.env.AIRTABLE_API_KEY}`,
			"Content-Type": "application/json"
		},
		body: JSON.stringify({ records: [{ id, fields }] })
	}, svc.cfg.TIMEOUT_MS);

	if (!res.ok) {
		const txt = await res.text();
		return svc.json({ error: `Airtable ${res.status}`, detail: safeText(txt) }, res.status, svc.corsHeaders(origin));
	}

	return svc.json({ ok: true }, 200, svc.corsHeaders(origin));
}

/**
 * Delete a partial.
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {string} origin
 * @param {string} id
 * @returns {Promise<Response>}
 */
export async function deletePartial(svc, origin, id) {
	const base = svc.env.AIRTABLE_BASE_ID;
	const table = encodeURIComponent(svc.env.AIRTABLE_TABLE_PARTIALS || "Partials");
	const url = `https://api.airtable.com/v0/${base}/${table}/${encodeURIComponent(id)}`;

	const res = await fetchWithTimeout(url, {
		method: "DELETE",
		headers: { "Authorization": `Bearer ${svc.env.AIRTABLE_API_KEY}` }
	}, svc.cfg.TIMEOUT_MS);

	if (!res.ok) {
		const txt = await res.text();
		return svc.json({ error: `Airtable ${res.status}`, detail: safeText(txt) }, res.status, svc.corsHeaders(origin));
	}

	return svc.json({ ok: true }, 200, svc.corsHeaders(origin));
}
