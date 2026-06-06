import { normalizeCategoryKey, normalizeTags, safeText } from "./text.js";

export function parseBasePayload(body) {
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

export function parseEntryPayload(body) {
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

export function entryPayloadFromEntry(entry, base) {
	return {
		...base,
		entryId: safeText(entry.id),
		categoryKey: normalizeCategoryKey(entry.category),
		description: safeText(entry.content || entry.body || entry.description || entry.text),
		tags: normalizeTags(entry.tags),
		createdAt: entry.createdAt || entry.created_at || ""
	};
}

export async function readRequestBody(request) {
	try {
		return await request.json();
	} catch {
		return null;
	}
}
