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
    (location.hostname.endsWith("pages.dev")
      ? "https://rops-api.digikev-kevin-rapley.workers.dev"
      : location.origin);

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
    if (els.btnConnect) els.btnConnect.disabled = false;
    if (els.btnSetup) els.btnSetup.disabled = true;
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
        resolveBoard(projectId).then((res) => {
          if (res?.boardUrl) window.open(res.boardUrl, "_blank", "noopener");
        }).catch(() => { /* noop */ });
      }
    };
  }

  function wireConnectButton(projectId) {
    if (!els.btnConnect) return;
    els.btnConnect.onclick = () => {
      const backAbs = absolutePagesUrl(`/pages/project-dashboard/?id=${encodeURIComponent(projectId)}`);
      location.href = `${API_ORIGIN}/api/mural/auth?uid=${encodeURIComponent(uid())}&return=${encodeURIComponent(backAbs)}`;
    };
  }

  /* ─────────────── API wrappers ─────────────── */

  async function verify() {
    const js = await jsonFetch(`${API_ORIGIN}/api/mural/verify?uid=${encodeURIComponent(uid())}`);
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

  async function awaitViewerUrl({ muralId, projectId, maxMs = 180000, intervalMs = 2500 }) {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      try {
        const js = await fetch(
          `${API_ORIGIN}/api/mural/await?muralId=${encodeURIComponent(muralId)}&projectId=${encodeURIComponent(projectId)}&uid=${encodeURIComponent(uid())}`,
          { method: "GET", cache: "no-store" }
        ).then(async r => {
          const body = await r.text().then(t => { try { return t ? JSON.parse(t) : {}; } catch { return {}; } });
          return { status: r.status, body };
        });

        if (js.status === 200 && js.body?.ok && js.body?.boardUrl) {
          return { ok: true, boardUrl: js.body.boardUrl };
        }
        if (js.status !== 202) {
          // Unexpected error — bubble up but keep friendly UI text outside
          throw new Error(js.body?.error || `HTTP ${js.status}`);
        }
      } catch {
        // brief backoff on error
      }
      await sleep(intervalMs);
    }
    return { ok: false };
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
      if (els.btnConnect) els.btnConnect.disabled = false;
      if (els.btnSetup) els.btnSetup.disabled = true;
      return;
    }

    // Step 2: Resolve existing board
    if (!projectName) {
      pill(els.status, "neutral", "Preparing project details…");
      for (let i = 0; i < 10; i++) {
        await sleep(120);
        if (getProjectName()) break;
      }
    }

    try {
      const res = await resolveBoard(projectId);
      if (res?.muralId || res?.boardUrl) {
        console.log("[mural] resolved board", res);
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

        const body = {
          uid: uid(),
          projectId,
          projectName
        };

        const activeWorkspaceId = window.__muralActiveWorkspaceId;
        if (typeof activeWorkspaceId === "string" && activeWorkspaceId.trim()) {
          body.workspaceId = activeWorkspaceId.trim();
        }

        const js = await jsonFetch(`${API_ORIGIN}/api/mural/setup`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body)
        });

        const folderDenied = Boolean(js?.folderDenied);

        // Fast path: we already have the link
        let muralId = js?.mural?.id || js?.muralId || null;
        let boardUrl = js?.boardUrl || js?.mural?.viewLink || null;
        if (boardUrl) {
          RESOLVE_CACHE.set(projectId, { muralId, boardUrl, ts: Date.now() });
          setSetupAsOpen(projectId, boardUrl);
          setConnectedStatus(folderDenied);
          window.open(boardUrl, "_blank", "noopener");
          console.log("[mural] created + registered board", { muralId, boardUrl });
          els.btnSetup.disabled = false;
          return;
        }

        // Slow path: link pending — poll /api/mural/await
        muralId = muralId || js?.muralId || null;
        if (!muralId) throw new Error("mural_id_unavailable");

        pill(els.status, "neutral", "Preparing the board link…");
        const awaited = await awaitViewerUrl({ muralId, projectId, maxMs: 180000, intervalMs: 2500 });
        if (awaited.ok && awaited.boardUrl) {
          RESOLVE_CACHE.set(projectId, { muralId, boardUrl: awaited.boardUrl, ts: Date.now() });
          setSetupAsOpen(projectId, awaited.boardUrl);
          setConnectedStatus(folderDenied);
          window.open(awaited.boardUrl, "_blank", "noopener");
          els.btnSetup.disabled = false;
          return;
        }

        // If still not ready, leave UI in a safe state
        pill(els.status, "warn", "Board created; link will appear shortly. Try the button again in a moment.");
        els.btnSetup.disabled = false;
      } catch (err) {
        console.warn("[mural] setup failed", err);
        const code = Number(err?.status || 0);
        if (code === 401) {
          pill(els.status, "warn", "Please connect Mural first");
        } else if (code === 403) {
          pill(els.status, "bad", "Mural account not in Home Office workspace");
        } else if (err?.message === "mural_id_unavailable") {
          pill(els.status, "bad", "Created, but couldn’t obtain a board id");
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
      const rec = RESOLVE_CACHE.get(projectId);
      return rec?.muralId || null;
    }
  });

  /* ─────────────── boot ─────────────── */

  document.addEventListener("DOMContentLoaded", () => {
    if (!els.section) return;
    jsonFetch(`${API_ORIGIN}/api/health`).catch(() => {});
    observeProjectName();
    updateSetupState();
  });
})();
