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
	const match = String(url || "").match(/\/murals\/([^/]+)\/widgets(?:\/|$)/);
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

async function listMuralTags(accessToken, muralId) {
	const res = await fetch(`${MURAL_ROOT}/murals/${muralId}/tags`, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: "application/json"
		}
	});
	const body = await res.json().catch(() => ({}));
	if (!res.ok) return [];
	return Array.isArray(body?.value) ? body.value : (Array.isArray(body?.tags) ? body.tags : []);
}

async function createMuralTag(accessToken, muralId, tag) {
	const text = truncateMuralTag(tag);
	if (!text) return "";
	const bodies = [{ text }, { text, backgroundColor: "#F6D6FF", borderColor: "#B15FD1", color: "#0B0C0C" }];

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
			return truncateMuralTag(created?.text || text);
		}
	}
	return "";
}

async function ensureKnownTags(accessToken, muralId, tags) {
	const desired = userFacingTags(tags);
	if (!desired.length || !accessToken || !muralId) return [];

	const known = new Map();
	for (const tag of await listMuralTags(accessToken, muralId)) {
		const text = truncateMuralTag(tag?.text || tag?.name || tag?.title || tag);
		if (text) known.set(text.toLowerCase(), text);
	}

	const safe = [];
	for (const tag of desired) {
		const key = tag.toLowerCase();
		if (known.has(key)) {
			safe.push(known.get(key));
			continue;
		}
		const created = await createMuralTag(accessToken, muralId, tag).catch(() => "");
		if (created) {
			known.set(created.toLowerCase(), created);
			safe.push(created);
		}
	}
	return dedupeTags(safe);
}

async function responseMentionsMissingTag(response) {
	if (!response || response.ok || response.status !== 400) return false;
	const body = await response.clone().json().catch(() => ({}));
	const text = JSON.stringify(body).toLowerCase();
	return text.includes("specified tag does not exist") || text.includes("tag does not exist");
}

function removeUnsupportedFields(body) {
	if (Array.isArray(body)) return body.map(item => removeUnsupportedFields(item));
	if (body && typeof body === "object") {
		const next = { ...body };
		delete next.title;
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
		return next;
	}
	return body;
}

function withTags(body, tags) {
	if (Array.isArray(body)) return body.map(item => withTags(item, tags));
	if (body && typeof body === "object") {
		const next = removeUnsupportedFields(body);
		return tags.length ? { ...next, tags } : next;
	}
	return body;
}

function tagsFromBody(body) {
	if (Array.isArray(body)) return body.flatMap(item => normalizeTags(item?.tags));
	return normalizeTags(body?.tags);
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

function installSafeMuralFetch(svc, originalFetch) {
	return async function safeMuralFetch(input, init = {}) {
		const url = typeof input === "string" ? input : input?.url;
		const muralId = muralIdFromUrl(url);

		if (isMuralWidgetsRead(url, init)) {
			const response = await originalFetch(input, init);
			if (!response.ok || !muralId) return response;
			const body = await response.clone().json().catch(() => null);
			if (!body) return response;
			const mappings = await listD1MappingsForMural(svc.env, muralId).catch(() => []);
			return jsonResponseFrom(response, annotateWidgetsWithMappings(body, mappings));
		}

		if (!isMuralWidgetWrite(url, init)) return originalFetch(input, init);

		const body = await bodyAsJson(init.body);
		const desiredTags = tagsFromBody(body);
		if (!body || !desiredTags.length) {
			return originalFetch(input, { ...init, body: body ? JSON.stringify(removeUnsupportedFields(body)) : init.body });
		}

		const accessToken = accessTokenFromHeaders(init.headers);
		const confirmedTags = await ensureKnownTags(accessToken, muralId, desiredTags).catch(() => []);
		const firstResponse = await originalFetch(input, { ...init, body: JSON.stringify(confirmedTags.length ? withTags(body, confirmedTags) : withoutTags(body)) });

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
