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

/* ───────────────────────────── ARIA helpers ────────────────────────── */

function setAriaDisabled(btn, disabled) {
	btn.setAttribute("aria-disabled", String(disabled));
}
function setAriaLabel(btn, label) {
	if (label) btn.setAttribute("aria-label", label);
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

function updateSetupState() {
	const setupBtn = $("#mural-setup");
	if (!setupBtn) return;
	const name = getProjectName();
	const shouldEnable = !!(lastVerifyOk && name);
	setupBtn.disabled = !shouldEnable;
	setAriaDisabled(setupBtn, !shouldEnable);
	setAriaLabel(setupBtn, "Create Reflexive Journal board in Mural");
	console.log("[mural] updateSetupState → verifyOk:", lastVerifyOk, "| projectName:", name || "(empty)", "| enabled:", shouldEnable);
}

/* ───────────────────────────────────── Init ───────────────────────────────────── */

function attachDirectListeners() {
	const connectBtn = $("#mural-connect");
	const setupBtn = $("#mural-setup");
	const statusEl = $("#mural-status");

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
				alert("Project name not found on this page. Please ensure it’s set in <main data-project-name> or <h1 id=\"project-title\">.");
				return;
			}

			const prev = setupBtn.textContent;
			setupBtn.disabled = true;
			setAriaDisabled(setupBtn, true);
			setAriaLabel(setupBtn, "Provisioning Reflexive Journal…");
			setupBtn.textContent = "Creating…";
			setPill(statusEl, "neutral", "Provisioning Reflexive Journal…");

			try {
				const res = await setup(getUid(), name);
				console.log("[mural] setup response:", res);

				if (res?.ok) {
					setPill(statusEl, "ok", "Folder + Reflexive Journal created");

					const openUrl =
						res?.mural?.url ||
						res?.mural?.viewerUrl ||
						res?.mural?.viewLink ||
						(res?.mural?.links?.view || res?.mural?.links?.viewer) ||
						"";

					// Switch button to OPEN state
					setupBtn.textContent = "Open “Reflexive Journal”";
					setupBtn.disabled = false;
					setAriaDisabled(setupBtn, false);
					setAriaLabel(setupBtn, "Open Reflexive Journal in Mural");

					// Assign click handler
					if (openUrl) {
						setupBtn.onclick = () => window.open(openUrl, "_blank", "noopener,noreferrer");
						// Also automatically open immediately
						window.open(openUrl, "_blank", "noopener,noreferrer");
					} else {
						setupBtn.onclick = () => {
							alert(
								`Your Reflexive Journal board has been created in Mural.\n\n` +
								`Look in your Private room → the “${name}” folder → “Reflexive Journal”.`
							);
						};
					}
				} else if (res?.reason === "not_authenticated") {
					setPill(statusEl, "warn", "Please connect Mural first");
					setupBtn.textContent = prev || "Create “Reflexive Journal”";
					setupBtn.onclick = null;
				} else if (res?.reason === "not_in_home_office_workspace") {
					setPill(statusEl, "err", "Your Mural account isn’t in Home Office");
					setupBtn.textContent = prev || "Create “Reflexive Journal”";
					setupBtn.onclick = null;
				} else {
					setPill(statusEl, "err", res?.error || "Setup failed");
					console.warn("[mural] setup error payload:", res);
					setupBtn.textContent = prev || "Create “Reflexive Journal”";
					setupBtn.onclick = null;
					alert(`Mural setup failed:\n${JSON.stringify(res, null, 2)}`);
				}
			} catch (err) {
				console.error("[mural] setup exception:", err);
				setPill(statusEl, "err", "Setup failed");
				setupBtn.textContent = prev || "Create “Reflexive Journal”";
				setupBtn.onclick = null;
			} finally {
				setupBtn.disabled = false;
				setAriaDisabled(setupBtn, false);
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
	const statusEl = $("#mural-status");
	attachDirectListeners();

	const uid = getUid();
	console.log("[mural] resolved uid:", uid, "projectName:", getProjectName() || "(empty)");

	if (new URLSearchParams(location.search).get("mural") === "connected") {
		setPill(statusEl, "ok", "Connected to Mural");
	} else {
		setPill(statusEl, "neutral", "Checking…");
	}

	verify(uid).then((res) => {
		console.log("[mural] verify result:", res);
		lastVerifyOk = !!res?.ok;
		updateSetupState();

		if (res.ok) {
			setPill(statusEl, "ok", "Connected to Mural (Home Office)");
			const connectBtn = $("#mural-connect");
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

window.MuralIntegration = { init, verify, setup, startOAuth, resetUid, API_BASE };
