/**
 * @file /public/components/mural-integration.js
 * @summary Project Dashboard ↔ Mural wiring (verify, resolve, setup, open).
 *
 * UI hooks expected on the page:
 *  - Section:   <section id="mural-integration">
 *  - Status:    <p id="mural-status"><span class="pill"></span></p>
 *  - Buttons:   #mural-connect  #mural-setup
 *
 * State sources on the page:
 *  - Project ID:   URL ?id=…  (Airtable record id)
 *  - Project name: <main data-project-name="…">
 *
 * Public API used elsewhere (e.g. journal-tabs.js):
 *  - window.MuralIntegration.getMuralIdForProject(projectId) → string|null
 */

(() => {
	/* ─────────────── config / helpers ─────────────── */

	// Centralised API origin so every call (verify/resolve/setup/auth) uses the same backend.
	// Priority: <html data-api-origin="..."> → window.API_ORIGIN → workers.dev for pages.dev → same-origin.
	const API_ORIGIN =
		document.documentElement?.dataset?.apiOrigin ||
		window.API_ORIGIN ||
		(location.hostname.endsWith("pages.dev") ?
			"https://rops-api.digikev-kevin-rapley.workers.dev" :
			location.origin);

	const $ = (s, r = document) => r.querySelector(s);
	const byId = (id) => document.getElementById(id);
	const sleep = (ms) => new Promise(res => setTimeout(res, ms));

	async function jsonFetch(url, init) {
		const res = await fetch(url, init);
		const txt = await res.text().catch(() => "");
		let body = {};
		try { body = txt ? JSON.parse(txt) : {}; } catch { /* noop */ }
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

	function uid() {
		return localStorage.getItem("mural.uid") ||
			localStorage.getItem("userId") ||
			"anon";
	}

	function getProjectId() {
		const u = new URL(location.href);
		return u.searchParams.get("id") || "";
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

	/* ─────────────── UI elements ─────────────── */

	const els = {
		section: byId("mural-integration"),
		status: byId("mural-status"),
		btnConnect: byId("mural-connect"),
		btnSetup: byId("mural-setup")
	};

	function disableAll() {
		// Allow Connect even when other controls disabled
		if (els.btnConnect) els.btnConnect.disabled = false;
		if (els.btnSetup) els.btnSetup.disabled = true;
	}

	function setSetupAsCreate(projectId, projectName) {
		if (!els.btnSetup) return;
		els.btnSetup.disabled = false;
		els.btnSetup.textContent = 'Create “Reflexive Journal”';
		els.btnSetup.onclick = async () => {
			try {
				els.btnSetup.disabled = true;
				pill(els.status, "neutral", "Creating board…");

				const body = {
					uid: uid(),
					projectId,
					projectName
				};

				const js = await jsonFetch(`${API_ORIGIN}/api/mural/setup`, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(body)
				});

				// Prefer links returned by create; if missing, fall back to resolve → Airtable or KV mapping.
				let muralId = js?.mural?.id || null;
				let boardUrl = js?.boardUrl || js?.mural?.viewLink || js?.mural?.viewerUrl || js?.mural?._canvasLink || null;

				// Cache workspace for synthetic link
				const wsId = window.__muralActiveWorkspaceId || null;

				// FIX: correct viewer URL shape (no extra workspace segment)
				if (!boardUrl && muralId && wsId) {
					boardUrl = `https://app.mural.co/t/${wsId}/m/${muralId}`;
				}

				if (muralId) {
					RESOLVE_CACHE.set(projectId, { muralId, boardUrl, ts: Date.now() });
					setSetupAsOpen(projectId, boardUrl || null);
					pill(els.status, "good", boardUrl ? "Connected" : "Created (open from Mural)");
					if (boardUrl) window.open(boardUrl, "_blank", "noopener");
					console.log("[mural] created + registered board", { muralId, boardUrl });
				} else {
					// No mural id (should be rare) — still try resolve to pick up KV/AT mapping
					try {
						const r = await jsonFetch(`${API_ORIGIN}/api/mural/resolve?projectId=${encodeURIComponent(projectId)}&uid=${encodeURIComponent(uid())}`);
						if (r?.boardUrl) {
							RESOLVE_CACHE.set(projectId, { muralId: r.muralId || null, boardUrl: r.boardUrl, ts: Date.now() });
							setSetupAsOpen(projectId, r.boardUrl);
							pill(els.status, "good", "Connected");
							window.open(r.boardUrl, "_blank", "noopener");
							return;
						}
					} catch { /* ignore */ }
					pill(els.status, "warn", "Created, but missing board link");
					els.btnSetup.disabled = false;
				}
			} catch (err) {
				console.warn("[mural] setup failed", err);
				const code = Number(err?.status || 0);
				if (code === 401) {
					pill(els.status, "warn", "Please connect Mural first");
				} else if (code === 403) {
					pill(els.status, "bad", "Mural account not in Home Office workspace");
				} else {
					pill(els.status, "bad", "Could not create the board");
				}
				els.btnSetup.disabled = false;
			}
		};
	}

	function setSetupAsOpen(projectId, boardUrl) {
		if (!els.btnSetup) return;
		els.btnSetup.disabled = false;
		els.btnSetup.textContent = 'Open “Reflexive Journal”';
		els.btnSetup.onclick = () => {
			const cached = RESOLVE_CACHE.get(projectId);
			const href = boardUrl || cached?.boardUrl;
			if (href) {
				window.open(href, "_blank", "noopener");
			} else {
				// fallback to resolve + open
				resolveBoard(projectId).then((res) => {
					if (res?.boardUrl) window.open(res.boardUrl, "_blank", "noopener");
				}).catch(() => { /* noop */ });
			}
		};
	}

	function wireConnectButton(projectId) {
		if (!els.btnConnect) return;
		els.btnConnect.onclick = () => {
			// FIX: use ABSOLUTE return URL on Pages, so callback lands on researchops.pages.dev
			const backAbs = absolutePagesUrl(`/pages/project-dashboard/?id=${encodeURIComponent(projectId)}`);
			location.href = `${API_ORIGIN}/api/mural/auth?uid=${encodeURIComponent(uid())}&return=${encodeURIComponent(backAbs)}`;
		};
	}

	/* ─────────────── API wrappers ─────────────── */

	async function verify() {
		const js = await jsonFetch(`${API_ORIGIN}/api/mural/verify?uid=${encodeURIComponent(uid())}`);
		// cache workspace id for client-side synthetic URL if needed
		window.__muralActiveWorkspaceId = js?.activeWorkspaceId || window.__muralActiveWorkspaceId || null;
		return js;
	}

	async function resolveBoard(projectId) {
		const cached = RESOLVE_CACHE.get(projectId);
		if (cached && (Date.now() - cached.ts < 60_000)) return cached;

		const js = await jsonFetch(`${API_ORIGIN}/api/mural/resolve?projectId=${encodeURIComponent(projectId)}&uid=${encodeURIComponent(uid())}`);
		const rec = { muralId: js?.muralId || null, boardUrl: js?.boardUrl || null, ts: Date.now() };
		if (rec.muralId || rec.boardUrl) RESOLVE_CACHE.set(projectId, rec);
		return rec;
	}

	/* ─────────────── main state machine ─────────────── */

	async function updateSetupState() {
		const projectId = getProjectId();
		const projectName = getProjectName();
		if (!els.section || !projectId) return;

		// Ensure buttons are wired
		wireConnectButton(projectId);
		disableAll();

		// Step 1: Verify OAuth + workspace
		try {
			const vr = await verify();
			console.log("[mural] ✓ verify completed:", vr);
			pill(els.status, "good", "Connected");
		} catch (err) {
			const code = Number(err?.status || 0);
			if (code === 401) {
				pill(els.status, "neutral", "Connect to Mural to enable journal sync");
			} else if (code === 403) {
				pill(els.status, "bad", "Mural account not in Home Office workspace");
			} else {
				// Friendly message when Mural is down/unreachable
				pill(els.status, "warn", "Mural is having trouble right now. You can still write journal entries; we’ll sync later.");
			}
			// Only Connect is enabled if not verified
			if (els.btnConnect) els.btnConnect.disabled = false;
			if (els.btnSetup) els.btnSetup.disabled = true;
			return;
		}

		// Step 2: Resolve existing board (requires a project name to avoid UI flicker)
		if (!projectName) {
			console.log("[mural] updateSetupState → projectName not ready; waiting…");
			pill(els.status, "neutral", "Preparing project details…");
			// Wait briefly for the page script to populate data-project-name
			for (let i = 0; i < 10; i++) {
				await sleep(120);
				if (getProjectName()) break;
			}
		}

		// Try resolution; handle known Airtable failure modes gracefully
		try {
			const res = await resolveBoard(projectId);
			if (res?.muralId || res?.boardUrl) {
				console.log("[mural] resolved board", res);
				setSetupAsOpen(projectId, res.boardUrl || null);
				pill(els.status, "good", "Connected");
			} else {
				setSetupAsCreate(projectId, getProjectName() || "Project");
				pill(els.status, "neutral", "No board yet");
			}
		} catch (err) {
			const code = Number(err?.status || 0);
			const tag = (err?.body?.error || err?.body?.detail || "").toString();
			if (code === 404) {
				// Not found → allow create
				setSetupAsCreate(projectId, getProjectName() || "Project");
				pill(els.status, "neutral", "No board yet");
				console.log("[mural] resolve returned 404 not_found");
			} else if (code === 500 && /airtable_list_failed/i.test(tag)) {
				// Airtable hiccup → show friendly text, keep Connect green
				setSetupAsCreate(projectId, getProjectName() || "Project");
				pill(els.status, "warn", "Couldn’t check the board mapping just now (Airtable). You can still create it.");
				console.warn("[mural] resolve failed due to Airtable listing issue");
			} else {
				// Generic trouble
				setSetupAsCreate(projectId, getProjectName() || "Project");
				pill(els.status, "warn", "We couldn’t check Mural just now. You can still create the board.");
				console.warn("[mural] resolve failed", err);
			}
		}
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
			const rec = RESOLVE_CACHE.get(projectId);
			return rec?.muralId || null;
		}
	});

	/* ─────────────── boot ─────────────── */

	document.addEventListener("DOMContentLoaded", () => {
		// Defensive: if the section isn’t on the page, do nothing.
		if (!els.section) return;

		// Early health check to reassure users (non-blocking)
		jsonFetch(`${API_ORIGIN}/api/health`).then(h => {
			console.log("[mural] health check OK:", h);
		}).catch(() => { /* ignore */ });

		observeProjectName();
		updateSetupState();
	});
})();
