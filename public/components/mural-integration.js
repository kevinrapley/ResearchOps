/**
 * @file /public/components/mural-integration.js
 * @summary Wires Project dashboard → Connect Mural → Verify → Setup “Reflexive Journal”.
 *
 * Expects the page to provide:
 * - Project name in either:
 *   1) an element with id="project-title", or
 *   2) <main data-project-name="..."> attribute.
 * - A user id in either:
 *   1) window.USER?.id (if your auth sets it), or
 *   2) localStorage.getItem("userId"), else "anon".
 */

const $ = (s, r = document) => r.querySelector(s);

function getProjectName() {
	// 1) <main data-project-name="...">
	const main = $("main[data-project-name]");
	if (main?.dataset?.projectName) return main.dataset.projectName.trim();

	// 2) #project-title text
	const t = $("#project-title");
	const txt = t?.textContent?.trim();
	if (txt) return txt;

	// 3) Fallback to URL param ?projectName=
	const sp = new URLSearchParams(location.search);
	const fromQuery = sp.get("projectName");
	if (fromQuery) return fromQuery.trim();

	return "";
}

function getUid() {
	// Prefer your app’s auth surface if present
	if (window.USER?.id) return String(window.USER.id);
	// Fallback to localStorage
	const ls = localStorage.getItem("userId");
	return (ls && ls.trim()) || "anon";
}

function setPill(el, kind, text) {
	el.innerHTML = "";
	const span = document.createElement("span");
	span.className = `pill pill--${kind}`;
	span.textContent = text;
	el.appendChild(span);
}

async function verify(uid) {
	const res = await fetch(`/api/mural/verify?uid=${encodeURIComponent(uid)}`, { cache: "no-store" });
	if (res.status === 401) return { ok: false, reason: "not_authenticated" };
	if (!res.ok) {
		const t = await res.text().catch(() => "");
		return { ok: false, reason: "error", detail: t };
	}
	return res.json();
}

async function setup(uid, projectName) {
	const res = await fetch(`/api/mural/setup`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ uid, projectName })
	});
	return res.json();
}

function startOAuth(uid) {
	// Redirect user to Mural OAuth; callback returns to /pages/projects/?mural=connected
	const url = `/api/mural/auth?uid=${encodeURIComponent(uid)}`;
	location.assign(url);
}

function init() {
	const statusEl = $("#mural-status");
	const connectBtn = $("#mural-connect");
	const setupBtn = $("#mural-setup");
	if (!statusEl || !connectBtn || !setupBtn) return; // not on this page

	const uid = getUid();
	const projectName = getProjectName();

	// Initial status check
	setPill(statusEl, "neutral", "Checking…");
	verify(uid).then((res) => {
		if (res.ok) {
			setPill(statusEl, "ok", "Connected to Mural (Home Office)");
			setupBtn.disabled = !projectName;
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

	// Wire buttons
	connectBtn.addEventListener("click", () => {
		startOAuth(uid);
	});

	setupBtn.addEventListener("click", async () => {
		setupBtn.disabled = true;
		setPill(statusEl, "neutral", "Provisioning Reflexive Journal…");
		try {
			const res = await setup(uid, projectName);
			if (res?.ok) {
				setPill(statusEl, "ok", "Folder + Reflexive Journal created");
				// You could surface a link: res.mural?.viewLink if/when you store it.
			} else if (res?.reason === "not_authenticated") {
				setPill(statusEl, "warn", "Please connect Mural first");
			} else if (res?.reason === "not_in_home_office_workspace") {
				setPill(statusEl, "err", "Your Mural account isn’t in Home Office workspace");
			} else {
				setPill(statusEl, "err", "Setup failed");
				console.warn("Mural setup error", res);
			}
		} catch (err) {
			setPill(statusEl, "err", "Setup failed");
			console.error(err);
		} finally {
			// Re-verify to refresh state
			verify(uid).then((res) => {
				if (res.ok) setPill(statusEl, "ok", "Connected to Mural (Home Office)");
			});
			setupBtn.disabled = false;
		}
	});
}

document.addEventListener("DOMContentLoaded", init);
