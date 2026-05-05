/**
 * @file src/service/projects.js
 * @module service/projects
 * @summary Project-related handlers with robust GitHub CSV fallback + deep diagnostics.
 */

import { fetchWithTimeout, toMs, safeText } from "../core/utils.js";

/**
 * @typedef {import('./index.js').ServiceContext} ServiceContext
 */

/* ───────────────────────── CSV fallback helpers ───────────────────────── */

function parseCsv(text) {
  const lines = String(text || "").split(/\r?\n/).filter(l => l.trim().length);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).map(line => {
    const cols = line.split(",").map(c => c.trim());
    const obj = {};
    for (let i = 0; i < headers.length; i++) obj[headers[i]] = cols[i] ?? "";
    return obj;
  });
}

async function fetchProjectsCsvFromGitHub(env) {
  const owner  = env.GH_OWNER;
  const repo   = env.GH_REPO;
  const branch = env.GH_BRANCH || "main";
  const path   = env.GH_PATH_PROJECTS || "data/projects.csv";

  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  const headers = {};
  if (env.GH_TOKEN) headers.Authorization = `Bearer ${env.GH_TOKEN}`;

  const res = await fetch(rawUrl, { headers });
  const body = await res.text().catch(() => "");
  if (!res.ok) {
    throw Object.assign(new Error("github_csv_fetch_failed"), {
      status: res.status,
      body: safeText(body)
    });
  }
  return parseCsv(body);
}

function coerceCsvRowToProject(r = {}) {
  const id = r.id || r.ID || r.Id || r.LocalId || r.localId || "";
  let stakeholders = [];
  try { stakeholders = r.Stakeholders ? JSON.parse(r.Stakeholders) : []; } catch { /* noop */ }

  return {
    id: String(id),
    name: r.Name || "",
    description: r.Description || "",
    "rops:servicePhase": r.Phase || "",
    "rops:projectStatus": r.Status || "",
    objectives: String(r.Objectives || "").split(/\r?\n/).filter(Boolean),
    user_groups: String(r.UserGroups || "").split(",").map(s => s.trim()).filter(Boolean),
    stakeholders,
    createdAt: r.CreatedAt || r.createdTime || ""
  };
}

/* ───────────────────────── Helpers ───────────────────────── */

function requireEnv(ctx, keys) {
  const miss = keys.filter(k => !ctx?.env?.[k]);
  if (miss.length) throw new Error(`Missing env: ${miss.join(", ")}`);
}

function normaliseLines(value) {
  if (Array.isArray(value)) return value.map(item => String(item || "").trim()).filter(Boolean);
  return String(value || "").split(/\r?\n/).map(item => item.trim()).filter(Boolean);
}

function normaliseCommas(value) {
  if (Array.isArray(value)) return value.map(item => String(item || "").trim()).filter(Boolean);
  return String(value || "").split(",").map(item => item.trim()).filter(Boolean);
}

function normaliseStakeholders(value) {
  if (Array.isArray(value)) {
    return value.map(item => ({
      name: String(item?.name || item?.Name || "").trim(),
      role: String(item?.role || item?.Role || "").trim(),
      email: String(item?.email || item?.Email || "").trim()
    })).filter(item => item.name || item.role || item.email);
  }

  try {
    return normaliseStakeholders(JSON.parse(value || "[]"));
  } catch {
    return [];
  }
}

function mapProject(r) {
  const f = r?.fields || {};
  return {
    id: r.id,
    name: f.Name || "",
    description: f.Description || "",
    "rops:servicePhase": f.Phase || "",
    "rops:projectStatus": f.Status || "",
    objectives: normaliseLines(f.Objectives || ""),
    user_groups: normaliseCommas(f.UserGroups || ""),
    stakeholders: normaliseStakeholders(f.Stakeholders || "[]"),
    createdAt: r.createdTime || f.CreatedAt || ""
  };
}

function compareProjects(a = {}, b = {}) {
  const dateOrder = toMs(b.createdAt) - toMs(a.createdAt);
  if (dateOrder !== 0) return dateOrder;

  const an = String(a.name || "").toLocaleLowerCase();
  const bn = String(b.name || "").toLocaleLowerCase();
  if (an && !bn) return -1;
  if (!an && bn) return 1;
  if (an < bn) return -1;
  if (an > bn) return 1;

  const ai = String(a.id || a.LocalId || "");
  const bi = String(b.id || b.LocalId || "");
  return ai.localeCompare(bi);
}

function jsonHeaders(ctx, origin, extra = {}) {
  return {
    ...ctx.corsHeaders(origin),
    "content-type": "application/json; charset=utf-8",
    ...extra
  };
}

/* ───────────────────────── List Projects ───────────────────────── */

export async function listProjectsFromAirtable(ctx, origin, url) {
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10), 1), 200);
  const view = url.searchParams.get("view") || undefined;

  const attemptAirtable = async () => {
    requireEnv(ctx, ["AIRTABLE_BASE_ID", "AIRTABLE_TABLE_PROJECTS", "AIRTABLE_TABLE_DETAILS", "AIRTABLE_API_KEY"]);

    const base = ctx.env.AIRTABLE_BASE_ID;
    const tProjects = encodeURIComponent(ctx.env.AIRTABLE_TABLE_PROJECTS);
    const tDetails  = encodeURIComponent(ctx.env.AIRTABLE_TABLE_DETAILS);

    let atUrl = `https://api.airtable.com/v0/${base}/${tProjects}?pageSize=${limit}`;
    if (view) atUrl += `&view=${encodeURIComponent(view)}`;

    ctx.log.info?.("airtable.projects.request", { url: atUrl });

    const pRes = await fetch(atUrl, {
      headers: { "Authorization": `Bearer ${ctx.env.AIRTABLE_API_KEY}`, "Accept": "application/json" },
      signal: AbortSignal.timeout(ctx.cfg.TIMEOUT_MS)
    });

    const pCt  = (pRes.headers.get("content-type") || "").toLowerCase();
    const pUrl = pRes.url || atUrl;
    const pTxt = await pRes.text();

    if (!pCt.includes("application/json")) {
      ctx.log.warn("airtable.projects.nonjson", {
        status: pRes.status,
        contentType: pCt || "(missing)",
        responseUrl: pUrl,
        preview: safeText(pTxt).slice(0, 180)
      });
      throw Object.assign(new Error("airtable_non_json"), { status: pRes.status });
    }
    if (!pRes.ok) {
      ctx.log.error("airtable.projects.list.fail", { status: pRes.status, text: safeText(pTxt) });
      throw Object.assign(new Error(`airtable_http_${pRes.status}`), { status: pRes.status });
    }

    /** @type {{records: Array<{id:string,createdTime?:string,fields:Record<string,any>}>}} */
    let pData;
    try { pData = JSON.parse(pTxt); } catch { pData = { records: [] }; }

    let projects = (Array.isArray(pData.records) ? pData.records : []).map(mapProject);

    const dUrl = `https://api.airtable.com/v0/${base}/${tDetails}?pageSize=100&fields%5B%5D=Project&fields%5B%5D=Lead%20Researcher&fields%5B%5D=Lead%20Researcher%20Email&fields%5B%5D=Notes`;
    ctx.log.info?.("airtable.details.request", { url: dUrl });

    const dRes = await fetch(dUrl, {
      headers: { "Authorization": `Bearer ${ctx.env.AIRTABLE_API_KEY}`, "Accept": "application/json" },
      signal: AbortSignal.timeout(ctx.cfg.TIMEOUT_MS)
    });

    const dCt = (dRes.headers.get("content-type") || "").toLowerCase();
    const dTxt = await dRes.text();

    if (dRes.ok && dCt.includes("application/json")) {
      /** @type {{records:Array<{id:string,createdTime?:string,fields:Record<string,any>}>}} */
      let dData;
      try { dData = JSON.parse(dTxt); } catch { dData = { records: [] }; }

      const detailsByProject = new Map();
      for (const r of (dData.records || [])) {
        const f = r.fields || {};
        const linked = Array.isArray(f.Project) && f.Project[0];
        if (!linked) continue;
        const existing = detailsByProject.get(linked);
        if (!existing || toMs(r.createdTime) > toMs(existing._createdAt)) {
          detailsByProject.set(linked, {
            lead_researcher: f["Lead Researcher"] || "",
            lead_researcher_email: f["Lead Researcher Email"] || "",
            notes: f.Notes || "",
            _createdAt: r.createdTime || ""
          });
        }
      }

      projects = projects.map(p => {
        const d = detailsByProject.get(p.id);
        return d ? { ...p, lead_researcher: d.lead_researcher, lead_researcher_email: d.lead_researcher_email, notes: d.notes } : p;
      });
    } else {
      ctx.log.warn("airtable.details.join.fail", { status: dRes.status, contentType: dCt, preview: safeText(dTxt).slice(0, 160) });
    }

    projects.sort(compareProjects);
    return { projects, source: "airtable" };
  };

  let payload;
  try {
    payload = await attemptAirtable();
  } catch (airErr) {
    ctx.log.warn("airtable.list.failed_fallback_to_csv", {
      status: airErr?.status ?? 0,
      detail: String(airErr?.message || airErr).slice(0, 200)
    });
    try {
      const rows = await fetchProjectsCsvFromGitHub(ctx.env);
      let projects = rows.map(coerceCsvRowToProject);
      if (projects.length > limit) projects = projects.slice(0, limit);
      projects.sort(compareProjects);
      payload = { projects, source: "csv" };
    } catch (csvErr) {
      return ctx.json(
        {
          ok: false,
          error: "projects_unavailable",
          detail: "Airtable and CSV fallback both failed",
          upstream: {
            github_status: csvErr?.status ?? 0,
            github_detail: safeText(csvErr?.body || csvErr?.message || String(csvErr)).slice(0, 200)
          }
        },
        500,
        jsonHeaders(ctx, origin, { "x-rops-source": "none" })
      );
    }
  }

  return ctx.json(
    { ok: true, projects: payload.projects },
    200,
    jsonHeaders(ctx, origin, { "x-rops-source": payload.source })
  );
}

/* ───────────────────────── Get Project by ID ───────────────────────── */

export async function getProjectById(ctx, origin, projectId) {
  if (!projectId) {
    return ctx.json({ ok: false, error: "Missing project id" }, 400, jsonHeaders(ctx, origin));
  }

  try {
    requireEnv(ctx, ["AIRTABLE_BASE_ID", "AIRTABLE_TABLE_PROJECTS", "AIRTABLE_TABLE_DETAILS", "AIRTABLE_API_KEY"]);
  } catch (e) {
    return ctx.json({ ok: false, error: String(e?.message || e) }, 500, jsonHeaders(ctx, origin));
  }

  const base = ctx.env.AIRTABLE_BASE_ID;
  const tProjects = encodeURIComponent(ctx.env.AIRTABLE_TABLE_PROJECTS);
  const tDetails  = encodeURIComponent(ctx.env.AIRTABLE_TABLE_DETAILS);

  const pUrl = `https://api.airtable.com/v0/${base}/${tProjects}/${encodeURIComponent(projectId)}`;
  ctx.log.info?.("airtable.project.request", { url: pUrl });

  const pRes = await fetch(pUrl, {
    headers: { "Authorization": `Bearer ${ctx.env.AIRTABLE_API_KEY}`, "Accept": "application/json" },
    signal: AbortSignal.timeout(ctx.cfg.TIMEOUT_MS)
  });
  const pCt = (pRes.headers.get("content-type") || "").toLowerCase();
  const pText = await pRes.text();

  if (pRes.status === 404) {
    return ctx.json({ ok: false, error: "Project not found" }, 404, jsonHeaders(ctx, origin));
  }
  if (!pCt.includes("application/json") || !pRes.ok) {
    ctx.log.error("airtable.project.read.fail", {
      status: pRes.status,
      contentType: pCt,
      text: safeText(pText).slice(0, 200)
    });
    return ctx.json({ ok: false, error: `Airtable ${pRes.status}`, detail: safeText(pText) }, pRes.status, jsonHeaders(ctx, origin));
  }

  /** @type {{id:string,createdTime?:string,fields?:Record<string,any>}} */
  let rec;
  try { rec = JSON.parse(pText); } catch { rec = /** @type any */ ({}); }

  let project = mapProject(rec);

  const dUrl = `https://api.airtable.com/v0/${base}/${tDetails}?pageSize=100&filterByFormula=${encodeURIComponent(`FIND("${projectId}", ARRAYJOIN(Project))`)}`;
  ctx.log.info?.("airtable.project.details.request", { url: dUrl });

  const dRes = await fetch(dUrl, {
    headers: { "Authorization": `Bearer ${ctx.env.AIRTABLE_API_KEY}`, "Accept": "application/json" },
    signal: AbortSignal.timeout(ctx.cfg.TIMEOUT_MS)
  });

  const dCt = (dRes.headers.get("content-type") || "").toLowerCase();
  const dTxt = await dRes.text();

  if (dRes.ok && dCt.includes("application/json")) {
    /** @type {{records:Array<{id:string,createdTime?:string,fields:Record<string,any>}>}} */
    let dData;
    try { dData = JSON.parse(dTxt); } catch { dData = { records: [] }; }

    let latest = null;
    for (const r of (dData.records || [])) {
      if (!latest || toMs(r.createdTime) > toMs(latest.createdTime)) latest = r;
    }
    if (latest) {
      const f = latest.fields || {};
      project = {
        ...project,
        lead_researcher: f["Lead Researcher"] || "",
        lead_researcher_email: f["Lead Researcher Email"] || "",
        notes: f.Notes || ""
      };
    }
  } else {
    ctx.log.warn("airtable.project.details.join.fail", {
      status: dRes.status,
      contentType: dCt,
      preview: safeText(dTxt).slice(0, 160)
    });
  }

  return ctx.json(project, 200, jsonHeaders(ctx, origin, { "x-rops-source": "airtable" }));
}

/* ───────────────────────── Update Project Framing ───────────────────────── */

export async function updateProjectFraming(ctx, request, origin, projectId) {
  if (!projectId) {
    return ctx.json({ ok: false, error: "Missing project id" }, 400, jsonHeaders(ctx, origin));
  }

  try {
    requireEnv(ctx, ["AIRTABLE_BASE_ID", "AIRTABLE_TABLE_PROJECTS", "AIRTABLE_API_KEY"]);
  } catch (e) {
    return ctx.json({ ok: false, error: String(e?.message || e) }, 500, jsonHeaders(ctx, origin));
  }

  const body = await request.arrayBuffer();
  if (body.byteLength > ctx.cfg.MAX_BODY_BYTES) {
    return ctx.json({ ok: false, error: "Payload too large" }, 413, jsonHeaders(ctx, origin));
  }

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(body));
  } catch {
    return ctx.json({ ok: false, error: "Invalid JSON" }, 400, jsonHeaders(ctx, origin));
  }

  const fields = {};
  if (Object.hasOwn(payload, "objectives")) fields.Objectives = normaliseLines(payload.objectives).join("\n");
  if (Object.hasOwn(payload, "user_groups")) fields.UserGroups = normaliseCommas(payload.user_groups).join(", ");
  if (Object.hasOwn(payload, "stakeholders")) fields.Stakeholders = JSON.stringify(normaliseStakeholders(payload.stakeholders));

  if (Object.keys(fields).length === 0) {
    return ctx.json({ ok: false, error: "No updatable project framing fields provided" }, 400, jsonHeaders(ctx, origin));
  }

  const base = ctx.env.AIRTABLE_BASE_ID;
  const table = encodeURIComponent(ctx.env.AIRTABLE_TABLE_PROJECTS);
  const atUrl = `https://api.airtable.com/v0/${base}/${table}`;

  const res = await fetchWithTimeout(atUrl, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${ctx.env.AIRTABLE_API_KEY}`,
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({ records: [{ id: projectId, fields }] })
  }, ctx.cfg.TIMEOUT_MS);

  const text = await res.text();
  if (!res.ok) {
    ctx.log.error("airtable.project.update.fail", { status: res.status, text: safeText(text) });
    return ctx.json({ ok: false, error: `Airtable ${res.status}`, detail: safeText(text) }, res.status, jsonHeaders(ctx, origin));
  }

  let data;
  try { data = JSON.parse(text); } catch { data = { records: [] }; }
  const project = mapProject(data.records?.[0] || { id: projectId, fields });

  if (ctx.env.AUDIT === "true") ctx.log.info("project.framing.updated", { projectId, fields: Object.keys(fields) });
  return ctx.json({ ok: true, project }, 200, jsonHeaders(ctx, origin, { "x-rops-source": "airtable" }));
}
