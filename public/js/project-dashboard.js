/**
 * @file project-dashboard.js
 * @module ProjectDashboard
 */

/* ───────── Set data-project-id from URL ASAP (read by integrations) ───────── */
{
  const urlId = new URLSearchParams(location.search).get("id") || "";
  const m = document.querySelector("main");
  if (m && urlId) m.setAttribute("data-project-id", urlId);
}

/* ───────── Config: single source of truth for API origin ───────── */
const API_ORIGIN =
  document.documentElement?.dataset?.apiOrigin ||
  window.API_ORIGIN ||
  (location.hostname.endsWith("pages.dev") ?
    "https://rops-api.digikev-kevin-rapley.workers.dev" :
    location.origin);

/**
 * @typedef {Object} UIProject
 * @property {string} id
 * @property {string} localId
 * @property {string} name
 * @property {string} description
 * @property {string} org
 * @property {string} phase
 * @property {string} status
 * @property {string[]} objectives
 * @property {string[]} user_groups
 * @property {{name?:string, role?:string, email?:string}[]} stakeholders
 * @property {string} createdAt
 * @property {string} lead_researcher
 * @property {string} lead_researcher_email
 */

/**
 * @typedef {Object} UIStudy
 * @property {string} id
 * @property {string} studyId
 * @property {string} method
 * @property {string} status
 * @property {string} description
 * @property {string} createdAt
 * @property {string} [title]
 */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const setText = (sel, val, fallback = "—") => {
  const el = $(sel);
  if (el) el.textContent = (val ?? "").toString().trim() || fallback;
};
const toMs = (d) => { const n = Date.parse(d); return Number.isFinite(n) ? n : 0; };
const makeStudyId = () => "rec" + Math.floor(Date.now() / 1000).toString(36);

async function loadProjects() {
  const res = await fetch(`${API_ORIGIN}/api/projects?ts=${Date.now()}`, { cache: "no-store" });
  const ctype = (res.headers.get("content-type") || "").toLowerCase();
  if (!ctype.includes("application/json")) {
    const preview = await res.text().catch(() => "");
    throw new Error(`Projects non-JSON (${res.status}) ${preview.slice(0,120)}`);
  }
  let data;
  try { data = await res.json(); } catch { throw new Error(`Projects JSON parse failed (${res.status})`); }
  const list = Array.isArray(data) ? data : (Array.isArray(data?.projects) ? data.projects : null);
  if (!list) throw new Error(`Projects unexpected payload (${res.status})`);
  return list.map(p => ({
    id: p.id || p.LocalId || p.localId || "",
    localId: p.LocalId || p.localId || "",
    name: p.name || p.Name || "",
    description: p.description || p.Description || "",
    org: p.Org || p.org || "Home Office Biometrics",
    phase: p["rops:servicePhase"] || p.Phase || "",
    status: p["rops:projectStatus"] || p.Status || "",
    objectives: Array.isArray(p.objectives) ? p.objectives : String(p.Objectives ?? p.objectives ?? "").split(/\r?\n/).filter(Boolean),
    user_groups: Array.isArray(p.user_groups) ? p.user_groups : String(p.UserGroups ?? p.user_groups ?? "").split(",").map(s => s.trim()).filter(Boolean),
    stakeholders: Array.isArray(p.stakeholders) ? p.stakeholders : (() => { try { return JSON.parse(p.Stakeholders || "[]"); } catch { return []; } })(),
    createdAt: p.createdAt || p.CreatedAt || p.createdTime || "",
    lead_researcher: p.lead_researcher || p["Lead Researcher"] || "",
    lead_researcher_email: p.lead_researcher_email || p["Lead Researcher Email"] || ""
  }));
}

function pickProject(projects) {
  const id = new URLSearchParams(location.search).get("id") || "";
  if (!id) return null;
  return projects.find(p => p.id === id || p.localId === id) || null;
}

async function loadStudies(projectId) {
  const url = `${API_ORIGIN}/api/studies?project=${encodeURIComponent(projectId)}&ts=${Date.now()}`;
  const res = await fetch(url, { cache: "no-store" });
  const js = await res.json().catch(() => ({}));
  if (!res.ok || !js?.ok) return [];
  return (js.studies || []).map(r => ({
    id: r.id || "",
    studyId: r.studyId || "",
    method: r.method || "",
    status: r.status || "",
    description: r.description || "",
    createdAt: r.createdAt || "",
    title: r.title || r.Title || ""
  }));
}

function computeStudyTitle({ description = "", method = "", createdAt = "" } = {}) {
  if (description && description.trim()) return description.trim().slice(0, 80);
  const d = createdAt ? new Date(createdAt) : new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${method || "Study"} — ${yyyy}-${mm}-${dd}`;
}

function normalizeStudy(s = {}) {
  return { ...s, title: s.title || s.Title || computeStudyTitle(s) };
}

function renderProject(project) {
  setText("#eyebrow-org", project.org);
  setText("#project-title", project.name, "Untitled project");
  setText("#project-subtitle", project.description);
  setText("#kv-service-stage", project.phase);
  setText("#kv-project-stage", project.status);
  setText("#kv-client-name", project.org);
  setText("#kv-lead-researcher", project.lead_researcher);
  setText("#kv-lead-email", project.lead_researcher_email);

  const main = document.querySelector("main");
  if (main) {
    // Keep both explicit attributes for integrations:
    // - data-project-id: record id from URL or project.id
    // - data-project-name: project name
    // - data-project-airtable-id: canonical Airtable record id
    if (!main.getAttribute("data-project-id")) {
      main.setAttribute("data-project-id", project.id || "");
    }
    main.dataset.projectName = project.name || "";
    main.dataset.projectAirtableId = project.id || "";
  }

  const metaProject = document.querySelector('meta[name="project:name"]');
  if (metaProject) metaProject.setAttribute("content", project.name || "");

  const bcProject = document.getElementById("breadcrumb-project");
  if (bcProject) {
    bcProject.textContent = project.name || "Project";
    bcProject.href = `/pages/project-dashboard/?id=${encodeURIComponent(project.id)}`;
  }

  const edit = document.getElementById("btn-edit");
  if (edit) edit.href = `./start/?id=${encodeURIComponent(project.id)}`;
}

function renderStudies(project, studies) {
  const list = document.getElementById("studies-list");
  if (!list) return;

  if (!studies.length) {
    list.innerHTML = '<li class="lede">No studies yet.</li>';
    return;
  }

  const escapeHtml = (s = "") =>
    s.replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const truncateToWords = (text, maxLength = 170) => {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).replace(/\s+\S*$/, "");
  };

  list.innerHTML = studies.map(s => {
    const title =
      s.title?.trim() ||
      s.Title?.trim() ||
      s.method?.trim() ||
      "Untitled Study";

    const href = `/pages/study/?pid=${encodeURIComponent(project.id)}&sid=${encodeURIComponent(s.id)}`;
    const status = (s.status || "").trim();
    const meta = status ? ` — <em>${escapeHtml(status)}</em>` : "";

    const full = s.description || "";
    const isTruncated = full.length > 170;
    const truncated = truncateToWords(full, 170);

    let descHtml = "";
    if (truncated) {
      if (isTruncated && truncated.length > 10) {
        const head = escapeHtml(truncated.slice(0, -10));
        const tail = escapeHtml(truncated.slice(-10));
        descHtml = `${head}<span class="fade-tail">${tail}</span>&hellip;`;
      } else {
        descHtml = escapeHtml(truncated);
      }
    }

    return `
<li class="item">
<div>
<a class="govuk-link" href="${href}">${escapeHtml(title)}</a>${meta}
</div>
${descHtml ? `<div class="lede" style="margin-top:4px;">${descHtml}</div>` : ""}
</li>`;
  }).join("");
}

function initStudyModal(project) {
  const dialog = /** @type {HTMLDialogElement|null} */ (document.getElementById("study-dialog"));
  const openBtn = document.getElementById("btn-add-study");
  const closeBtn = document.getElementById("study-close");
  const cancelBtn = document.getElementById("study-cancel");
  const submitBtn = document.getElementById("study-submit");
  const form = dialog?.querySelector("form");
  let lastFocus = null;
  if (!dialog || !openBtn) return;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const open = () => {
    lastFocus = document.activeElement;
    dialog.showModal();
    dialog.setAttribute("aria-hidden", "false");
    document.getElementById("study-method")?.focus();
    document.documentElement.classList.add("modal-open");
  };
  const close = () => {
    dialog.close();
    dialog.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("modal-open");
    if (lastFocus && typeof /** @type {any} */(lastFocus).focus === "function") {
      /** @type {any} */
      (lastFocus).focus();
    }
  };

  dialog.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== "Tab") return;

    const focusables = $$('a[href]:not([disabled]), button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])', dialog)
      .filter(el => el.offsetParent !== null);
    if (!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    // @ts-ignore
    if (e.shiftKey && document.activeElement === first) {
      last.focus();
      e.preventDefault();
    }
    // @ts-ignore
    else if (!e.shiftKey && document.activeElement === last) {
      first.focus();
      e.preventDefault();
    }
  });

  dialog.addEventListener("click", (e) => {
    const rect = dialog.getBoundingClientRect();
    const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (!inside) close();
  });

  openBtn.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  cancelBtn?.addEventListener("click", close);

  (form || submitBtn)?.addEventListener("submit" in (form || {}) ? "submit" : "click", async (e) => {
    e.preventDefault();

    const methodEl = /** @type {HTMLSelectElement|null} */ (document.getElementById("study-method"));
    const notesEl = /** @type {HTMLTextAreaElement|null} */ (document.getElementById("study-notes"));
    const titleEl = /** @type {HTMLInputElement|null} */ (document.getElementById("study-title-input"));
    const method = methodEl?.value?.trim();
    const notes = notesEl?.value?.trim();
    const title = (titleEl?.value || "").trim();
    if (!method || !notes) return;

    const projectAirtableId = project.id || document.querySelector("main")?.dataset?.projectAirtableId || "";
    if (!projectAirtableId) { alert("Missing project id; cannot create study."); return; }

    submitBtn?.setAttribute("disabled", "true");

    try {
      const res = await fetch(`${API_ORIGIN}/api/studies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_airtable_id: projectAirtableId,
          method,
          description: notes,
          status: "Planned",
          study_id: makeStudyId(),
          title
        })
      });
      const js = await res.json().catch(() => ({}));
      if (!res.ok || !js?.ok) throw new Error(js?.error || `HTTP ${res.status}`);

      const studies = await loadStudies(project.id);
      renderStudies(project, studies);

      if (methodEl) methodEl.value = "";
      if (notesEl) notesEl.value = "";
      if (titleEl) titleEl.value = "";
      close();
    } catch (err) {
      console.error(err);
      alert("Could not create study.");
    } finally {
      submitBtn?.removeAttribute("disabled");
    }
  });
}

(async function bootstrap() {
  try {
    const projects = await loadProjects();
    projects.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
    const project = pickProject(projects);
    if (!project) throw new Error("Project not found from id param");

    renderProject(project);

    const studies = await loadStudies(project.id);
    renderStudies(project, studies);

    initStudyModal(project);
  } catch (err) {
    console.error(err);
    alert("Could not load project.");
  }
})();

(function() {
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get('id');
  if (projectId) {
    const journalLink = document.getElementById('journal-link');
    if (journalLink) {
      journalLink.href = `/pages/projects/journals/?id=${encodeURIComponent(projectId)}`;
    }
    const impactLink = document.getElementById('outcomes-link');
    if (impactLink) {
      impactLink.href = `/pages/projects/outcomes/?id=${encodeURIComponent(projectId)}`;
    }
  }
})();
