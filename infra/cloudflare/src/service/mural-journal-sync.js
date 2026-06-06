/**
 * @file src/service/mural-journal-sync.js
 * @module service/mural-journal-sync
 * @summary Idempotent Reflexive Journal to Mural sync and hydration.
 */

import { buildContext, resolveBoardAndWidgets, sortedEntries, statusFromEntriesAndWidgets } from "./mural-journal-sync/context.js";
import { validAccessToken } from "./mural-journal-sync/auth.js";
import { entryPayloadFromEntry, parseEntryPayload, readRequestBody } from "./mural-journal-sync/request.js";
import { syncOneEntry } from "./mural-journal-sync/sync-entry.js";
import { safeText } from "./mural-journal-sync/text.js";

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
