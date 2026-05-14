/**
 * @file src/service/projects.js
 * @module service/projects
 * @summary Project-related handlers with Airtable-first reads, team scoping and CSV fallback.
 */

import { fetchWithTimeout, toMs, safeText } from "../core/utils.js";

function requireEnv(ctx, keys) {
  const miss = keys.filter(k => !ctx?.env?.[k]);
  if (miss.length) throw new Error(`Missing env: ${miss.join(", ")}`);
}

function jsonHeaders(ctx, origin, extra = {}) {
  return {
    ...ctx.corsHeaders(origin),
    "content-type": "application/json; charset=utf-8",
    ...extra
  };
}

function airtableHeaders(ctx) {
  return {
    "Authorization": `Bearer ${ctx.env.AIRTABLE_API_KEY}`,
    "Accept": "application/json"
  };
}

function normaliseKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function compactUnique(values = []) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const text = String(value || "").trim();
    const key = normaliseKey(text);
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function firstPresent(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return "";
}

function tryJson(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || !/^[{[]/.test(text)) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normaliseLines(value) {
  if (Array.isArray(value)) return compactUnique(value);
  return compactUnique(String(value || "").split(/\r?\n/));
}

function labelFromObject(item = {}) {
  return firstPresent(
    item.name,
    item.Name,
    item.label,
    item.Label,
    item.title,
    item.Title,
    item.text,
    item.Text,
    item.value,
    item.Value
  );
}

function looksLikeIdentityFragment(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  return /"?EMAIL"?\s*:/i.test(text) ||
    /"?email"?\s*:/i.test(text) ||
    /^[}\]]+$/.test(text) ||
    /^[{[]/.test(text) ||
    (/^[^,\s]+@[^,\s]+\.[^,\s]+$/i.test(text) && !/\s/.test(text));
}

function normaliseLabelList(value) {
  const parsed = tryJson(value);
  if (parsed) return normaliseLabelList(parsed);

  if (Array.isArray(value)) return compactUnique(value.flatMap(item => normaliseLabelList(item)));

  if (value && typeof value === "object") {
    const label = labelFromObject(value);
    return label && !looksLikeIdentityFragment(label) ? [label] : [];
  }

  return compactUnique(
    String(value || "")
      .split(/\r?\n|[|,]/)
      .map(item => item.trim())
      .filter(item => item && !looksLikeIdentityFragment(item))
  );
}

function normaliseUserGroups(value) {
  return normaliseLabelList(value);
}

function normaliseStakeholders(value) {
  if (Array.isArray(value)) {
    return value.map(item => ({
      name: String(item?.name || item?.Name || "").trim(),
      role: String(item?.role || item?.Role || "").trim(),
      email: String(item?.email || item?.Email || item?.EMAIL || "").trim()
    })).filter(item => item.name || item.role || item.email);
  }

  try {
    return normaliseStakeholders(JSON.parse(value || "[]"));
  } catch {
    return [];
  }
}

function airtableRecordId(value) {
  const text = String(value || "").trim();
  return /^rec[a-zA-Z0-9]{14,}$/.test(text) ? text : "";
}

function textValues(value) {
  if (Array.isArray(value)) return value.flatMap(textValues);
  if (value && typeof value === "object") return normaliseLabelList(value);
  const text = String(value || "").trim();
  return text ? [text] : [];
}

function valuesFromFields(fields = {}, names = []) {
  return names.flatMap(name => textValues(fields[name]));
}

function normaliseTeamIdsFromFields(fields = {}) {
  const values = valuesFromFields(fields, [
    "Team ID",
    "Team IDs",
    "TeamId",
    "TeamIds",
    "team_id",
    "team_ids",
    "Team",
    "Teams",
    "Project Team",
    "Project Teams",
    "Owning Team",
    "Owning Teams"
  ]);

  return compactUnique(values.filter(value => {
    const key = normaliseKey(value);
    return key.startsWith("team-") || airtableRecordId(value);
  }));
}

function normaliseTeamNamesFromFields(fields = {}) {
  const names = valuesFromFields(fields, [
    "Team Name",
    "Team Names",
    "Team name",
    "Team names",
    "teamName",
    "teamNames",
    "team_name",
    "team_names",
    "Org",
    "org",
    "Organisation",
    "Organization",
    "Project Team Name",
    "Project Team Names",
    "Owning Team Name",
    "Owning Team Names"
  ]);

  const linkedLabels = valuesFromFields(fields, [
    "Team",
    "Teams",
    "Project Team",
    "Project Teams",
    "Owning Team",
    "Owning Teams"
  ]).filter(value => !airtableRecordId(value) && !normaliseKey(value).startsWith("team-"));

  return compactUnique([...names, ...linkedLabels]);
}

function researchOpsCoreTeamMatches(team = {}) {
  const id = normaliseKey(team.id || team.teamId || "");
  const name = normaliseKey(team.name || team.teamName || team.label || "");
  return id === "team-researchops-core" || name === "researchops-core" || name === "researchops-core-team";
}

function isResearchOpsCoreMember(authContext = {}) {
  if (authContext?.isResearchOpsCoreTeamAdmin) return true;
  const memberships = [
    ...(authContext.teamMemberships || []),
    ...(authContext.memberTeams || []),
    ...(authContext.teams || []),
    authContext.activeTeam
  ].filter(Boolean);
  return memberships.some(researchOpsCoreTeamMatches);
}

function visibleTeamKeys(authContext = {}) {
  const keys = new Set();
  for (const team of [
    ...(authContext.teamMemberships || []),
    ...(authContext.memberTeams || []),
    ...(authContext.teams || []),
    authContext.activeTeam
  ].filter(Boolean)) {
    for (const value of [team.id, team.teamId, team.name, team.teamName, team.label]) {
      const key = normaliseKey(value);
      if (key) keys.add(key);
    }
  }
  return keys;
}

function projectTeamKeys(project = {}) {
  const keys = new Set();
  for (const value of [
    ...(project.team_ids || []),
    ...(project.teamIds || []),
    ...(project.teamNames || []),
    project.teamName,
    project.team_name,
    project.team,
    project.org
  ].filter(Boolean)) {
    const key = normaliseKey(value);
    if (key) keys.add(key);
  }
  return keys;
}

function userCanSeeProject(project = {}, authContext = {}) {
  if (isResearchOpsCoreMember(authContext)) return true;
  const projectKeys = projectTeamKeys(project);
  if (!projectKeys.size) return false;
  const userKeys = visibleTeamKeys(authContext);
  for (const key of projectKeys) {
    if (userKeys.has(key)) return true;
  }
  return false;
}

function canStartProject(authContext = {}) {
  if (isResearchOpsCoreMember(authContext)) return true;
  const permissions = new Set((authContext.permissions || []).map(permission => permission.code));
  if (permissions.has("governed.create")) return true;
  return (authContext.roles || []).some(role => ["researcher", "user_researcher", "research_lead"].includes(role.key || role.roleKey));
}

function activeTeamForProject(authContext = {}) {
  if (authContext?.activeTeam?.id || authContext?.activeTeam?.name) return authContext.activeTeam;
  return (authContext.teamMemberships || authContext.memberTeams || authContext.teams || [])[0] || null;
}

function mapProject(r) {
  const f = r?.fields || {};
  const teamNames = normaliseTeamNamesFromFields(f);
  const teamIds = normaliseTeamIdsFromFields(f);
  const teamName = teamNames[0] || "";
  return {
    id: r.id,
    name: f.Name || "",
    description: f.Description || "",
    "rops:servicePhase": f.Phase || "",
    "rops:projectStatus": f.Status || "",
    objectives: normaliseLines(f.Objectives || ""),
    user_groups: normaliseUserGroups(f.UserGroups || f["User Groups"] || ""),
    stakeholders: normaliseStakeholders(f.Stakeholders || "[]"),
    createdAt: r.createdTime || f.CreatedAt || "",
    team_ids: teamIds,
    teamIds,
    teamNames,
    teamName,
    team_name: teamName,
    team: teamName,
    org: teamName || f.Org || f.org || ""
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
  return String(a.id || a.LocalId || "").localeCompare(String(b.id || b.LocalId || ""));
}

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
  const owner = env.GH_OWNER;
  const repo = env.GH_REPO;
  const branch = env.GH_BRANCH || "main";
  const path = env.GH_PATH_PROJECTS || "data/projects.csv";
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
  const teamNames = normaliseTeamNamesFromFields(r);
  const teamIds = normaliseTeamIdsFromFields(r);
  return {
    id: String(id),
    name: r.Name || "",
    description: r.Description || "",
    "rops:servicePhase": r.Phase || "",
    "rops:projectStatus": r.Status || "",
    objectives: normaliseLines(r.Objectives || ""),
    user_groups: normaliseUserGroups(r.UserGroups || ""),
    stakeholders,
    createdAt: r.CreatedAt || r.createdTime || "",
    team_ids: teamIds,
    teamNames,
    teamName: teamNames[0] || r.Org || r.org || "",
    team_name: teamNames[0] || r.Org || r.org || "",
    org: teamNames[0] || r.Org || r.org || ""
  };
}

function projectCreateFields(payload = {}, authContext = {}, ctx = {}) {
  const activeTeam = activeTeamForProject(authContext);
  const fields = {
    Name: String(payload.name || payload.Name || "").trim(),
    Description: String(payload.description || payload.Description || "").trim(),
    Phase: String(payload.phase || payload.Phase || "Discovery").trim(),
    Status: String(payload.status || payload.Status || "Goal setting & problem defining").trim(),
    Objectives: normaliseLines(payload.objectives || payload.Objectives || "").join("\n"),
    UserGroups: normaliseUserGroups(payload.user_groups || payload.UserGroups || payload["User Groups"] || "").join(", "),
    Stakeholders: JSON.stringify(normaliseStakeholders(payload.stakeholders || payload.Stakeholders || []))
  };
  const teamName = String(activeTeam?.name || payload.teamName || payload.team_name || payload.org || "").trim();
  const teamId = String(activeTeam?.id || payload.teamId || payload.team_id || "").trim();
  const teamNameField = ctx?.env?.AIRTABLE_PROJECT_TEAM_NAME_FIELD || "Team Name";
  const teamIdField = ctx?.env?.AIRTABLE_PROJECT_TEAM_ID_FIELD || "Team ID";
  if (teamName && teamNameField) fields[teamNameField] = teamName;
  if (teamId && teamIdField) fields[teamIdField] = teamId;
  return fields;
}

async function createProjectRecord(ctx, fields) {
  const base = ctx.env.AIRTABLE_BASE_ID;
  const table = encodeURIComponent(ctx.env.AIRTABLE_TABLE_PROJECTS);
  const atUrl = `https://api.airtable.com/v0/${base}/${table}`;
  const res = await fetchWithTimeout(atUrl, {
    method: "POST",
    headers: {
      ...airtableHeaders(ctx),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ records: [{ fields }] })
  }, ctx.cfg.TIMEOUT_MS);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = {}; }
  if (!res.ok) {
    const message = data?.error?.message || data?.error?.type || safeText(text);
    throw Object.assign(new Error(message || `airtable_http_${res.status}`), { status: res.status, body: text, data });
  }
  return data.records?.[0] || null;
}

function hasUnknownFieldError(error) {
  const text = `${error?.message || ""} ${error?.body || ""}`;
  return /unknown field|unknown_field|invalid field|field name/i.test(text);
}

export async function listProjectsFromAirtable(ctx, origin, url, authContext = {}) {
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10), 1), 200);
  const view = url.searchParams.get("view") || undefined;
  const attemptAirtable = async () => {
    requireEnv(ctx, ["AIRTABLE_BASE_ID", "AIRTABLE_TABLE_PROJECTS", "AIRTABLE_TABLE_DETAILS", "AIRTABLE_API_KEY"]);
    const base = ctx.env.AIRTABLE_BASE_ID;
    const tProjects = encodeURIComponent(ctx.env.AIRTABLE_TABLE_PROJECTS);
    const tDetails = encodeURIComponent(ctx.env.AIRTABLE_TABLE_DETAILS);
    let atUrl = `https://api.airtable.com/v0/${base}/${tProjects}?pageSize=${limit}`;
    if (view) atUrl += `&view=${encodeURIComponent(view)}`;
    const pRes = await fetch(atUrl, {
      headers: airtableHeaders(ctx),
      signal: AbortSignal.timeout(ctx.cfg.TIMEOUT_MS)
    });
    const pCt = (pRes.headers.get("content-type") || "").toLowerCase();
    const pTxt = await pRes.text();
    if (!pCt.includes("application/json")) throw Object.assign(new Error("airtable_non_json"), { status: pRes.status });
    if (!pRes.ok) throw Object.assign(new Error(`airtable_http_${pRes.status}`), { status: pRes.status });
    let pData;
    try { pData = JSON.parse(pTxt); } catch { pData = { records: [] }; }
    let projects = (Array.isArray(pData.records) ? pData.records : []).map(mapProject);
    const dUrl = `https://api.airtable.com/v0/${base}/${tDetails}?pageSize=100&fields%5B%5D=Project&fields%5B%5D=Lead%20Researcher&fields%5B%5D=Lead%20Researcher%20Email&fields%5B%5D=Notes`;
    const dRes = await fetch(dUrl, {
      headers: airtableHeaders(ctx),
      signal: AbortSignal.timeout(ctx.cfg.TIMEOUT_MS)
    });
    const dCt = (dRes.headers.get("content-type") || "").toLowerCase();
    const dTxt = await dRes.text();
    if (dRes.ok && dCt.includes("application/json")) {
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
    }
    projects = projects.filter(project => userCanSeeProject(project, authContext));
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
      let projects = rows.map(coerceCsvRowToProject).filter(project => userCanSeeProject(project, authContext));
      if (projects.length > limit) projects = projects.slice(0, limit);
      projects.sort(compareProjects);
      payload = { projects, source: "csv" };
    } catch (csvErr) {
      return ctx.json({
        ok: false,
        error: "projects_unavailable",
        detail: "Airtable and CSV fallback both failed",
        upstream: {
          github_status: csvErr?.status ?? 0,
          github_detail: safeText(csvErr?.body || csvErr?.message || String(csvErr)).slice(0, 200)
        }
      }, 500, jsonHeaders(ctx, origin, { "x-rops-source": "none" }));
    }
  }
  return ctx.json({ ok: true, projects: payload.projects, canStartProject: canStartProject(authContext) }, 200, jsonHeaders(ctx, origin, { "x-rops-source": payload.source }));
}

export async function createProjectInAirtable(ctx, request, origin, authContext = {}) {
  if (!canStartProject(authContext)) {
    return ctx.json({ ok: false, error: "forbidden", detail: "You do not have permission to start a research project." }, 403, jsonHeaders(ctx, origin));
  }
  try {
    requireEnv(ctx, ["AIRTABLE_BASE_ID", "AIRTABLE_TABLE_PROJECTS", "AIRTABLE_API_KEY"]);
  } catch (e) {
    return ctx.json({ ok: false, error: String(e?.message || e) }, 500, jsonHeaders(ctx, origin));
  }
  const body = await request.arrayBuffer();
  if (body.byteLength > ctx.cfg.MAX_BODY_BYTES) return ctx.json({ ok: false, error: "Payload too large" }, 413, jsonHeaders(ctx, origin));
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(body));
  } catch {
    return ctx.json({ ok: false, error: "Invalid JSON" }, 400, jsonHeaders(ctx, origin));
  }
  const fields = projectCreateFields(payload, authContext, ctx);
  if (!fields.Name) return ctx.json({ ok: false, error: "Project name is required" }, 400, jsonHeaders(ctx, origin));
  let record;
  try {
    record = await createProjectRecord(ctx, fields);
  } catch (error) {
    if (hasUnknownFieldError(error)) {
      return ctx.json({
        ok: false,
        error: "project_team_fields_missing",
        detail: "Airtable rejected the team-scoping fields. Add project team fields or configure AIRTABLE_PROJECT_TEAM_NAME_FIELD and AIRTABLE_PROJECT_TEAM_ID_FIELD."
      }, 500, jsonHeaders(ctx, origin));
    }
    return ctx.json({ ok: false, error: `Airtable ${error?.status || 500}`, detail: safeText(error?.message || error) }, error?.status || 500, jsonHeaders(ctx, origin));
  }
  return ctx.json({ ok: true, project: mapProject(record) }, 201, jsonHeaders(ctx, origin, { "x-rops-source": "airtable" }));
}

export async function getProjectById(ctx, origin, projectId, authContext = {}) {
  if (!projectId) return ctx.json({ ok: false, error: "Missing project id" }, 400, jsonHeaders(ctx, origin));
  try {
    requireEnv(ctx, ["AIRTABLE_BASE_ID", "AIRTABLE_TABLE_PROJECTS", "AIRTABLE_TABLE_DETAILS", "AIRTABLE_API_KEY"]);
  } catch (e) {
    return ctx.json({ ok: false, error: String(e?.message || e) }, 500, jsonHeaders(ctx, origin));
  }
  const base = ctx.env.AIRTABLE_BASE_ID;
  const tProjects = encodeURIComponent(ctx.env.AIRTABLE_TABLE_PROJECTS);
  const tDetails = encodeURIComponent(ctx.env.AIRTABLE_TABLE_DETAILS);
  const pUrl = `https://api.airtable.com/v0/${base}/${tProjects}/${encodeURIComponent(projectId)}`;
  const pRes = await fetch(pUrl, {
    headers: airtableHeaders(ctx),
    signal: AbortSignal.timeout(ctx.cfg.TIMEOUT_MS)
  });
  const pCt = (pRes.headers.get("content-type") || "").toLowerCase();
  const pText = await pRes.text();
  if (pRes.status === 404) return ctx.json({ ok: false, error: "Project not found" }, 404, jsonHeaders(ctx, origin));
  if (!pCt.includes("application/json") || !pRes.ok) {
    return ctx.json({ ok: false, error: `Airtable ${pRes.status}`, detail: safeText(pText) }, pRes.status, jsonHeaders(ctx, origin));
  }
  let rec;
  try { rec = JSON.parse(pText); } catch { rec = {}; }
  let project = mapProject(rec);
  if (!userCanSeeProject(project, authContext)) return ctx.json({ ok: false, error: "Project not found" }, 404, jsonHeaders(ctx, origin));
  const dUrl = `https://api.airtable.com/v0/${base}/${tDetails}?pageSize=100&filterByFormula=${encodeURIComponent(`FIND("${projectId}", ARRAYJOIN(Project))`)}`;
  const dRes = await fetch(dUrl, {
    headers: airtableHeaders(ctx),
    signal: AbortSignal.timeout(ctx.cfg.TIMEOUT_MS)
  });
  const dCt = (dRes.headers.get("content-type") || "").toLowerCase();
  const dTxt = await dRes.text();
  if (dRes.ok && dCt.includes("application/json")) {
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
  }
  return ctx.json(project, 200, jsonHeaders(ctx, origin, { "x-rops-source": "airtable" }));
}

export async function updateProjectFraming(ctx, request, origin, projectId, authContext = {}) {
  if (!projectId) return ctx.json({ ok: false, error: "Missing project id" }, 400, jsonHeaders(ctx, origin));
  try {
    requireEnv(ctx, ["AIRTABLE_BASE_ID", "AIRTABLE_TABLE_PROJECTS", "AIRTABLE_API_KEY"]);
  } catch (e) {
    return ctx.json({ ok: false, error: String(e?.message || e) }, 500, jsonHeaders(ctx, origin));
  }
  const body = await request.arrayBuffer();
  if (body.byteLength > ctx.cfg.MAX_BODY_BYTES) return ctx.json({ ok: false, error: "Payload too large" }, 413, jsonHeaders(ctx, origin));
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(body));
  } catch {
    return ctx.json({ ok: false, error: "Invalid JSON" }, 400, jsonHeaders(ctx, origin));
  }
  const fields = {};
  if (Object.hasOwn(payload, "objectives")) fields.Objectives = normaliseLines(payload.objectives).join("\n");
  if (Object.hasOwn(payload, "user_groups")) fields.UserGroups = normaliseUserGroups(payload.user_groups).join(", ");
  if (Object.hasOwn(payload, "stakeholders")) fields.Stakeholders = JSON.stringify(normaliseStakeholders(payload.stakeholders));
  if (Object.keys(fields).length === 0) return ctx.json({ ok: false, error: "No updatable project framing fields provided" }, 400, jsonHeaders(ctx, origin));
  const readable = await getProjectById(ctx, origin, projectId, authContext);
  if (readable.status === 404) return readable;
  const base = ctx.env.AIRTABLE_BASE_ID;
  const table = encodeURIComponent(ctx.env.AIRTABLE_TABLE_PROJECTS);
  const atUrl = `https://api.airtable.com/v0/${base}/${table}`;
  const res = await fetchWithTimeout(atUrl, {
    method: "PATCH",
    headers: {
      ...airtableHeaders(ctx),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ records: [{ id: projectId, fields }] })
  }, ctx.cfg.TIMEOUT_MS);
  const text = await res.text();
  if (!res.ok) return ctx.json({ ok: false, error: `Airtable ${res.status}`, detail: safeText(text) }, res.status, jsonHeaders(ctx, origin));
  let data;
  try { data = JSON.parse(text); } catch { data = { records: [] }; }
  const project = mapProject(data.records?.[0] || { id: projectId, fields });
  if (ctx.env.AUDIT === "true") ctx.log.info("project.framing.updated", { projectId, fields: Object.keys(fields) });
  return ctx.json({ ok: true, project }, 200, jsonHeaders(ctx, origin, { "x-rops-source": "airtable" }));
}
