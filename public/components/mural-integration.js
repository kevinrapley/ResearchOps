/**
 * @file /public/components/mural-integration.js
 * @summary Project Dashboard ↔ Mural wiring (verify, resolve, setup, open) with async "await link" polling.
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
	const API_ORIGIN =
		document.documentElement?.dataset?.apiOrigin ||
		window.API_ORIGIN ||
		(location.hostname.endsWith("pages.dev") ?
			"https://rops-api.digikev-kevin-rapley.workers.dev" :
			location.origin);

	const $ = (s, r = document) => r.querySelector(s);
	const byId = (id) => document.getElementById(id);
	const sleep = (ms) => new Promise(res => setTimeout(res, ms));

	function addDebug(url) {
		try {
			const u = new URL(url, location.origin);
			if (!u.searchParams.has("debug")) u.searchParams.set("debug", "true");
			return u.toString();
		} catch {
			return url;
		}
	}

	function debugLog(...args) {
		try { console.debug("[mural-ui]", ...args); } catch {}
	}

	async function jsonFetch(url, init) {
		const res = await fetch(url, init);
		const txt = await res.text().catch(() => "");
		let body = {};
		try { body = txt ? JSON.parse(txt) : {}; } catch { /* noop */ }
		debugLog("fetch ←", url, { status: res.status, ok: res.ok, bodyPreview: txt ? txt.slice(0, 300) : "" });
		if (!res.ok) {
			const err = new Error((body && (body.error || body.message)) || `HTTP ${res.status}`);
			err.status = res.status;
			err.body = body;
			throw err;
		}
		return body;
	}

	function pill(el, variant, text) {
		if (!el) return;
		const span = el.querySelector(".pill") || el;
		span.classList.remove("pill--neutral", "pill--good", "pill--warn", "pill--bad");
		span.classList.add(`pill--${variant}`);
		span.textContent = text;
	}

	function setConnectedStatus(folderDenied = false) {
		if (folderDenied) {
			pill(els.status, "warn", "Board created but we couldn't create a folder in your Mural room.");
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

	function absolutePagesUrl(pathAndQuery) {
		return new URL(pathAndQuery, location.origin).toString();
	}

	async function resolveProjectIdByName(name) {
		const url = addDebug(`/api/projects/lookup-by-name?name=${encodeURIComponent(name)}`);
		const r = await fetch(url, { cache: "no-store" });
		if (!r.ok) return null;
		const js = await r.json().catch(() => ({}));
		return js?.ok ? js.id : null;
	}

	const RESOLVE_CACHE = new Map();
	const PROJECT_ID_ALIASES = new Map();

	function canonicalProjectId(id) {
		const v = String(id || "");
		return PROJECT_ID_ALIASES.get(v) || v;
	}

	const els = {
		section: byId("mural-integration"),
		status: byId("mural-status"),
		btnConnect: byId("mural-connect"),
		btnSetup: byId("mural-setup")
	};

	function disableAll() {
		if (els.btnConnect) els.btnConnect.disabled = false;
		if (els.btnSetup) els.btnSetup.disabled = true;
	}

	function setSetupAsOpen(projectId, boardUrl) {
		if (!els.btnSetup) return;
		els.btnSetup.disabled = false;
		els.btnSetup.textContent = 'Open "Reflexive Journal"';
		els.btnSetup.onclick = () => {
			const effectiveId = canonicalProjectId(getProjectId() || projectId);
			const cached = RESOLVE_CACHE.get(effectiveId);
			const href = boardUrl || cached?.boardUrl;
			debugLog("open click", { effectiveId, hasHref: !!href });
			if (href) {
				window.open(href, "_blank", "noopener");
			} else {
				resolveBoard(effectiveId).then((res) => {
					if (res?.boardUrl) window.open(res.boardUrl, "_blank", "noopener");
				}).catch(() => { /* noop */ });
			}
		};
		debugLog("setup button → OPEN wired");
	}

	function wireConnectButton(projectId) {
		if (!els.btnConnect) return;
		els.btnConnect.disabled = false;
		els.btnConnect.onclick = () => {
			const effectiveId = canonicalProjectId(projectId);
			const backAbs = absolutePagesUrl(`/pages/project-dashboard/?id=${encodeURIComponent(effectiveId)}`);
			const href = addDebug(`${API_ORIGIN}/api/mural/auth?uid=${encodeURIComponent(uid())}&return=${encodeURIComponent(backAbs)}`);
			debugLog("connect click", { href });
			location.href = href;
		};
		debugLog("connect button wired");
	}

	async function verify() {
		const url = addDebug(`${API_ORIGIN}/api/mural/verify?uid=${encodeURIComponent(uid())}`);
		debugLog("fetch →", url, { signal: {} });
		const js = await jsonFetch(url);
		window.__muralActiveWorkspaceId = js?.activeWorkspaceId || window.__muralActiveWorkspaceId || null;
		debugLog("verify ok", js);
		return js;
	}

	async function resolveBoard(projectId) {
		const pid = canonicalProjectId(projectId);

		const cached = RESOLVE_CACHE.get(pid);
		if (cached && (Date.now() - cached.ts < 60_000)) return cached;

		const url = addDebug(`${API_ORIGIN}/api/mural/resolve?projectId=${encodeURIComponent(pid)}&uid=${encodeURIComponent(uid())}`);
		debugLog("fetch →", url, { signal: {} });
		const js = await jsonFetch(url);

		const rec = { muralId: js?.muralId || null, boardUrl: js?.boardUrl || null, ts: Date.now() };
		if (rec.muralId || rec.boardUrl) {
			RESOLVE_CACHE.set(pid, rec);

			const paramId = getProjectParamId();
			const airtableId = document.querySelector("main")?.dataset?.projectAirtableId || "";
			[projectId, pid, paramId, airtableId].filter(Boolean).forEach(id => {
				const s = String(id);
				if (s !== pid) PROJECT_ID_ALIASES.set(s, pid);
			});
		}
		debugLog("resolved board", rec);
		return rec;
	}

	async function awaitViewerUrl({ muralId, projectId, maxMs = 180000, intervalMs = 2500 }) {
		const start = Date.now();
		while (Date.now() - start < maxMs) {
			try {
				const url = addDebug(`${API_ORIGIN}/api/mural/await?muralId=${encodeURIComponent(muralId)}&projectId=${encodeURIComponent(projectId)}&uid=${encodeURIComponent(uid())}`);
				const r = await fetch(url, { method: "GET", cache: "no-store" });
				const bodyText = await r.text().catch(() => "");
				let body = {};
				try { body = bodyText ? JSON.parse(bodyText) : {}; } catch {}
				debugLog("await ←", url, { status: r.status, ok: r.ok, bodyPreview: bodyText.slice(0, 300) });

				if (r.status === 200 && body?.ok && body?.boardUrl) {
					return { ok: true, boardUrl: body.boardUrl };
				}
				if (r.status !== 202) throw new Error(body?.error || `HTTP ${r.status}`);
			} catch {}
			await sleep(intervalMs);
		}
		return { ok: false };
	}

	async function updateSetupState() {
		const projectIdRaw = getProjectId();
		const projectParamId = getProjectParamId();
		const projectName = getProjectName();
		if (!els.section) return;

		wireConnectButton(projectParamId || projectIdRaw);
		disableAll();

		if (!projectIdRaw) {
			pill(els.status, "neutral", "Preparing project details…");
			return;
		}

		try {
			const vr = await verify();
			console.log("[mural] ✓ verify completed:", vr);
			setConnectedStatus(false);
		} catch (err) {
			const code = Number(err?.status || 0);
			if (code === 401) {
				pill(els.status, "neutral", "Connect to Mural to enable journal sync");
			} else if (code === 403) {
				pill(els.status, "bad", "Mural account not in Home Office workspace");
			} else {
				pill(els.status, "warn", "Mural is having trouble right now. You can still write journal entries; we'll sync later.");
			}
			if (els.btnConnect) els.btnConnect.disabled = false;
			if (els.btnSetup) els.btnSetup.disabled = true;
			return;
		}

		if (!projectName) {
			pill(els.status, "neutral", "Preparing project details…");
			for (let i = 0; i < 10; i++) {
				await sleep(120);
				if (getProjectName()) break;
			}
		}

		try {
			const canonicalId = canonicalProjectId(projectIdRaw);
			const res = await resolveBoard(canonicalId);
			if (res?.muralId || res?.boardUrl) {
				setSetupAsOpen(canonicalId, res.boardUrl || null);
				setConnectedStatus(false);
			} else {
				setSetupAsCreate(canonicalId, getProjectName() || "Project");
				pill(els.status, "neutral", "No board yet");
			}
		} catch (err) {
			const code = Number(err?.status || 0);
			const tag = (err?.body?.error || err?.body?.detail || "").toString();
			if (code === 404) {
				setSetupAsCreate(projectIdRaw, getProjectName() || "Project");
				pill(els.status, "neutral", "No board yet");
			} else if (code === 500 && /airtable_list_failed/i.test(tag)) {
				setSetupAsCreate(projectIdRaw, getProjectName() || "Project");
				pill(els.status, "warn", "Couldn't check the board mapping just now (Airtable). You can still create it.");
			} else {
				setSetupAsCreate(projectIdRaw, getProjectName() || "Project");
				pill(els.status, "warn", "We couldn't check Mural just now. You can still create the board.");
			}
		}
	}

	function setSetupAsCreate(projectId, projectName) {
		if (!els.btnSetup) return;
		els.btnSetup.disabled = false;
		els.btnSetup.textContent = 'Create "Reflexive Journal"';
		els.btnSetup.onclick = async () => {
			try {
				els.btnSetup.disabled = true;
				pill(els.status, "neutral", "Creating board…");

				let resolvedProjectId = canonicalProjectId(getProjectId() || projectId);
				if (!resolvedProjectId) {
					pill(els.status, "warn", "Project not ready yet");
					els.btnSetup.disabled = false;
					return;
				}

				const looksLikeRec = /^rec[a-z0-9]{14}$/i.test(resolvedProjectId);
				if (!looksLikeRec && projectName && projectName.trim()) {
					const recId = await resolveProjectIdByName(projectName.trim()).catch(() => null);
					if (recId) {
						PROJECT_ID_ALIASES.set(resolvedProjectId, recId);
						resolvedProjectId = recId;
					}
				}

				const body = {
					uid: uid(),
					projectName
				};

				if (/^rec[a-z0-9]{14}$/i.test(resolvedProjectId)) {
					body.projectId = resolvedProjectId;
				}

				const activeWorkspaceId = window.__muralActiveWorkspaceId;
				if (typeof activeWorkspaceId === "string" && activeWorkspaceId.trim()) {
					body.workspaceId = activeWorkspaceId.trim();
				}

				const js = await jsonFetch(addDebug(`${API_ORIGIN}/api/mural/setup`), {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(body)
				});

				const folderDenied = Boolean(js?.folderDenied);
				const templateCopied = js?.templateCopied !== false;

				let muralId = js?.mural?.id || js?.muralId || null;
				let boardUrl = js?.boardUrl || js?.mural?.viewLink || null;
				if (boardUrl) {
					RESOLVE_CACHE.set(resolvedProjectId, { muralId, boardUrl, ts: Date.now() });
					setSetupAsOpen(resolvedProjectId, boardUrl);

					if (!templateCopied) {
						pill(els.status, "warn", "Board created but template couldn't be copied. Check Mural permissions.");
					} else if (folderDenied) {
						pill(els.status, "warn", "Board created but we couldn't create a folder in your Mural room");
					} else {
						setConnectedStatus(false);
					}

					window.open(boardUrl, "_blank", "noopener");
					debugLog("created + registered board", { muralId, boardUrl, templateCopied });
					els.btnSetup.disabled = false;
					return;
				}

				muralId = muralId || js?.muralId || null;
				if (!muralId) throw new Error("mural_id_unavailable");

				pill(els.status, "neutral", "Preparing the board link…");
				const awaited = await awaitViewerUrl({ muralId, projectId: resolvedProjectId, maxMs: 180000, intervalMs: 2500 });
				if (awaited.ok && awaited.boardUrl) {
					RESOLVE_CACHE.set(resolvedProjectId, { muralId, boardUrl: awaited.boardUrl, ts: Date.now() });
					setSetupAsOpen(resolvedProjectId, awaited.boardUrl);

					if (!templateCopied) {
						pill(els.status, "warn", "Board created but template couldn't be copied. Check Mural permissions.");
					} else if (folderDenied) {
						pill(els.status, "warn", "Board created but we couldn't create a folder in your Mural room");
					} else {
						setConnectedStatus(false);
					}

					window.open(awaited.boardUrl, "_blank", "noopener");
					els.btnSetup.disabled = false;
					return;
				}

				pill(els.status, "warn", "Board created; link will appear shortly. Try the button again in a moment.");
				els.btnSetup.disabled = false;
			} catch (err) {
				console.warn("[mural] setup failed", err);
				const code = Number(err?.status || 0);
				const detail = err?.body?.message || err?.body?.upstream?.message || "";
				const errorCode = err?.body?.code || "";
				const step = err?.body?.step || "";

				if (errorCode === "TEMPLATE_COPY_FAILED") {
					pill(els.status, "bad", "Cannot copy template. Check if you have access to the template mural.");
				} else if (code === 401) {
					pill(els.status, "warn", "Please connect Mural first");
				} else if (code === 403 && step === "create_mural" && /not allowed/i.test(detail)) {
					pill(
						els.status,
						"bad",
						"We can't create boards in this Mural room with your permissions. Ask a workspace admin to grant access."
					);
				} else if (code === 403) {
					pill(els.status, "bad", "Mural account not in Home Office workspace");
				} else if (err?.message === "mural_id_unavailable") {
					pill(els.status, "bad", "Created, but couldn't obtain a board id");
				} else {
					pill(els.status, "bad", "Could not create the board");
				}
				els.btnSetup.disabled = false;
			}
		};
		debugLog("setup button → CREATE wired");
	}

	function observeProjectMeta() {
		const main = $("main");
		if (!main) return;
		let lastName = main.dataset.projectName || "";
		let lastAid = main.dataset.projectAirtableId || "";
		const mo = new MutationObserver(() => {
			const curName = main.dataset.projectName || "";
			const curAid = main.dataset.projectAirtableId || "";
			if (curName !== lastName || curAid !== lastAid) {
				lastName = curName;
				lastAid = curAid;
				updateSetupState();
			}
		});
		mo.observe(main, { attributes: true, attributeFilter: ["data-project-name", "data-project-airtable-id"] });
	}

	window.MuralIntegration = Object.assign(window.MuralIntegration || {}, {
		async resolve(projectId) {
			try {
				return await resolveBoard(canonicalProjectId(projectId));
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

	document.addEventListener("DOMContentLoaded", () => {
		if (!els.section) return;
		jsonFetch(addDebug(`${API_ORIGIN}/api/health`)).catch(() => {});
		observeProjectMeta();
		updateSetupState();
	});
})();
