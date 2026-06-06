import { getWidgets } from "../../lib/mural.js";
import { CATEGORY_KEYS, PURPOSE_REFLEXIVE } from "./constants.js";
import { validAccessToken } from "./auth.js";
import { parseBasePayload } from "./request.js";
import { normalizeCategoryKey, safeText } from "./text.js";
import { categoryTemplateWidget, normalizeWidget, widgetHasEntryTag, widgetMatchesCategory, widgetMatchesTemplateGeometry } from "./widgets.js";

export async function resolveBoardAndWidgets(svc, token, payload) {
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

export async function listEntriesForProject(svc, origin, projectId) {
	const url = new URL("https://local/api/journal-entries");
	url.searchParams.set("project", projectId);
	const response = await svc.listJournalEntries(origin, url);
	const data = await response.json().catch(() => ({}));
	return Array.isArray(data?.entries) ? data.entries : [];
}

export function sortedEntries(entries) {
	return [...entries].sort((a, b) => {
		const aTime = Date.parse(a.createdAt || a.created_at || "");
		const bTime = Date.parse(b.createdAt || b.created_at || "");
		return (Number.isFinite(aTime) ? aTime : 0) - (Number.isFinite(bTime) ? bTime : 0);
	});
}

export function statusFromEntriesAndWidgets(entries, widgets) {
	const validEntries = entries.filter(entry => safeText(entry.id));
	const syncedEntryIds = new Set();
	const templates = Object.fromEntries(CATEGORY_KEYS.map(category => [category, categoryTemplateWidget(widgets, category)]));

	for (const entry of validEntries) {
		const category = normalizeCategoryKey(entry.category);
		const template = templates[category];
		if (widgets.some(widget => {
			return widgetHasEntryTag(widget, entry.id) &&
				widgetMatchesCategory(widget, category) &&
				widgetMatchesTemplateGeometry(widget, template);
		})) {
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

export async function buildContext(svc, origin, body) {
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
