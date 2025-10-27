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
  const base = (fromWindow || fromHtml || DEFAULT_API_BASE || "")
    .trim()
    .replace(/\/+$/, "");
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

function resetUid() {
  localStorage.removeItem(UID_KEY);
}

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

/* ───────────────────────────── State + Enabling Logic ─────────────────────────── */

let lastVerifyOk = false;

function updateSetupState() {
  const setupBtn = /** @type {HTMLButtonElement|null} */ ($("#mural-setup"));
  if (!setupBtn) return;
  const name = getProjectName();
  const shouldEnable = !!(lastVerifyOk && name);
  setupBtn.disabled = !shouldEnable;
  setupBtn.setAttribute("aria-disabled", String(!shouldEnable));
  console.log(
    "[mural] updateSetupState → verifyOk:",
    lastVerifyOk,
    "| projectName:",
    name || "(empty)",
    "| enabled:",
    shouldEnable
  );
}

/* Observe when <main data-project-name="…"> appears/changes */
function watchProjectName() {
  const main = document.querySelector("main");
  if (!main) return;
  const obs = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "attributes" && m.attributeName === "data-project-name") {
        updateSetupState();
        return;
      }
      if (m.type === "childList") {
        updateSetupState();
      }
    }
  });
  obs.observe(main, {
    attributes: true,
    attributeFilter: ["data-project-name"],
    childList: true,
    subtree: true
  });
}

/* ───────────────────────────── URL extraction helper ─────────────────────────── */

function extractMuralOpenUrl(res) {
  const v = res?.mural?.value || res?.mural || {};
  return v?._canvasLink || v?.viewerUrl || v?.url || "";
}

/* ─────────── Persisted Open URL helpers (localStorage-first) ─────────── */

function projectKey() {
  // Prefer a stable id if exposed on <main>; fall back to name
  const id =
    document.querySelector("main")?.dataset?.projectAirtableId ||
    new URLSearchParams(location.search).get("id") ||
    "";
  const name = getProjectName() || "";
  return id
    ? `mural.open.${id}`
    : name
    ? `mural.open.name.${name.toLowerCase()}`
    : "";
}

function loadOpenUrl() {
  try {
    const k = projectKey();
    return k ? localStorage.getItem(k) || "" : "";
  } catch {
    return "";
  }
}

function saveOpenUrl(url) {
  try {
    const k = projectKey();
    if (k && url) localStorage.setItem(k, url);
  } catch {}
}

function switchButtonToOpen(url) {
  const btn = /** @type {HTMLButtonElement|null} */ ($("#mural-setup"));
  if (!btn) return;
  btn.textContent = "Open “Reflexive Journal”";
  btn.disabled = false;
  btn.setAttribute("aria-disabled", "false");

  // Remove create handler if present
  if (btn.__muralCreateHandler) {
    btn.removeEventListener("click", btn.__muralCreateHandler);
    delete btn.__muralCreateHandler;
  }
  // Remove previous open handler (avoid duplicates)
  if (btn.__muralOpenHandler) {
    btn.removeEventListener("click", btn.__muralOpenHandler);
  }
  btn.__muralOpenHandler = function onOpenClick() {
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };
  btn.addEventListener("click", btn.__muralOpenHandler);
}

/**
 * If we already know an Open URL (localStorage first, then server `/api/mural/find`),
 * flip the button to Open and persist the URL locally.
 */
async function hydrateOpenUrlIfAvailable() {
  // 1) localStorage first (instant)
  const localUrl = loadOpenUrl();
  if (localUrl) {
    console.log("[mural] hydrate: localStorage hit");
    switchButtonToOpen(localUrl);
    return;
  }

  // 2) Ask server/KV only if connected and we have a project name
  if (!lastVerifyOk) return;
  const name = getProjectName();
  if (!name) return;

  try {
    const uid = getUid();
    const u = new URL(`${API_BASE}/api/mural/find`);
    u.searchParams.set("uid", uid);
    u.searchParams.set("projectName", name);
    u.searchParams.set("title", "Reflexive Journal");

    const res = await fetch(u, { cache: "no-store" });
    const js = await res.json().catch(() => ({}));
    if (res.ok && js?.ok && js?.url) {
      console.log("[mural] hydrate: KV hit");
      saveOpenUrl(js.url);
      switchButtonToOpen(js.url);
    } else {
      console.log("[mural] hydrate: no existing URL found");
    }
  } catch (e) {
    console.warn("[mural] hydrate failed:", e);
  }
}

/* ───────────────────────────────────── Init ───────────────────────────────────── */

function attachDirectListeners() {
  const connectBtn = /** @type {HTMLButtonElement|null} */ ($("#mural-connect"));
  const setupBtn = /** @type {HTMLButtonElement|null} */ ($("#mural-setup"));
  const statusEl = /** @type {HTMLElement|null} */ ($("#mural-status"));

  if (connectBtn && !connectBtn.__muralBound) {
    connectBtn.__muralBound = true;
    connectBtn.addEventListener("click", () => {
      console.log("[mural] connect button clicked");
      startOAuth(getUid());
    });
  }

  if (setupBtn && !setupBtn.__muralBound) {
    setupBtn.__muralBound = true;

    // Keep a reference so we can remove this listener after creation.
    setupBtn.__muralCreateHandler = async function onCreateClick() {
      console.log("[mural] setup button clicked");
      const name = getProjectName();
      if (!name) {
        setPill(statusEl, "warn", "Missing project name on page");
        alert(
          "Project name not found on this page. Please ensure the dashboard includes either:\n" +
            "• <main data-project-name=\"…\"> or\n" +
            "• <h1 id=\"project-title\">…</h1> or\n" +
            "• <meta name=\"project:name\" content=\"…\">"
        );
        return;
      }

      const prev = setupBtn.textContent;
      setupBtn.disabled = true;
      setupBtn.setAttribute("aria-disabled", "true");
      setupBtn.textContent = "Creating…";
      setPill(statusEl, "neutral", "Provisioning Reflexive Journal…");

      try {
        const res = await setup(getUid(), name);
        console.log("[mural] setup response:", res);

        if (res?.ok) {
          setPill(statusEl, "ok", "Folder + Reflexive Journal created");

          const openUrl = extractMuralOpenUrl(res);

          // Persist URL for this project (so next load is instant)
          if (openUrl) saveOpenUrl(openUrl);

          // Switch button to OPEN state
          switchButtonToOpen(openUrl);

          // Auto-open once on creation
          if (openUrl) window.open(openUrl, "_blank", "noopener,noreferrer");
          else {
            alert(
              `Your Reflexive Journal board has been created in Mural.\n\n` +
                `Look in your Private room → the “${name}” folder → “Reflexive Journal”.`
            );
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
        // If still in "create" mode, re-enable; if switched to "open" mode we already re-enabled above.
        setupBtn.disabled = false;
        setupBtn.setAttribute("aria-disabled", "false");

        // Refresh status; enable state will be recomputed after verify returns
        verify(getUid())
          .then((res) => {
            lastVerifyOk = !!res?.ok;
            updateSetupState();
            if (res.ok) setPill(statusEl, "ok", "Connected to Mural (Home Office)");
          })
          .catch(() => {});
      }
    };

    setupBtn.addEventListener("click", setupBtn.__muralCreateHandler);
  }
}

function init() {
  console.log("[mural] init()");
  const statusEl = /** @type {HTMLElement|null} */ ($("#mural-status"));

  // Bind direct listeners to avoid duplicate delegated clicks
  attachDirectListeners();

  const uid = getUid();
  console.log("[mural] resolved uid:", uid, "projectName:", getProjectName() || "(empty)");

  // Status hint if just returned from OAuth
  if (new URLSearchParams(location.search).get("mural") === "connected") {
    setPill(statusEl, "ok", "Connected to Mural");
  } else {
    setPill(statusEl, "neutral", "Checking…");
  }

  // Verify, then compute setup enablement and hydrate URL if available
  verify(uid)
    .then((res) => {
      console.log("[mural] verify result:", res);
      lastVerifyOk = !!res?.ok;
      updateSetupState();

      if (res.ok) {
        setPill(statusEl, "ok", "Connected to Mural (Home Office)");
        const connectBtn = /** @type {HTMLButtonElement|null} */ ($("#mural-connect"));
        if (connectBtn) connectBtn.textContent = "Re-connect Mural";

        // Now that we know we're connected, try to hydrate the Open URL
        hydrateOpenUrlIfAvailable();
      } else if (res.reason === "not_authenticated") {
        setPill(statusEl, "warn", "Not connected");
      } else if (res.reason === "not_in_home_office_workspace") {
        setPill(statusEl, "err", "Not in Home Office workspace");
      } else {
        setPill(statusEl, "err", "Error checking status");
      }
    })
    .catch((e) => {
      console.error("[mural] verify failed:", e);
      lastVerifyOk = false;
      updateSetupState();
      setPill(statusEl, "err", "Error checking status");
    });

  // React when <main data-project-name> is populated later by renderProject()
  watchProjectName();

  // If your dashboard injects the buttons later, rebind direct listeners
  if (!window.__muralObserver) {
    window.__muralObserver = new MutationObserver(() => attachDirectListeners());
    window.__muralObserver.observe(document.body, { childList: true, subtree: true });
  }
}

/* Ensure init runs whether script loads early or late */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  try {
    init();
  } catch (e) {
    console.error("[mural] init error:", e);
  }
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
