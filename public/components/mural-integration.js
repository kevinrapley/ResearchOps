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

// Re-resolve at click time
let projectNameAtClick = getProjectName();
if (!projectNameAtClick) {
	projectNameAtClick = prompt("Enter a project name for the Mural folder:") || "";
	projectNameAtClick = projectNameAtClick.trim();
	if (!projectNameAtClick) {
		setPill(statusEl, "warn", "Project name is required");
		return;
	}
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

/* ───────────────────────────────────── Init ───────────────────────────────────── */

async function handleSetupClick(statusEl, btn, uid) {
	// Always re-resolve project name at click time in case DOM updated
	const projectName = getProjectNameAtClick();
	console.log("[mural] setup click — projectName:", projectName || "(empty)");

	if (btn.disabled) {
		console.warn("[mural] setup clicked while disabled");
		setPill(statusEl, "warn", "Connect and ensure a project name first");
		return;
	}
	if (!projectName) {
		setPill(statusEl, "warn", "Missing project name on page");
		alert(
			"Project name not found on this page. Please ensure the dashboard includes either:\n" +
			"• <main data-project-name=\"…\"> or\n" +
			"• <h1 id=\"project-title\">…</h1> or\n" +
			"• <meta name=\"project:name\" content=\"…\">"
		);
		return;
	}

	const prev = btn.textContent;
	btn.disabled = true;
	btn.textContent = "Creating…";
	setPill(statusEl, "neutral", "Provisioning Reflexive Journal…");

	try {
		const res = await setup(getUid(), projectName);
		console.log("[mural] setup response:", res);
		if (res?.ok) {
			setPill(statusEl, "ok", "Folder + Reflexive Journal created");
			if (res?.mural?.url) {
				btn.textContent = "Open “Reflexive Journal”";
				btn.onclick = () => window.open(res.mural.url, "_blank", "noopener");
			} else {
				btn.textContent = prev || "Create “Reflexive Journal”";
			}
		} else if (res?.reason === "not_authenticated") {
			setPill(statusEl, "warn", "Please connect Mural first");
			btn.textContent = prev || "Create “Reflexive Journal”";
		} else if (res?.reason === "not_in_home_office_workspace") {
			setPill(statusEl, "err", "Your Mural account isn’t in Home Office");
			btn.textContent = prev || "Create “Reflexive Journal”";
		} else {
			setPill(statusEl, "err", res?.error || "Setup failed");
			console.warn("[mural] setup error payload:", res);
			btn.textContent = prev || "Create “Reflexive Journal”";
			alert(`Mural setup failed:\n${JSON.stringify(res, null, 2)}`);
		}
	} catch (err) {
		console.error("[mural] setup exception:", err);
		setPill(statusEl, "err", "Setup failed");
		btn.textContent = prev || "Create “Reflexive Journal”";
	} finally {
		btn.disabled = false;
		// Re-verify to refresh status (don’t block UI)
		verify(getUid()).then((res) => {
			if (res.ok) setPill(statusEl, "ok", "Connected to Mural (Home Office)");
		}).catch(() => {});
	}
}

function attachListeners() {
	const connectBtn = /** @type {HTMLButtonElement|null} */ ($("#mural-connect"));
	const setupBtn = /** @type {HTMLButtonElement|null} */ ($("#mural-setup"));
	const statusEl = /** @type {HTMLElement|null} */ ($("#mural-status"));

	// Direct listeners (present-at-init case)
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
			console.log("[mural] setup button clicked (direct)");
			await handleSetupClick(statusEl, setupBtn, getUid());
		});
	}

	// Delegated fallback (works if buttons appear later)
	if (!document.__muralDelegated) {
		document.__muralDelegated = true;
		document.addEventListener("click", async (e) => {
			const t = e.target;
			if (!(t instanceof Element)) return;

			// If a direct listener already bound, let it handle the event
			if (t.__muralBound) return;

			if (t.id === "mural-connect") {
				console.log("[mural] connect button clicked (delegated)");
				e.preventDefault();
				startOAuth(getUid());
				return;
			}
			if (t.id === "mural-setup") {
				console.log("[mural] setup button clicked (delegated)");
				e.preventDefault();
				await handleSetupClick(document.querySelector("#mural-status"), /** @type {HTMLButtonElement} */ (t), getUid());
				return;
			}
		});
	}
}

function init() {
	console.log("[mural] init()");
	const statusEl = /** @type {HTMLElement|null} */ ($("#mural-status"));

	attachListeners(); // bind now (and again if new nodes appear)

	const uid = getUid();
	console.log("[mural] resolved uid:", uid, "projectName:", getProjectName() || "(empty)");

	// Status hint if just returned from OAuth
	if (new URLSearchParams(location.search).get("mural") === "connected") {
		setPill(statusEl, "ok", "Connected to Mural");
	} else {
		setPill(statusEl, "neutral", "Checking…");
	}

	// Verify, then enable/disable setup accordingly
	verify(uid).then((res) => {
		console.log("[mural] verify result:", res);
		const setupBtn = /** @type {HTMLButtonElement|null} */ ($("#mural-setup"));
		const hasProjectName = !!getProjectName();

		if (res.ok) {
			setPill(statusEl, "ok", "Connected to Mural (Home Office)");
			if (setupBtn) setupBtn.disabled = !hasProjectName;
			const connectBtn = /** @type {HTMLButtonElement|null} */ ($("#mural-connect"));
			if (connectBtn) connectBtn.textContent = "Re-connect Mural";
		} else if (res.reason === "not_authenticated") {
			setPill(statusEl, "warn", "Not connected");
			if (setupBtn) setupBtn.disabled = true;
		} else if (res.reason === "not_in_home_office_workspace") {
			setPill(statusEl, "err", "Not in Home Office workspace");
			if (setupBtn) setupBtn.disabled = true;
		} else {
			setPill(statusEl, "err", "Error checking status");
			if (setupBtn) setupBtn.disabled = true;
		}
	}).catch((e) => {
		console.error("[mural] verify failed:", e);
		setPill(statusEl, "err", "Error checking status");
		const setupBtn = /** @type {HTMLButtonElement|null} */ ($("#mural-setup"));
		if (setupBtn) setupBtn.disabled = true;
	});

	// If your dashboard injects the buttons later, a tiny observer helps:
	if (!window.__muralObserver) {
		window.__muralObserver = new MutationObserver(() => attachListeners());
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
	API_BASE
};
