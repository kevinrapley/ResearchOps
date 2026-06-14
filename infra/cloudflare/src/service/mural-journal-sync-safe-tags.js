/**
 * @file src/service/mural-journal-sync-safe-tags.js
 * @module service/mural-journal-sync-safe-tags
 * @summary Creates missing Mural tags and persists journal-entry/widget mappings in D1 and Airtable.
 */

import * as BaseMuralJournalSync from "./mural-journal-sync-layout.js";
import { createRecords } from "./internals/airtable.js";
import { d1All, d1Run } from "./internals/researchops-d1.js";

const SYSTEM_TAG_RE = /^journal-entry:/i;
const MURAL_ROOT = "https://app.mural.co/api/public/v1";
const MURAL_MINT_TAG_STYLE = {
	backgroundColor: "#DDF7E8FF",
	borderColor: "#98DDB8FF",
	color: "#0B0C0CFF"
};

function safeText(value) {
	return String(value || "").trim();
}

function normalizeTags(value) {
	if (Array.isArray(value)) {
		return value.map(tag => safeText(typeof tag === "string" ? tag : (tag?.text || tag?.name || tag?.title || tag?.label || ""))).filter(Boolean);
	}
	if (!value) return [];
	return String(value).split(",").map(tag => tag.trim()).filter(Boolean);
}

function dedupeTags(tags) {
	const seen = new Set();
	const out = [];
	for (const tag of tags.map(safeText).filter(Boolean)) {
		const key = tag.toLowerCase();
		if (!seen.has(key)) {
			seen.add(key);
			out.push(tag);
		}
	}
	return out;
}

function truncateMuralTag(tag) {
	const text = safeText(tag);
	return text.length > 25 ? text.slice(0, 25) : text;
}

function userFacingTags(tags) {
	return dedupeTags(normalizeTags(tags).filter(tag => !SYSTEM_TAG_RE.test(tag)).map(truncateMuralTag).filter(Boolean));
}

function hasAirtable(env) {
	return !!((env?.AIRTABLE_BASE_ID || env?.AIRTABLE_BASE) && (env?.AIRTABLE_API_KEY || env?.AIRTABLE_PAT || env?.AIRTABLE_ACCESS_TOKEN));
}

function hasD1(env) {
	return !!env?.RESEARCHOPS_D1;
}

function headerValue(headers, key) {
	if (!headers) return "";
	if (headers instanceof Headers) return headers.get(key) || "";
	if (Array.isArray(headers)) {
		const found = headers.find(([name]) => String(name || "").toLowerCase() === key.toLowerCase());
		return found ? String(found[1] || "") : "";
	}
	return String(headers[key] || headers[key.toLowerCase()] || "");
}

function accessTokenFromHeaders(headers) {
	const match = headerValue(headers, "Authorization").match(/^Bearer\s+(.+)$/i);
	return match ? match[1] : "";
}

function muralIdFromUrl(url) {
	const match = String(url || "").match(/\/murals\/([^/]+)\/(?:widgets|tags)(?:[/?#]|$)/);
	return match ? decodeURIComponent(match[1]) : "";
}

function widgetIdFromUrl(url) {
	const match = String(url || "").match(/\/widgets\/(?:sticky-note\/)?([^/?#]+)/);
	return match ? decodeURIComponent(match[1]) : "";
}

function isMuralWidgetWrite(url, init) {
	const method = String(init?.method || "GET").toUpperCase();
	return (method === "POST" || method === "PATCH") && /app\.mural\.co\/api\/public\/v1\/murals\/[^/]+\/widgets(?:\/|$)/.test(String(url || ""));
}

function isMuralWidgetsRead(url, init) {
	const method = String(init?.method || "GET").toUpperCase();
	return method === "GET" && /app\.mural\.co\/api\/public\/v1\/murals\/[^/]+\/widgets(?:\?|$)/.test(String(url || ""));
}

function isMuralTagsRead(url, init) {
	const method = String(init?.method || "GET").toUpperCase();
	return method === "GET" && /app\.mural\.co\/api\/public\/v1\/murals\/[^/]+\/tags(?:\?|$)/.test(String(url || ""));
}

function tagsFromListBody(body) {
	if (Array.isArray(body?.value)) return body.value;
	if (Array.isArray(body?.tags)) return body.tags;
	if (Array.isArray(body)) return body;
	return [];
}

function isPatchRequest(init) {
	return String(init?.method || "GET").toUpperCase() === "PATCH";
}

async function bodyAsJson(body) {
	if (!body || typeof body !== "string") return null;
	try {
		return JSON.parse(body);
	} catch {
		return null;
	}
}

async function requestBody(request) {
	try {
		return await request.clone().json();
	} catch {
		return {};
	}
}

function airtableTableName(env) {
	return env?.AIRTABLE_TABLE_MURAL_JOURNAL_SYNC || env?.AIRTABLE_TABLE_MURAL_JOURNAL_MAPPINGS || "Mural Journal Sync";
}

async function ensureD1MappingTable(env) {
	if (!hasD1(env)) throw new Error("D1 binding RESEARCHOPS_D1 is not configured");
	await d1Run(env, `
		CREATE TABLE IF NOT EXISTS mural_journal_entry_widgets (
			journal_entry_id TEXT NOT NULL,
			mural_id TEXT NOT NULL,
			widget_id TEXT NOT NULL,
			project_id TEXT,
			category TEXT,
			sync_status TEXT,
			action TEXT,
			synced_at TEXT,
			updated_at TEXT,
			PRIMARY KEY (journal_entry_id, mural_id)
		);
	`);
}

async function listD1MappingsForMural(env, muralId) {
	if (!hasD1(env) || !muralId) return [];
	await ensureD1MappingTable(env);
	return d1All(env, `
		SELECT journal_entry_id, mural_id, widget_id, project_id, category, sync_status, action, synced_at, updated_at
		FROM mural_journal_entry_widgets
		WHERE mural_id = ?;
	`, [muralId]);
}

async function upsertD1Mapping(env, mapping) {
	await ensureD1MappingTable(env);
	await d1Run(env, `
		INSERT INTO mural_journal_entry_widgets (
			journal_entry_id, mural_id, widget_id, project_id, category, sync_status, action, synced_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(journal_entry_id, mural_id)
		DO UPDATE SET
			widget_id = excluded.widget_id,
			project_id = excluded.project_id,
			category = excluded.category,
			sync_status = excluded.sync_status,
			action = excluded.action,
			synced_at = excluded.synced_at,
			updated_at = excluded.updated_at;
	`, [
		mapping.journalEntryId,
		mapping.muralId,
		mapping.widgetId,
		mapping.projectId,
		mapping.category,
		mapping.syncStatus,
		mapping.action,
		mapping.syncedAt,
		mapping.updatedAt
	]);
}

async function appendAirtableMapping(svc, mapping) {
	if (!hasAirtable(svc.env)) throw new Error("Airtable is not configured");
	await createRecords(svc.env, airtableTableName(svc.env), [{
		fields: {
			"Journal Entry ID": mapping.journalEntryId,
			"Project ID": mapping.projectId,
			"Mural ID": mapping.muralId,
			"Widget ID": mapping.widgetId,
			"Category": mapping.category,
			"Sync Status": mapping.syncStatus,
			"Action": mapping.action,
			"Synced At": mapping.syncedAt,
			"Updated At": mapping.updatedAt
		}
	}], svc?.cfg?.TIMEOUT_MS);
}

function successfulOutcomes(data) {
	if (Array.isArray(data?.outcomes)) return data.outcomes.filter(outcome => outcome?.ok && outcome?.entryId && outcome?.widgetId);
	if (data?.ok && data?.entryId && data?.widgetId) return [data];
	return [];
}

async function persistMappings(svc, body, data) {
	const outcomes = successfulOutcomes(data);
	if (!outcomes.length) return { ok: true, persisted: 0, d1: [], airtable: [] };

	const now = new Date().toISOString();
	const muralId = safeText(data?.muralId || body?.muralId || "");
	const projectId = safeText(body?.projectId || body?.project || body?.project_airtable_id || body?.project_local_id || "");
	const results = { ok: true, persisted: 0, d1: [], airtable: [] };

	for (const outcome of outcomes) {
		const mapping = {
			journalEntryId: safeText(outcome.entryId),
			muralId,
			widgetId: safeText(outcome.widgetId),
			projectId,
			category: safeText(outcome.category),
			syncStatus: "synced",
			action: safeText(outcome.action),
			syncedAt: now,
			updatedAt: now
		};

		try {
			await upsertD1Mapping(svc.env, mapping);
			results.d1.push({ ok: true, journalEntryId: mapping.journalEntryId, widgetId: mapping.widgetId });
		} catch (err) {
			results.ok = false;
			results.d1.push({ ok: false, journalEntryId: mapping.journalEntryId, error: String(err?.message || err) });
		}

		try {
			await appendAirtableMapping(svc, mapping);
			results.airtable.push({ ok: true, journalEntryId: mapping.journalEntryId, widgetId: mapping.widgetId });
		} catch (err) {
			results.ok = false;
			results.airtable.push({ ok: false, journalEntryId: mapping.journalEntryId, error: String(err?.message || err) });
		}

		results.persisted += 1;
	}

	return results;
}

async function listMuralTags(accessToken, muralId, tagCache = null) {
	if (tagCache && tagCache.has(muralId)) return tagCache.get(muralId);
	const res = await fetch(`${MURAL_ROOT}/murals/${muralId}/tags`, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: "application/json"
		}
	});
	const body = await res.json().catch(() => ({}));
	const tags = res.ok ? (Array.isArray(body?.value) ? body.value : (Array.isArray(body?.tags) ? body.tags : [])) : [];
	if (tagCache && res.ok) tagCache.set(muralId, tags);
	return tags;
}

async function createMuralTag(accessToken, muralId, tag) {
	const text = truncateMuralTag(tag);
	if (!text) return null;
	const bodies = [{ text, ...MURAL_MINT_TAG_STYLE }, { text }];

	for (const body of bodies) {
		const res = await fetch(`${MURAL_ROOT}/murals/${muralId}/tags`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
				Accept: "application/json"
			},
			body: JSON.stringify(body)
		});
		const data = await res.json().catch(() => ({}));
		if (res.ok) {
			const created = Array.isArray(data?.value) ? data.value[0] : (data?.value || data);
			return normalizeMuralTagRecord({ ...created, text: created?.text || text });
		}
	}
	return null;
}

function normalizeMuralTagRecord(tag) {
	const text = truncateMuralTag(tag?.text || tag?.name || tag?.title || tag?.label || tag);
	const id = safeText(tag?.id || tag?.tagId || "");
	return text ? { ...tag, id, text } : null;
}

function isMintStyledTag(record) {
	return safeText(record?.backgroundColor).toUpperCase() === MURAL_MINT_TAG_STYLE.backgroundColor &&
		safeText(record?.borderColor).toUpperCase() === MURAL_MINT_TAG_STYLE.borderColor;
}

async function restyleMuralTagAsMint(accessToken, muralId, record) {
	if (!record?.id) return record;
	const res = await fetch(`${MURAL_ROOT}/murals/${muralId}/tags/${record.id}`, {
		method: "PATCH",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
			Accept: "application/json"
		},
		body: JSON.stringify(MURAL_MINT_TAG_STYLE)
	});
	if (!res.ok) return record;
	return { ...record, ...MURAL_MINT_TAG_STYLE };
}

async function ensureKnownTags(accessToken, muralId, tags, createableTags = tags, tagCache = null) {
	const desired = userFacingTags(tags);
	if (!desired.length || !accessToken || !muralId) return [];
	const createable = new Set(userFacingTags(createableTags).map(tag => tag.toLowerCase()));

	const known = new Map();
	const listed = await listMuralTags(accessToken, muralId, tagCache);
	for (const tag of listed) {
		const record = normalizeMuralTagRecord(tag);
		if (record) known.set(record.text.toLowerCase(), record);
	}

	const safe = [];
	for (const tag of desired) {
		const key = tag.toLowerCase();
		if (known.has(key)) {
			let record = known.get(key);
			// User-authored tags created by earlier syncs (or by hand) keep
			// whatever style they were created with; bring them onto the
			// Mint contract. Board-curated tags are never restyled.
			if (createable.has(key) && !isMintStyledTag(record)) {
				record = await restyleMuralTagAsMint(accessToken, muralId, record).catch(() => record);
				known.set(key, record);
				if (isMintStyledTag(record) && tagCache && tagCache.has(muralId)) {
					const cached = tagCache.get(muralId);
					const idx = cached.findIndex(tag => safeText(tag?.id || tag?.tagId) === record.id);
					if (idx >= 0) cached[idx] = { ...cached[idx], ...MURAL_MINT_TAG_STYLE };
				}
			}
			safe.push(record);
			continue;
		}
		if (!createable.has(key)) continue;
		const record = await createMuralTag(accessToken, muralId, tag).catch(() => null);
		if (record) {
			known.set(record.text.toLowerCase(), record);
			safe.push(record);
			if (tagCache && tagCache.has(muralId)) tagCache.get(muralId).push(record);
		}
	}
	return safe;
}

async function responseMentionsMissingTag(response) {
	if (!response || response.ok || response.status !== 400) return false;
	const body = await response.clone().json().catch(() => ({}));
	const text = JSON.stringify(body).toLowerCase();
	return text.includes("specified tag does not exist") || text.includes("tag does not exist");
}

async function responseMentionsWrongWidgetType(response) {
	if (!response || response.ok || response.status !== 400) return false;
	const body = await response.clone().json().catch(() => ({}));
	const text = JSON.stringify(body).toLowerCase();
	return text.includes("operation cannot be performed on this widget type");
}

function removeUnsupportedFields(body) {
	if (Array.isArray(body)) return body.map(item => removeUnsupportedFields(item));
	if (body && typeof body === "object") {
		const next = { ...body };
		delete next.title;
		delete next.researchOpsUserTags;
		if (Array.isArray(next.tags)) {
			next.tags = userFacingTags(next.tags);
			if (!next.tags.length) delete next.tags;
		}
		return next;
	}
	return body;
}

function withoutTags(body) {
	if (Array.isArray(body)) return body.map(item => withoutTags(item));
	if (body && typeof body === "object") {
		const next = { ...body };
		delete next.tags;
		delete next.title;
		delete next.researchOpsUserTags;
		return next;
	}
	return body;
}

function tagsFromBody(body) {
	if (Array.isArray(body)) return body.flatMap(item => normalizeTags(item?.tags));
	return normalizeTags(body?.tags);
}

function researchOpsUserTagsFromBody(body) {
	if (Array.isArray(body)) return body.flatMap(item => normalizeTags(item?.researchOpsUserTags));
	return normalizeTags(body?.researchOpsUserTags);
}

function widgetsFromBody(body) {
	if (Array.isArray(body?.value)) return body.value;
	if (Array.isArray(body?.widgets)) return body.widgets;
	if (Array.isArray(body)) return body;
	return [];
}

function firstWidgetIdFromBody(body) {
	const value = Array.isArray(body?.value) ? body.value[0] : body?.value;
	return safeText(value?.id || body?.id || "");
}

function widgetById(widgetCache, muralId, widgetId) {
	const widgets = widgetCache.get(muralId) || [];
	return widgets.find(widget => safeText(widget?.id) === safeText(widgetId)) || null;
}

function numberValue(value, fallback) {
	const n = Number(value);
	return Number.isFinite(n) ? n : fallback;
}

function replacementTextFromBody(body) {
	if (!body || typeof body !== "object") return "";
	return safeText(body.htmlText || body.text || body.content || "");
}

function replacementStyleFromWidget(widget) {
	const style = widget?.style || {};
	const backgroundColor = safeText(style.backgroundColor || widget?.backgroundColor || "#FFFFFFFF") || "#FFFFFFFF";
	return {
		backgroundColor,
		fontSize: numberValue(style.fontSize ?? widget?.fontSize, 23),
		textAlign: safeText(style.textAlign || widget?.textAlign || "left") || "left"
	};
}

function replacementStickyBodies(sourceWidget, requestedBody) {
	const geometry = sourceWidget?.geometry || sourceWidget?.bounds || {};
	const text = replacementTextFromBody(requestedBody);
	const x = numberValue(sourceWidget?.x ?? geometry.x, 0);
	const y = numberValue(sourceWidget?.y ?? geometry.y, 0);
	const style = replacementStyleFromWidget(sourceWidget);
	return [
		{
			x,
			y,
			width: numberValue(sourceWidget?.width ?? geometry.width, 260),
			height: numberValue(sourceWidget?.height ?? geometry.height, 160),
			text,
			style,
			stackingOrder: numberValue(sourceWidget?.stackingOrder, 1) + 1
		},
		{ x, y, text, backgroundColor: style.backgroundColor },
		{ x, y, text }
	];
}

async function createReplacementSticky(originalFetch, accessToken, muralId, sourceWidget, requestedBody) {
	let lastResponse = null;
	for (const body of replacementStickyBodies(sourceWidget, requestedBody)) {
		lastResponse = await originalFetch(`${MURAL_ROOT}/murals/${muralId}/widgets/sticky-note`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
				Accept: "application/json"
			},
			body: JSON.stringify(body)
		});
		if (lastResponse.ok) return lastResponse;
	}
	return lastResponse;
}

function dedupeTagRecords(tagRecords) {
	const seen = new Set();
	const out = [];
	for (const record of tagRecords) {
		const id = safeText(record?.id);
		if (!id || seen.has(id)) continue;
		seen.add(id);
		out.push(record);
	}
	return out;
}

/**
 * Mural's widget PATCH replaces the whole tag set, so an update must carry the
 * tags already on the widget (the Raspberry category and Snowberry project
 * tags from the template) or they are silently removed.
 */
async function existingWidgetTagRecords(accessToken, muralId, widgetId, widgetCache, tagCache) {
	const widget = widgetById(widgetCache, muralId, widgetId);
	const widgetTags = Array.isArray(widget?.tags) ? widget.tags : [];
	if (!widgetTags.length) return [];

	const listed = await listMuralTags(accessToken, muralId, tagCache).catch(() => []);
	const byId = new Map();
	const byText = new Map();
	for (const tag of listed) {
		const record = normalizeMuralTagRecord(tag);
		if (!record?.id) continue;
		byId.set(record.id, record);
		byText.set(record.text.toLowerCase(), record);
	}

	const records = [];
	for (const tag of widgetTags) {
		if (typeof tag === "string") {
			const record = byId.get(safeText(tag)) || byText.get(safeText(tag).toLowerCase());
			if (record) records.push(record);
			continue;
		}
		const id = safeText(tag?.id || tag?.tagId);
		const text = safeText(tag?.text || tag?.name || tag?.title || tag?.label);
		const record = (id && byId.get(id)) || (text && byText.get(text.toLowerCase())) || (id ? { ...tag, id, text } : null);
		if (record) records.push(record);
	}
	return dedupeTagRecords(records);
}

async function applyTagsToWidget(originalFetch, accessToken, muralId, widgetId, tagRecords) {
	const tagLabels = dedupeTags(tagRecords.map(tag => safeText(tag?.text || tag?.name || tag?.title || tag?.label)).filter(Boolean));
	if (!accessToken || !muralId || !widgetId || !tagLabels.length) return false;
	const urls = [
		`${MURAL_ROOT}/murals/${muralId}/widgets/sticky-note/${widgetId}`,
		`${MURAL_ROOT}/murals/${muralId}/widgets/${widgetId}`
	];
	for (const url of urls) {
		const res = await originalFetch(url, {
			method: "PATCH",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
				Accept: "application/json"
			},
			body: JSON.stringify({ tags: tagLabels })
		});
		if (res.ok) return true;
	}
	return false;
}

async function attachUserTagsByTagEndpoint(originalFetch, accessToken, muralId, widgetId, tagRecords, createableTags) {
	const createable = new Set(userFacingTags(createableTags).map(tag => tag.toLowerCase()));
	for (const tag of tagRecords) {
		if (!createable.has(safeText(tag?.text).toLowerCase())) continue;
		await originalFetch(`${MURAL_ROOT}/murals/${muralId}/tags`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
				Accept: "application/json"
			},
			body: JSON.stringify({ text: tag.text, ...MURAL_MINT_TAG_STYLE, widgets: [{ id: widgetId }] })
		}).catch(() => null);
	}
}

async function fallbackToReplacementSticky({ originalFetch, init, url, body, muralId, confirmedTags, firstResponse, widgetCache }) {
	if (!isPatchRequest(init)) return firstResponse;
	if (!(await responseMentionsWrongWidgetType(firstResponse))) return firstResponse;

	const accessToken = accessTokenFromHeaders(init.headers);
	const widgetId = widgetIdFromUrl(url);
	const sourceWidget = widgetById(widgetCache, muralId, widgetId);
	const replacementText = replacementTextFromBody(body);
	if (!accessToken || !muralId || !sourceWidget || !replacementText) return firstResponse;

	const replacementResponse = await createReplacementSticky(originalFetch, accessToken, muralId, sourceWidget, body);
	if (replacementResponse?.ok && confirmedTags.length) {
		const responseBody = await replacementResponse.clone().json().catch(() => ({}));
		const replacementWidgetId = firstWidgetIdFromBody(responseBody);
		if (replacementWidgetId) {
			await applyTagsToWidget(originalFetch, accessToken, muralId, replacementWidgetId, confirmedTags).catch(() => false);
		}
	}
	return replacementResponse || firstResponse;
}

function annotateWidgetsWithMappings(body, mappings) {
	const byWidgetId = new Map();
	for (const mapping of mappings) {
		const widgetId = safeText(mapping.widget_id || mapping.widgetId);
		const entryId = safeText(mapping.journal_entry_id || mapping.journalEntryId);
		const category = safeText(mapping.category);
		if (widgetId && entryId) byWidgetId.set(widgetId, { entryId, category });
	}

	function annotate(widget) {
		const marker = byWidgetId.get(safeText(widget?.id));
		if (!marker) return widget;
		const tags = dedupeTags([...(normalizeTags(widget.tags)), marker.category, `journal-entry:${marker.entryId}`]);
		return { ...widget, title: `journal-entry:${marker.entryId}`, tags };
	}

	if (Array.isArray(body?.value)) return { ...body, value: body.value.map(annotate) };
	if (Array.isArray(body?.widgets)) return { ...body, widgets: body.widgets.map(annotate) };
	if (Array.isArray(body)) return body.map(annotate);
	return body;
}

function jsonResponseFrom(original, body) {
	const headers = new Headers(original.headers);
	headers.set("content-type", "application/json; charset=utf-8");
	return new Response(JSON.stringify(body), { status: original.status, statusText: original.statusText, headers });
}

function mergeWidgetCache(widgetCache, muralId, pageWidgets) {
	const byId = new Map();
	for (const widget of widgetCache.get(muralId) || []) {
		const id = safeText(widget?.id);
		if (id) byId.set(id, widget);
	}
	for (const widget of pageWidgets) {
		const id = safeText(widget?.id);
		if (id) byId.set(id, widget);
	}
	widgetCache.set(muralId, Array.from(byId.values()));
}

function installSafeMuralFetch(svc, originalFetch) {
	const widgetCache = new Map();
	const tagCache = new Map();

	return async function safeMuralFetch(input, init = {}) {
		const url = typeof input === "string" ? input : input?.url;
		const muralId = muralIdFromUrl(url);

		if (isMuralWidgetsRead(url, init)) {
			const response = await originalFetch(input, init);
			if (!response.ok || !muralId) return response;
			const body = await response.clone().json().catch(() => null);
			if (!body) return response;
			mergeWidgetCache(widgetCache, muralId, widgetsFromBody(body));
			const mappings = await listD1MappingsForMural(svc.env, muralId).catch(() => []);
			return jsonResponseFrom(response, annotateWidgetsWithMappings(body, mappings));
		}

		if (isMuralTagsRead(url, init)) {
			const response = await originalFetch(input, init);
			if (response.ok && muralId) {
				const body = await response.clone().json().catch(() => null);
				if (body) tagCache.set(muralId, tagsFromListBody(body));
			}
			return response;
		}

		if (!isMuralWidgetWrite(url, init)) return originalFetch(input, init);

		const body = await bodyAsJson(init.body);
		const desiredTags = tagsFromBody(body);
		const createableTags = researchOpsUserTagsFromBody(body);
		if (!body || !desiredTags.length) {
			return originalFetch(input, { ...init, body: body ? JSON.stringify(removeUnsupportedFields(body)) : init.body });
		}

		const accessToken = accessTokenFromHeaders(init.headers);
		let confirmedTags = await ensureKnownTags(accessToken, muralId, desiredTags, createableTags, tagCache).catch(() => []);
		if (isPatchRequest(init) && confirmedTags.length) {
			const preserved = await existingWidgetTagRecords(accessToken, muralId, widgetIdFromUrl(url), widgetCache, tagCache).catch(() => []);
			confirmedTags = dedupeTagRecords([...confirmedTags, ...preserved]);
		}
		const firstResponse = await originalFetch(input, { ...init, body: JSON.stringify(withoutTags(body)) });

		if (firstResponse.ok && confirmedTags.length) {
			const responseBody = await firstResponse.clone().json().catch(() => ({}));
			const widgetId = firstWidgetIdFromBody(responseBody) || widgetIdFromUrl(url);
			const applied = await applyTagsToWidget(originalFetch, accessToken, muralId, widgetId, confirmedTags).catch(() => false);
			if (!applied) await attachUserTagsByTagEndpoint(originalFetch, accessToken, muralId, widgetId, confirmedTags, createableTags);
		}

		const replacementResponse = await fallbackToReplacementSticky({
			originalFetch,
			init,
			url,
			body,
			muralId,
			confirmedTags,
			firstResponse,
			widgetCache
		});
		if (replacementResponse !== firstResponse) return replacementResponse;

		if (!(await responseMentionsMissingTag(firstResponse))) return firstResponse;
		return originalFetch(input, { ...init, body: JSON.stringify(withoutTags(body)) });
	};
}

async function responseWithMappings(response, svc, body) {
	const data = await response.clone().json().catch(() => null);
	if (!data || !data.ok || (data.mode !== "hydrate" && data.mode !== "entry")) return response;
	const mappings = await persistMappings(svc, body, data);
	return jsonResponseFrom(response, { ...data, mappings });
}

export async function muralJournalSync(svc, request, origin) {
	const originalFetch = globalThis.fetch;
	const body = await requestBody(request);
	globalThis.fetch = installSafeMuralFetch(svc, originalFetch);
	try {
		const response = await BaseMuralJournalSync.muralJournalSync(svc, request, origin);
		return responseWithMappings(response, svc, body);
	} finally {
		globalThis.fetch = originalFetch;
	}
}
