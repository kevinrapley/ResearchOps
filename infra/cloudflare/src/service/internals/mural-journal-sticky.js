import {
	applyTagsToSticky,
	createSticky,
	ensureTagsBlueberry,
	findLatestInCategory,
	getWidgets,
	normaliseWidgets,
	updateSticky,
} from "../../lib/mural.js";
import { PURPOSE_REFLEXIVE } from "./mural-board-registry.js";
import { getValidAccessToken } from "./mural-tokens.js";

const GRID_Y = 32;
const DEFAULT_W = 240;
const DEFAULT_H = 120;

export async function handleMuralJournalSync(self, request, origin) {
	const cors = self.root.corsHeaders(origin);
	let step = "parse_input";

	try {
		const body = await request.json().catch(() => ({}));
		const uid = String(body?.uid || "anon");
		const purpose = String(body?.purpose || PURPOSE_REFLEXIVE);
		const category = String(body?.category || "").toLowerCase().trim();
		const description = String(body?.description || "").trim();
		const labels = Array.isArray(body?.tags) ? body.tags.filter(Boolean) : [];

		if (!category || !description) {
			return self.root.json({ ok: false, error: "missing_category_or_description" }, 400, cors);
		}
		if (!["perceptions", "procedures", "decisions", "introspections"].includes(category)) {
			return self.root.json({ ok: false, error: "unsupported_category" }, 400, cors);
		}

		step = "resolve_board";
		const resolved = await self.resolveBoard({
			projectId: body.projectId,
			uid: uid || undefined,
			purpose,
			explicitMuralId: body.muralId,
		});
		const muralId = resolved?.muralId || null;
		if (!muralId) {
			return self.root.json({ ok: false, error: "no_mural_id" }, 404, cors);
		}

		step = "access_token";
		const tokenRes = await getValidAccessToken(self, uid);
		if (!tokenRes.ok) {
			return self.root.json(
				{ ok: false, error: tokenRes.reason },
				tokenRes.reason === "not_authenticated" ? 401 : 500,
				cors,
			);
		}
		const accessToken = tokenRes.token;

		step = "load_widgets";
		const widgetsJs = await getWidgets(self.root.env, accessToken, muralId);
		const stickyList = normaliseWidgets(widgetsJs?.widgets);
		const last = findLatestInCategory(stickyList, category);

		let stickyId = null;
		let action = "";
		let targetX = last?.x ?? 200;
		let targetY = last?.y ?? 200;
		let targetW = last?.width ?? DEFAULT_W;
		let targetH = last?.height ?? DEFAULT_H;

		step = "write_or_create";
		if (last && (last.text || "").trim().length === 0) {
			await updateSticky(self.root.env, accessToken, muralId, last.id, { text: description });
			stickyId = last.id;
			action = "updated-empty-sticky";
		} else {
			if (last) {
				targetY = (last.y || 0) + (last.height || DEFAULT_H) + GRID_Y;
				targetX = last.x || targetX;
				targetW = last.width || targetW;
				targetH = last.height || targetH;
			}
			const crt = await createSticky(self.root.env, accessToken, muralId, {
				text: description,
				x: Math.round(targetX),
				y: Math.round(targetY),
				width: Math.round(targetW),
				height: Math.round(targetH),
			});
			stickyId = crt?.id || null;
			action = "created-new-sticky";
		}

		step = "tagging";
		if (labels.length && stickyId) {
			const tagIds = await ensureTagsBlueberry(self.root.env, accessToken, muralId, labels);
			if (tagIds.length) {
				await applyTagsToSticky(self.root.env, accessToken, muralId, stickyId, tagIds);
			}
		}

		return self.root.json({ ok: true, stickyId, action, muralId }, 200, cors);
	} catch (err) {
		const status = Number(err?.status) || 500;
		const body = err?.body || null;
		const message = String(err?.message || "journal_sync_failed");
		return self.root.json({ ok: false, error: "journal_sync_failed", step, message, upstream: body }, status, cors);
	}
}
