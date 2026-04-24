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
	return safeText(widget?.text || widget?.htmlText || widget?.title || widget?.name || "");
}

function numeric(value, fallback = 0) {
	const n = Number(value);
	return Number.isFinite(n) ? n : fallback;
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

function isSticky(widget) {
	const type = safeText(widget?.type).toLowerCase();
	return type.includes("sticky");
}

function isTemplatePlaceholder(widget) {
	const text = widgetText(widget);
	return !text || TEMPLATE_PLACEHOLDER_RE.test(text);
}

function entrySyncTag(entryId) {
	const id = safeText(entryId);
	return id ? `journal-entry:${id}` : "";
}

function widgetHasEntryTag(widget, entryId) {
	const tag = entrySyncTag(entryId).toLowerCase();
	return !!tag && tagKeys(widget).includes(tag);
}

function widgetMatchesCategory(widget, categoryKey) {
	const tags = tagKeys(widget);
	const text = widgetText(widget).toLowerCase();
	return tags.includes(categoryKey) || text.startsWith(`[${categoryKey}]`) || text.includes(`${categoryKey} sticky note`);
}

function columnHeaderWidgets(widgets, categoryKey) {
	return widgets.filter(widget => {
		const text = widgetText(widget).toLowerCase();
		const tags = tagKeys(widget);
		return tags.includes(categoryKey) || text === categoryKey || text.includes(categoryKey);
	});
}

function pickCategoryAnchor(widgets, categoryKey) {
	const stickies = widgets.filter(widget => isSticky(widget) && widgetMatchesCategory(widget, categoryKey));
	const placeholders = stickies.filter(isTemplatePlaceholder);
	if (placeholders.length) return placeholders.sort((a, b) => numeric(a.y) - numeric(b.y))[0];
	if (stickies.length) return stickies.sort((a, b) => numeric(b.y) - numeric(a.y))[0];

	const headers = columnHeaderWidgets(widgets, categoryKey);
	if (headers.length) {
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

	return null;
}

function placementForAnchor(widgets, anchor, categoryKey) {
	const sameCategory = widgets.filter(widget => isSticky(widget) && widgetMatchesCategory(widget, categoryKey));
	const latest = sameCategory.length ? sameCategory.sort((a, b) => numeric(b.y) - numeric(a.y))[0] : anchor;
	return {
		x: numeric(anchor?.x, 0),
		y: numeric(latest?.y, numeric(anchor?.y, 0)) + numeric(latest?.height, DEFAULT_HEIGHT) + GRID_GAP,
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

function createStickyPayload({ text, tags, placement }) {
	return {
		x: placement.x,
		y: placement.y,
		width: placement.width,
		height: placement.height,
		shape: "rectangle",
		text,
		tags,
		style: {
			backgroundColor: "#FFFFFFFF",
			fontSize: 23,
			textAlign: "left"
		}
	};
}

async function createStickyNote(env, accessToken, muralId, payload) {
	const url = `https://app.mural.co/api/public/v1/murals/${muralId}/widgets/sticky-note`;
	const res = await fetch(url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
			Accept: "application/json"
		},
		body: JSON.stringify(payload)
	});
	const body = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw Object.assign(new Error(`Create Mural sticky note failed: ${res.status}`), {
			status: res.status,
			body
		});
	}
	return body?.value || body;
}

function updateWidgetInPlace(widgets, widgetId, patch) {
	const idx = widgets.findIndex(widget => widget.id === widgetId);
	if (idx >= 0) widgets[idx] = normalizeWidget({ ...widgets[idx], ...patch });
}

function pushCreatedWidget(widgets, created, fallback) {
	const widget = normalizeWidget({ ...fallback, ...(created?.value || created || {}) });
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
			category: payload.categoryKey || null
		};
	}

	if (!CATEGORY_KEYS.includes(payload.categoryKey)) {
		return {
			ok: false,
			action: "skipped-unsupported-category",
			entryId: payload.entryId,
			category: payload.categoryKey
		};
	}

	const existing = widgets.find(widget => isSticky(widget) && widgetHasEntryTag(widget, payload.entryId));
	if (existing) {
		return {
			ok: true,
			action: "already-synced",
			entryId: payload.entryId,
			category: payload.categoryKey,
			widgetId: existing.id
		};
	}

	const anchor = pickCategoryAnchor(widgets, payload.categoryKey);
	if (!anchor) {
		return {
			ok: false,
			action: "category-column-not-found",
			entryId: payload.entryId,
			category: payload.categoryKey
		};
	}

	const syncTag = entrySyncTag(payload.entryId);
	const tags = dedupeTags([payload.categoryKey, payload.projectName, syncTag, ...payload.tags]);
	const text = payload.description;

	if (anchor.id && isTemplatePlaceholder(anchor)) {
		const widget = await updateSticky(svc.env, accessToken, board.muralId, anchor.id, { text, tags });
		updateWidgetInPlace(widgets, anchor.id, { text, tags });
		return {
			ok: true,
			action: "updated-template-sticky",
			entryId: payload.entryId,
			category: payload.categoryKey,
			widgetId: widget?.id || widget?.value?.id || anchor.id
		};
	}

	const placement = placementForAnchor(widgets, anchor, payload.categoryKey);
	const created = await createStickyNote(
		svc.env,
		accessToken,
		board.muralId,
		createStickyPayload({ text, tags, placement })
	);
	const widget = pushCreatedWidget(widgets, created, {
		id: created?.id || created?.value?.id,
		type: "sticky-note",
		text,
		tags,
		...placement
	});

	return {
		ok: true,
		action: "created-sticky",
		entryId: payload.entryId,
		category: payload.categoryKey,
		widgetId: widget.id || created?.id || created?.value?.id || null
	};
}

function statusFromEntriesAndWidgets(entries, widgets) {
	const validEntries = entries.filter(entry => safeText(entry.id));
	const syncedEntryIds = new Set();

	for (const entry of validEntries) {
		if (widgets.some(widget => isSticky(widget) && widgetHasEntryTag(widget, entry.id))) {
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

async function handleHydrate(svc, origin, body) {
	const ctx = await buildContext(svc, origin, body);
	if (!ctx.ok) return svc.json(ctx.body, ctx.status, svc.corsHeaders(origin));

	const before = statusFromEntriesAndWidgets(ctx.entries, ctx.widgets);
	const outcomes = [];
	const base = ctx.payload;

	for (const entry of sortedEntries(ctx.entries)) {
		const payload = entryPayloadFromEntry(entry, base);
		if (!payload.entryId || !payload.description || !payload.categoryKey) continue;
		if (ctx.widgets.some(widget => isSticky(widget) && widgetHasEntryTag(widget, payload.entryId))) {
			outcomes.push({
				ok: true,
				action: "already-synced",
				entryId: payload.entryId,
				category: payload.categoryKey
			});
			continue;
		}

		try {
			outcomes.push(await syncOneEntry({
				svc,
				accessToken: ctx.accessToken,
				board: ctx.board,
				widgets: ctx.widgets,
				payload
			}));
		} catch (err) {
			outcomes.push({
				ok: false,
				action: "sync-failed",
				entryId: payload.entryId,
				category: payload.categoryKey,
				detail: String(err?.message || err)
			});
		}
	}

	const after = statusFromEntriesAndWidgets(ctx.entries, ctx.widgets);
	return svc.json({
		ok: true,
		mode: "hydrate",
		muralId: ctx.board.muralId,
		boardSource: ctx.board.source,
		before,
		after,
		createdOrUpdated: outcomes.filter(o => ["updated-template-sticky", "created-sticky"].includes(o.action)).length,
		alreadySynced: outcomes.filter(o => o.action === "already-synced").length,
		failed: outcomes.filter(o => !o.ok).length,
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
			status: status || undefined
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
