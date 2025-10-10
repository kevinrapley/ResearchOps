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
	safeText,
	toMs,
	mdToAirtableRich,
	pickFirstField
} from "../core/utils.js";

import {
	GUIDE_LINK_FIELD_CANDIDATES,
	GUIDE_FIELD_NAMES
} from "../core/fields.js";

/**
 * @typedef {Object} GuidesDeps
 * @property {any} env Environment bindings.
 * @property {any} cfg Configuration object.
 * @property {import("../core/logger.js").BatchLogger} log
 * @property {(body:any,status?:number,headers?:HeadersInit)=>Response} json
 * @property {(origin:string)=>Record<string,string>} corsHeaders
 */

/**
 * Factory returning bound Discussion Guide handlers.
 * @param {GuidesDeps} deps
 */
export function createGuidesHandlers(deps) {
	const { env, cfg, log, json, corsHeaders } = deps;

	/**
	 * List discussion guides for a study.
	 * @route GET /api/guides?study=<StudyAirtableId>
	 * @param {string} origin
	 * @param {URL} url
	 */
	async function listGuides(origin, url) {
		const studyId = url.searchParams.get("study");
		if (!studyId) {
			return json({ ok: false, error: "Missing study query" }, 400, corsHeaders(origin));
		}

		const base = env.AIRTABLE_BASE_ID;
		const tGuides = encodeURIComponent(env.AIRTABLE_TABLE_GUIDES || "Discussion Guides");
		const atBase = `https://api.airtable.com/v0/${base}/${tGuides}`;
		const headers = { "Authorization": `Bearer ${env.AIRTABLE_API_KEY}` };

		const records = [];
		let offset;
		do {
			const params = new URLSearchParams({ pageSize: "100" });
			if (offset) params.set("offset", offset);
			const resp = await fetchWithTimeout(`${atBase}?${params.toString()}`, { headers }, cfg.TIMEOUT_MS);
			const txt = await resp.text();

			if (!resp.ok) {
				log.error("airtable.guides.list.fail", { status: resp.status, text: safeText(txt) });
				return json({ ok: false, error: `Airtable ${resp.status}`, detail: safeText(txt) }, resp.status, corsHeaders(origin));
			}

			let js;
			try { js = JSON.parse(txt); } catch { js = { records: [] }; }
			records.push(...(js.records || []));
			offset = js.offset;
		} while (offset);

		// Extract only guides linked to the target Study ID
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
		return json({ ok: true, guides }, 200, corsHeaders(origin));
	}

	/**
	 * Create a new guide for a study.
	 * @route POST /api/guides
	 */
	async function createGuide(request, origin) {
		const body = await request.text();
		let payload;
		try { payload = JSON.parse(body); } catch {
			return json({ ok: false, error: "Invalid JSON" }, 400, corsHeaders(origin));
		}
		if (!payload.study_airtable_id || !payload.title) {
			return json({ ok: false, error: "Missing study_airtable_id or title" }, 400, corsHeaders(origin));
		}

		const base = env.AIRTABLE_BASE_ID;
		const table = encodeURIComponent(env.AIRTABLE_TABLE_GUIDES);
		const url = `https://api.airtable.com/v0/${base}/${table}`;
		const headers = {
			"Authorization": `Bearer ${env.AIRTABLE_API_KEY}`,
			"Content-Type": "application/json"
		};

		const fields = {
			Study: [payload.study_airtable_id],
			Title: payload.title,
			Status: "draft",
			Source: mdToAirtableRich(payload.sourceMarkdown || ""),
			Variables: JSON.stringify(payload.variables || {})
		};

		const res = await fetchWithTimeout(url, {
			method: "POST",
			headers,
			body: JSON.stringify({ records: [{ fields }] })
		}, cfg.TIMEOUT_MS);

		const txt = await res.text();
		if (!res.ok) {
			log.error("airtable.guide.create.fail", { status: res.status, text: safeText(txt) });
			return json({ ok: false, error: `Airtable ${res.status}`, detail: safeText(txt) }, res.status, corsHeaders(origin));
		}

		let js;
		try { js = JSON.parse(txt); } catch { js = { records: [] }; }

		const id = js.records?.[0]?.id || null;
		return json({ ok: true, id }, 200, corsHeaders(origin));
	}

	/**
	 * Update guide metadata or markdown.
	 * @route PATCH /api/guides/:id
	 */
	async function updateGuide(request, origin, id) {
		const body = await request.text();
		let payload;
		try { payload = JSON.parse(body); } catch {
			return json({ ok: false, error: "Invalid JSON" }, 400, corsHeaders(origin));
		}

		const fields = {};
		if (typeof payload.title === "string") fields.Title = payload.title;
		if (typeof payload.status === "string") fields.Status = payload.status;
		if (typeof payload.sourceMarkdown === "string") fields.Source = mdToAirtableRich(payload.sourceMarkdown);
		if (payload.variables) fields.Variables = JSON.stringify(payload.variables);

		const base = env.AIRTABLE_BASE_ID;
		const table = encodeURIComponent(env.AIRTABLE_TABLE_GUIDES);
		const url = `https://api.airtable.com/v0/${base}/${table}`;
		const headers = {
			"Authorization": `Bearer ${env.AIRTABLE_API_KEY}`,
			"Content-Type": "application/json"
		};

		const res = await fetchWithTimeout(url, {
			method: "PATCH",
			headers,
			body: JSON.stringify({ records: [{ id, fields }] })
		}, cfg.TIMEOUT_MS);

		const txt = await res.text();
		if (!res.ok) {
			log.error("airtable.guide.update.fail", { status: res.status, text: safeText(txt) });
			return json({ ok: false, error: `Airtable ${res.status}`, detail: safeText(txt) }, res.status, corsHeaders(origin));
		}

		return json({ ok: true, id }, 200, corsHeaders(origin));
	}

	/**
	 * Publish a guide (set Status = 'published').
	 * @route POST /api/guides/:id/publish
	 */
	async function publishGuide(origin, id) {
		const base = env.AIRTABLE_BASE_ID;
		const table = encodeURIComponent(env.AIRTABLE_TABLE_GUIDES);
		const url = `https://api.airtable.com/v0/${base}/${table}`;
		const headers = {
			"Authorization": `Bearer ${env.AIRTABLE_API_KEY}`,
			"Content-Type": "application/json"
		};

		const body = JSON.stringify({ records: [{ id, fields: { Status: "published", PublishedAt: new Date().toISOString() } }] });
		const res = await fetchWithTimeout(url, { method: "PATCH", headers, body }, cfg.TIMEOUT_MS);

		const txt = await res.text();
		if (!res.ok) {
			log.error("airtable.guide.publish.fail", { status: res.status, text: safeText(txt) });
			return json({ ok: false, error: `Airtable ${res.status}`, detail: safeText(txt) }, res.status, corsHeaders(origin));
		}

		return json({ ok: true, id, status: "published" }, 200, corsHeaders(origin));
	}

	return {
		listGuides,
		createGuide,
		updateGuide,
		publishGuide
	};
}