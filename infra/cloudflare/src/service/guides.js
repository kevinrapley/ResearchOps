/**
 * @file guides.js
 * @module guides
 * @summary Discussion Guides endpoints for ResearchOps Worker (Airtable + GitHub CSV).
 *
 * @description
 * Encapsulates:
 * - listGuides (GET /api/guides?study=...)
 * - createGuide (POST /api/guides)
 * - updateGuide (PATCH /api/guides/:id)
 * - publishGuide (POST /api/guides/:id/publish)
 */

import {
	fetchWithTimeout,
	mdToAirtableRich,
	pickFirstField,
	safeText,
	toMs
} from "../core/utils.js";
import { GUIDE_LINK_FIELD_CANDIDATES, GUIDE_FIELD_NAMES } from "../core/fields.js";
import { airtableTryWrite } from "../core/utils.js";
import { getRecord } from "./internals/airtable.js";

/**
 * Pull `version: X` from YAML front-matter at the top of a Markdown doc.
 */
function extractFrontmatterVersion(md = "") {
	if (!/^---\s*\n/.test(md)) return null;
	const m = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
	if (!m) return null;
	const yaml = m[1];
	const v = yaml.match(/^\s*version\s*:\s*("?)([^"\n]+)\1\s*$/mi);
	return v ? String(v[2]).trim() : null;
}

/**
 * List guides for a study.
 * @route GET /api/guides?study=<StudyAirtableId>
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {string} origin
 * @param {URL} url
 * @returns {Promise<Response>}
 */
export async function listGuides(svc, origin, url) {
	const studyId = url.searchParams.get("study");
	if (!studyId) return svc.json({ ok: false, error: "Missing study query" }, 400, svc.corsHeaders(origin));

	const base = svc.env.AIRTABLE_BASE_ID;
	const tGuides = encodeURIComponent(svc.env.AIRTABLE_TABLE_GUIDES || "Discussion Guides");
	const atBase = `https://api.airtable.com/v0/${base}/${tGuides}`;
	const headers = { "Authorization": `Bearer ${svc.env.AIRTABLE_API_KEY}` };

	const records = [];
	let offset;
	do {
		const params = new URLSearchParams({ pageSize: "100" });
		if (offset) params.set("offset", offset);
		const resp = await fetchWithTimeout(`${atBase}?${params.toString()}`, { headers }, svc.cfg.TIMEOUT_MS);
		const txt = await resp.text();

		if (!resp.ok) {
			svc.log.error("airtable.guides.list.fail", { status: resp.status, text: safeText(txt) });
			return svc.json({ ok: false, error: `Airtable ${resp.status}`, detail: safeText(txt) }, resp.status, svc.corsHeaders(origin));
		}

		let js;
		try { js = JSON.parse(txt); } catch { js = { records: [] }; }
		records.push(...(js.records || []));
		offset = js.offset;
	} while (offset);

	const guides = [];
	for (const r of records) {
		const f = r.fields || {};
		const linkKey = pickFirstField(f, GUIDE_LINK_FIELD_CANDIDATES);
		const linkArr = linkKey ? f[linkKey] : undefined;
		if (Array.isArray(linkArr) && linkArr.includes(studyId)) {
			const titleKey = pickFirstField(f, GUIDE_FIELD_NAMES.title);
			const statusKey = pickFirstField(f, GUIDE_FIELD_NAMES.status);
			const verKey = pickFirstField(f, GUIDE_FIELD_NAMES.version);
			const srcKey = pickFirstField(f, GUIDE_FIELD_NAMES.source);
			const varsKey = pickFirstField(f, GUIDE_FIELD_NAMES.variables);

			guides.push({
				id: r.id,
				title: titleKey ? f[titleKey] : "",
				status: statusKey ? f[statusKey] : "draft",
				version: verKey ? f[verKey] : 1,
				sourceMarkdown: srcKey ? (f[srcKey] || "") : "",
				variables: (() => { try { return JSON.parse(f[varsKey] || "{}"); } catch { return {}; } })(),
				createdAt: r.createdTime || ""
			});
		}
	}

	guides.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
	return svc.json({ ok: true, guides }, 200, svc.corsHeaders(origin));
}

/**
 * Create a guide for a study. Tries multiple link-field names until one works.
 * @route POST /api/guides
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {Request} request
 * @param {string} origin
 * @returns {Promise<Response>}
 */
export async function createGuide(svc, request, origin) {
	const body = await request.arrayBuffer();
	if (body.byteLength > svc.cfg.MAX_BODY_BYTES) {
		svc.log.warn("request.too_large", { size: body.byteLength });
		return svc.json({ error: "Payload too large" }, 413, svc.corsHeaders(origin));
	}

	/** @type {any} */
	let p;
	try { p = JSON.parse(new TextDecoder().decode(body)); } catch { return svc.json({ error: "Invalid JSON" }, 400, svc.corsHeaders(origin)); }

	if (!p.study_airtable_id)
		return svc.json({ error: "Missing field: study_airtable_id" }, 400, svc.corsHeaders(origin));

	const base = svc.env.AIRTABLE_BASE_ID;
	const tGuides = encodeURIComponent(svc.env.AIRTABLE_TABLE_GUIDES);
	const atUrl = `https://api.airtable.com/v0/${base}/${tGuides}`;

	// Build non-link fields (remember which Status key we used)
	const fieldsTemplate = {};
	const setIf = (names, val) => {
		if (val === undefined || val === null) return null;
		const k = names[0];
		fieldsTemplate[k] = val;
		return k;
	};

	setIf(GUIDE_FIELD_NAMES.title, String(p.title || "Untitled guide"));
	const statusKey = setIf(GUIDE_FIELD_NAMES.status, String(p.status || "draft"));
	setIf(GUIDE_FIELD_NAMES.version, Number.isFinite(p.version) ? p.version : 1);
	setIf(GUIDE_FIELD_NAMES.source, mdToAirtableRich(p.sourceMarkdown || ""));
	setIf(GUIDE_FIELD_NAMES.variables, typeof p.variables === "object" ? JSON.stringify(p.variables || {}) : String(p.variables || "{}"));

	// Try link field candidates; for each, retry if Status select rejects "draft"
	let lastDetail = "";
	for (const linkName of GUIDE_LINK_FIELD_CANDIDATES) {
		// attempt 1: as-is
		let fields = { ...fieldsTemplate, [linkName]: [p.study_airtable_id] };
		let attempt = await airtableTryWrite(atUrl, svc.env.AIRTABLE_API_KEY, "POST", fields, svc.cfg.TIMEOUT_MS);
		if (attempt.ok) {
			const id = attempt.json.records?.[0]?.id;
			if (!id) return svc.json({ error: "Airtable response missing id" }, 502, svc.corsHeaders(origin));
			if (svc.env.AUDIT === "true") svc.log.info("guide.created", { id, linkName, statusFallback: "none" });
			return svc.json({ ok: true, id }, 200, svc.corsHeaders(origin));
		}
		lastDetail = attempt.detail || lastDetail;

		// If invalid select option on Status, retry smartly
		const is422 = attempt.status === 422;
		const isSelectErr = /INVALID_MULTIPLE_CHOICE_OPTIONS/i.test(String(attempt.detail || ""));
		if (is422 && isSelectErr && statusKey && typeof fields[statusKey] === "string") {
			// attempt 2: capitalise (draft -> Draft)
			const cap = fields[statusKey].charAt(0).toUpperCase() + fields[statusKey].slice(1);
			fields = { ...fields, [statusKey]: cap };
			attempt = await airtableTryWrite(atUrl, svc.env.AIRTABLE_API_KEY, "POST", fields, svc.cfg.TIMEOUT_MS);
			if (attempt.ok) {
				const id = attempt.json.records?.[0]?.id;
				if (!id) return svc.json({ error: "Airtable response missing id" }, 502, svc.corsHeaders(origin));
				if (svc.env.AUDIT === "true") svc.log.info("guide.created", { id, linkName, statusFallback: "capitalised" });
				return svc.json({ ok: true, id }, 200, svc.corsHeaders(origin));
			}

			// attempt 3: drop Status (let Airtable default)
			const {
				[statusKey]: _drop, ...withoutStatus
			} = fields;
			attempt = await airtableTryWrite(atUrl, svc.env.AIRTABLE_API_KEY, "POST", withoutStatus, svc.cfg.TIMEOUT_MS);
			if (attempt.ok) {
				const id = attempt.json.records?.[0]?.id;
				if (!id) return svc.json({ error: "Airtable response missing id" }, 502, svc.corsHeaders(origin));
				if (svc.env.AUDIT === "true") svc.log.info("guide.created", { id, linkName, statusFallback: "omitted" });
				return svc.json({ ok: true, id }, 200, svc.corsHeaders(origin));
			}
			lastDetail = attempt.detail || lastDetail;
		}

		// If not a field-name issue, surface the error now
		if (!attempt.retry) {
			svc.log.error("airtable.guide.create.fail", { status: attempt.status, detail: attempt.detail });
			return svc.json({ error: `Airtable ${attempt.status}`, detail: attempt.detail }, attempt.status || 500, svc.corsHeaders(origin));
		}
	}

	// No link field matched
	svc.log.error("airtable.guide.create.linkfield.none_matched", { detail: lastDetail });
	return svc.json({
		error: "Airtable 422",
		detail: lastDetail || "No matching link field name found for the Guides↔Study relation. Add a link-to-record field to your Discussion Guides table that links to Project Studies. Try: " + GUIDE_LINK_FIELD_CANDIDATES.join(", ")
	}, 422, svc.corsHeaders(origin));
}

/**
 * Update a guide (partial).
 * @route PATCH /api/guides/:id
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {Request} request
 * @param {string} origin
 * @param {string} guideId
 * @returns {Promise<Response>}
 */
export async function updateGuide(svc, request, origin, guideId) {
	if (!guideId) return svc.json({ error: "Missing guide id" }, 400, svc.corsHeaders(origin));

	const body = await request.arrayBuffer();
	if (body.byteLength > svc.cfg.MAX_BODY_BYTES) {
		svc.log.warn("request.too_large", { size: body.byteLength });
		return svc.json({ error: "Payload too large" }, 413, svc.corsHeaders(origin));
	}

	/** @type {any} */
	let p;
	try { p = JSON.parse(new TextDecoder().decode(body)); } catch { return svc.json({ error: "Invalid JSON" }, 400, svc.corsHeaders(origin)); }

	// Map incoming keys to preferred Airtable field names
	const f = {};
	const putIf = (names, val) => {
		if (val === undefined) return null;
		const key = names[0];
		f[key] = val;
		return key;
	};

	putIf(GUIDE_FIELD_NAMES.title, typeof p.title === "string" ? p.title : undefined);
	const statusKey = putIf(GUIDE_FIELD_NAMES.status, typeof p.status === "string" ? p.status : undefined);
	putIf(GUIDE_FIELD_NAMES.version, Number.isFinite(p.version) ? p.version : undefined);
	putIf(GUIDE_FIELD_NAMES.source, typeof p.sourceMarkdown === "string" ? mdToAirtableRich(p.sourceMarkdown) : undefined);
	putIf(GUIDE_FIELD_NAMES.variables, p.variables != null ? JSON.stringify(p.variables) : undefined);

	if (Object.keys(f).length === 0) {
		return svc.json({ error: "No updatable fields provided" }, 400, svc.corsHeaders(origin));
	}

	const base = svc.env.AIRTABLE_BASE_ID;
	const tGuides = encodeURIComponent(svc.env.AIRTABLE_TABLE_GUIDES);
	const atUrl = `https://api.airtable.com/v0/${base}/${tGuides}`;

	// try once
	let res = await fetchWithTimeout(atUrl, {
		method: "PATCH",
		headers: { "Authorization": `Bearer ${svc.env.AIRTABLE_API_KEY}`, "Content-Type": "application/json" },
		body: JSON.stringify({ records: [{ id: guideId, fields: f }] })
	}, svc.cfg.TIMEOUT_MS);

	let text = await res.text();
	if (res.ok) return svc.json({ ok: true }, 200, svc.corsHeaders(origin));

	// If status is invalid select option, retry with capitalised or omit
	const isSelectErr = /INVALID_MULTIPLE_CHOICE_OPTIONS/i.test(text);
	if (res.status === 422 && isSelectErr && statusKey && typeof f[statusKey] === "string") {
		// 2nd attempt: capitalised
		const f2 = { ...f, [statusKey]: f[statusKey].charAt(0).toUpperCase() + f[statusKey].slice(1) };
		res = await fetchWithTimeout(atUrl, {
			method: "PATCH",
			headers: { "Authorization": `Bearer ${svc.env.AIRTABLE_API_KEY}`, "Content-Type": "application/json" },
			body: JSON.stringify({ records: [{ id: guideId, fields: f2 }] })
		}, svc.cfg.TIMEOUT_MS);
		text = await res.text();
		if (res.ok) return svc.json({ ok: true, status_fallback: "capitalised" }, 200, svc.corsHeaders(origin));

		// 3rd attempt: omit Status
		const {
			[statusKey]: _drop, ...f3
		} = f2;
		res = await fetchWithTimeout(atUrl, {
			method: "PATCH",
			headers: { "Authorization": `Bearer ${svc.env.AIRTABLE_API_KEY}`, "Content-Type": "application/json" },
			body: JSON.stringify({ records: [{ id: guideId, fields: f3 }] })
		}, svc.cfg.TIMEOUT_MS);
		text = await res.text();
		if (res.ok) return svc.json({ ok: true, status_fallback: "omitted" }, 200, svc.corsHeaders(origin));
	}

	svc.log.error("airtable.guide.update.fail", { status: res.status, text: safeText(text) });
	return svc.json({ error: `Airtable ${res.status}`, detail: safeText(text) }, res.status, svc.corsHeaders(origin));
}

/**
 * Publish a guide: set Status="published" and increment Version.
 * Uses flexible field names defined in GUIDE_FIELD_NAMES.
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {string} origin
 * @param {string} guideId
 * @returns {Promise<Response>}
 */
export async function publishGuide(svc, origin, guideId) {
	if (!guideId) return svc.json({ error: "Missing guide id" }, 400, svc.corsHeaders(origin));

	const base = svc.env.AIRTABLE_BASE_ID;
	const tGuides = encodeURIComponent(svc.env.AIRTABLE_TABLE_GUIDES);
	const atBase = `https://api.airtable.com/v0/${base}/${tGuides}`;
	const headers = { "Authorization": `Bearer ${svc.env.AIRTABLE_API_KEY}` };

	// Read current record (to find actual keys + version)
	const getUrl = `${atBase}?pageSize=1&filterByFormula=${encodeURIComponent(`RECORD_ID()="${guideId}"`)}`;
	const getRes = await fetchWithTimeout(getUrl, { headers }, svc.cfg.TIMEOUT_MS);
	const getText = await getRes.text();
	if (!getRes.ok) {
		svc.log.error("airtable.guide.read.fail", { status: getRes.status, text: safeText(getText) });
		return svc.json({ error: `Airtable ${getRes.status}`, detail: safeText(getText) }, getRes.status, svc.corsHeaders(origin));
	}
	let js;
	try { js = JSON.parse(getText); } catch { js = { records: [] }; }
	const rec = js.records?.[0];
	const f = rec?.fields || {};

	const statusKey = pickFirstField(f, GUIDE_FIELD_NAMES.status) || GUIDE_FIELD_NAMES.status[0];
	const versionKey = pickFirstField(f, GUIDE_FIELD_NAMES.version) || GUIDE_FIELD_NAMES.version[0];

	const cur = Number.isFinite(f[versionKey]) ? Number(f[versionKey]) : parseInt(f[versionKey], 10);
	const nextVer = Number.isFinite(cur) ? cur + 1 : 1;

	const tryPatch = async (statusValue, note) => {
		const fields = statusValue != null ? {
			[statusKey]: statusValue,
			[versionKey]: nextVer
		} : {
			[versionKey]: nextVer
		};
		const res = await fetchWithTimeout(atBase, {
			method: "PATCH",
			headers: { "Authorization": `Bearer ${svc.env.AIRTABLE_API_KEY}`, "Content-Type": "application/json" },
			body: JSON.stringify({ records: [{ id: guideId, fields }] })
		}, svc.cfg.TIMEOUT_MS);
		const txt = await res.text();
		return { ok: res.ok, status: res.status, txt: safeText(txt), note };
	};

	// 1) 'published'
	let r = await tryPatch("published", "lowercase");
	if (r.ok) return svc.json({ ok: true, version: nextVer, status: "published" }, 200, svc.corsHeaders(origin));

	// If select error, try 'Published'
	const selectErr = r.status === 422 && /INVALID_MULTIPLE_CHOICE_OPTIONS/i.test(r.txt);
	if (selectErr) {
		r = await tryPatch("Published", "capitalised");
		if (r.ok) return svc.json({ ok: true, version: nextVer, status: "Published", status_fallback: "capitalised" }, 200, svc.corsHeaders(origin));

		// final fallback: bump version only
		r = await tryPatch(null, "omit-status");
		if (r.ok) return svc.json({ ok: true, version: nextVer, status: f[statusKey] || undefined, status_fallback: "omitted" }, 200, svc.corsHeaders(origin));
	}

	svc.log.error("airtable.guide.publish.fail", { status: r.status, text: r.txt });
	return svc.json({ error: `Airtable ${r.status}`, detail: r.txt }, r.status || 500, svc.corsHeaders(origin));
}

/**
 * Read a guide by Airtable record id.
 * @route GET /api/guides/:id
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {string} origin
 * @param {string} guideId
 * @returns {Promise<Response>}
 */
export async function readGuide(svc, origin, guideId) {
	if (!guideId) {
		return svc.json({ error: "Missing guide id" }, 400, svc.corsHeaders(origin));
	}

	try {
		// Use resilient getter
		const rec = await getRecord(svc.env, svc.env.AIRTABLE_TABLE_GUIDES, guideId);
		const f = rec?.fields || {};

		// Map flexible field names back to the shape expected by the UI
		const titleKey = pickFirstField(f, GUIDE_FIELD_NAMES.title);
		const statusKey = pickFirstField(f, GUIDE_FIELD_NAMES.status);
		const verKey = pickFirstField(f, GUIDE_FIELD_NAMES.version);
		const srcKey = pickFirstField(f, GUIDE_FIELD_NAMES.source);
		const varsKey = pickFirstField(f, GUIDE_FIELD_NAMES.variables);

		// Variables may be stored as JSON string
		let vars = {};
		if (varsKey && f[varsKey] != null) {
			try {
				vars = typeof f[varsKey] === "string" ? JSON.parse(f[varsKey]) : f[varsKey];
			} catch {
				vars = {};
			}
		}

		const payload = {
			ok: true,
			guide: {
				id: rec.id,
				title: titleKey ? f[titleKey] : "Untitled",
				status: statusKey ? f[statusKey] : "Draft",
				version: verKey ? f[verKey] : 1,
				// If source field was stored via mdToAirtableRich, it’s just markdown text in Airtable.
				sourceMarkdown: srcKey ? (f[srcKey] || "") : "",
				variables: vars
			}
		};

		return new Response(JSON.stringify(payload), {
			status: 200,
			headers: { "Content-Type": "application/json", ...svc.corsHeaders(origin) }
		});

	} catch (err) {
		const msg = String(err?.message || "");
		const isNotFound = /Airtable\s*404/i.test(msg) || /NOT_FOUND/i.test(msg);
		const body = isNotFound ?
			{ error: "Airtable 404", detail: "{\"error\":\"NOT_FOUND\"}" } :
			{ error: "Airtable error", detail: msg };

		return new Response(JSON.stringify(body), {
			status: isNotFound ? 404 : 500,
			headers: { "Content-Type": "application/json", ...svc.corsHeaders(origin) }
		});
	}
}