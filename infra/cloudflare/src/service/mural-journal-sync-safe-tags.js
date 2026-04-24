/**
 * @file src/service/mural-journal-sync-safe-tags.js
 * @module service/mural-journal-sync-safe-tags
 * @summary Creates missing Mural tags before Reflexive Journal entries are added to a board.
 */

import * as BaseMuralJournalSync from "./mural-journal-sync.js";

function safeText(value) {
	return String(value || "").trim();
}

function normalizeTags(value) {
	if (Array.isArray(value)) {
		return value
			.map(tag => safeText(typeof tag === "string" ? tag : (tag?.text || tag?.name || tag?.title || tag?.label || "")))
			.filter(Boolean);
	}
	if (!value) return [];
	return String(value).split(",").map(tag => tag.trim()).filter(Boolean);
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

function truncateMuralTag(tag) {
	const text = safeText(tag);
	return text.length > 25 ? text.slice(0, 25) : text;
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
	const auth = headerValue(headers, "Authorization");
	const match = auth.match(/^Bearer\s+(.+)$/i);
	return match ? match[1] : "";
}

function muralIdFromUrl(url) {
	const match = String(url || "").match(/\/murals\/([^/]+)\/widgets\//);
	return match ? decodeURIComponent(match[1]) : "";
}

function isMuralWidgetWrite(url, init) {
	const method = String(init?.method || "GET").toUpperCase();
	if (method !== "POST" && method !== "PATCH") return false;
	return /app\.mural\.co\/api\/public\/v1\/murals\/[^/]+\/widgets\//.test(String(url || ""));
}

async function bodyAsJson(body) {
	if (!body) return null;
	if (typeof body === "string") {
		try {
			return JSON.parse(body);
		} catch {
			return null;
		}
	}
	return null;
}

async function listMuralTags(accessToken, muralId) {
	const res = await fetch(`https://app.mural.co/api/public/v1/murals/${muralId}/tags`, {
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

	const attempts = [
		{ text },
		{
			text,
			backgroundColor: "#F6D6FF",
			borderColor: "#B15FD1",
			color: "#0B0C0C"
		}
	];

	for (const body of attempts) {
		const res = await fetch(`https://app.mural.co/api/public/v1/murals/${muralId}/tags`, {
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
	const desired = dedupeTags(normalizeTags(tags).map(truncateMuralTag));
	if (!desired.length || !accessToken || !muralId) return [];

	const existing = await listMuralTags(accessToken, muralId);
	const known = new Map();
	for (const tag of existing) {
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
	const clone = response.clone();
	const body = await clone.json().catch(() => ({}));
	const text = JSON.stringify(body).toLowerCase();
	return text.includes("specified tag does not exist") || text.includes("tag does not exist");
}

function withoutTags(body) {
	if (Array.isArray(body)) return body.map(item => withoutTags(item));
	if (body && typeof body === "object") {
		const next = { ...body };
		delete next.tags;
		return next;
	}
	return body;
}

function withTags(body, tags) {
	if (Array.isArray(body)) return body.map(item => withTags(item, tags));
	if (body && typeof body === "object") return { ...body, tags };
	return body;
}

function tagsFromBody(body) {
	if (Array.isArray(body)) return body.flatMap(item => normalizeTags(item?.tags));
	return normalizeTags(body?.tags);
}

function installSafeMuralTagFetch(originalFetch) {
	return async function safeMuralTagFetch(input, init = {}) {
		const url = typeof input === "string" ? input : input?.url;
		if (!isMuralWidgetWrite(url, init)) return originalFetch(input, init);

		const body = await bodyAsJson(init.body);
		const desiredTags = tagsFromBody(body);
		if (!body || !desiredTags.length) return originalFetch(input, init);

		const accessToken = accessTokenFromHeaders(init.headers);
		const muralId = muralIdFromUrl(url);
		const confirmedTags = await ensureKnownTags(accessToken, muralId, desiredTags).catch(() => []);
		const bodyWithConfirmedTags = confirmedTags.length ? withTags(body, confirmedTags) : withoutTags(body);

		const firstResponse = await originalFetch(input, {
			...init,
			body: JSON.stringify(bodyWithConfirmedTags)
		});

		if (!(await responseMentionsMissingTag(firstResponse))) return firstResponse;

		return originalFetch(input, {
			...init,
			body: JSON.stringify(withoutTags(body))
		});
	};
}

export async function muralJournalSync(svc, request, origin) {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = installSafeMuralTagFetch(originalFetch);
	try {
		return await BaseMuralJournalSync.muralJournalSync(svc, request, origin);
	} finally {
		globalThis.fetch = originalFetch;
	}
}
