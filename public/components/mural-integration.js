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
 * Debug on iPad:
 * - Add ?debug=true to the page URL and include <div id="mural-debug"></div>
 *   to mirror console logs to the page.
 */

/* eslint-env browser */
"use strict";

/* ───────────────────── Debug bridge (mirrors console to page) ───────────────────── */
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
			console[k] = function () { try { write(k, arguments); } catch {} finally { orig.apply(console, arguments); } };
		});
		window.addEventListener("error", e => console.error("window.error:", e.message || e));
		window.addEventListener("unhandledrejection", e => console.error("unhandledrejection:", (e.reason && e.reason.message) || e.reason || ""));
		console.log("[mural] debug bridge active");
	} catch {}
})();

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
	const main = $("main[data-project-name]");
	if (main?.dataset?.projectName) return main.dataset.projectName.trim();
	const title = $("#project-title")?.textContent?.trim();
	if (title) return title;
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
function init() {
	const statusEl = /** @type {HTMLElement|null} */ ($("#mural-status"));
	const connectBtn = /** @type {HTMLButtonElement|null} */ ($("#mural-connect"));
	const setupBtn = /** @type {HTMLButtonElement|null} */ ($("#mural-setup"));

	console.log("[mural] init() start. Buttons present?",
		"connect:", !!connectBtn, "setup:", !!setupBtn);

	const uid = getUid();
	const projectName = getProjectName();
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
			if (setupBtn) setupBtn.disabled = !projectName; // only enable if we have a project name
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
		if (setupBtn) setupBtn.disabled = true;
	});

	/* Direct listeners (work when buttons exist at init time) */
	if (connectBtn) {
		connectBtn.addEventListener("click", () => {
			console.log("[mural] connect button clicked");
			startOAuth(uid);
		});
	}
	if (setupBtn) {
		setupBtn.addEventListener("click", async () => {
			console.log("[mural] setup button clicked (direct)");
			await handleSetupClick(statusEl, setupBtn, uid, projectName);
		});
	}

	/* Event delegation fallback (works if buttons are injected later) */
	document.addEventListener("click", async (e) => {
		const t = e.target;
		if (!(t instanceof Element)) return;

		if (t.id === "mural-connect") {
			console.log("[mural] connect button clicked (delegated)");
			e.preventDefault();
			startOAuth(uid);
			return;
		}

		if (t.id === "mural-setup") {
			console.log("[mural] setup button clicked (delegated)");
			e.preventDefault();
			const btn = /** @type {HTMLButtonElement} */(t);
			await handleSetupClick(statusEl, btn, uid, projectName);
			return;
		}
	});
}

/* Shared click logic for setup */
async function handleSetupClick(statusEl, btn, uid, projectName) {
	if (btn.disabled) {
		console.warn("[mural] setup clicked while disabled");
		setPill(statusEl, "warn", "Connect and ensure a project name first");
		return;
	}
	if (!projectName) {
		setPill(statusEl, "warn", "Missing project name on page");
		alert("Project name not found on this page. Please ensure the dashboard includes either:\n• <main data-project-name=\"…\"> or\n• <h1 id=\"project-title\">…</h1>");
		return;
	}

	const prev = btn.textContent;
	btn.disabled = true;
	btn.textContent = "Creating…";
	setPill(statusEl, "neutral", "Provisioning Reflexive Journal…");

	try {
		const res = await setup(uid, projectName);
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
		// Optionally re-verify
		verify(getUid()).then((res) => {
			if (res.ok) setPill(statusEl, "ok", "Connected to Mural (Home Office)");
		}).catch(() => {});
	}
}

/* Ensure init runs whether script loads early or late */
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", init);
} else {
	try { init(); } catch (e) { console.error("[mural] init error:", e); }
}

/* Public surface (optional) */
window.MuralIntegration = {
	init, verify, setup, startOAuth, resetUid, API_BASE
};
