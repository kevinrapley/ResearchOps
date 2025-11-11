/**
 * @file /public/components/mural-integration.js
 * @summary Project Dashboard ↔ Mural wiring (verify, resolve, setup, open) with async “await link” polling.
 *
 * UI hooks expected on the page:
 *  - Section:   <section id="mural-integration">
 *  - Status:    <p id="mural-status"><span class="pill"></span></p>
 *  - Buttons:   #mural-connect  #mural-setup
 *
 * Public API used elsewhere (e.g. journal-tabs.js):
 *  - window.MuralIntegration.getMuralIdForProject(projectId) → string|null
 */

(() => {
	/* ─────────────── config / helpers ─────────────── */

	const API_ORIGIN =
		document.documentElement?.dataset?.apiOrigin ||
		window.API_ORIGIN ||
		(location.hostname.endsWith("pages.dev") ?
			"https://rops-api.digikev-kevin-rapley.workers.dev" :
			location.origin);

	const urlSearch = new URL(location.href).searchParams;
	const DEBUG = urlSearch.get("debug") === "true";

	const $ = (s, r = document) => r.querySelector(s);
	const byId = (id) => document.getElementById(id);
	const sleep = (ms) => new Promise(res => setTimeout(res, ms));

	function dlog(...args) { if (DEBUG) console.log("[mural-ui]", ...args); }

	function addDebug(urlOrPath) {
		// Accept absolute or relative; always append ?debug=true if DEBUG
		const u = new URL(urlOrPath, API_ORIGIN);
		if (DEBUG) u.searchParams.set("debug", "true");
		return u.toString();
	}

	async function jsonFetch(url, init = {}, opts = {}) {
		// Adds a built-in timeout so we don't hang the UI forever.
		const { timeoutMs = 8000 } = opts;
		const ctrl = new AbortController();
		const t = setTimeout(() => ctrl.abort("timeout"), timeoutMs);
		const init2 = { ...init, signal: ctrl.signal };

		dlog("fetch →", url, init2);
		let res, txt;
		try {
			res = await fetch(url, init2);
			txt = await res.text().catch(() => "");
		} finally {
			clearTimeout(t);
		}

		let body = {};
		try { body = txt ? JSON.parse(txt) : {}; } catch { /* noop */ }

		dlog("fetch ←", url, { status: res?.status, ok: res?.ok, bodyPreview: txt?.slice(0, 500) });

		if (!res.ok) {
			const err = new Error((body && (body.error || body.message)) || `HTTP ${res.status}`);
			err.status = res.status;
			err.body = body;
			throw err;
		}
		return body;
	}

	function pill(el, variant, text) {
		// Variants: neutral | good | warn | bad
		if (!el) return;
		const span = el.querySelector(".pill") || el;
		span.classList.remove("pill--neutral", "pill--good", "pill--warn", "pill--bad");
		span.classList.add(`pill--${variant}`);
		span.textContent = text;
	}

	function setConnectedStatus(folderDenied = false) {
		if (folderDenied) {
			pill(els.status, "warn", "Board created but we couldn’t create a folder in your Mural room.");
		} else {
			pill(els.status, "good", "Connected");
		}
	}

	function uid() {
		return localStorage.getItem("mural.uid") ||
			localStorage.getItem("userId") ||
			"anon";
	}

	function getProjectParamId() {
		const u = new URL(location.href);
		return u.searchParams.get("id") || "";
	}

	function getProjectId() {
		const main = document.querySelector("main");
		const airtableId = main?.dataset?.projectAirtableId || "";
		if (airtableId && airtableId.trim()) return airtableId.trim();
		return getProjectParamId();
	}

	function getProjectName() {
		return ($("main")?.dataset?.projectName || "").trim();
	}

	// Build an absolute URL on the current Pages origin
	function absolutePagesUrl(pathAndQuery) {
		return new URL(pathAndQuery, location.origin).toString();
	}

	// Local cache: projectId → { muralId, boardUrl, ts }
	const RESOLVE_CACHE = new Map();

	// Maps alternative project keys (UUID/slug) → canonical Airtable rec id
	const PROJECT_ID_ALIASES = new Map();

	function canonicalProjectId(id) {
		const v = String(id || "");
		return PROJECT_ID_ALIASES.get(v) || v;
	}

	/* ─────────────── UI elements ─────────────── */

	const els = {
		section: byId("mural-integration"),
		status: byId("mural-status"),
		btnConnect: byId("mural-connect"),
		btnSetup: byId("mural-setup")
	};

	function enableButtons() {
		if (els.btnConnect) els.btnConnect.disabled = false;
		if (els.btnSetup) els.btnSetup.disabled = false;
	}

	function disableSetupOnly() {
		if (els.btnSetup) els.btnSetup.disabled = true;
	}

	function setSetupAsOpen(projectId, boardUrl) {
		if (!els.btnSetup) return;
		els.btnSetup.disabled = false;
		els.btnSetup.textContent = 'Open “Reflexive Journal”';
		els.btnSetup.onclick = () => {
			const effectiveId = getProjectId() || projectId;
			const cached = RESOLVE_CACHE.get(effectiveId);
			const href = boardUrl || cached?.boardUrl;
			if (href) {
				window.open(href, "_blank", "noopener");
			} else {
				resolveBoard(effectiveId).then((res) => {
					if (res?.boardUrl) window.open(res.boardUrl, "_blank", "noopener");
				}).catch(() => { /* noop */ });
			}
		};
	}

	function wireConnectButton(projectIdForReturn) {
		if (!els.btnConnect) return;
		els.btnConnect.disabled = false;
		els.btnConnect.onclick = () => {
			const backAbs = absolutePagesUrl(`/pages/project-dashboard/?id=${encodeURIComponent(projectIdForReturn || "")}${DEBUG ? "&debug=true" : ""}`);
			const auth = `${API_ORIGIN}/api/mural/auth?uid=${encodeURIComponent(uid())}&return=${encodeURIComponent(backAbs)}`;
			location.href = addDebug(auth);
		};
	}

	/* ─────────────── API wrappers ─────────────── */

	async function verify() {
		return jsonFetch(addDebug(`${API_ORIGIN}/api/mural/verify?uid=${encodeURIComponent(uid())}`), {}, { timeoutMs: 8000 })
			.then(js => {
				window.__muralActiveWorkspaceId = js?.activeWorkspaceId || window.__muralActiveWorkspaceId || null;
				dlog("verify ok", js);
				return js;
			});
	}

	async function resolveBoard(projectId) {
		const pid = canonicalProjectId(projectId);
		const cached = RESOLVE_CACHE.get(pid);
		if (cached && (Date.now() - cached.ts < 60_000)) return cached;

		const js = await jsonFetch(
			addDebug(`${API_ORIGIN}/api/mural/resolve?projectId=${encodeURIComponent(pid)}&uid=${encodeURIComponent(uid())}`), {}, { timeoutMs: 8000 }
		);
		const rec = { muralId: js?.muralId || null, boardUrl: js?.boardUrl || null, ts: Date.now() };
		if (rec.muralId || rec.boardUrl) {
			RESOLVE_CACHE.set(pid, rec);
			// If the page also has a different id (e.g. URL UUID), alias it to this rec id
			const paramId = getProjectParamId();
			const airtableId = document.querySelector("main")?.dataset?.projectAirtableId || "";
			const ids = [projectId, pid, paramId, airtableId].filter(Boolean);
			ids.forEach(id => { if (id !== pid) PROJECT_ID_ALIASES.set(id, pid); });
		}
		return rec;
	}

	async function awaitViewerUrl({ muralId, projectId, maxMs = 180000, intervalMs = 2500 }) {
		const start = Date.now();
		while (Date.now() - start < maxMs) {
			try {
				const r = await fetch(addDebug(
					`${API_ORIGIN}/api/mural/await?muralId=${encodeURIComponent(muralId)}&projectId=${encodeURIComponent(projectId)}&uid=${encodeURIComponent(uid())}`
				), { method: "GET", cache: "no-store" });

				const body = await r.text().then(t => { try { return t ? JSON.parse(t) : {}; } catch { return {}; } });
				dlog("await ←", r.status, body);

				if (r.status === 200 && body?.ok && body?.boardUrl) {
					return { ok: true, boardUrl: body.boardUrl };
				}
				if (r.status !== 202) {
					throw new Error(body?.error || `HTTP ${r.status}`);
				}
			} catch (e) {
				dlog("await error/backoff", String(e?.message || e));
			}
			await sleep(intervalMs);
		}
		return { ok: false };
	}

	// ── Name → Project Record ID (pre-resolve, so Airtable linked-record writes use ids)
	async function resolveProjectIdByName(name) {
		const url = addDebug(`/api/projects/lookup-by-name?name=${encodeURIComponent(name)}`);
		try {
			const r = await fetch(url, { cache: "no-store" });
			if (!r.ok) return null;
			const js = await r.json().catch(() => ({}));
			return js?.ok ? js.id : null;
		} catch {
			return null;
		}
	}

	/* ─────────────── main state machine ─────────────── */

	async function updateSetupState() {
		const projectParamId = getProjectParamId();
		const projectId = getProjectId();
		const projectName = getProjectName();

		if (!els.section) return;

		// Wire buttons IMMEDIATELY so UI never feels dead.
		wireConnectButton(projectParamId || projectId || "");
		if (els.btnSetup) els.btnSetup.disabled = false;

		if (!projectId) {
			pill(els.status, "neutral", "Preparing project details…");
			return;
		}

		// Step 1: Verify OAuth + workspace (with timeout & full catch)
		try {
			const vr = await verify();
			dlog("✓ verify completed", vr);
			setConnectedStatus(false);
		} catch (err) {
			const code = Number(err?.status || 0);
			if (code === 401) {
				pill(els.status, "neutral", "Connect to Mural to enable journal sync");
			} else if (code === 403) {
				pill(els.status, "bad", "Mural account not in Home Office workspace");
			} else {
				pill(els.status, "warn", "Mural is having trouble right now. You can still write journal entries; we’ll sync later.");
			}
			// Even on error, keep buttons functional:
			if (els.btnConnect) els.btnConnect.disabled = false;
			if (els.btnSetup) {
				// Allow creating anyway — the server will respond with clear errors
				setSetupAsCreate(projectId, getProjectName() || "Project");
				els.btnSetup.disabled = false;
			}
			// Don't return; continue to try resolving an existing board.
		}

		// Step 2: Resolve existing board
		if (!projectName) {
			pill(els.status, "neutral", "Checking…");
			for (let i = 0; i < 10; i++) {
				await sleep(120);
				if (getProjectName()) break;
			}
		}

		try {
			const res = await resolveBoard(projectId);
			if (res?.muralId || res?.boardUrl) {
				dlog("resolved board", res);
				setSetupAsOpen(projectId, res.boardUrl || null);
				setConnectedStatus(false);
			} else {
				setSetupAsCreate(projectId, getProjectName() || "Project");
				pill(els.status, "neutral", "No board yet");
			}
		} catch (err) {
			const code = Number(err?.status || 0);
			const tag = (err?.body?.error || err?.body?.detail || "").toString();
			if (code === 404) {
				setSetupAsCreate(projectId, getProjectName() || "Project");
				pill(els.status, "neutral", "No board yet");
			} else if (code === 500 && /airtable_list_failed/i.test(tag)) {
				setSetupAsCreate(projectId, getProjectName() || "Project");
				pill(els.status, "warn", "Couldn’t check the board mapping just now (Airtable). You can still create it.");
			} else {
				setSetupAsCreate(projectId, getProjectName() || "Project");
				pill(els.status, "warn", "We couldn’t check Mural just now. You can still create the board.");
			}
		}
	}

	function setSetupAsCreate(projectId, projectName) {
		if (!els.btnSetup) return;
		els.btnSetup.disabled = false;
		els.btnSetup.textContent = 'Create “Reflexive Journal”';
		els.btnSetup.onclick = async () => {
			try {
				els.btnSetup.disabled = true;
				pill(els.status, "neutral", "Creating board…");

				const resolvedProjectId = getProjectId() || projectId;
				if (!resolvedProjectId && !projectName) {
					pill(els.status, "warn", "Project not ready yet");
					els.btnSetup.disabled = false;
					return;
				}

				let projectRecordId = resolvedProjectId;
				// If resolvedProjectId does NOT look like an Airtable rec id, try name → id
				if (!/^rec[a-z0-9]{14}$/i.test(String(resolvedProjectId))) {
					projectRecordId = await resolveProjectIdByName(projectName || getProjectName() || "");
					dlog("lookup-by-name", { input: projectName, hit: projectRecordId });
				}

				const body = {
					uid: uid(),
					projectName: projectName || getProjectName() || "Project"
				};
				if (projectRecordId) body.projectId = projectRecordId;

				const activeWorkspaceId = window.__muralActiveWorkspaceId;
				if (typeof activeWorkspaceId === "string" && activeWorkspaceId.trim()) {
					body.workspaceId = activeWorkspaceId.trim();
				}

				const js = await jsonFetch(addDebug(`${API_ORIGIN}/api/mural/setup`), {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(body)
				}, { timeoutMs: 20000 });

				const folderDenied = Boolean(js?.folderDenied);

				// Fast path
				let muralId = js?.mural?.id || js?.muralId || null;
				let boardUrl = js?.boardUrl || js?.mural?.viewLink || null;
				if (boardUrl) {
					const cacheKey = projectRecordId || resolvedProjectId || projectId;
					RESOLVE_CACHE.set(cacheKey, { muralId, boardUrl, ts: Date.now() });
					setSetupAsOpen(cacheKey, boardUrl);
					setConnectedStatus(folderDenied);
					window.open(boardUrl, "_blank", "noopener");
					dlog("created + registered board", { muralId, boardUrl });
					els.btnSetup.disabled = false;
					return;
				}

				// Slow path
				muralId = muralId || js?.muralId || null;
				if (!muralId) throw new Error("mural_id_unavailable");

				pill(els.status, "neutral", "Preparing the board link…");
				const awaited = await awaitViewerUrl({
					muralId,
					projectId: projectRecordId || resolvedProjectId || projectId,
					maxMs: 180000,
					intervalMs: 2500
				});
				if (awaited.ok && awaited.boardUrl) {
					const cacheKey = projectRecordId || resolvedProjectId || projectId;
					RESOLVE_CACHE.set(cacheKey, { muralId, boardUrl: awaited.boardUrl, ts: Date.now() });
					setSetupAsOpen(cacheKey, awaited.boardUrl);
					setConnectedStatus(folderDenied);
					window.open(awaited.boardUrl, "_blank", "noopener");
					els.btnSetup.disabled = false;
					return;
				}

				pill(els.status, "warn", "Board created; link will appear shortly. Try the button again in a moment.");
				els.btnSetup.disabled = false;
			} catch (err) {
				dlog("setup failed", err);
				const code = Number(err?.status || 0);
				const detail = err?.body?.message || err?.body?.upstream?.message || "";
				const step = err?.body?.step || "";
				if (code === 401) {
					pill(els.status, "warn", "Please connect Mural first");
				} else if (code === 403 && step === "create_mural" && /not allowed/i.test(detail)) {
					pill(
						els.status,
						"bad",
						"We can’t create boards in this Mural room with your permissions. Ask a workspace admin to grant access."
					);
				} else if (code === 403) {
					pill(els.status, "bad", "Mural account not in Home Office workspace");
				} else if (err?.message === "mural_id_unavailable") {
					pill(els.status, "bad", "Created, but couldn’t obtain a board id");
				} else if (String(err?.message || "").includes("timeout")) {
					pill(els.status, "warn", "Mural is slow right now. Try again in a moment.");
				} else {
					pill(els.status, "bad", "Could not create the board");
				}
				els.btnSetup.disabled = false;
			}
		};
	}

	/* ─────────────── observe project name to avoid “Open→Create” flicker ─────────────── */

	function observeProjectName() {
		const main = $("main");
		if (!main) return;
		let last = main.dataset.projectName || "";
		const mo = new MutationObserver(() => {
			const cur = main.dataset.projectName || "";
			if (cur && cur !== last) {
				last = cur;
				updateSetupState();
			}
		});
		mo.observe(main, { attributes: true, attributeFilter: ["data-project-name"] });
	}

	/* ─────────────── public API for other modules ─────────────── */

	window.MuralIntegration = Object.assign(window.MuralIntegration || {}, {
		async resolve(projectId) {
			try {
				return await resolveBoard(projectId);
			} catch {
				return null;
			}
		},
		getMuralIdForProject(projectId) {
			const pid = canonicalProjectId(projectId);
			const rec = RESOLVE_CACHE.get(pid);
			return rec?.muralId || null;
		}
	});

	/* ─────────────── boot ─────────────── */

	document.addEventListener("DOMContentLoaded", () => {
		if (!els.section) return;
		// Keep buttons interactive from the start; show a lightweight “Checking…” status.
		enableButtons();
		pill(els.status, "neutral", "Checking…");

		// Health ping (debug-enabled) — non-blocking
		fetch(addDebug(`${API_ORIGIN}/api/health`)).catch(() => {});

		observeProjectName();
		updateSetupState(); // never blocks buttons due to our defensive code
	});
})();
