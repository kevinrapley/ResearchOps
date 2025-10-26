/**
 * @file /public/components/mural-integration.js
 * @module muralIntegration
 * @summary
 * Project dashboard → Connect to Mural (OAuth), verify connection, and create a
 * “Reflexive Journal” board inside a project-named folder.
 *
 * DOM:
 * - <button id="mural-connect">
 * - <button id="mural-setup">
 * - <span   id="mural-status"></span> (optional)
 *
 * Project name sources (first match wins):
 * - <main data-project-name="…">
 * - <h1 id="project-title">…</h1>
 * - <meta name="project:name" content="…">
 * - ?projectName=… (URL)
 *
 * Debug: logs to console.* (your existing debug console captures these).
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

/* ─────────────────────────────────── DOM helpers ───────────────────────────────── */

const $ = (s, r = document) => r.querySelector(s);

function getProjectName() {
	// 1) data attribute
	const main = $("main[data-project-name]");
	if (main?.dataset?.projectName) return main.dataset.projectName.trim();

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

/* ─────────────────────────── Storage: per-project URL ─────────────────────────── */

const URL_KEY_PREFIX = "mural.url::";
/** Stable per-project storage key (by project name). */
function urlKeyFor(projectName) { return `${URL_KEY_PREFIX}${(projectName || "").toLowerCase()}`; }

function getStoredUrl(projectName) { return localStorage.getItem(urlKeyFor(projectName)) || null; }

function setStoredUrl(projectName, url) {
	if (!projectName || !url) return;
	localStorage.setItem(urlKeyFor(projectName), url);
}

function clearStoredUrl(projectName) { if (projectName) localStorage.removeItem(urlKeyFor(projectName)); }

/* ────────────────────────────────── Status pill ──────────────────────────────── */

function setPill(host, kind, text) {
	if (!host) return;
	host.innerHTML = "";
	const span = document.createElement("span");
	span.className = `pill pill--${kind}`;
	span.textContent = text;
	host.appendChild(span);
}

/* ───────────────────────────── Button state helpers ───────────────────────────── */

/**
 * Keep ARIA in sync whenever we toggle the primary action.
 * @param {HTMLButtonElement} btn
 * @param {boolean} disabled
 * @param {string} label
 */
function syncAria(btn, disabled, label) {
	btn.setAttribute("aria-disabled", String(disabled));
	if (label) btn.setAttribute("aria-label", label);
}

/**
 * Put the button into “Create Reflexive Journal” mode.
 * Respects current enablement (verify + project name).
 */
function setCreateMode(btn, enabled) {
	btn.dataset.muralMode = "create";
	btn.textContent = "Create “Reflexive Journal”";
	btn.disabled = !enabled;
	btn.onclick = null;
	syncAria(btn, btn.disabled, "Create Reflexive Journal board in Mural");
}

/**
 * Put the button into “Open Reflexive Journal” mode and wire the click.
 */
function setOpenMode(btn, url) {
	btn.dataset.muralMode = "open";
	btn.textContent = "Open “Reflexive Journal”";
	btn.disabled = false;
	btn.onclick = () => window.open(url, "_blank", "noopener,noreferrer");
	syncAria(btn, false, "Open Reflexive Journal in Mural");
}

/* ────────────────────────────────── API wrappers ──────────────────────────────── */

async function verify(uid) {
	const url = new URL(`${API_BASE}/api/mural/verify`);
	url.searchParams.set("uid", uid);
	console.log("[mural] verifying uid:", uid, "→", url.toString());
	const res = await fetch(url, { cache: "no-store", credentials: "omit" });
	if (res.status === 401) return { ok: false, reason: "not_authenticated" };
	if (!res.ok) {
		const t = await res.text().catch(() => "");
		console.error("[mural] verify error payload:", t);
		return { ok: false, reason: "error", detail: t };
	}
	return res.json();
}

async function setup(uid, projectName) {
	console.log("[mural] setup →", { uid, projectName });
	const res = await fetch(`${API_BASE}/api/mural/setup`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ uid, projectName })
	});
	const js = await res.json().catch(() => ({}));
	if (!res.ok) console.warn("[mural] setup non-200:", res.status, js);
	return js;
}

function startOAuth(uid) {
	localStorage.setItem(UID_KEY, String(uid || "anon")); // pin before leaving
	const returnTo = location.href;
	const url = new URL(`${API_BASE}/api/mural/auth`);
	url.searchParams.set("uid", uid);
	url.searchParams.set("return", returnTo);
	console.log("[mural] redirecting to OAuth…", { uid });
	location.assign(url.toString());
}

/* ───────────────────────────── State + Enabling Logic ─────────────────────────── */

let lastVerifyOk = false;

/**
 * Decide whether the setup button is enabled AND which mode it should be in.
 * - If we have a stored Mural URL for this project → “Open …”
 * - Else → “Create …”, enabled when verify OK + project name present
 */
function updateSetupState() {
	const setupBtn = /** @type {HTMLButtonElement|null} */ ($("#mural-setup"));
	if (!setupBtn) return;

	const name = getProjectName();
	const persistedUrl = getStoredUrl(name);
	const canCreate = Boolean(lastVerifyOk && name);

	if (persistedUrl && lastVerifyOk) {
		setOpenMode(setupBtn, persistedUrl);
	} else {
		setCreateMode(setupBtn, canCreate);
	}

	console.log("[mural] updateSetupState → verifyOk:", lastVerifyOk, "| projectName:", name || "(empty)", "| mode:", setupBtn.dataset.muralMode, "| enabled:", !setupBtn.disabled);
}

/* Observe when <main data-project-name="…"> appears/changes */
function watchProjectName() {
	const main = document.querySelector("main");
	if (!main) return;
	const obs = new MutationObserver(() => updateSetupState());
	obs.observe(main, { attributes: true, attributeFilter: ["data-project-name"], childList: true, subtree: true });
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
		setupBtn.addEventListener("click", async () => {
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

			// If already in OPEN mode, just open and bail.
			if (setupBtn.dataset.muralMode === "open") {
				const url = getStoredUrl(name);
				if (url) {
					window.open(url, "_blank", "noopener,noreferrer");
					return;
				}
				// No URL (edge), fall back to create flow.
			}

			const prev = setupBtn.textContent;
			setupBtn.disabled = true;
			syncAria(setupBtn, true, "Provisioning Reflexive Journal…");
			setupBtn.textContent = "Creating…";
			setPill(statusEl, "neutral", "Provisioning Reflexive Journal…");

			try {
				const res = await setup(getUid(), name);
				console.log("[mural] setup response:", res);
				if (res?.ok) {
					setPill(statusEl, "ok", "Folder + Reflexive Journal created");

					if (res?.mural?.url) {
						setStoredUrl(name, res.mural.url);
						setOpenMode(setupBtn, res.mural.url);
						// Open immediately after creation
						window.open(res.mural.url, "_blank", "noopener,noreferrer");
					} else {
						// No URL returned; revert to create state but enabled
						setCreateMode(setupBtn, true);
						setupBtn.textContent = prev || "Create “Reflexive Journal”";
					}
				} else if (res?.reason === "not_authenticated") {
					setPill(statusEl, "warn", "Please connect Mural first");
					setCreateMode(setupBtn, false);
					setupBtn.textContent = prev || "Create “Reflexive Journal”";
				} else if (res?.reason === "not_in_home_office_workspace") {
					setPill(statusEl, "err", "Your Mural account isn’t in Home Office");
					setCreateMode(setupBtn, false);
					setupBtn.textContent = prev || "Create “Reflexive Journal”";
				} else {
					setPill(statusEl, "err", res?.error || "Setup failed");
					console.warn("[mural] setup error payload:", res);
					setCreateMode(setupBtn, true); // allow retry
					setupBtn.textContent = prev || "Create “Reflexive Journal”";
					alert(`Mural setup failed:\n${JSON.stringify(res, null, 2)}`);
				}
			} catch (err) {
				console.error("[mural] setup exception:", err);
				setPill(statusEl, "err", "Setup failed");
				setCreateMode(setupBtn, true);
				setupBtn.textContent = prev || "Create “Reflexive Journal”";
			} finally {
				// Refresh status; enable state will be recomputed after verify returns
				verify(getUid()).then((res) => {
					lastVerifyOk = !!res?.ok;
					updateSetupState();
					if (res.ok) setPill(statusEl, "ok", "Connected to Mural (Home Office)");
				}).catch(() => {});
			}
		});
	}
}

function init() {
	console.log("[mural] init()");
	const statusEl = /** @type {HTMLElement|null} */ ($("#mural-status"));

	// Bind direct listeners to avoid duplicate delegated clicks
	attachDirectListeners();

	const uid = getUid();
	console.log("[mural] resolved uid:", uid, "projectName:", getProjectName() || "(empty)");

	// Status hint if just returned from OAuth
	if (new URLSearchParams(location.search).get("mural") === "connected") {
		setPill(statusEl, "ok", "Connected to Mural");
	} else {
		setPill(statusEl, "neutral", "Checking…");
	}

	// Verify, then compute setup enablement
	verify(uid).then((res) => {
		console.log("[mural] verify result:", res);
		lastVerifyOk = !!res?.ok;

		// If a board URL is persisted for this project, switch to OPEN mode now.
		const name = getProjectName();
		const persistedUrl = getStoredUrl(name);
		const setupBtn = /** @type {HTMLButtonElement|null} */ ($("#mural-setup"));

		if (setupBtn) {
			if (persistedUrl && lastVerifyOk) {
				setOpenMode(setupBtn, persistedUrl);
			} else {
				setCreateMode(setupBtn, Boolean(lastVerifyOk && name));
			}
		}

		if (res.ok) {
			setPill(statusEl, "ok", "Connected to Mural (Home Office)");
			const connectBtn = /** @type {HTMLButtonElement|null} */ ($("#mural-connect"));
			if (connectBtn) connectBtn.textContent = "Re-connect Mural";
		} else if (res.reason === "not_authenticated") {
			setPill(statusEl, "warn", "Not connected");
		} else if (res.reason === "not_in_home_office_workspace") {
			setPill(statusEl, "err", "Not in Home Office workspace");
		} else {
			setPill(statusEl, "err", "Error checking status");
		}
	}).catch((e) => {
		console.error("[mural] verify failed:", e);
		lastVerifyOk = false;
		updateSetupState();
		setPill(statusEl, "err", "Error checking status");
	});

	// React when <main data-project-name> is populated later by renderProject()
	watchProjectName();

	// Rebind direct listeners if nodes are injected later
	if (!window.__muralObserver) {
		window.__muralObserver = new MutationObserver(() => attachDirectListeners());
		window.__muralObserver.observe(document.body, { childList: true, subtree: true });
	}

	// On load: if we already know a URL for this project, display Open state
	const name = getProjectName();
	const persistedUrl = getStoredUrl(name);
	const setupBtn = /** @type {HTMLButtonElement|null} */ ($("#mural-setup"));
	if (setupBtn && persistedUrl && lastVerifyOk) {
		setOpenMode(setupBtn, persistedUrl);
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
	API_BASE
};
