/**
 * @file src/service/mural-journal-sync-layout.js
 * @module service/mural-journal-sync-layout
 * @summary Column-driven Reflexive Journal to Mural sync and hydration.
 */

import {
	refreshAccessToken,
	verifyHomeOfficeByCompany,
	getWidgets,
	updateSticky
} from "../lib/mural.js";

const CATEGORY_KEYS = ["perceptions", "procedures", "decisions", "introspections"];
const DEFAULT_WIDTH = 260;
const DEFAULT_HEIGHT = 160;
const GRID_GAP = 32;
const PURPOSE_REFLEXIVE = "reflexive_journal";
const ENTRY_MARKER_RE = /journal-entry:[a-z0-9_-]+/i;

function safeText(value) {
	return String(value || "").trim();
}

function categoryLabel(categoryKey) {
	return {
		perceptions: "perceptions",
		procedures: "procedures",
		decisions: "decisions",
		introspections: "introspections"
	}[categoryKey] || categoryKey;
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

function userFacingTags(tags) {
	return dedupeTags(normalizeTags(tags).filter(tag => !tag.toLowerCase().startsWith("journal-entry:")));
}

function tagKeys(widget) {
	return normalizeTags(widget?.tags).map(t => t.toLowerCase());
}

function widgetText(widget) {
	return safeText(widget?.text || widget?.htmlText || widget?.title || widget?.name || widget?.label || "");
}

function widgetMetadataText(widget) {
	return [
		widget?.title,
		widget?.name,
		widget?.label,
		widget?.instruction,
		widget?.hyperlinkTitle,
		widget?.presentationTitle,
		widget?.plainText,
		widget?.htmlText
	].map(safeText).filter(Boolean).join(" ").toLowerCase();
}

function numeric(value, fallback = 0) {
	const n = Number(value);
	return Number.isFinite(n) ? n : fallback;
}

function rounded(value, fallback = 0) {
	return Math.round(numeric(value, fallback));
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

function entrySyncTag(entryId) {
	const id = safeText(entryId);
	return id ? `journal-entry:${id}` : "";
}

function widgetHasAnyEntryTag(widget) {
	return ENTRY_MARKER_RE.test([widgetMetadataText(widget), tagKeys(widget).join(" ")].join(" "));
}

function widgetHasEntryTag(widget, entryId) {
	const tag = entrySyncTag(entryId).toLowerCase();
	if (!tag) return false;
	return tagKeys(widget).includes(tag) || widgetMetadataText(widget).includes(tag);
}

function isStickyLike(widget) {
	const type = safeText(widget?.type).toLowerCase();
	return type.includes("sticky") || type.includes("note") || type.includes("shape") || type === "";
}

function isHeaderWidget(widget, categoryKey) {
	const label = categoryLabel(categoryKey);
	const text = widgetText(widget).toLowerCase();
	const meta = widgetMetadataText(widget);
	const tags = tagKeys(widget);
	const categoryMatch = text === label || meta === label || tags.includes(categoryKey);
	return categoryMatch && numeric(widget.width) > numeric(widget.height);
}

function categoryHeaderWidget(widgets, categoryKey) {
	return widgets
		.filter(widget => isHeaderWidget(widget, categoryKey))
		.sort((a, b) => numeric(a.y) - numeric(b.y) || numeric(a.x) - numeric(b.x))[0] || null;
}

function centreX(widget) {
	return numeric(widget.x) + numeric(widget.width) / 2;
}

function isInHeaderColumn(widget, header) {
	if (!header) return false;
	const x = numeric(widget.x);
	const y = numeric(widget.y);
	const width = numeric(widget.width, DEFAULT_WIDTH);
	const centre = x + width / 2;
	const left = numeric(header.x) - Math.max(24, numeric(header.width) * 0.1);
	const right = numeric(header.x) + numeric(header.width) + Math.max(24, numeric(header.width) * 0.1);
	return y > numeric(header.y) + numeric(header.height) && centre >= left && centre <= right;
}

function isCategoryTaggedTemplate(widget, categoryKey) {
	const tags = tagKeys(widget);
	const meta = widgetMetadataText(widget);
	const text = widgetText(widget).toLowerCase();
	return tags.includes(categoryKey) || meta.includes(categoryKey) || text.includes(`${categoryKey} sticky note`);
}

function columnTemplateWidgetFromTags(widgets, categoryKey) {
	return widgets
		.filter(isStickyLike)
		.filter(widget => isCategoryTaggedTemplate(widget, categoryKey))
		.filter(widget => !widgetHasAnyEntryTag(widget))
		.sort((a, b) => numeric(a.y) - numeric(b.y) || numeric(a.x) - numeric(b.x))[0] || null;
}

function columnTemplateWidget(widgets, categoryKey) {
	const header = categoryHeaderWidget(widgets, categoryKey);
	if (!header) return columnTemplateWidgetFromTags(widgets, categoryKey);

	return widgets
		.filter(widget => widget.id !== header.id)
		.filter(isStickyLike)
		.filter(widget => isInHeaderColumn(widget, header))
		.sort((a, b) => numeric(a.y) - numeric(b.y) || Math.abs(centreX(a) - centreX(header)) - Math.abs(centreX(b) - centreX(header)))[0] ||
		columnTemplateWidgetFromTags(widgets, categoryKey);
}

function inferHeaderFromTemplate(widgets, categoryKey, template) {
	if (!template) return null;
	const above = widgets
		.filter(widget => numeric(widget.y) < numeric(template.y))
		.filter(widget => numeric(widget.width) > numeric(widget.height))
		.sort((a, b) => {
			const adx = Math.abs(centreX(a) - centreX(template));
			const bdx = Math.abs(centreX(b) - centreX(template));
			return adx - bdx || numeric(b.y) - numeric(a.y);
		})[0];
	if (!above) return null;
	return { ...above, text: widgetText(above) || categoryLabel(categoryKey) };
}

function columnLayout(widgets, categoryKey) {
	const template = columnTemplateWidget(widgets, categoryKey);
	const header = categoryHeaderWidget(widgets, categoryKey) || inferHeaderFromTemplate(widgets, categoryKey, template);
	if (!header && !template) return null;

	const source = template || header;
	const width = rounded(template?.width ?? header?.width ?? source?.width, DEFAULT_WIDTH);
	const height = rounded(template?.height, DEFAULT_HEIGHT);
	const x = rounded(template?.x ?? header?.x ?? source?.x, 0);
	const y = rounded(template?.y ?? (numeric(header?.y, 0) + numeric(header?.height, 0) + GRID_GAP), 0);

	return {
		categoryKey,
		header,
		template: template || {
			id: null,
			type: "virtual-template",
			x,
			y,
			width,
			height,
			text: "",
			tags: [categoryKey]
		},
		x,
		y,
		width,
		height
	};
}

function widgetMatchesColumnLayout(widget, layout) {
	if (!widget || !layout) return false;
	const xDiff = Math.abs(numeric(widget.x) - numeric(layout.x));
	const widthDiff = Math.abs(numeric(widget.width, layout.width) - numeric(layout.width));
	const heightDiff = Math.abs(numeric(widget.height, layout.height) - numeric(layout.height));
	return xDiff <= 8 && widthDiff <= 8 && heightDiff <= 8;
}

function widgetMatchesCategory(widget, categoryKey, layout) {
	const tags = tagKeys(widget);
	const meta = widgetMetadataText(widget);
	return tags.includes(categoryKey) || meta.includes(categoryKey) || widgetMatchesColumnLayout(widget, layout);
}

function canonicalExistingWidget(widgets, entry, layout) {
	return widgets.find(widget => {
		return widgetHasEntryTag(widget, entry.entryId) &&
			widgetMatchesCategory(widget, entry.categoryKey, layout) &&
			widgetMatchesColumnLayout(widget, layout);
	});
}

function latestCanonicalWidget(widgets, categoryKey, layout) {
	return widgets
		.filter(widget => widgetHasAnyEntryTag(widget))
		.filter(widget => widgetMatchesCategory(widget, categoryKey, layout))
		.filter(widget => widgetMatchesColumnLayout(widget, layout))
		.sort((a, b) => numeric(b.y) - numeric(a.y))[0] || null;
}

function placementBelow(layout, latest) {
	const from = latest || layout.template;
	return {
		x: layout.x,
		y: rounded(numeric(from.y, layout.y) + numeric(from.height, layout.height) + GRID_GAP),
		width: layout.width,
		height: layout.height
	};
}

function stickyBackground(template) {
	return safeText(template?.style?.backgroundColor || template?.backgroundColor || "#FFFFFFFF") || "#FFFFFFFF";
}

function stickyStyle(template) {
	const source = template?.style || {};
	const style = {
		backgroundColor: stickyBackground(template),
		fontSize: rounded(source.fontSize ?? template?.fontSize, 23),
		textAlign: safeText(source.textAlign || template?.textAlign || "left") || "left"
	};
	if (source.bold !== undefined) style.bold = !!source.bold;
	if (source.italic !== undefined) style.italic = !!source.italic;
	if (source.underline !== undefined) style.underline = !!source.underline;
	if (source.font) style.font = source.font;
	if (source.border !== undefined) style.border = !!source.border;
	return style;
}

function tagsForEntry(layout, entry) {
	const templateTags = userFacingTags(layout.template?.tags);
	return dedupeTags([
		...templateTags,
		entry.categoryKey,
		entry.projectName,
		...userFacingTags(entry.tags)
	]);
}

function localEntryWidget(widget, entry, layout, tags, placement = {}) {
	return normalizeWidget({
		...widget,
		...placement,
		tags: dedupeTags([...tags, entry.categoryKey, entrySyncTag(entry.entryId)]),
		title: entrySyncTag(entry.entryId),
		text: entry.description,
		type: widget?.type || "sticky-note",
		width: placement.width ?? layout.width,
		height: placement.height ?? layout.height
	});
}

function replaceWidget(widgets, widgetId, nextWidget) {
	const index = widgets.findIndex(widget => widget.id === widgetId);
	if (index >= 0) widgets[index] = nextWidget;
	else widgets.push(nextWidget);
}

async function patchSticky(accessToken, muralId, widgetId, template, text) {
	const textOnly = { text };
	const contentOnly = { content: text };
	const htmlOnly = { htmlText: text };
	const attempts = [
		() => patchStickyNote(accessToken, muralId, widgetId, textOnly),
		() => updateSticky(null, accessToken, muralId, widgetId, textOnly),
		() => patchStickyNote(accessToken, muralId, widgetId, contentOnly),
		() => patchStickyNote(accessToken, muralId, widgetId, htmlOnly)
	];
	const errors = [];

	for (const attempt of attempts) {
		try {
			return await attempt();
		} catch (err) {
			errors.push(muralErrorSummary(err));
		}
	}

	throw new Error(`Update Mural template sticky failed after ${errors.length} attempts: ${errors.at(-1) || "unknown error"}`);
}

async function patchStickyNote(accessToken, muralId, widgetId, body) {
	const url = `https://app.mural.co/api/public/v1/murals/${muralId}/widgets/sticky-note/${widgetId}`;
	const res = await fetch(url, {
		method: "PATCH",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
			Accept: "application/json"
		},
		body: JSON.stringify(body)
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw Object.assign(new Error(`Update Mural sticky note failed: ${res.status}`), { status: res.status, body: data });
	}
	return firstMuralValue(data) || { id: widgetId, ...body };
}

function createPayload(template, placement, text, tags) {
	return {
		x: placement.x,
		y: placement.y,
		width: placement.width,
		height: placement.height,
		shape: safeText(template?.shape || "rectangle") || "rectangle",
		text,
		tags,
		style: stickyStyle(template),
		backgroundColor: stickyBackground(template)
	};
}

async function postSticky(accessToken, muralId, body) {
	const url = `https://app.mural.co/api/public/v1/murals/${muralId}/widgets/sticky-note`;
	const res = await fetch(url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
			Accept: "application/json"
		},
		body: JSON.stringify(body)
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw Object.assign(new Error(`Create Mural template sticky failed: ${res.status}`), { status: res.status, body: data });
	}
	return firstMuralValue(data) || body;
}

async function createStickyFromTemplate(accessToken, muralId, template, placement, text, tags) {
	const full = createPayload(template, placement, text, tags);
	const minimal = {
		x: placement.x,
		y: placement.y,
		width: placement.width,
		height: placement.height,
		text,
		backgroundColor: stickyBackground(template)
	};
	const attempts = [full, minimal, [minimal]];
	const errors = [];

	for (const body of attempts) {
		try {
			return await postSticky(accessToken, muralId, body);
		} catch (err) {
			errors.push(muralErrorSummary(err));
		}
	}

	throw new Error(`Create Mural template sticky failed after ${errors.length} attempts: ${errors.at(-1) || "unknown error"}`);
}

async function validAccessToken(svc, uid) {
	const tokens = await svc.mural.loadTokens(uid);
	if (!tokens?.access_token) return { ok: false, reason: "not_authenticated" };

	try {
		await verifyHomeOfficeByCompany(svc.env, tokens.access_token);
		return { ok: true, token: tokens.access_token };
	} catch (err) {
		if (Number(err?.status || 0) === 401 && tokens.refresh_token) {
			try {
				const refreshed = await refreshAccessToken(svc.env, tokens.refresh_token);
				const merged = { ...tokens, ...refreshed };
				await svc.mural.saveTokens(uid, merged);
				await verifyHomeOfficeByCompany(svc.env, merged.access_token);
				return { ok: true, token: merged.access_token };
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
	return {
		...base,
		entryId: safeText(body.entryId || body.id || ""),
		categoryKey: normalizeCategoryKey(body.category || body.categoryKey),
		description: safeText(body.description || body.content || body.text),
		tags: normalizeTags(body.tags),
		createdAt: body.createdAt || body.created_at || ""
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

async function resolveBoardAndWidgets(svc, accessToken, payload) {
	const board = await svc.mural.resolveBoard({
		projectId: payload.projectId,
		uid: payload.uid,
		purpose: PURPOSE_REFLEXIVE,
		explicitMuralId: payload.explicitMuralId
	});

	if (!board?.muralId) {
		return { ok: false, status: 404, body: { ok: false, error: "mural_board_not_found" } };
	}

	const rawWidgets = await getWidgets(svc.env, accessToken, board.muralId);
	return {
		ok: true,
		board,
		widgets: rawWidgets.map(normalizeWidget)
	};
}

async function buildContext(svc, origin, body) {
	const payload = parseBasePayload(body);
	if (!payload.projectId) {
		return { ok: false, status: 400, body: { ok: false, error: "missing_project_id" } };
	}

	const token = await validAccessToken(svc, payload.uid);
	if (!token.ok) {
		return { ok: false, status: 401, body: { ok: false, error: token.reason || "not_authenticated" } };
	}

	try {
		const boardAndWidgets = await resolveBoardAndWidgets(svc, token.token, payload);
		if (!boardAndWidgets.ok) return boardAndWidgets;
		const entries = await listEntriesForProject(svc, origin, payload.projectId);
		return { ok: true, payload, accessToken: token.token, board: boardAndWidgets.board, widgets: boardAndWidgets.widgets, entries };
	} catch (err) {
		const status = Number(err?.status || 0);
		return {
			ok: false,
			status: status >= 400 && status < 600 ? status : 500,
			body: { ok: false, error: "mural_sync_context_failed", detail: String(err?.message || err), status: status || undefined }
		};
	}
}

function statusFromEntriesAndWidgets(entries, widgets) {
	const validEntries = entries.filter(entry => safeText(entry.id));
	const syncedEntryIds = new Set();
	const layouts = Object.fromEntries(CATEGORY_KEYS.map(category => [category, columnLayout(widgets, category)]));

	for (const entry of validEntries) {
		const category = normalizeCategoryKey(entry.category);
		const layout = layouts[category];
		if (!layout) continue;
		if (widgets.some(widget => widgetHasEntryTag(widget, entry.id) && widgetMatchesCategory(widget, category, layout) && widgetMatchesColumnLayout(widget, layout))) {
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

async function syncOneEntry({ accessToken, board, widgets, entry }) {
	if (!entry.entryId || !entry.categoryKey || !entry.description) {
		return { ok: false, action: "skipped-invalid-entry", entryId: entry.entryId || null, category: entry.categoryKey || null, detail: "Entry is missing an id, category, or description." };
	}
	if (!CATEGORY_KEYS.includes(entry.categoryKey)) {
		return { ok: false, action: "skipped-unsupported-category", entryId: entry.entryId, category: entry.categoryKey, detail: "Entry category does not map to a Reflexive Journal Mural column." };
	}

	const layout = columnLayout(widgets, entry.categoryKey);
	if (!layout) {
		return { ok: false, action: "category-column-not-found", entryId: entry.entryId, category: entry.categoryKey, detail: `No ${entry.categoryKey} column template or heading was found on the Mural board.` };
	}

	const existing = canonicalExistingWidget(widgets, entry, layout);
	if (existing) {
		return { ok: true, action: "already-synced", entryId: entry.entryId, category: entry.categoryKey, widgetId: existing.id };
	}

	const tags = tagsForEntry(layout, entry);
	const seed = layout.template;

	if (seed.id && !widgetHasAnyEntryTag(seed)) {
		const updated = await patchSticky(accessToken, board.muralId, seed.id, seed, entry.description, tags);
		const local = localEntryWidget({ ...seed, ...firstMuralValue(updated) }, entry, layout, tags, {
			x: layout.x,
			y: numeric(seed.y, layout.y),
			width: layout.width,
			height: layout.height
		});
		replaceWidget(widgets, seed.id, local);
		return { ok: true, action: "updated-template-widget", entryId: entry.entryId, category: entry.categoryKey, widgetId: local.id || seed.id, tags };
	}

	const latest = latestCanonicalWidget(widgets, entry.categoryKey, layout);
	const placement = placementBelow(layout, latest);
	const created = await createStickyFromTemplate(accessToken, board.muralId, seed, placement, entry.description, tags);
	const local = localEntryWidget({ ...seed, ...firstMuralValue(created) }, entry, layout, tags, placement);
	widgets.push(local);
	return { ok: true, action: "created-template-sticky", entryId: entry.entryId, category: entry.categoryKey, widgetId: local.id || created?.id || null, tags };
}

async function handleStatus(svc, origin, body) {
	const ctx = await buildContext(svc, origin, body);
	if (!ctx.ok) return svc.json(ctx.body, ctx.status, svc.corsHeaders(origin));
	const status = statusFromEntriesAndWidgets(ctx.entries, ctx.widgets);
	return svc.json({ ok: true, mode: "status", muralId: ctx.board.muralId, boardSource: ctx.board.source, ...status }, 200, svc.corsHeaders(origin));
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

	for (const category of CATEGORY_KEYS) {
		const entries = sortedEntries(ctx.entries)
			.map(entry => entryPayloadFromEntry(entry, base))
			.filter(entry => entry.categoryKey === category);
		for (const entry of entries) {
			try {
				outcomes.push(await syncOneEntry({ accessToken: ctx.accessToken, board: ctx.board, widgets: ctx.widgets, entry }));
			} catch (err) {
				outcomes.push({ ok: false, action: "sync-failed", entryId: entry.entryId, category: entry.categoryKey, detail: String(err?.message || err), status: err?.status || undefined, errors: err?.errors || undefined });
			}
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
	const entry = parseEntryPayload(body);
	if (!entry.projectId || !entry.categoryKey || !entry.description) {
		return svc.json({ ok: false, error: "missing_required_fields", detail: "projectId, category and description/content are required" }, 400, svc.corsHeaders(origin));
	}

	const token = await validAccessToken(svc, entry.uid);
	if (!token.ok) return svc.json({ ok: false, error: token.reason || "not_authenticated" }, 401, svc.corsHeaders(origin));

	try {
		const boardAndWidgets = await resolveBoardAndWidgets(svc, token.token, entry);
		if (!boardAndWidgets.ok) return svc.json(boardAndWidgets.body, boardAndWidgets.status, svc.corsHeaders(origin));
		const outcome = await syncOneEntry({ accessToken: token.token, board: boardAndWidgets.board, widgets: boardAndWidgets.widgets, entry });
		return svc.json({ ok: outcome.ok, mode: "entry", muralId: boardAndWidgets.board.muralId, boardSource: boardAndWidgets.board.source, ...outcome }, outcome.ok ? 200 : 422, svc.corsHeaders(origin));
	} catch (err) {
		const status = Number(err?.status || 0);
		return svc.json({ ok: false, error: "mural_journal_sync_failed", detail: String(err?.message || err), status: status || undefined, errors: err?.errors || undefined }, status >= 400 && status < 600 ? status : 500, svc.corsHeaders(origin));
	}
}

export async function muralJournalSync(svc, request, origin) {
	const body = await readRequestBody(request);
	if (!body) return svc.json({ ok: false, error: "invalid_json" }, 400, svc.corsHeaders(origin));
	const mode = safeText(body.mode || "entry").toLowerCase() || "entry";
	if (mode === "status") return handleStatus(svc, origin, body);
	if (mode === "hydrate") return handleHydrate(svc, origin, body);
	return handleEntrySync(svc, origin, body);
}
