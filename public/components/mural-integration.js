/**
 * @file /public/components/mural-integration.js
 * @module muralIntegration
 * @summary Project dashboard → Connect to Mural (OAuth), verify connection, and create a
 *          “Reflexive Journal” board in a project folder.
 *
 * DOM requirements:
 *   - <button id="mural-connect">
 *   - <button id="mural-setup">
 *   - <span   id="mural-status"></span>   (optional)
 *   - Project name available via:
 *       a) <main data-project-name="…">   OR
 *       b) <h1 id="project-title">…</h1>  OR
 *       c) ?projectName=… (URL)
 *
 * Config detection order for API base:
 *   1) window.ROPS_API_BASE
 *   2) <html data-api-base="https://…">
 *   3) DEFAULT_API_BASE (adjust below if needed)
 *
 * Notes:
 * - Setup button is enabled after a successful verify even if a project name isn’t found;
 *   on click we’ll prompt for a name as a fallback so iPad flows still work.
 */

/* eslint-env browser */
"use strict";

/* ─────────────────────────── In-page debug (for iPad) ─────────────────────────── */

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
			console[k] = function() { try { write(k, arguments); } catch {} finally { orig.apply(console, arguments); } };
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

function getUid() {
	if (window.USER?.id) return String(window.USER.id);
	const st = localStorage.getItem("userId");
	return (st && st.trim()) || "anon";
}

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
	const returnTo = location.href; // come back to the exact dashboard view
	const url = new URL(`${API_BASE}/api/mural/auth`);
	url.searchParams.set("uid", uid);
	url.searchParams.set("return", returnTo);
	console.log("[mural] redirecting to OAuth…");
	location.assign(url.toString());
}

/* ───────────────────────────────────── Init ───────────────────────────────────── */

function init() {
	const statusEl = /** @type {HTMLElement|null} */ ($("#mural-status"));
	const connectBtn = /** @type {HTMLButtonElement|null} */ ($("#mural-connect"));
	const setupBtn = /** @type {HTMLButtonElement|null} */ ($("#mural-setup"));
	if (!connectBtn || !setupBtn) {
		console.warn("[mural] buttons not found (#mural-connect / #mural-setup)");
		return;
	}

	const uid = getUid();
	let projectName = getProjectName();
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
			// Don’t hard-gate by projectName here; allow click + prompt if needed.
			setupBtn.disabled = false;
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

	// Setup
	setupBtn.addEventListener("click", async () => {
		// Re-resolve in case the page populated it after load
		if (!projectName) {
			projectName = prompt("Enter a project name for the Mural folder:") || "";
			projectName = projectName.trim();
			if (!projectName) return alert("Project name is required.");
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

// Optional: expose minimal API for other scripts/tests
window.MuralIntegration = { init, verify, setup, startOAuth, API_BASE };
