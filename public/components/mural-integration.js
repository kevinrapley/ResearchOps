/**
 * @file /public/components/mural-integration.js
 * @module muralIntegration
 * @summary
 * Connects the project dashboard to Mural (OAuth + verify + provision).
 * Persists the "Reflexive Journal" board id and restores the OPEN state on refresh.
 */

/* eslint-env browser */
"use strict";

/* ───────────────────────── Config ───────────────────────── */

const DEFAULT_API_BASE = "https://rops-api.digikev-kevin-rapley.workers.dev";

function resolveApiBase() {
	const fromWindow = typeof window !== "undefined" && window.ROPS_API_BASE;
	const fromHtml = document?.documentElement?.dataset?.apiBase;
	const base = (fromWindow || fromHtml || DEFAULT_API_BASE || "").trim().replace(/\/+$/, "");
	console.log("[mural] API base:", base || "(unset)");
	return base || DEFAULT_API_BASE;
}
const API_BASE = resolveApiBase();

/* warm liveness check (optional) */
fetch(`${API_BASE}/api/health`).then(r => r.json())
	.then(j => console.log("[mural] health check OK:", j))
	.catch(e => console.error("[mural] health check FAILED:", e));

/* ───────────────────────── DOM utils ───────────────────────── */

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

function getProjectId() {
	const sp = new URLSearchParams(location.search);
	const fromUrl = sp.get("id") || sp.get("project") || sp.get("projectId");
	if (fromUrl) return fromUrl.trim();

	const main = $("main");
	if (main?.dataset?.projectAirtableId) return main.dataset.projectAirtableId.trim();
	if (main?.dataset?.projectId) return main.dataset.projectId.trim();

	return "";
}

/* ───────────────────────── Persisted mapping ───────────────────────── */

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

/* ───────────────────────── UID handling ───────────────────────── */

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

/* ───────────────────────── Status pill ───────────────────────── */

function setPill(host, kind, text) {
	if (!host) return;
	host.innerHTML = "";
	const span = document.createElement("span");
	span.className = `pill pill--${kind}`;
	span.textContent = text;
	host.appendChild(span);
}

/* ───────────────────────── API wrappers ───────────────────────── */

async function verify(uid) {
	const url = new URL(`${API_BASE}/api/mural/verify`);
	url.searchParams.set("uid", uid);
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
	try {
		const res = await fetch(`${API_BASE}/api/mural/setup`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ uid, projectId, projectName }),
			signal: AbortSignal.timeout(15000)
		});
		const js = await res.json().catch(() => ({}));

		// Robustly pick the mural id regardless of shape
		const newId = js?.mural?.id || js?.mural?.value?.id || js?.muralId || null;
		if (js?.ok && newId && projectId) saveMuralIdForProject(projectId, newId);

		return js;
	} catch (err) {
		console.error("[mural] setup error:", err);
		return { ok: false, error: "Network error", detail: String(err) };
	}
}

/**
 * Best-effort mapping fetch from server (Airtable source-of-truth).
 * Non-fatal if the route isn’t present; we just return nulls.
 */
async function resolveMapping(projectId) {
	if (!projectId) return { muralId: null, openUrl: "" };
	try {
		const u = new URL(`${API_BASE}/api/mural/resolve`);
		u.searchParams.set("projectId", projectId);
		const res = await fetch(u, { cache: "no-store", signal: AbortSignal.timeout(8000) });
		if (!res.ok) return { muralId: null, openUrl: "" };
		const js = await res.json().catch(() => ({}));
		const muralId = js?.muralId || js?.mural?.id || null;
		const openUrl = js?.openUrl || js?.mural?._canvasLink || js?.mural?.url || "";
		return { muralId, openUrl };
	} catch {
		return { muralId: null, openUrl: "" };
	}
}

function startOAuth(uid) {
	localStorage.setItem(UID_KEY, String(uid || "anon")); // pin before leaving
	const url = new URL(`${API_BASE}/api/mural/auth`);
	url.searchParams.set("uid", uid);
	url.searchParams.set("return", location.href);
	location.assign(url.toString());
}

/* ───────────────────────── State + enabling ───────────────────────── */

let lastVerifyOk = false;
let lastUpdate = 0;
let restoredOnce = false;

function updateSetupState() {
	const now = Date.now();
	if (now - lastUpdate < 300) return; // throttle noisy logs
	lastUpdate = now;

	const setupBtn = /** @type {HTMLButtonElement|null} */ ($("#mural-setup"));
	if (!setupBtn) return;

	const name = getProjectName();
	const shouldEnable = !!(lastVerifyOk && name);
	setupBtn.disabled = !shouldEnable;
	setupBtn.setAttribute("aria-disabled", String(!shouldEnable));
	console.log("[mural] updateSetupState → verifyOk:", lastVerifyOk, " | projectName:", name || "(empty)", " | enabled:", shouldEnable);

	// When we first become enabled, attempt a restore if we haven't already.
	if (shouldEnable && !restoredOnce) {
		restoreOpenButton().catch(() => {});
	}
}

/* React when project name appears/changes (dashboard populates it async) */
function watchProjectName() {
	const main = document.querySelector("main");
	if (!main) return;
	const obs = new MutationObserver(() => updateSetupState());
	obs.observe(main, { attributes: true, attributeFilter: ["data-project-name"], childList: true, subtree: true });
}

/* ───────────────────────── Restore “Open” on refresh ───────────────────────── */

async function restoreOpenButton() {
	const setupBtn = /** @type {HTMLButtonElement|null} */ ($("#mural-setup"));
	const statusEl = /** @type {HTMLElement|null} */ ($("#mural-status"));
	if (!setupBtn) return;

	const projectId = getProjectId();
	if (!projectId) return;

	// 1) Fast path: localStorage
	let muralId = getMuralIdForProject(projectId);
	let openUrl = "";

	// 2) If missing, try server (Airtable source-of-truth)
	if (!muralId) {
		const r = await resolveMapping(projectId);
		if (r.muralId) {
			muralId = r.muralId;
			openUrl = r.openUrl || openUrl;
			saveMuralIdForProject(projectId, muralId);
		}
	}

	// Nothing to restore
	if (!muralId) return;

	// We might still not have a share URL. If so, we’ll fall back to an info alert.
	if (!openUrl) {
		// optional extra fetch to resolve (in case server gained it late)
		const r = await resolveMapping(projectId).catch(() => ({}));
		openUrl = r?.openUrl || "";
	}

	// Switch to OPEN state
	setupBtn.textContent = 'Open "Reflexive Journal"';
	setupBtn.disabled = false;
	setupBtn.setAttribute("aria-disabled", "false");

	// Avoid stacking listeners on re-runs
	if (setupBtn.__muralCreateHandler) {
		setupBtn.removeEventListener("click", setupBtn.__muralCreateHandler);
		delete setupBtn.__muralCreateHandler;
	}
	if (setupBtn.__muralOpenHandler) {
		setupBtn.removeEventListener("click", setupBtn.__muralOpenHandler);
		delete setupBtn.__muralOpenHandler;
	}

	setupBtn.__muralOpenHandler = function onOpen() {
		if (openUrl) {
			window.open(openUrl, "_blank", "noopener,noreferrer");
		} else {
			alert(
				'Your "Reflexive Journal" board is set up in Mural.\n\n' +
				"Tip: Open Mural → Private room → the project-named folder → Reflexive Journal."
			);
		}
	};
	setupBtn.addEventListener("click", setupBtn.__muralOpenHandler);

	if (statusEl) setPill(statusEl, "ok", "Reflexive Journal ready");
	restoredOnce = true;
}

/* ───────────────────────── Init & listeners ───────────────────────── */

function attachDirectListeners() {
	const connectBtn = /** @type {HTMLButtonElement|null} */ ($("#mural-connect"));
	const setupBtn = /** @type {HTMLButtonElement|null} */ ($("#mural-setup"));
	const statusEl = /** @type {HTMLElement|null} */ ($("#mural-status"));

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
				alert(
					"Project name not found. Ensure the dashboard sets one of:\n" +
					"• <main data-project-name=\"…\">\n" +
					"• <h1 id=\"project-title\">…</h1>\n" +
					"• <meta name=\"project:name\" content=\"…\">"
				);
				return;
			}

			const prev = setupBtn.textContent;
			setupBtn.disabled = true;
			setupBtn.setAttribute("aria-disabled", "true");
			setupBtn.textContent = "Creating…";
			setPill(statusEl, "neutral", "Provisioning Reflexive Journal…");

			try {
				const res = await setup(getUid(), name);

				if (res?.ok) {
					// capture and persist id under all known response shapes
					const newId = res?.mural?.id || res?.mural?.value?.id || res?.muralId || null;
					const projectId = getProjectId();
					if (newId && projectId) saveMuralIdForProject(projectId, newId);

					setPill(statusEl, "ok", "Folder + Reflexive Journal created");

					const openUrl = res?.mural?._canvasLink || res?.mural?.viewerUrl || res?.mural?.url || "";

					// flip to open
					setupBtn.textContent = 'Open "Reflexive Journal"';
					setupBtn.disabled = false;
					setupBtn.setAttribute("aria-disabled", "false");

					setupBtn.removeEventListener("click", setupBtn.__muralCreateHandler);
					delete setupBtn.__muralCreateHandler;

					setupBtn.__muralOpenHandler = function onOpenClick() {
						if (openUrl) window.open(openUrl, "_blank", "noopener,noreferrer");
						else alert('Open Mural → Private room → project folder → "Reflexive Journal".');
					};
					setupBtn.addEventListener("click", setupBtn.__muralOpenHandler);

					// one-time auto-open
					if (openUrl) window.open(openUrl, "_blank", "noopener,noreferrer");
				} else if (res?.reason === "service_unavailable") {
					setPill(statusEl, "err", "Mural appears unavailable. Try again later.");
					setupBtn.textContent = prev || 'Create “Reflexive Journal”';
				} else if (res?.reason === "not_authenticated") {
					setPill(statusEl, "warn", "Please connect Mural first");
					setupBtn.textContent = prev || 'Create “Reflexive Journal”';
				} else if (res?.reason === "not_in_home_office_workspace") {
					setPill(statusEl, "err", "Not in Home Office workspace");
					setupBtn.textContent = prev || 'Create “Reflexive Journal”';
				} else {
					setPill(statusEl, "err", res?.error || "Setup failed");
					console.warn("[mural] setup error payload:", res);
					setupBtn.textContent = prev || 'Create “Reflexive Journal”';
				}
			} catch (err) {
				console.error("[mural] setup exception:", err);
				setPill(statusEl, "err", "Setup failed");
				setupBtn.textContent = 'Create “Reflexive Journal”';
			} finally {
				setupBtn.disabled = false;
				setupBtn.setAttribute("aria-disabled", "false");

				// refresh status & try a restore once verified
				verify(getUid()).then((res) => {
					lastVerifyOk = !!res?.ok;
					updateSetupState();
					if (res.ok) {
						setPill(statusEl, "ok", "Connected to Mural (Home Office)");
						restoreOpenButton().catch(() => {});
					}
				}).catch(() => {});
			}
		};

		setupBtn.addEventListener("click", setupBtn.__muralCreateHandler);
	}
}

function init() {
	const statusEl = /** @type {HTMLElement|null} */ ($("#mural-status"));

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

			if (res.ok) {
				setPill(statusEl, "ok", "Connected to Mural (Home Office)");
				const connectBtn = $("#mural-connect");
				if (connectBtn) connectBtn.textContent = "Re-connect Mural";
				restoreOpenButton().catch(() => {});
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

	// keep the enabled state + restore logic in sync with late-populated project name
	watchProjectName();

	// if buttons are injected later, bind again
	if (!window.__muralObserver) {
		window.__muralObserver = new MutationObserver(() => attachDirectListeners());
		window.__muralObserver.observe(document.body, { childList: true, subtree: true });
	}
}

/* run */
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", init);
} else {
	try { init(); } catch (e) { console.error("[mural] init error:", e); }
}

/* public surface for other modules */
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
