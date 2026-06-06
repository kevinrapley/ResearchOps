import { createViewerLink, getMural, getMuralLinks } from "../../lib/mural.js";

function looksLikeMuralViewerUrl(u) {
	try {
		const x = new URL(u);
		if (x.hostname !== "app.mural.co") return false;
		const p = x.pathname || "";
		return (
			/^\/t\/[^/]+\/m\/[^/]+/i.test(p) ||
			/^\/invitation\/mural\/[a-z0-9.-]+/i.test(p) ||
			/^\/viewer\//i.test(p) ||
			/^\/share\/[^/]+\/mural\/[a-z0-9.-]+/i.test(p)
		);
	} catch {
		return false;
	}
}

function extractViewerUrl(payload) {
	if (!payload) return null;
	const seen = new Set();
	const queue = [payload];

	while (queue.length) {
		const n = queue.shift();
		if (!n || seen.has(n)) continue;
		seen.add(n);

		if (typeof n === "string" && looksLikeMuralViewerUrl(n)) return n;
		if (typeof n !== "object") continue;

		const cands = [
			n.viewerUrl,
			n.viewerURL,
			n.viewLink,
			n.viewURL,
			n.openUrl,
			n.openURL,
			n._canvasLink,
			n.url,
			n.href,
			n.link,
			n.value,
			n.links,
			n.links?.viewer,
			n.links?.open,
			n.links?.share,
			n.links?.public,
		].filter(Boolean);

		for (const c of cands) {
			if (typeof c === "string" && looksLikeMuralViewerUrl(c)) return c;
			if (c && typeof c === "object") queue.push(c);
		}
		for (const v of Object.values(n)) {
			if (!cands.includes(v)) queue.push(v);
		}
	}
	return null;
}

export async function probeViewerUrl(env, accessToken, muralId) {
	try {
		const hydrated = await getMural(env, accessToken, muralId).catch(() => null);
		const url = extractViewerUrl(hydrated);
		if (url) return url;
	} catch {}
	try {
		const links = await getMuralLinks(env, accessToken, muralId).catch(() => []);
		const best =
			links.find((l) => looksLikeMuralViewerUrl(l.url)) ||
			links.find((l) => /viewer|view|open|public/i.test(String(l.type || "")) && l.url);
		if (best?.url && looksLikeMuralViewerUrl(best.url)) return best.url;
	} catch {}
	try {
		const created = await createViewerLink(env, accessToken, muralId);
		if (created && looksLikeMuralViewerUrl(created)) return created;
	} catch {}
	try {
		const hydrated2 = await getMural(env, accessToken, muralId).catch(() => null);
		const url2 = extractViewerUrl(hydrated2);
		if (url2) return url2;
	} catch {}
	return null;
}
