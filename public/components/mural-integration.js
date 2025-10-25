/**
 * @file /public/components/mural-integration.js
 * @module muralIntegration
 * @summary Project dashboard → Connect to Mural (OAuth), verify connection, and create a
 *          “Reflexive Journal” board in a project folder.
 *
 * How it works (client-side):
 *   1) “Connect Mural” → full-page redirect to your Worker’s /api/mural/auth (starts OAuth).
 *   2) Mural redirects back to your Worker /api/mural/callback, which stores tokens in KV.
 *   3) Dashboard loads → calls /api/mural/verify → enables “Create Reflexive Journal”.
 *   4) “Create Reflexive Journal” → POST /api/mural/setup with { uid, projectName }.
 *
 * Requirements (DOM):
 *   - Button:  <button id="mural-connect">
 *   - Button:  <button id="mural-setup">
 *   - Status:  <span   id="mural-status"></span>  (optional; shows a pill)
 *   - Project name exposed in one of:
 *       a) <main data-project-name="…">
 *       b) <h1 id="project-title">…</h1>
 *       c) ?projectName=… in the URL
 *
 * Configuration (host / API):
 *   - The Worker base URL is read from (first match wins):
 *       1) window.ROPS_API_BASE
 *       2) <html data-api-base="https://…">
 *       3) fallback constant DEFAULT_API_BASE (edit below)
 *
 *   - The user id is read from (first match wins):
 *       1) window.USER.id
 *       2) localStorage.getItem("userId")
 *       3) "anon"
 *
 * CORS:
 *   Ensure your Worker allows the Pages origin in ALLOWED_ORIGINS.
 *
 * License: Internal / Home Office Biometrics — ResearchOps
 */

/* eslint-env browser */
"use strict";

/* ────────────────────────────────────────────────────────────────────────── */
/* Config                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

/** @constant {string} DEFAULT_API_BASE - Fallback Worker base (edit to your workers.dev host). */
const DEFAULT_API_BASE = "https://rops-api.digikev-kevin-rapley.workers.dev";

/**
 * Resolve the Worker API base URL.
 * @returns {string} Absolute base URL (no trailing slash).
 */
function resolveApiBase() {
	const fromWindow = typeof window !== "undefined" && window.ROPS_API_BASE;
	const fromHtml = document?.documentElement?.dataset?.apiBase;
	const base = (fromWindow || fromHtml || DEFAULT_API_BASE || "").trim().replace(/\/+$/, "");
	return base || DEFAULT_API_BASE;
}

/** @type {string} */
const API_BASE = resolveApiBase();

/* ────────────────────────────────────────────────────────────────────────── */
/* DOM helpers                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Shorthand query selector.
 * @param {string} selector
 * @param {ParentNode} [root=document]
 * @returns {Element|null}
 */
function $(selector, root = document) {
	return root.querySelector(selector);
}

/**
 * Get the project name from DOM or URL.
 * @returns {string} Project name or an empty string.
 */
function getProjectName() {
	const main = $("main[data-project-name]");
	if (main?.dataset?.projectName) return main.dataset.projectName.trim();

	const title = $("#project-title")?.textContent?.trim();
	if (title) return title;

	const sp = new URLSearchParams(location.search);
	const q = sp.get("projectName");
	return (q && q.trim()) || "";
}

/**
 * Resolve a best-effort user id for associating the Mural session.
 * @returns {string} uid (never empty; defaults to "anon")
 */
function getUid() {
	if (window.USER?.id) return String(window.USER.id);
	const st = localStorage.getItem("userId");
	return (st && st.trim()) || "anon";
}

/**
 * Render a status “pill” into an element.
 * Add CSS for:
 *   .pill { display:inline-block; padding:2px 8px; border-radius:12px; font:inherit; }
 *   .pill--ok    { background:#dff0d8; color:#0b0c0c; border:1px solid #2a5b2b; }
 *   .pill--warn  { background:#fff3cd; color:#0b0c0c; border:1px solid #6b4e00; }
 *   .pill--err   { background:#f8d7da; color:#0b0c0c; border:1px solid #7a1212; }
 *   .pill--neutral { background:#f3f2f1; color:#0b0c0c; border:1px solid #b1b4b6; }
 * @param {HTMLElement|null} host
 * @param {"ok"|"warn"|"err"|"neutral"} kind
 * @param {string} text
 */
function setPill(host, kind, text) {
	if (!host) return;
	host.innerHTML = "";
	const span = document.createElement("span");
	span.className = `pill pill--${kind}`;
	span.textContent = text;
	host.appendChild(span);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* API wrappers (→ Worker)                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Verify Mural connection for a given uid.
 * GET /api/mural/verify?uid=…
 * @param {string} uid
 * @returns {Promise<{ok:boolean, reason?:string, user?:object, workspace?:object}>}
 */
async function verify(uid) {
	const url = new URL(`${API_BASE}/api/mural/verify`);
	url.searchParams.set("uid", uid);
	const res = await fetch(url, { cache: "no-store", credentials: "omit" });
	if (res.status === 401) return { ok: false, reason: "not_authenticated" };
	if (!res.ok) {
		const t = await res.text().catch(() => "");
		return { ok: false, reason: "error", detail: t };
	}
	return res.json();
}

/**
 * Create the Mural folder + “Reflexive Journal” in the user’s private area.
 * POST /api/mural/setup
 * @param {string} uid
 * @param {string} projectName
 * @returns {Promise<{ok:boolean, mural?:{id:string,url?:string}, folder?:object, reason?:string}>}
 */
async function setup(uid, projectName) {
	const res = await fetch(`${API_BASE}/api/mural/setup`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ uid, projectName })
	});
	return res.json();
}

/**
 * Start OAuth by redirecting the browser to the Worker’s /auth endpoint.
 * The Worker should accept an optional `return` URL and bounce back to it
 * after completing /callback.
 * @param {string} uid
 */
function startOAuth(uid) {
	const returnTo = location.href;
	const url = new URL(`${API_BASE}/api/mural/auth`);
	url.searchParams.set("uid", uid);
	url.searchParams.set("return", returnTo);
	location.assign(url.toString()); // full page navigation is required
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Init                                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Initialise Mural integration controls on the Project dashboard.
 * Looks for #mural-connect, #mural-setup, and #mural-status.
 */
function init() {
	const statusEl = /** @type {HTMLElement|null} */ ($("#mural-status"));
	const connectBtn = /** @type {HTMLButtonElement|null} */ ($("#mural-connect"));
	const setupBtn = /** @type {HTMLButtonElement|null} */ ($("#mural-setup"));
	if (!connectBtn || !setupBtn) return;

	const uid = getUid();
	const projectName = getProjectName();

	// Hint if we just returned from OAuth (?mural=connected)
	if (new URLSearchParams(location.search).get("mural") === "connected") {
		setPill(statusEl, "ok", "Connected to Mural");
	} else {
		setPill(statusEl, "neutral", "Checking…");
	}

	// Verify connection on load
	verify(uid).then((res) => {
		if (res.ok) {
			setPill(statusEl, "ok", "Connected to Mural (Home Office)");
			setupBtn.disabled = !projectName;
			connectBtn.textContent = "Re-connect Mural";
		} else if (res.reason === "not_authenticated") {
			setPill(statusEl, "warn", "Not connected");
			setupBtn.disabled = true;
		} else if (res.reason === "not_in_home_office_workspace") {
			setPill(statusEl, "err", "Not in Home Office workspace");
			setupBtn.disabled = true;
		} else {
			setPill(statusEl, "err", "Error checking status");
			setupBtn.disabled = true;
		}
	}).catch(() => {
		setPill(statusEl, "err", "Error checking status");
		setupBtn.disabled = true;
	});

	// Wire “Connect Mural”
	connectBtn.addEventListener("click", () => startOAuth(uid));

	// Wire “Create Reflexive Journal”
	setupBtn.addEventListener("click", async () => {
		setupBtn.disabled = true;
		const prev = setupBtn.textContent;
		setupBtn.textContent = "Creating…";
		setPill(statusEl, "neutral", "Provisioning Reflexive Journal…");

		try {
			const res = await setup(uid, projectName);
			if (res?.ok) {
				setPill(statusEl, "ok", "Folder + Reflexive Journal created");
				if (res?.mural?.url) {
					setupBtn.textContent = "Open “Reflexive Journal”";
					setupBtn.onclick = () => window.open(res.mural.url, "_blank", "noopener");
				} else {
					setupBtn.textContent = prev || "Create “Reflexive Journal”";
				}
			} else if (res?.reason === "not_authenticated") {
				setPill(statusEl, "warn", "Please connect Mural first");
				setupBtn.textContent = prev || "Create “Reflexive Journal”";
			} else if (res?.reason === "not_in_home_office_workspace") {
				setPill(statusEl, "err", "Your Mural account isn’t in Home Office workspace");
				setupBtn.textContent = prev || "Create “Reflexive Journal”";
			} else {
				setPill(statusEl, "err", "Setup failed");
				console.warn("Mural setup error", res);
				setupBtn.textContent = prev || "Create “Reflexive Journal”";
			}
		} catch (err) {
			console.error(err);
			setPill(statusEl, "err", "Setup failed");
			setupBtn.textContent = prev || "Create “Reflexive Journal”";
		} finally {
			// Refresh status
			verify(uid).then((res) => {
				if (res.ok) setPill(statusEl, "ok", "Connected to Mural (Home Office)");
			}).catch(() => {});
			setupBtn.disabled = false;
		}
	});
}

// Auto-init when the dashboard is ready
document.addEventListener("DOMContentLoaded", init);

// Optional: expose minimal API for other scripts/tests
window.MuralIntegration = { init, verify, setup, startOAuth, API_BASE };
