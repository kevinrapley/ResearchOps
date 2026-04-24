/**
 * @file src/service/mural-journal-sync.js
 * @module service/mural-journal-sync
 * @summary Idempotent Reflexive Journal to Mural sync and hydration.
 */

import {
	refreshAccessToken,
	verifyHomeOfficeByCompany,
	getWidgets,
	updateSticky
} from "../lib/mural.js";

const CATEGORY_KEYS = ["perceptions", "procedures", "decisions", "introspections"];
const DEFAULT_WIDTH = 520;
const DEFAULT_HEIGHT = 260;
const GRID_GAP = 32;
const PURPOSE_REFLEXIVE = "reflexive_journal";
const TEMPLATE_PLACEHOLDER_RE = /This is a .*sticky note that will contain|Further .*entries will appear|single .*from the Research Operations app|Research Operations app/i;

function safeText(value) {
	return String(value || "").trim();
}

function normalizeCategoryKey(value) {
	const raw = safeText(value).toLowerCase();
	if (raw === "perceptions" || raw.includes("perception")) return "perceptions";
	if (raw === "procedures" || raw.includes("procedure") || raw.includes("day-to-day")) return "procedures";
	if (raw === "decisions" || raw.includes("decision") || raw.includes("methodological")) return "decisions";
	if (raw === "introspections" || raw.includes("introspection") || raw.includes("personal")) return "introspections";
	return "";
}

function normalizeTags(value) {
	if (Array.isArray(value)) {
		return value
			.map(v => safeText(typeof v === "string" ? v : (v?.text || v?.name || v?.title || v?.label || "")))
			.filter(Boolean);
	}
	if (!value) return [];
	return String(value).split(",").map(s => s.trim()).filter(Boolean);
}

function tagKeys(widget) {
	return normalizeTags(widget?.tags).map(t => t.toLowerCase());
}

function widgetText(widget) {
	return safeText(widget?.text || widget?.htmlText || "");
}

function widgetMetadataText(widget) {
	return [
		widget?.title,
		widget?.name,
		widget?.instruction,
		widget?.hyperlinkTitle,
		widget?.presentationTitle
	].map(safeText).filter(Boolean).join(" ").toLowerCase();
}

function numeric(value, fallback = 0) {
	const n = Number(value);
	return Number.isFinite(n) ? n : fallback;
}

function firstMuralValue(body) {
	if (Array.isArray(body?.value)) return body.value[0] || null;
	if (body?.value) return body.value;
	if (Array.isArray(body)) return body[0] || null;
	return body || null;
}

function muralErrorSummary(error) {
	const body = error?.body || error?.secondError || error?.firstError || null;
	if (!body) return String(error?.message || error);
	if (typeof body === "string") return body;
	return safeText(body.message || body.code || body.error || JSON.stringify(body));
}

function normalizeWidget(widget) {
	const geometry = widget?.geometry || widget?.bounds || {};
	return {
		...widget,
		id: widget?.id,
		type: safeText(widget?.type).toLowerCase(),
		text: widgetText(widget),
		tags: normalizeTags(widget?.tags),
		x: numeric(widget?.x ?? geometry.x, 0),
		y: numeric(widget?.y ?? geometry.y, 0),
		width: numeric(widget?.width ?? geometry.width, DEFAULT_WIDTH),
		height: numeric(widget?.height ?? geometry.height, DEFAULT_HEIGHT),
		createdAt: widget?.createdAt || widget?.createdOn || widget?.updatedAt || widget?.updatedOn || null
	};
}

function isTemplatePlaceholder(widget) {
	const text = widgetText(widget);
	return !text || TEMPLATE_PLACEHOLDER_RE.test(text);
}

function entrySyncTag(entryId) {
	const id = safeText(entryId);
	return id ? `journal-entry:${id}` : "";
}

function entrySyncTitle(categoryKey, entryId) {
	const tag = entrySyncTag(entryId);
	return tag ? `${categoryKey} ${tag}` : categoryKey;
}

function widgetHasAnyEntryTag(widget) {
	return /journal-entry:[a-z0-9_-]+/i.test([widgetMetadataText(widget), tagKeys(widget).join(" ")].join(" "));
}

function widgetHasEntryTag(widget, entryId) {
	const tag = entrySyncTag(entryId).toLowerCase();
	if (!tag) return false;
	return tagKeys(widget).includes(tag) || widgetMetadataText(widget).includes(tag);
}

function widgetMatchesCategory(widget, categoryKey) {
	const tags = tagKeys(widget);
	const text = widgetText(widget).toLowerCase();
	const meta = widgetMetadataText(widget);
	return tags.includes(categoryKey) || meta.includes(categoryKey) || text.startsWith(`[${categoryKey}]`) || text.includes(`${categoryKey} sticky note`);
}

function widgetIsSyncedEntry(widget, entryId, categoryKey) {
	return widgetHasEntryTag(widget, entryId) && widgetMatchesCategory(widget, categoryKey);
}

function categoryWidgets(widgets, categoryKey) {
	return widgets
		.filter(widget => widgetMatchesCategory(widget, categoryKey))
		.sort((a, b) => numeric(a.y) - numeric(b.y));
}

function categorySeedWidget(widgets, categoryKey) {
	const matches = categoryWidgets(widgets, categoryKey);
	const placeholders = matches.filter(widget => !widgetHasAnyEntryTag(widget) && isTemplatePlaceholder(widget));
	if (placeholders.length) return placeholders[0];
	return matches[0] || null;
}

function latestSyncedCategoryWidget(widgets, categoryKey) {
	const synced = categoryWidgets(widgets, categoryKey).filter(widget => widgetHasAnyEntryTag(widget));
	return synced.length ? synced.sort((a, b) => numeric(b.y) - numeric(a.y))[0] : null;
}

function columnHeaderWidgets(widgets, categoryKey) {
	return widgets.filter(widget => {
		const text = widgetText(widget).toLowerCase();
		const tags = tagKeys(widget);
		const meta = widgetMetadataText(widget);
		return tags.includes(categoryKey) || meta.includes(categoryKey) || text === categoryKey || text.includes(categoryKey);
	});
}

function virtualAnchorFromHeader(widgets, categoryKey) {
	const headers = columnHeaderWidgets(widgets, categoryKey);
	if (!headers.length) return null;
	const header = headers.sort((a, b) => numeric(a.y) - numeric(b.y))[0];
	return {
		id: null,
		type: "virtual-anchor",
		x: header.x,
		y: header.y + header.height + GRID_GAP,
		width: DEFAULT_WIDTH,
		height: DEFAULT_HEIGHT,
		text: "",
		tags: [categoryKey]
	};
}

function placementBelow(anchor, latest) {
	const from = latest || anchor;
	return {
		x: numeric(anchor?.x, 0),
		y: numeric(from?.y, numeric(anchor?.y, 0)) + numeric(from?.height, DEFAULT_HEIGHT) + GRID_GAP,
		width: numeric(anchor?.width, DEFAULT_WIDTH),
		height: numeric(anchor?.height, DEFAULT_HEIGHT)
	};
}

function dedupeTags(tags) {
	const seen = new Set();
	const out = [];
	for (const tag of tags.map(safeText).filter(Boolean)) {
		const key = tag.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(tag);
	}
	return out;
}

function stickyStyleFromTemplate(template) {
	const source = template?.style || {};
	const style = {
		backgroundColor: safeText(source.backgroundColor || template?.backgroundColor || "#FFFFFFFF") || "#FFFFFFFF",
		fontSize: numeric(source.fontSize ?? template?.fontSize, 23),
		textAlign: safeText(source.textAlign || template?.textAlign || "left") || "left"
	};

	if (source.bold !== undefined) style.bold = !!source.bold;
	if (source.italic !== undefined) style.italic = !!source.italic;
	if (source.underline !== undefined) style.underline = !!source.underline;
	if (source.strike !== undefined) style.strike = !!source.strike;
	if (source.font) style.font = source.font;
	if (source.border !== undefined) style.border = !!source.border;

	return style;
}

function stickyPayloadFromTemplate(template, { text, tags, placement, syncTitle }) {
	const payload = {
		x: placement.x,
		y: placement.y,
		width: placement.width,
		height: placement.height,
		shape: safeText(template?.shape || "rectangle") || "rectangle",
		text,
		title: syncTitle,
		tags,
		style: stickyStyleFromTemplate(template)
	};

	if (template?.rotation !== undefined) payload.rotation = numeric(template.rotation, 0);
	if (template?.parentId) payload.parentId = template.parentId;
	if (template?.stackingOrder !== undefined) payload.stackingOrder = numeric(template.stackingOrder, 1);

	return payload;
}

function minimalStickyPayload(payload) {
	return {
		x: payload.x,
		y: payload.y,
		width: payload.width,
		height: payload.height,
		shape: payload.shape || "rectangle",
		text: payload.text,
		title: payload.title,
		style: {
			backgroundColor: payload.style?.backgroundColor || "#FFFFFFFF",
			fontSize: payload.style?.fontSize || 23,
			textAlign: payload.style?.textAlign || "left"
		}
	};
}

function patchPayloadFromTemplate(template, { text, tags, syncTitle }) {
	return {
		text,
		title: syncTitle,
		tags,
		style: stickyStyleFromTemplate(template)
	};
}

async function postStickyPayload(accessToken, url, body) {
	const res = await fetch(url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
			Accept: "application/json"
		},
		body: JSON.stringify(body)
	});
	const responseBody = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw Object.assign(new Error(`Create Mural template sticky failed: ${res.status}`), {
			status: res.status,
			body: responseBody
		});
	}
	return firstMuralValue(responseBody);
}

async function createStickyFromTemplate(env, accessToken, muralId, template, payload) {
	const url = `https://app.mural.co/api/public/v1/murals/${muralId}/widgets/sticky-note`;
	const full = stickyPayloadFromTemplate(template, payload);
	const minimal = minimalStickyPayload(full);
	const attempts = [
		{ name: "template-sticky-full", body: full },
		{ name: "template-sticky-minimal", body: minimal },
		{ name: "template-sticky-minimal-array", body: [minimal] }
	];
	const errors = [];

	for (const attempt of attempts) {
		try {
			const created = await postStickyPayload(accessToken, url, attempt.body);
			return created || { ...full };
		} catch (err) {
			errors.push({ attempt: attempt.name, status: err?.status, summary: muralErrorSummary(err) });
		}
	}

	const last = errors[errors.length - 1] || {};
	throw Object.assign(new Error(`Create Mural template sticky failed after ${errors.length} attempts: ${last.summary || "unknown error"}`), {
		status: last.status || 400,
		errors
	});
}

async function patchStickyNote(env, accessToken, muralId, widgetId, patch) {
	const url = `https://app.mural.co/api/public/v1/murals/${muralId}/widgets/sticky-note/${widgetId}`;
	const res = await fetch(url, {
		method: "PATCH",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
			Accept: "application/json"
		},
		body: JSON.stringify(patch)
	});
	const body = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw Object.assign(new Error(`Update Mural sticky note failed: ${res.status}`), {
			status: res.status,
			body
		});
	}
	return firstMuralValue(body) || { id: widgetId, ...patch };
}

async function updateTemplateWidget(env, accessToken, muralId, widgetId, patch) {
	const minimalPatch = {
		text: patch.text,
		title: patch.title,
		style: {
			backgroundColor: patch.style?.backgroundColor || "#FFFFFFFF",
			fontSize: patch.style?.fontSize || 23,
			textAlign: patch.style?.textAlign || "left"
		}
	};
	const attempts = [
		() => updateSticky(env, accessToken, muralId, widgetId, patch),
		() => updateSticky(env, accessToken, muralId, widgetId, minimalPatch),
		() => patchStickyNote(env, accessToken, muralId, widgetId, patch),
		() => patchStickyNote(env, accessToken, muralId, widgetId, minimalPatch)
	];
	const errors = [];

	for (const attempt of attempts) {
		try {
			const updated = await attempt();
			return firstMuralValue(updated) || { id: widgetId, ...patch };
		} catch (err) {
			errors.push({ status: err?.status, summary: muralErrorSummary(err) });
		}
	}

	const last = errors[errors.length - 1] || {};
	throw Object.assign(new Error(`Could not update template widget after ${errors.length} attempts: ${last.summary || "unknown error"}`), {
		status: last.status || 400,
		errors
	});
}

function updateWidgetInPlace(widgets, widgetId, patch) {
	const idx = widgets.findIndex(widget => widget.id === widgetId);
	if (idx >= 0) widgets[idx] = normalizeWidget({ ...widgets[idx], ...patch });
}

function pushCreatedWidget(widgets, created, fallback) {
	const widget = normalizeWidget({ ...fallback, ...(created || {}) });
	widgets.push(widget);
	return widget;
}

async function validAccessToken(svc, uid) {
	const tokens = await svc.mural.loadTokens(uid);
	if (!tokens?.access_token) return { ok: false, reason: "not_authenticated" };

	let accessToken = tokens.access_token;
	try {
		await verifyHomeOfficeByCompany(svc.env, accessToken);
		return { ok: true, token: accessToken };
	} catch (err) {
		if (Number(err?.status || 0) === 401 && tokens.refresh_token) {
			try {
				const refreshed = await refreshAccessToken(svc.env, tokens.refresh_token);
				const merged = { ...tokens, ...refreshed };
				await svc.mural.saveTokens(uid, merged);
				accessToken = merged.access_token;
				await verifyHomeOfficeByCompany(svc.env, accessToken);
				return { ok: true, token: accessToken };
			} catch {}
		}
		return { ok: false, reason: "not_authenticated" };
	}
}

function parseBasePayload(body) {
	const projectId = safeText(body.projectId || body.project || body.project_airtable_id || body.project_local_id);
	const projectName = safeText(body.projectName || body.projectTitle || body.projectLabel || projectId);
	const uid = safeText(body.uid || "anon") || "anon";

	return {
		mode: safeText(body.mode || "entry").toLowerCase() || "entry",
		uid,
		projectId,
		projectName,
		explicitMuralId: safeText(body.muralId || "") || null
	};
}

function parseEntryPayload(body) {
	const base = parseBasePayload(body);
	const categoryKey = normalizeCategoryKey(body.category || body.categoryKey);
	const description = safeText(body.description || body.content || body.text);
	const entryId = safeText(body.entryId || body.id || "");
	const tags = normalizeTags(body.tags);

	return {
		...base,
		entryId,
		categoryKey,
		description,
		tags
	};
}

function entryPayloadFromEntry(entry, base) {
	return {
		...base,
		entryId: safeText(entry.id),
		categoryKey: normalizeCategoryKey(entry.category),
		description: safeText(entry.content || entry.body || entry.description || entry.text),
		tags: normalizeTags(entry.tags),
		createdAt: entry.createdAt || entry.created_at || ""
	};
}

async function readRequestBody(request) {
	try {
		return await request.json();
	} catch {
		return null;
	}
}

async function resolveBoardAndWidgets(svc, token, payload) {
	const board = await svc.mural.resolveBoard({
		projectId: payload.projectId,
		uid: payload.uid,
		purpose: PURPOSE_REFLEXIVE,
		explicitMuralId: payload.explicitMuralId
	});

	if (!board?.muralId) {
		return { ok: false, status: 404, body: { ok: false, error: "mural_board_not_found" } };
	}

	const rawWidgets = await getWidgets(svc.env, token, board.muralId);
	return {
		ok: true,
		board,
		widgets: rawWidgets.map(normalizeWidget)
	};
}

async function listEntriesForProject(svc, origin, projectId) {
	const url = new URL("https://local/api/journal-entries");
	url.searchParams.set("project", projectId);
	const response = await svc.listJournalEntries(origin, url);
	const data = await response.json().catch(() => ({}));
	return Array.isArray(data?.entries) ? data.entries : [];
}

function sortedEntries(entries) {
	return [...entries].sort((a, b) => {
		const aTime = Date.parse(a.createdAt || a.created_at || "");
		const bTime = Date.parse(b.createdAt || b.created_at || "");
		return (Number.isFinite(aTime) ? aTime : 0) - (Number.isFinite(bTime) ? bTime : 0);
	});
}

async function syncOneEntry({ svc, accessToken, board, widgets, payload }) {
	if (!payload.entryId || !payload.categoryKey || !payload.description) {
		return {
			ok: false,
			action: "skipped-invalid-entry",
			entryId: payload.entryId || null,
			category: payload.categoryKey || null,
			detail: "Entry is missing an id, category, or description."
		};
	}

	if (!CATEGORY_KEYS.includes(payload.categoryKey)) {
		return {
			ok: false,
			action: "skipped-unsupported-category",
			entryId: payload.entryId,
			category: payload.categoryKey,
			detail: "Entry category does not map to a Reflexive Journal Mural column."
		};
	}

	const existing = widgets.find(widget => widgetIsSyncedEntry(widget, payload.entryId, payload.categoryKey));
	if (existing) {
		return {
			ok: true,
			action: "already-synced",
			entryId: payload.entryId,
			category: payload.categoryKey,
			widgetId: existing.id
		};
	}

	const seed = categorySeedWidget(widgets, payload.categoryKey) || virtualAnchorFromHeader(widgets, payload.categoryKey);
	if (!seed) {
		return {
			ok: false,
			action: "category-column-not-found",
			entryId: payload.entryId,
			category: payload.categoryKey,
			detail: `No ${payload.categoryKey} template widget or heading was found on the Mural board.`
		};
	}

	const syncTag = entrySyncTag(payload.entryId);
	const syncTitle = entrySyncTitle(payload.categoryKey, payload.entryId);
	const tags = dedupeTags([payload.categoryKey, payload.projectName, syncTag, ...payload.tags]);
	const text = payload.description;

	if (seed.id && !widgetHasAnyEntryTag(seed) && isTemplatePlaceholder(seed)) {
		const patch = patchPayloadFromTemplate(seed, { text, syncTitle, tags });
		const widget = await updateTemplateWidget(svc.env, accessToken, board.muralId, seed.id, patch);
		updateWidgetInPlace(widgets, seed.id, patch);
		return {
			ok: true,
			action: "updated-template-widget",
			entryId: payload.entryId,
			category: payload.categoryKey,
			widgetId: widget?.id || widget?.value?.id || seed.id
		};
	}

	const latest = latestSyncedCategoryWidget(widgets, payload.categoryKey);
	const placement = placementBelow(seed, latest);
	const templatePayload = { text, tags, placement, syncTitle };
	const created = await createStickyFromTemplate(
		svc.env,
		accessToken,
		board.muralId,
		seed,
		templatePayload
	);
	const widget = pushCreatedWidget(widgets, created, {
		id: created?.id,
		type: "sticky-note",
		text,
		title: syncTitle,
		tags,
		style: stickyStyleFromTemplate(seed),
		shape: seed?.shape || "rectangle",
		...placement
	});

	return {
		ok: true,
		action: "created-template-sticky",
		entryId: payload.entryId,
		category: payload.categoryKey,
		widgetId: widget.id || created?.id || null
	};
}

function statusFromEntriesAndWidgets(entries, widgets) {
	const validEntries = entries.filter(entry => safeText(entry.id));
	const syncedEntryIds = new Set();

	for (const entry of validEntries) {
		const category = normalizeCategoryKey(entry.category);
		if (widgets.some(widget => widgetIsSyncedEntry(widget, entry.id, category))) {
			syncedEntryIds.add(String(entry.id));
		}
	}

	const byCategory = Object.fromEntries(CATEGORY_KEYS.map(category => [category, { total: 0, synced: 0, pending: 0 }]));
	for (const entry of validEntries) {
		const category = normalizeCategoryKey(entry.category);
		if (!byCategory[category]) continue;
		byCategory[category].total += 1;
		if (syncedEntryIds.has(String(entry.id))) byCategory[category].synced += 1;
		else byCategory[category].pending += 1;
	}

	return {
		total: validEntries.length,
		synced: syncedEntryIds.size,
		pending: Math.max(0, validEntries.length - syncedEntryIds.size),
		syncedEntryIds: Array.from(syncedEntryIds),
		byCategory
	};
}

async function buildContext(svc, origin, body) {
	const payload = parseBasePayload(body);
	if (!payload.projectId) {
		return { ok: false, status: 400, body: { ok: false, error: "missing_project_id" } };
	}

	const token = await validAccessToken(svc, payload.uid);
	if (!token.ok) {
		return {
			ok: false,
			status: 401,
			body: { ok: false, error: token.reason || "not_authenticated" }
		};
	}

	try {
		const boardAndWidgets = await resolveBoardAndWidgets(svc, token.token, payload);
		if (!boardAndWidgets.ok) return boardAndWidgets;

		const entries = await listEntriesForProject(svc, origin, payload.projectId);
		return {
			ok: true,
			payload,
			accessToken: token.token,
			board: boardAndWidgets.board,
			widgets: boardAndWidgets.widgets,
			entries
		};
	} catch (err) {
		const status = Number(err?.status || 0);
		return {
			ok: false,
			status: status >= 400 && status < 600 ? status : 500,
			body: {
				ok: false,
				error: "mural_sync_context_failed",
				detail: String(err?.message || err),
				status: status || undefined
			}
		};
	}
}

async function handleStatus(svc, origin, body) {
	const ctx = await buildContext(svc, origin, body);
	if (!ctx.ok) return svc.json(ctx.body, ctx.status, svc.corsHeaders(origin));

	const status = statusFromEntriesAndWidgets(ctx.entries, ctx.widgets);
	return svc.json({
		ok: true,
		mode: "status",
		muralId: ctx.board.muralId,
		boardSource: ctx.board.source,
		...status
	}, 200, svc.corsHeaders(origin));
}

function hydrateReason({ outcomes, failed, skipped, pending }) {
	if (!pending) return "All entries are on Mural.";
	const firstFailure = outcomes.find(o => !o.ok && o.detail);
	if (firstFailure) return firstFailure.detail;
	if (failed) return `${failed} ${failed === 1 ? "entry could" : "entries could"} not be added to Mural.`;
	if (skipped) return `${skipped} ${skipped === 1 ? "entry was" : "entries were"} skipped because required data was missing.`;
	return "No entries were added to Mural.";
}

async function handleHydrate(svc, origin, body) {
	const ctx = await buildContext(svc, origin, body);
	if (!ctx.ok) return svc.json(ctx.body, ctx.status, svc.corsHeaders(origin));

	const before = statusFromEntriesAndWidgets(ctx.entries, ctx.widgets);
	const outcomes = [];
	const base = ctx.payload;

	for (const entry of sortedEntries(ctx.entries)) {
		const payload = entryPayloadFromEntry(entry, base);
		try {
			const outcome = await syncOneEntry({
				svc,
				accessToken: ctx.accessToken,
				board: ctx.board,
				widgets: ctx.widgets,
				payload
			});
			outcomes.push(outcome);
		} catch (err) {
			outcomes.push({
				ok: false,
				action: "sync-failed",
				entryId: payload.entryId,
				category: payload.categoryKey,
				detail: String(err?.message || err),
				status: err?.status || undefined,
				errors: err?.errors || undefined
			});
		}
	}

	const after = statusFromEntriesAndWidgets(ctx.entries, ctx.widgets);
	const createdOrUpdated = outcomes.filter(o => ["updated-template-widget", "created-template-sticky"].includes(o.action)).length;
	const alreadySynced = outcomes.filter(o => o.action === "already-synced").length;
	const skipped = outcomes.filter(o => String(o.action || "").startsWith("skipped-")).length;
	const failed = outcomes.filter(o => !o.ok).length;

	return svc.json({
		ok: true,
		mode: "hydrate",
		muralId: ctx.board.muralId,
		boardSource: ctx.board.source,
		before,
		after,
		total: after.total,
		synced: after.synced,
		pending: after.pending,
		createdOrUpdated,
		alreadySynced,
		skipped,
		failed,
		reason: hydrateReason({ outcomes, failed, skipped, pending: after.pending }),
		outcomes
	}, 200, svc.corsHeaders(origin));
}

async function handleEntrySync(svc, origin, body) {
	const payload = parseEntryPayload(body);
	if (!payload.projectId || !payload.categoryKey || !payload.description) {
		return svc.json({
			ok: false,
			error: "missing_required_fields",
			detail: "projectId, category and description/content are required"
		}, 400, svc.corsHeaders(origin));
	}

	const token = await validAccessToken(svc, payload.uid);
	if (!token.ok) {
		return svc.json({ ok: false, error: token.reason || "not_authenticated" }, 401, svc.corsHeaders(origin));
	}

	try {
		const boardAndWidgets = await resolveBoardAndWidgets(svc, token.token, payload);
		if (!boardAndWidgets.ok) return svc.json(boardAndWidgets.body, boardAndWidgets.status, svc.corsHeaders(origin));

		const outcome = await syncOneEntry({
			svc,
			accessToken: token.token,
			board: boardAndWidgets.board,
			widgets: boardAndWidgets.widgets,
			payload
		});

		return svc.json({
			ok: outcome.ok,
			mode: "entry",
			muralId: boardAndWidgets.board.muralId,
			boardSource: boardAndWidgets.board.source,
			...outcome
		}, outcome.ok ? 200 : 422, svc.corsHeaders(origin));
	} catch (err) {
		const status = Number(err?.status || 0);
		return svc.json({
			ok: false,
			error: "mural_journal_sync_failed",
			detail: String(err?.message || err),
			status: status || undefined,
			errors: err?.errors || undefined
		}, status >= 400 && status < 600 ? status : 500, svc.corsHeaders(origin));
	}
}

/**
 * POST /api/mural/journal-sync
 *
 * Modes:
 * - entry: sync one newly saved journal entry
 * - hydrate: sync all project entries that are not already tagged on the board
 * - status: return page-level sync counts
 */
export async function muralJournalSync(svc, request, origin) {
	const body = await readRequestBody(request);
	if (!body) {
		return svc.json({ ok: false, error: "invalid_json" }, 400, svc.corsHeaders(origin));
	}

	const mode = safeText(body.mode || "entry").toLowerCase() || "entry";
	if (mode === "status") return handleStatus(svc, origin, body);
	if (mode === "hydrate") return handleHydrate(svc, origin, body);
	return handleEntrySync(svc, origin, body);
}
