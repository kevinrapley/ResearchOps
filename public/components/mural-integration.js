/**
 * @file /public/components/mural-integration.js
 * @module muralIntegration
 * @summary Project dashboard → Mural (OAuth + verify + provision Reflexive Journal).
 */

/* eslint-env browser */
"use strict";

/* ───────────────────────────────────── Config ─────────────────────────────────── */

const DEFAULT_API_BASE = "https://rops-api.digikev-kevin-rapley.workers.dev";

function resolveApiBase() {
	const fromWindow = typeof window !== "undefined" && window.ROPS_API_BASE;
	const fromHtml = document?.documentElement?.dataset?.apiBase;
	const base = (fromWindow || fromHtml || DEFAULT_API_BASE || "").trim().replace(/\/+$/, "");
	console.log("[mural] API base:", base || "(unset)");
	return base || DEFAULT_API_BASE;
}
const API_BASE = resolveApiBase();

// Probe API quickly
fetch(`${API_BASE}/api/health`)
	.then(r => r.json())
	.then(j => console.log("[mural] health check OK:", j))
	.catch(e => console.error("[mural] health check FAILED:", e));

/* ─────────────────────────────────── DOM helpers ───────────────────────────────── */

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
	const q = sp.get("projectName");
	return (q && q.trim()) || "";
}

/* ─────────────────────── Project Mural ID storage ─────────────────────── */

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

/* ─────────────────────────────────── UID handling ─────────────────────────────── */

const UID_KEY = "mural.uid";

function getUid() {
	const pinned = localStorage.getItem(UID_KEY);
	if (pinned && pinned.trim()) return pinned.trim();
	let uid =
		(window.USER?.id && String(window.USER.id)) ||
		(localStorage.getItem("userId") || "").trim() ||
		"anon";
	uid = String(uid);
	localStorage.setItem(UID_KEY, uid);
	return uid;
}

function resetUid() { localStorage.removeItem(UID_KEY); }

/* ────────────────────────────────── Status pill ──────────────────────────────── */

function setPill(host, kind, text) {
	if (!host) return;
	host.innerHTML = "";
	const span = document.createElement("span");
	span.className = `pill pill--${kind}`;
	span.textContent = text;
	host.appendChild(span);
}

/* ────────────────────────────────── API wrappers ──────────────────────────────── */

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

		// Friendly mapping
		if (res.status >= 500) {
			return { ok: false, reason: "service_unavailable" };
		}
		if (res.status === 401) {
			return { ok: false, reason: "not_authenticated" };
		}
		if (res.status === 403) {
			return { ok: false, reason: "not_in_home_office_workspace" };
		}
		if (!res.ok) {
			const t = await res.text().catch(() => "");
			console.error("[mural] verify error payload:", t);
			return { ok: false, reason: "error", detail: t || `HTTP ${res.status}` };
		}

		const json = await res.json();
		return json;
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
		if (js?.ok && js?.mural?.id && projectId) {
			saveMuralIdForProject(projectId, js.mural.id);
		}
		return js;
	} catch (err) {
		console.error("[mural] setup error:", err);
		return { ok: false, error: "Network error", detail: String(err) };
	}
}

function startOAuth(uid) {
	localStorage.setItem(UID_KEY, String(uid || "anon"));
	const returnTo = location.href;
	const url = new URL(`${API_BASE}/api/mural/auth`);
	url.searchParams.set("uid", uid);
	url.searchParams.set("return", returnTo);
	console.log("[mural] redirecting to OAuth…", { uid });
	location.assign(url.toString());
}

/* ───────────────────────────── State + Enabling Logic ─────────────────────────── */

let lastVerifyOk = false;

function updateSetupState() {
	const setupBtn = /** @type {HTMLButtonElement|null} */ ($("#mural-setup"));
	if (!setupBtn) return;
	const name = getProjectName();
	const shouldEnable = !!(lastVerifyOk && name);
	setupBtn.disabled = !shouldEnable;
	setupBtn.setAttribute("aria-disabled", String(!shouldEnable));
	console.log("[mural] updateSetupState → verifyOk:", lastVerifyOk, "| projectName:", name || "(empty)", "| enabled:", shouldEnable);
}

/* Observe when <main data-project-name="…"> appears/changes */
function watchProjectName() {
	const main = document.querySelector("main");
	if (!main) return;
	const obs = new MutationObserver((mutations) => {
		for (const m of mutations) {
			if (m.type === "attributes" && m.attributeName === "data-project-name") {
				updateSetupState();
				return;
			}
			if (m.type === "childList") {
				updateSetupState();
			}
		}
	});
	obs.observe(main, { attributes: true, attributeFilter: ["data-project-name"], childList: true, subtree: true });
}

/* ───────────────────────────── URL extraction helper ─────────────────────────── */

function extractMuralOpenUrl(res) {
	const v = res?.mural?.value || res?.mural || {};
	return v?._canvasLink || v?.viewerUrl || v?.url || "";
}

/* ───────────────────────────────────── Init ───────────────────────────────────── */

function attachDirectListeners() {
	const connectBtn = /** @type {HTMLButtonElement|null} */ ($("#mural-connect"));
	const setupBtn = /** @type {HTMLButtonElement|null} */ ($("#mural-setup"));
	const statusEl = /** @type {HTMLElement|null} */ ($("#mural-status"));

	if (connectBtn && !connectBtn.__muralBound) {
		connectBtn.__muralBound = true;
		connectBtn.addEventListener("click", () => {
			console.log("[mural] connect button clicked");
			startOAuth(getUid());
		});
	}

	if (setupBtn && !setupBtn.__muralBound) {
		setupBtn.__muralBound = true;

		setupBtn.__muralCreateHandler = async function onCreateClick() {
			console.log("[mural] setup button clicked");
			const name = getProjectName();
			if (!name) {
				setPill(statusEl, "warn", "Missing project name on page");
				alert(
					"Project name not found on this page. Please ensure the dashboard includes either:\n" +
					"• <main data-project-name=\"…\"> or\n" +
					"• <h1 id=\"project-title\">…</h1> or\n" +
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
					setPill(statusEl, "ok", "Folder + Reflexive Journal created");
					const openUrl = extractMuralOpenUrl(res);
					setupBtn.textContent = 'Open "Reflexive Journal"';
					setupBtn.disabled = false;
					setupBtn.setAttribute("aria-disabled", "false");
					setupBtn.removeEventListener("click", setupBtn.__muralCreateHandler);
					delete setupBtn.__muralCreateHandler;
					setupBtn.__muralOpenHandler = function onOpenClick() {
						if (openUrl) window.open(openUrl, "_blank", "noopener,noreferrer");
					};
					setupBtn.addEventListener("click", setupBtn.__muralOpenHandler);
					if (openUrl) window.open(openUrl, "_blank", "noopener,noreferrer");
				} else if (res?.reason === "not_authenticated") {
					setPill(statusEl, "warn", "Please connect Mural first");
					setupBtn.textContent = prev || 'Create "Reflexive Journal"';
				} else if (res?.reason === "not_in_home_office_workspace") {
					setPill(statusEl, "err", "Your Mural account isn’t in Home Office");
					setupBtn.textContent = prev || 'Create "Reflexive Journal"';
				} else if (res?.reason === "service_unavailable") {
					setPill(statusEl, "err", "Mural appears to be unavailable right now. You can continue journaling here and try again later.");
					setupBtn.textContent = prev || 'Create "Reflexive Journal"';
				} else {
					setPill(statusEl, "err", res?.error || "Setup failed");
					console.warn("[mural] setup error payload:", res);
					setupBtn.textContent = prev || 'Create "Reflexive Journal"';
					alert(`Mural setup failed:\n${JSON.stringify(res, null, 2)}`);
				}
			} catch (err) {
				console.error("[mural] setup exception:", err);
				setPill(statusEl, "err", "Setup failed");
				setupBtn.textContent = prev || 'Create "Reflexive Journal"';
			} finally {
				setupBtn.disabled = false;
				setupBtn.setAttribute("aria-disabled", "false");

				verify(getUid()).then((res) => {
					lastVerifyOk = !!res?.ok;
					updateSetupState();
					if (res.ok) setPill(statusEl, "ok", "Connected to Mural (Home Office)");
				}).catch(() => {});
			}
		};

		setupBtn.addEventListener("click", setupBtn.__muralCreateHandler);
	}
}

function init() {
	console.log("[mural] init() starting");
	const statusEl = /** @type {HTMLElement|null} */ ($("#mural-status"));

	attachDirectListeners();

	const uid = getUid();

	// Status hint if just returned from OAuth
	if (new URLSearchParams(location.search).get("mural") === "connected") {
		setPill(statusEl, "ok", "Connected to Mural");
	} else {
		setPill(statusEl, "neutral", "Checking…");
	}

	verify(uid)
		.then((res) => {
			lastVerifyOk = !!res?.ok;
			updateSetupState();

			if (res.ok) {
				setPill(statusEl, "ok", "Connected to Mural (Home Office)");
				const connectBtn = /** @type {HTMLButtonElement|null} */ ($("#mural-connect"));
				if (connectBtn) connectBtn.textContent = "Re-connect Mural";
			} else if (res.reason === "service_unavailable") {
				setPill(
					statusEl,
					"err",
					"Mural appears to be unavailable right now. Your data here is safe — please try again later."
				);
			} else if (res.reason === "not_authenticated") {
				setPill(statusEl, "warn", "Not connected");
			} else if (res.reason === "not_in_home_office_workspace") {
				setPill(statusEl, "err", "Not in Home Office workspace");
			} else if (res.reason === "network_error") {
				setPill(statusEl, "err", "Network error — check your connection or try later.");
			} else {
				setPill(statusEl, "err", "We couldn’t check Mural right now. Please try again later.");
			}
		})
		.catch((e) => {
			console.error("[mural] ✗ verify failed:", e);
			lastVerifyOk = false;
			updateSetupState();
			setPill(
				statusEl,
				"err",
				"We couldn’t check Mural right now. Your project work here is unaffected."
			);
		});

	watchProjectName();

	if (!window.__muralObserver) {
		window.__muralObserver = new MutationObserver(() => attachDirectListeners());
		window.__muralObserver.observe(document.body, { childList: true, subtree: true });
	}

	console.log("[mural] init() completed");
}

/* Ensure init runs whether script loads early or late */
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", init);
} else {
	try { init(); } catch (e) { console.error("[mural] init error:", e); }
}

/* Public surface */
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
