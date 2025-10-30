/**
 * @file /public/components/mural-integration.js
 * @module muralIntegration
 * @summary
 * Connects a project dashboard to Mural (OAuth, verify, provision Reflexive Journal).
 * Adds persistence + recovery so an existing Mural board auto-restores the “Open” button.
 */

/* eslint-env browser */
"use strict";

/* ───────────────────────────── Config ───────────────────────────── */

const DEFAULT_API_BASE = "https://rops-api.digikev-kevin-rapley.workers.dev";

function resolveApiBase() {
	const fromWindow = typeof window !== "undefined" && window.ROPS_API_BASE;
	const fromHtml = document?.documentElement?.dataset?.apiBase;
	const base = (fromWindow || fromHtml || DEFAULT_API_BASE || "").trim().replace(/\/+$/, "");
	console.log("[mural] API base:", base || "(unset)");
	return base || DEFAULT_API_BASE;
}
const API_BASE = resolveApiBase();

/* quick liveness check */
fetch(`${API_BASE}/api/health`)
	.then(r => r.json())
	.then(j => console.log("[mural] health check OK:", j))
	.catch(e => console.error("[mural] health check FAILED:", e));

/* ───────────────────────────── DOM utils ───────────────────────────── */

const $ = (s, r = document) => r.querySelector(s);

function getProjectName() {
	const main = $("main[data-project-name]");
	if (main?.dataset?.projectName) return main.dataset.projectName.trim();
	const title = $("#project-title")?.textContent?.trim();
	if (title) return title;
	const meta = document.querySelector('meta[name="project:name"]');
	const metaName = meta?.getAttribute("content")?.trim();
	if (metaName) return metaName;
	const sp = new URLSearchParams(location.search);
	return sp.get("projectName")?.trim() || "";
}

/* ───────────────────────────── Storage ───────────────────────────── */

const MURAL_MAPPING_KEY_PREFIX = "mural.project.";

function saveMuralIdForProject(projectId, muralId) {
	if (!projectId || !muralId) return;
	localStorage.setItem(MURAL_MAPPING_KEY_PREFIX + projectId, muralId);
	console.log("[mural] saved muralId for project:", projectId, "→", muralId);
}

function getMuralIdForProject(projectId) {
	if (!projectId) return null;
	return localStorage.getItem(MURAL_MAPPING_KEY_PREFIX + projectId);
}

function getProjectId() {
	const sp = new URLSearchParams(location.search);
	const fromUrl = sp.get("id") || sp.get("project") || sp.get("projectId");
	if (fromUrl) return fromUrl.trim();
	const main = $("main");
	if (main?.dataset?.projectAirtableId) return main.dataset.projectAirtableId.trim();
	if (main?.dataset?.projectId) return main.dataset.projectId.trim();
	return "";
}

/* ───────────────────────────── UID handling ───────────────────────────── */

const UID_KEY = "mural.uid";

function getUid() {
	const pinned = localStorage.getItem(UID_KEY);
	if (pinned && pinned.trim()) return pinned.trim();
	let uid =
		(window.USER?.id && String(window.USER.id)) ||
		(localStorage.getItem("userId") || "").trim() ||
		"anon";
	localStorage.setItem(UID_KEY, uid);
	return uid;
}

function resetUid() { localStorage.removeItem(UID_KEY); }

/* ───────────────────────────── Pill helper ───────────────────────────── */

function setPill(host, kind, text) {
	if (!host) return;
	host.innerHTML = "";
	const span = document.createElement("span");
	span.className = `pill pill--${kind}`;
	span.textContent = text;
	host.appendChild(span);
}

/* ───────────────────────────── API wrappers ───────────────────────────── */

async function verify(uid) {
	const url = new URL(`${API_BASE}/api/mural/verify`);
	url.searchParams.set("uid", uid);
	console.log("[mural] verifying uid:", uid, "→", url.toString());
	try {
		const res = await fetch(url, {
			cache: "no-store",
			credentials: "omit",
			signal: AbortSignal.timeout(10000)
		});
		if (res.status >= 500) return { ok: false, reason: "service_unavailable" };
		if (res.status === 401) return { ok: false, reason: "not_authenticated" };
		if (res.status === 403) return { ok: false, reason: "not_in_home_office_workspace" };
		if (!res.ok) return { ok: false, reason: "error", detail: `HTTP ${res.status}` };
		return await res.json();
	} catch (err) {
		console.error("[mural] verify network error:", err);
		return { ok: false, reason: "network_error", detail: String(err) };
	}
}

async function setup(uid, projectName) {
	const projectId = getProjectId();
	console.log("[mural] setup →", { uid, projectId, projectName });
	try {
		const res = await fetch(`${API_BASE}/api/mural/setup`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ uid, projectId, projectName }),
			signal: AbortSignal.timeout(15000)
		});
		const js = await res.json().catch(() => ({}));
		if (js?.ok && js?.mural?.id && projectId) saveMuralIdForProject(projectId, js.mural.id);
		return js;
	} catch (err) {
		console.error("[mural] setup error:", err);
		return { ok: false, error: "Network error", detail: String(err) };
	}
}

function startOAuth(uid) {
	localStorage.setItem(UID_KEY, String(uid || "anon"));
	const url = new URL(`${API_BASE}/api/mural/auth`);
	url.searchParams.set("uid", uid);
	url.searchParams.set("return", location.href);
	location.assign(url.toString());
}

/* ───────────────────────────── State handling ───────────────────────────── */

let lastVerifyOk = false;
let lastUpdate = 0;

function updateSetupState() {
	const now = Date.now();
	if (now - lastUpdate < 300) return; // throttle noise
	lastUpdate = now;

	const setupBtn = $("#mural-setup");
	if (!setupBtn) return;
	const name = getProjectName();
	const shouldEnable = !!(lastVerifyOk && name);
	setupBtn.disabled = !shouldEnable;
	setupBtn.setAttribute("aria-disabled", String(!shouldEnable));
	console.log("[mural] updateSetupState → verifyOk:", lastVerifyOk, "| projectName:", name || "(empty)", "| enabled:", shouldEnable);
}

/* observe dynamic project name changes */
function watchProjectName() {
	const main = document.querySelector("main");
	if (!main) return;
	const obs = new MutationObserver(() => updateSetupState());
	obs.observe(main, { attributes: true, attributeFilter: ["data-project-name"], childList: true, subtree: true });
}

/* ───────────────────────────── Init & listeners ───────────────────────────── */

function attachDirectListeners() {
	const connectBtn = $("#mural-connect");
	const setupBtn = $("#mural-setup");
	const statusEl = $("#mural-status");

	if (connectBtn && !connectBtn.__muralBound) {
		connectBtn.__muralBound = true;
		connectBtn.addEventListener("click", () => startOAuth(getUid()));
	}

	if (setupBtn && !setupBtn.__muralBound) {
		setupBtn.__muralBound = true;
		setupBtn.__muralCreateHandler = async function onCreateClick() {
			const name = getProjectName();
			if (!name) {
				setPill(statusEl, "warn", "Missing project name on page");
				alert("Project name not found. Ensure dashboard sets <main data-project-name> or <h1 id='project-title'>.");
				return;
			}
			const prev = setupBtn.textContent;
			setupBtn.disabled = true;
			setupBtn.textContent = "Creating…";
			setPill(statusEl, "neutral", "Provisioning Reflexive Journal…");
			try {
				const res = await setup(getUid(), name);
				if (res?.ok) {
					setPill(statusEl, "ok", "Folder + Reflexive Journal created");
					const openUrl = res?.mural?._canvasLink || res?.mural?.url;
					setupBtn.textContent = 'Open "Reflexive Journal"';
					setupBtn.disabled = false;
					setupBtn.setAttribute("aria-disabled", "false");
					setupBtn.removeEventListener("click", setupBtn.__muralCreateHandler);
					delete setupBtn.__muralCreateHandler;
					setupBtn.addEventListener("click", () => openUrl && window.open(openUrl, "_blank", "noopener,noreferrer"));
					if (openUrl) window.open(openUrl, "_blank", "noopener,noreferrer");
				} else if (res?.reason === "service_unavailable") {
					setPill(statusEl, "err", "Mural appears unavailable. Try again later.");
					setupBtn.textContent = prev;
				} else if (res?.reason === "not_authenticated") {
					setPill(statusEl, "warn", "Please connect Mural first");
					setupBtn.textContent = prev;
				} else {
					setPill(statusEl, "err", res?.error || "Setup failed");
					setupBtn.textContent = prev;
				}
			} catch (err) {
				console.error("[mural] setup exception:", err);
				setPill(statusEl, "err", "Setup failed");
				setupBtn.textContent = prev;
			} finally {
				setupBtn.disabled = false;
				setupBtn.setAttribute("aria-disabled", "false");
				verify(getUid()).then(r => {
					lastVerifyOk = !!r?.ok;
					updateSetupState();
					if (r.ok) setPill(statusEl, "ok", "Connected to Mural (Home Office)");
				}).catch(() => {});
			}
		};
		setupBtn.addEventListener("click", setupBtn.__muralCreateHandler);
	}
}

/* ───────────────────────────── Bootstrap ───────────────────────────── */

function init() {
	console.log("[mural] init() starting");
	const statusEl = $("#mural-status");
	attachDirectListeners();
	const uid = getUid();

	if (new URLSearchParams(location.search).get("mural") === "connected") {
		setPill(statusEl, "ok", "Connected to Mural");
	} else {
		setPill(statusEl, "neutral", "Checking…");
	}

	verify(uid)
		.then((res) => {
			console.log("[mural] ✓ verify completed:", res);
			lastVerifyOk = !!res?.ok;
			updateSetupState();

			const setupBtn = $("#mural-setup");

			if (res.ok) {
				setPill(statusEl, "ok", "Connected to Mural (Home Office)");
				const connectBtn = $("#mural-connect");
				if (connectBtn) connectBtn.textContent = "Re-connect Mural";

				/* === Restore existing mapping === */
				const projectId = getProjectId();
				const existing = getMuralIdForProject(projectId);
				if (existing && setupBtn) {
					const openUrl = `${API_BASE}/api/mural/open?id=${encodeURIComponent(existing)}`;
					setupBtn.textContent = 'Open "Reflexive Journal"';
					setupBtn.disabled = false;
					setupBtn.setAttribute("aria-disabled", "false");
					setupBtn.addEventListener("click", () =>
						window.open(openUrl, "_blank", "noopener,noreferrer")
					);
					setPill(statusEl, "ok", "Reflexive Journal ready");
					return;
				}
			} else if (res.reason === "service_unavailable") {
				setPill(statusEl, "err", "Mural appears unavailable. Your data is safe; try again later.");
			} else if (res.reason === "not_authenticated") {
				setPill(statusEl, "warn", "Not connected");
			} else if (res.reason === "not_in_home_office_workspace") {
				setPill(statusEl, "err", "Not in Home Office workspace");
			} else if (res.reason === "network_error") {
				setPill(statusEl, "err", "Network error — check connection.");
			} else {
				setPill(statusEl, "err", "Couldn’t verify Mural connection.");
			}
		})
		.catch((e) => {
			console.error("[mural] ✗ verify failed:", e);
			lastVerifyOk = false;
			updateSetupState();
			setPill(statusEl, "err", "Couldn’t verify Mural. Try again later.");
		});

	watchProjectName();

	if (!window.__muralObserver) {
		window.__muralObserver = new MutationObserver(() => attachDirectListeners());
		window.__muralObserver.observe(document.body, { childList: true, subtree: true });
	}
	console.log("[mural] init() completed");
}

/* ───────────────────────────── Run ───────────────────────────── */

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", init);
} else {
	try { init(); } catch (e) { console.error("[mural] init error:", e); }
}

/* public surface */
window.MuralIntegration = {
	init,
	verify,
	setup,
	startOAuth,
	resetUid,
	getMuralIdForProject,
	saveMuralIdForProject,
	API_BASE
};
