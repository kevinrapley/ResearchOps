/**
 * @file /public/components/mural-integration.js
 * @module muralIntegration
 * @summary
 * Project dashboard → Connect to Mural (OAuth), verify connection, and create a
 * “Reflexive Journal” board inside a project-named folder.
 *
 * ## What this does (client-side flow)
 * 1) “Connect Mural” → full-page redirect to `/api/mural/auth` (Worker) to
 *    initiate OAuth. The current dashboard URL is passed in `return` so the
 *    Worker can redirect back after `/api/mural/callback`.
 * 2) On load, calls `/api/mural/verify?uid=…` to confirm:
 *    - user is authenticated with Mural; and
 *    - user is in the Home Office org/company (server enforces).
 * 3) “Create Reflexive Journal” → POST `/api/mural/setup` with `{ uid, projectName }`
 *    to ensure: Private room → Project folder → Mural board creation.
 *
 * ## DOM requirements
 * - <button id="mural-connect">
 * - <button id="mural-setup">
 * - <span   id="mural-status"></span>   (optional, used for status pills)
 * - Project name available via one of:
 *   a) <main data-project-name="…">, OR
 *   b) <h1 id="project-title">…</h1>, OR
 *   c) ?projectName=… (URL)
 *
 * ## API base detection order (first match wins)
 * 1) `window.ROPS_API_BASE`
 * 2) `<html data-api-base="https://…">`
 * 3) `DEFAULT_API_BASE` (edit this constant if needed)
 *
 * ## Debugging on iPad
 * If the page URL contains `?debug=true` **and** the page includes an element
 * with `id="mural-debug"`, console logs and errors are mirrored into that box.
 *
 * ## CORS
 * Ensure your Worker allows the Pages origin in `ALLOWED_ORIGINS`.
 */

/* eslint-env browser */
"use strict";

/* ─────────────────────────── In-page debug (for iPad) ─────────────────────────── */

/**
 * Bridges console output to a visible on-page element when the URL
 * contains `?debug=true`. Handy on devices without a JS console (iPad).
 *
 * Side effects:
 * - Wraps `console.log`, `console.warn`, `console.error`.
 * - Appends text nodes into `#mural-debug` if present.
 *
 * @private
 */
(function bridgeLogsToPage() {
	try {
		const sp = new URLSearchParams(location.search);
		if (sp.get("debug") !== "true") return;
		const box = document.getElementById("mural-debug");
		if (!box) return;
		const write = (lvl, args) => {
			const div = document.createElement("div");
			div.textContent = `[${lvl}] ${Array.from(args).map(String).join(" ")}`;
			box.appendChild(div);
		};
		["log", "warn", "error"].forEach((k) => {
			const orig = console[k].bind(console);
			console[k] = function() {
				try { write(k, arguments); } catch {} finally { orig.apply(console, arguments); }
			};
		});
		window.addEventListener("error", e => console.error("window.error:", e.message || e));
		window.addEventListener("unhandledrejection", e => console.error("unhandledrejection:", (e.reason && e.reason.message) || e.reason || ""));
		console.log("[mural] debug bridge active");
	} catch {}
})();

/* ───────────────────────────────────── Config ─────────────────────────────────── */

/**
 * Fallback Worker API base if not provided by window or <html>.
 * @constant {string}
 */
const DEFAULT_API_BASE = "https://rops-api.digikev-kevin-rapley.workers.dev";

/**
 * Resolve the Worker API base.
 * Trailing slashes are removed.
 * @returns {string} Absolute base URL (no trailing slash).
 */
function resolveApiBase() {
	const fromWindow = typeof window !== "undefined" && window.ROPS_API_BASE;
	const fromHtml = document?.documentElement?.dataset?.apiBase;
	const base = (fromWindow || fromHtml || DEFAULT_API_BASE || "").trim().replace(/\/+$/, "");
	console.log("[mural] API base:", base || "(unset)");
	return base || DEFAULT_API_BASE;
}

/** @constant {string} */
const API_BASE = resolveApiBase();

/* ─────────────────────────────────── DOM helpers ───────────────────────────────── */

const $ = (s, r = document) => r.querySelector(s);

/**
 * Extract a project name from the page.
 * @returns {string} The project name, or `""` if not found.
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

/* ─────────────────────────────────── UID handling ─────────────────────────────── */

/** Key used to pin a stable uid across auth/verify/setup calls. */
const UID_KEY = "mural.uid";

/**
 * Resolve a best-effort user id for associating Mural tokens in KV and pin it.
 * Sources:
 * - `window.USER.id`
 * - `localStorage.userId`
 * - `"anon"`
 * @returns {string} A non-empty uid string (persisted in localStorage).
 */
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

/** Optional helper to clear the pinned uid (e.g., for re-auth flows). */
function resetUid() {
	localStorage.removeItem(UID_KEY);
}

/* ────────────────────────────────── Status pill ──────────────────────────────── */

/**
 * Render a status pill into a host element.
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

/* ────────────────────────────────── API wrappers ──────────────────────────────── */

/**
 * Verify the user’s Mural connection via the Worker.
 * @param {string} uid
 * @returns {Promise<{ok:boolean, reason?:string, [k:string]:any}>}
 */
async function verify(uid) {
	const url = new URL(`${API_BASE}/api/mural/verify`);
	url.searchParams.set("uid", uid);
	console.log("[mural] verifying uid:", uid);
	const res = await fetch(url, { cache: "no-store", credentials: "omit" });
	if (res.status === 401) return { ok: false, reason: "not_authenticated" };
	if (!res.ok) {
		const t = await res.text().catch(() => "");
		console.error("[mural] verify error payload:", t);
		return { ok: false, reason: "error", detail: t };
	}
	return res.json();
}

/**
 * Request creation of the project folder and “Reflexive Journal” mural.
 * @param {string} uid
 * @param {string} projectName
 * @returns {Promise<{ok:boolean, reason?:string, error?:string, mural?:{id?:string,url?:string}}>}
 */
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

/**
 * Kick off the OAuth flow by navigating to the Worker’s `/api/mural/auth`.
 * Includes a `return` parameter pointing back to the current page so the
 * Worker can redirect here after `/api/mural/callback`.
 * @param {string} uid
 */
function startOAuth(uid) {
	localStorage.setItem(UID_KEY, String(uid || "anon")); // pin before leaving
	const returnTo = location.href;
	const url = new URL(`${API_BASE}/api/mural/auth`);
	url.searchParams.set("uid", uid);
	url.searchParams.set("return", returnTo);
	console.log("[mural] redirecting to OAuth…", { uid });
	location.assign(url.toString());
}

/* ───────────────────────────────────── Init ───────────────────────────────────── */

/**
 * Initialise the Mural integration on the Project dashboard.
 * Wires:
 * - “Connect Mural” button → `startOAuth(uid)`
 * - “Create Reflexive Journal” button → `setup(uid, projectName)`
 * Status is written to `#mural-status` if present.
 */
function init() {
	const statusEl = /** @type {HTMLElement|null} */ ($("#mural-status"));
	const connectBtn = /** @type {HTMLButtonElement|null} */ ($("#mural-connect"));
	const setupBtn = /** @type {HTMLButtonElement|null} */ ($("#mural-setup"));
	if (!connectBtn || !setupBtn) {
		console.warn("[mural] buttons not found (#mural-connect / #mural-setup)");
		return;
	}

	const uid = getUid();
	const projectName = getProjectName(); // ← authoritative; we will not prompt
	console.log("[mural] resolved uid:", uid, "projectName:", projectName || "(empty)");

	// Status hint if just returned from OAuth
	if (new URLSearchParams(location.search).get("mural") === "connected") {
		setPill(statusEl, "ok", "Connected to Mural");
	} else {
		setPill(statusEl, "neutral", "Checking…");
	}

	// Verify connection
	verify(uid).then((res) => {
		console.log("[mural] verify result:", res);
		if (res.ok) {
			setPill(statusEl, "ok", "Connected to Mural (Home Office)");
			// Enable setup only when we actually know the project name from the page.
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
	}).catch((e) => {
		console.error("[mural] verify failed:", e);
		setPill(statusEl, "err", "Error checking status");
		setupBtn.disabled = true;
	});

	// Connect
	connectBtn.addEventListener("click", () => startOAuth(uid));

	// Setup — strictly use the project name from the page; no prompt fallback.
	setupBtn.addEventListener("click", async () => {
		if (!projectName) {
			setPill(statusEl, "warn", "Missing project name on page");
			alert("Project name not found on this page. Please ensure the dashboard includes either:\n• <main data-project-name=\"…\"> or\n• <h1 id=\"project-title\">…</h1>");
			return;
		}

		const prev = setupBtn.textContent;
		setupBtn.disabled = true;
		setupBtn.textContent = "Creating…";
		setPill(statusEl, "neutral", "Provisioning Reflexive Journal…");

		try {
			const res = await setup(uid, projectName);
			console.log("[mural] setup response:", res);
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
				setPill(statusEl, "err", "Your Mural account isn’t in Home Office");
				setupBtn.textContent = prev || "Create “Reflexive Journal”";
			} else {
				setPill(statusEl, "err", res?.error || "Setup failed");
				console.warn("[mural] setup error payload:", res);
				setupBtn.textContent = prev || "Create “Reflexive Journal”";
				alert(`Mural setup failed:\n${JSON.stringify(res, null, 2)}`);
			}
		} catch (err) {
			console.error("[mural] setup exception:", err);
			setPill(statusEl, "err", "Setup failed");
			setupBtn.textContent = prev || "Create “Reflexive Journal”";
		} finally {
			setupBtn.disabled = false;
			// Refresh status
			verify(uid).then((res) => {
				if (res.ok) setPill(statusEl, "ok", "Connected to Mural (Home Office)");
			}).catch(() => {});
		}
	});
}

document.addEventListener("DOMContentLoaded", init);

/**
 * Minimal public surface (useful for tests or other scripts on the page).
 * @typedef {Object} MuralIntegrationAPI
 * @property {() => void} init
 * @property {(uid:string) => Promise<{ok:boolean,reason?:string}>} verify
 * @property {(uid:string, projectName:string) => Promise<any>} setup
 * @property {(uid:string) => void} startOAuth
 * @property {() => void} resetUid
 * @property {string} API_BASE
 */

/** @type {MuralIntegrationAPI} */
window.MuralIntegration = { init, verify, setup, startOAuth, resetUid, API_BASE };
