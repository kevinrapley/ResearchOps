/**
 * @file /public/components/mural-integration.js
 * @module muralIntegration
 * @summary
 * Project dashboard → Connect to Mural (OAuth), verify connection, and create/open a
 * "Reflexive Journal" board inside a project-named folder.
 *
 * DOM:
 * - <button id="mural-connect">
 * - <button id="mural-setup">
 * - <span   id="mural-status"></span> (optional)
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

// Test the API immediately (non-fatal)
fetch(`${API_BASE}/api/health`)
	.then(r => r.json())
	.then(j => console.log("[mural] health check OK:", j))
	.catch(e => console.warn("[mural] health check FAILED (non-fatal):", e));

/* ─────────────────────────────────── DOM helpers ───────────────────────────────── */

const $ = (s, r = document) => r.querySelector(s);

function getProjectName() {
	// 1) data attribute
	const main = $("main[data-project-name]");
	if (main?.dataset?.projectName && main.dataset.projectName !== "null") return main.dataset.projectName.trim();

	// 2) title element
	const title = $("#project-title")?.textContent?.trim();
	if (title) return title;

	// 3) meta tag
	const meta = document.querySelector('meta[name="project:name"]');
	const metaName = meta?.getAttribute("content")?.trim();
	if (metaName) return metaName;

	// 4) query param
	const sp = new URLSearchParams(location.search);
	const q = sp.get("projectName");
	return (q && q.trim()) || "";
}

/* ─────────────────────── Project Mural ID storage ─────────────────────── */

const MURAL_MAPPING_KEY_PREFIX = 'mural.project.';

function saveMuralIdForProject(projectId, muralId) {
	if (!projectId || !muralId) return;
	localStorage.setItem(MURAL_MAPPING_KEY_PREFIX + projectId, muralId);
	console.log('[mural] saved muralId for project:', projectId, '→', muralId);
}

function getMuralIdForProject(projectId) {
	if (!projectId) return null;
	return localStorage.getItem(MURAL_MAPPING_KEY_PREFIX + projectId);
}

function getProjectId() {
	// Try URL parameters first
	const sp = new URLSearchParams(location.search);
	const fromUrl = sp.get('id') || sp.get('project') || sp.get('projectId');
	if (fromUrl) return fromUrl.trim();

	// Try data attributes (check both variations)
	const main = $('main');
	if (main?.dataset?.projectAirtableId) return main.dataset.projectAirtableId.trim();
	if (main?.dataset?.projectId) return main.dataset.projectId.trim();

	return '';
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

function friendlyStatusForVerify(res) {
	if (!res) return { kind: "err", text: "Error checking status" };
	if (res.ok) return { kind: "ok", text: "Connected to Mural (Home Office)" };
	if (res.reason === "not_authenticated") return { kind: "warn", text: "Not connected" };
	if (res.reason === "not_in_home_office_workspace") return { kind: "err", text: "Not in Home Office workspace" };
	if (res.reason === "network_error") return { kind: "err", text: "Network issue connecting to Mural" };
	return { kind: "err", text: "Error checking status" };
}

function friendlyStatusForResolve(errStatus, detail) {
	if (errStatus === 404) return { kind: "neutral", text: "No Reflexive Journal yet" };
	if (errStatus === 500 && /airtable/i.test(detail || "")) {
		return { kind: "err", text: "Airtable lookup error — board mapping unavailable" };
	}
	return { kind: "err", text: "Couldn’t check existing board" };
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

		if (res.status === 401) {
			return { ok: false, reason: "not_authenticated" };
		}

		if (!res.ok) {
			const t = await res.text().catch(() => "");
			return { ok: false, reason: "error", detail: t };
		}

		const json = await res.json();
		return json;
	} catch (err) {
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

		// Save the Mural ID mapping for this project
		if (res.ok && js?.mural?.id && projectId) {
			saveMuralIdForProject(projectId, js.mural.id);
		}

		return js;
	} catch (err) {
		return { ok: false, error: "Network error", detail: String(err) };
	}
}

function startOAuth(uid) {
	localStorage.setItem(UID_KEY, String(uid || "anon")); // pin before leaving
	const returnTo = location.href;
	const url = new URL(`${API_BASE}/api/mural/auth`);
	url.searchParams.set("uid", uid);
	url.searchParams.set("return", returnTo);
	location.assign(url.toString());
}

/**
 * Try to resolve an existing “Reflexive Journal” board for this project+uid.
 * Returns {ok:true, muralId, boardUrl?} when found; nullish when not.
 */
async function resolveExistingBoard() {
	const projectId = getProjectId();
	if (!projectId) return null;

	// Prefer authoritative API, fall back to localStorage mapping if present.
	try {
		const url = new URL(`${API_BASE}/api/mural/resolve`);
		url.searchParams.set("projectId", projectId);
		const uid = getUid();
		if (uid && uid !== "anon") url.searchParams.set("uid", uid);

		const res = await fetch(url.toString(), { cache: "no-store", signal: AbortSignal.timeout(10000) });
		if (res.ok) {
			const js = await res.json().catch(() => ({}));
			if (js?.ok && js?.muralId) {
				// Persist mapping locally too
				saveMuralIdForProject(projectId, js.muralId);
				return { ok: true, muralId: js.muralId, boardUrl: js.boardUrl || "" };
			}
			return null;
		}

		// Handle common error modes gracefully in the UI
		const txt = await res.text().catch(() => "");
		console.warn("[mural] resolve failed", res.status, txt);
		const statusEl = $("#mural-status");
		const pretty = friendlyStatusForResolve(res.status, txt);
		setPill(statusEl, pretty.kind, pretty.text);
		return null;
	} catch (err) {
		console.warn("[mural] resolve network error", err);
		return null;
	}
}

/* ───────────────────────────── State + Enabling Logic ─────────────────────────── */

let lastVerifyOk = false;
let openHandlerBound = false;

function asOpenState(setupBtn, openUrl) {
	if (!setupBtn) return;
	setupBtn.textContent = 'Open "Reflexive Journal"';
	setupBtn.disabled = false;
	setupBtn.setAttribute("aria-disabled", "false");
	if (setupBtn.__muralCreateHandler) {
		setupBtn.removeEventListener("click", setupBtn.__muralCreateHandler);
		delete setupBtn.__muralCreateHandler;
	}
	if (!setupBtn.__muralOpenHandler) {
		setupBtn.__muralOpenHandler = function onOpenClick() {
			if (openUrl) window.open(openUrl, "_blank", "noopener,noreferrer");
		};
		setupBtn.addEventListener("click", setupBtn.__muralOpenHandler);
	}
	openHandlerBound = true;
}

function asCreateState(setupBtn) {
	if (!setupBtn) return;
	setupBtn.textContent = 'Create "Reflexive Journal"';
	if (setupBtn.__muralOpenHandler) {
		setupBtn.removeEventListener("click", setupBtn.__muralOpenHandler);
		delete setupBtn.__muralOpenHandler;
	}
	openHandlerBound = false;
}

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
				queueResolveCheck(); // project name now available → re-check
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
	return v?.viewLink || v?._canvasLink || v?.viewerUrl || v?.url || "";
}

/* ───────────────────────── Debounced resolve on load ─────────────────────────── */

let resolveTimer = null;

function queueResolveCheck() {
	if (resolveTimer) clearTimeout(resolveTimer);
	resolveTimer = setTimeout(async () => {
		const setupBtn = /** @type {HTMLButtonElement|null} */ ($("#mural-setup"));
		const statusEl = /** @type {HTMLElement|null} */ ($("#mural-status"));
		if (!setupBtn) return;
		const projectId = getProjectId();
		if (!projectId) return;

		// If we already have a local mapping, use that immediately for Open state
		const localId = getMuralIdForProject(projectId);
		if (localId && !openHandlerBound) {
			asOpenState(setupBtn, "");
			setPill(statusEl, "ok", "Reflexive Journal linked");
		}

		// Ask the API for the authoritative mapping
		const resolved = await resolveExistingBoard();
		if (resolved?.ok && resolved.muralId) {
			asOpenState(setupBtn, resolved.boardUrl || "");
			setPill(statusEl, "ok", "Reflexive Journal ready");
		} else if (!localId) {
			// Only show “no journal yet” if nothing local and API had no match
			const pretty = friendlyStatusForResolve(404, "");
			setPill(statusEl, pretty.kind, pretty.text);
			asCreateState(setupBtn);
		}
	}, 150);
}

/* ───────────────────────────────────── Init ───────────────────────────────────── */

function attachDirectListeners() {
	const connectBtn = /** @type {HTMLButtonElement|null} */ ($("#mural-connect"));
	const setupBtn = /** @type {HTMLButtonElement|null} */ ($("#mural-setup"));
	const statusEl = /** @type {HTMLElement|null} */ ($("#mural-status"));

	if (connectBtn && !connectBtn.__muralBound) {
		connectBtn.__muralBound = true;
		connectBtn.addEventListener("click", () => {
			startOAuth(getUid());
		});
	}

	if (setupBtn && !setupBtn.__muralBound) {
		setupBtn.__muralBound = true;

		// Keep a reference so we can remove this listener after creation.
		setupBtn.__muralCreateHandler = async function onCreateClick() {
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

					// Switch button to OPEN state
					asOpenState(setupBtn, openUrl);

					// Auto-open once on creation
					if (openUrl) window.open(openUrl, "_blank", "noopener,noreferrer");
					else {
						alert(
							`Your Reflexive Journal board has been created in Mural.\n\n` +
							`Look in your Private room → the "${name}" folder → "Reflexive Journal".`
						);
					}

					// Refresh resolve mapping so it sticks across reload
					queueResolveCheck();
				} else if (res?.reason === "not_authenticated") {
					setPill(statusEl, "warn", "Please connect Mural first");
					setupBtn.textContent = prev || 'Create "Reflexive Journal"';
				} else if (res?.reason === "not_in_home_office_workspace") {
					setPill(statusEl, "err", "Your Mural account isn’t in Home Office");
					setupBtn.textContent = prev || 'Create "Reflexive Journal"';
				} else {
					const msg = res?.error || res?.message || "Setup failed";
					setPill(statusEl, "err", msg);
					setupBtn.textContent = prev || 'Create "Reflexive Journal"';
					console.warn("[mural] setup error payload:", res);
				}
			} catch (err) {
				console.error("[mural] setup exception:", err);
				setPill(statusEl, "err", "Setup failed");
				setupBtn.textContent = prev || 'Create "Reflexive Journal"';
			} finally {
				setupBtn.disabled = false;
				setupBtn.setAttribute("aria-disabled", "false");

				// Refresh status
				verify(getUid()).then((res) => {
					lastVerifyOk = !!res?.ok;
					updateSetupState();
					const f = friendlyStatusForVerify(res);
					setPill(statusEl, f.kind, f.text);
				}).catch(() => {});
			}
		};

		setupBtn.addEventListener("click", setupBtn.__muralCreateHandler);
	}
}

function init() {
	const statusEl = /** @type {HTMLElement|null} */ ($("#mural-status"));

	// Bind direct listeners to avoid duplicate delegated clicks
	attachDirectListeners();

	const uid = getUid();

	// Status hint if just returned from OAuth
	if (new URLSearchParams(location.search).get("mural") === "connected") {
		setPill(statusEl, "ok", "Connected to Mural");
	} else {
		setPill(statusEl, "neutral", "Checking…");
	}

	// Verify, then compute setup enablement
	verify(uid)
		.then((res) => {
			lastVerifyOk = !!res?.ok;
			updateSetupState();

			const f = friendlyStatusForVerify(res);
			setPill(statusEl, f.kind, f.text);

			// If verified, immediately try to resolve an existing board
			if (lastVerifyOk) queueResolveCheck();

			const connectBtn = /** @type {HTMLButtonElement|null} */ ($("#mural-connect"));
			if (connectBtn && res?.ok) connectBtn.textContent = "Re-connect Mural";
		})
		.catch((e) => {
			console.error("[mural] verify failed:", e);
			lastVerifyOk = false;
			updateSetupState();
			setPill(statusEl, "err", "Error checking status");
		});

	// React when <main data-project-name> is populated later by renderProject()
	watchProjectName();

	// If your dashboard injects the buttons later, rebind direct listeners
	if (!window.__muralObserver) {
		window.__muralObserver = new MutationObserver(() => attachDirectListeners());
		window.__muralObserver.observe(document.body, { childList: true, subtree: true });
	}
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
