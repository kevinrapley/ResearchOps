/**
 * @file src/service/mural-journal-sync.js
 * @module service/mural-journal-sync
 * @summary Sync Reflexive Journal entries to the project Mural board.
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
const TEMPLATE_PLACEHOLDER_RE = /This is a .*sticky note that will contain|Further .*entries will appear|single .*from the Research Operations app/i;

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
		return value.map(v => safeText(typeof v === "string" ? v : (v?.text || v?.name || v?.title || v?.label || ""))).filter(Boolean);
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

function parsePayload(body) {
	const categoryKey = normalizeCategoryKey(body.category || body.categoryKey);
	const description = safeText(body.description || body.content || body.text);
	const projectId = safeText(body.projectId || body.project || body.project_airtable_id || body.project_local_id);
	const projectName = safeText(body.projectName || body.projectTitle || body.projectLabel || projectId);
	const uid = safeText(body.uid || "anon") || "anon";
	const entryId = safeText(body.entryId || body.id || "");
	const tags = normalizeTags(body.tags);

	return {
		uid,
		projectId,
		projectName,
		entryId,
		categoryKey,
		description,
		tags,
		explicitMuralId: safeText(body.muralId || "") || null
	};
}

async function readRequestBody(request) {
	try {
		return await request.json();
	} catch {
		return null;
	}
}

/**
 * POST /api/mural/journal-sync
 *
 * Syncs one journal entry to the Reflexive Journal board for its project.
 */
export async function muralJournalSync(svc, request, origin) {
	const body = await readRequestBody(request);
	if (!body) {
		return svc.json({ ok: false, error: "invalid_json" }, 400, svc.corsHeaders(origin));
	}

	const payload = parsePayload(body);
	if (!payload.projectId || !payload.categoryKey || !payload.description) {
		return svc.json({
			ok: false,
			error: "missing_required_fields",
			detail: "projectId, category and description/content are required"
		}, 400, svc.corsHeaders(origin));
	}
	if (!CATEGORY_KEYS.includes(payload.categoryKey)) {
		return svc.json({ ok: false, error: "unsupported_category", category: payload.categoryKey }, 400, svc.corsHeaders(origin));
	}

	const token = await validAccessToken(svc, payload.uid);
	if (!token.ok) {
		return svc.json({ ok: false, error: token.reason || "not_authenticated" }, 401, svc.corsHeaders(origin));
	}

	const board = await svc.mural.resolveBoard({
		projectId: payload.projectId,
		uid: payload.uid,
		purpose: "reflexive_journal",
		explicitMuralId: payload.explicitMuralId
	});

	if (!board?.muralId) {
		return svc.json({ ok: false, error: "mural_board_not_found" }, 404, svc.corsHeaders(origin));
	}

	try {
		const rawWidgets = await getWidgets(svc.env, token.token, board.muralId);
		const widgets = rawWidgets.map(normalizeWidget);
		const anchor = pickCategoryAnchor(widgets, payload.categoryKey);

		if (!anchor) {
			return svc.json({
				ok: false,
				error: "category_column_not_found",
				category: payload.categoryKey,
				muralId: board.muralId
			}, 404, svc.corsHeaders(origin));
		}

		const tags = dedupeTags([payload.categoryKey, payload.projectName, ...payload.tags]);
		const text = payload.description;

		let action = "created";
		let widget = null;

		if (anchor.id && isTemplatePlaceholder(anchor)) {
			try {
				widget = await updateSticky(svc.env, token.token, board.muralId, anchor.id, { text, tags });
				action = "updated-template-sticky";
			} catch (err) {
				svc.log.warn("mural.journal_sync.update_placeholder_failed", {
					message: String(err?.message || err),
					muralId: board.muralId,
					widgetId: anchor.id
				});
			}
		}

		if (!widget) {
			const placement = placementForAnchor(widgets, anchor, payload.categoryKey);
			widget = await createStickyNote(
				svc.env,
				token.token,
				board.muralId,
				createStickyPayload({ text, tags, placement })
			);
		}

		return svc.json({
			ok: true,
			action,
			muralId: board.muralId,
			boardSource: board.source,
			category: payload.categoryKey,
			entryId: payload.entryId || null,
			widgetId: widget?.id || widget?.value?.id || null
		}, 200, svc.corsHeaders(origin));
	} catch (err) {
		const status = Number(err?.status || 0);
		return svc.json({
			ok: false,
			error: "mural_journal_sync_failed",
			detail: String(err?.message || err),
			status: status || undefined,
			muralId: board.muralId
		}, status >= 400 && status < 600 ? status : 500, svc.corsHeaders(origin));
	}
}
