/**
 * @file src/service/projects.js
 * @module service/projects
 * @summary Team-scoped project handlers.
 */

import { fetchWithTimeout, toMs, safeText } from "../core/utils.js";

function jsonHeaders(ctx, origin, extra = {}) {
  return { ...ctx.corsHeaders(origin), "content-type": "application/json; charset=utf-8", ...extra };
}

function requireEnv(ctx, keys) {
  const missing = keys.filter(key => !ctx?.env?.[key]);
  if (missing.length) throw new Error(`Missing env: ${missing.join(", ")}`);
}

function airtableHeaders(ctx) {
  return { "Authorization": `Bearer ${ctx.env.AIRTABLE_API_KEY}`, "Accept": "application/json" };
}

function key(value) {
  return String(value || "").trim().toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function unique(values = []) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const text = String(value || "").trim();
    const k = key(text);
    if (!text || seen.has(k)) continue;
    seen.add(k);
    out.push(text);
  }
  return out;
}

function tryJson(value) {
  if (typeof value !== "string" || !/^[{[]/.test(value.trim())) return null;
  try { return JSON.parse(value); } catch { return null; }
}

function lines(value) {
  return Array.isArray(value) ? unique(value) : unique(String(value || "").split(/\r?\n/));
}

function looksLikeIdentity(value) {
  const text = String(value || "").trim();
  return /"?EMAIL"?\s*:/i.test(text) ||
    /"?email"?\s*:/i.test(text) ||
    /^[}\]]+$/.test(text) ||
    /^[{[]/.test(text) ||
    (/^[^,\s]+@[^,\s]+\.[^,\s]+$/i.test(text) && !/\s/.test(text));
}

function labelList(value) {
  const parsed = tryJson(value);
  if (parsed) return labelList(parsed);
  if (Array.isArray(value)) return unique(value.flatMap(labelList));
  if (value && typeof value === "object") {
    const label = value.name || value.Name || value.label || value.Label || value.title || value.Title || value.text || value.Text || value.value || value.Value || "";
    return label && !looksLikeIdentity(label) ? [label] : [];
  }
  return unique(String(value || "").split(/\r?\n|[|,]/).map(part => part.trim()).filter(part => part && !looksLikeIdentity(part)));
}

function normaliseUserGroups(value) {
  return labelList(value);
}

function normaliseStakeholders(value) {
  const parsed = tryJson(value);
  const list = parsed || value;
  if (!Array.isArray(list)) return [];
  return list.map(item => ({
    name: String(item?.name || item?.Name || "").trim(),
    role: String(item?.role || item?.Role || "").trim(),
    email: String(item?.email || item?.Email || item?.EMAIL || "").trim()
  })).filter(item => item.name || item.role || item.email);
}

function values(fields = {}, names = []) {
  return names.flatMap(name => {
    const value = fields[name];
    if (Array.isArray(value)) return value.flatMap(item => values({ value: item }, ["value"]));
    if (value && typeof value === "object") return labelList(value);
    return String(value || "").trim() ? [String(value).trim()] : [];
  });
}

function isRecordId(value) {
  return /^rec[a-zA-Z0-9]{14,}$/.test(String(value || "").trim());
}

function teamIds(fields = {}) {
  return unique(values(fields, ["Team ID", "Team IDs", "TeamId", "TeamIds", "team_id", "team_ids", "Team", "Teams", "Project Team", "Project Teams", "Owning Team", "Owning Teams"]).filter(value => key(value).startsWith("team-") || isRecordId(value)));
}

function teamNames(fields = {}) {
  const explicit = values(fields, ["Team Name", "Team Names", "Team name", "Team names", "teamName", "teamNames", "team_name", "team_names", "Org", "org", "Organisation", "Organization", "Project Team Name", "Project Team Names", "Owning Team Name", "Owning Team Names"]);
  const linked = values(fields, ["Team", "Teams", "Project Team", "Project Teams", "Owning Team", "Owning Teams"]).filter(value => !isRecordId(value) && !key(value).startsWith("team-"));
  return unique([...explicit, ...linked]);
}

function teamsFor(authContext = {}) {
  return [...(authContext.teamMemberships || []), ...(authContext.memberTeams || []), ...(authContext.teams || []), authContext.activeTeam].filter(Boolean);
}

function isCoreTeam(team = {}) {
  const id = key(team.id || team.teamId);
  const name = key(team.name || team.teamName || team.label);
  return id === "team-researchops-core" || name === "researchops-core" || name === "researchops-core-team";
}

function isResearchOpsCoreMember(authContext = {}) {
  return Boolean(authContext.isResearchOpsCoreTeamAdmin) || teamsFor(authContext).some(isCoreTeam);
}

function teamKeys(authContext = {}) {
  return new Set(teamsFor(authContext).flatMap(team => [team.id, team.teamId, team.name, team.teamName, team.label].map(key).filter(Boolean)));
}

function projectKeys(project = {}) {
  return new Set([...(project.team_ids || []), ...(project.teamIds || []), ...(project.teamNames || []), project.teamName, project.team_name, project.team, project.org].map(key).filter(Boolean));
}

function userCanSeeProject(project = {}, authContext = {}) {
  if (isResearchOpsCoreMember(authContext)) return true;
  const pKeys = projectKeys(project);
  if (!pKeys.size) return false;
  const uKeys = teamKeys(authContext);
  for (const pKey of pKeys) if (uKeys.has(pKey)) return true;
  return false;
}

function canStartProject(authContext = {}) {
  if (isResearchOpsCoreMember(authContext)) return true;
  if ((authContext.permissions || []).some(permission => permission.code === "governed.create")) return true;
  return (authContext.roles || []).some(role => ["researcher", "user_researcher", "research_lead"].includes(role.key || role.roleKey));
}

function activeTeam(authContext = {}) {
  return authContext.activeTeam || authContext.teamMemberships?.[0] || authContext.memberTeams?.[0] || authContext.teams?.[0] || null;
}

function mapProject(record = {}) {
  const fields = record.fields || {};
  const names = teamNames(fields);
  const ids = teamIds(fields);
  const teamName = names[0] || "";
  return {
    id: record.id,
    name: fields.Name || "",
    description: fields.Description || "",
    "rops:servicePhase": fields.Phase || "",
    "rops:projectStatus": fields.Status || "",
    objectives: lines(fields.Objectives || ""),
    user_groups: normaliseUserGroups(fields.UserGroups || fields["User Groups"] || ""),
    stakeholders: normaliseStakeholders(fields.Stakeholders || []),
    createdAt: record.createdTime || fields.CreatedAt || "",
    team_ids: ids,
    teamIds: ids,
    teamNames: names,
    teamName,
    team_name: teamName,
    team: teamName,
    org: teamName || fields.Org || fields.org || ""
  };
}

function compareProjects(a = {}, b = {}) {
  const dateOrder = toMs(b.createdAt) - toMs(a.createdAt);
  if (dateOrder !== 0) return dateOrder;
  return String(a.name || "").localeCompare(String(b.name || "")) || String(a.id || "").localeCompare(String(b.id || ""));
}

async function readAirtableJson(ctx, url, options = {}) {
  const response = await fetchWithTimeout(url, options, ctx.cfg.TIMEOUT_MS);
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = {}; }
  if (!response.ok) throw Object.assign(new Error(data?.error?.message || data?.error?.type || safeText(text) || `airtable_http_${response.status}`), { status: response.status, body: text });
  return data;
}

async function listAirtableProjects(ctx, limit, view) {
  const base = ctx.env.AIRTABLE_BASE_ID;
  const table = encodeURIComponent(ctx.env.AIRTABLE_TABLE_PROJECTS);
  let url = `https://api.airtable.com/v0/${base}/${table}?pageSize=${limit}`;
  if (view) url += `&view=${encodeURIComponent(view)}`;
  const data = await readAirtableJson(ctx, url, { headers: airtableHeaders(ctx), signal: AbortSignal.timeout(ctx.cfg.TIMEOUT_MS) });
  return (data.records || []).map(mapProject);
}

async function joinProjectDetails(ctx, projects) {
  try {
    const base = ctx.env.AIRTABLE_BASE_ID;
    const table = encodeURIComponent(ctx.env.AIRTABLE_TABLE_DETAILS);
    const url = `https://api.airtable.com/v0/${base}/${table}?pageSize=100&fields%5B%5D=Project&fields%5B%5D=Lead%20Researcher&fields%5B%5D=Lead%20Researcher%20Email&fields%5B%5D=Notes`;
    const data = await readAirtableJson(ctx, url, { headers: airtableHeaders(ctx), signal: AbortSignal.timeout(ctx.cfg.TIMEOUT_MS) });
    const details = new Map();
    for (const record of data.records || []) {
      const f = record.fields || {};
      const linked = Array.isArray(f.Project) && f.Project[0];
      if (!linked) continue;
      const current = details.get(linked);
      if (!current || toMs(record.createdTime) > toMs(current._createdAt)) {
        details.set(linked, {
          lead_researcher: f["Lead Researcher"] || "",
          lead_researcher_email: f["Lead Researcher Email"] || "",
          notes: f.Notes || "",
          _createdAt: record.createdTime || ""
        });
      }
    }
    return projects.map(project => details.has(project.id) ? { ...project, ...details.get(project.id) } : project);
  } catch (error) {
    ctx.log.warn("airtable.details.join.fail", { detail: String(error?.message || error).slice(0, 160) });
    return projects;
  }
}

function createFields(payload = {}, authContext = {}, ctx = {}) {
  const team = activeTeam(authContext);
  const fields = {
    Name: String(payload.name || payload.Name || "").trim(),
    Description: String(payload.description || payload.Description || "").trim(),
    Phase: String(payload.phase || payload.Phase || "Discovery").trim(),
    Status: String(payload.status || payload.Status || "Goal setting & problem defining").trim(),
    Objectives: lines(payload.objectives || payload.Objectives || "").join("\n"),
    UserGroups: normaliseUserGroups(payload.user_groups || payload.UserGroups || payload["User Groups"] || "").join(", "),
    Stakeholders: JSON.stringify(normaliseStakeholders(payload.stakeholders || payload.Stakeholders || []))
  };
  fields[ctx.env.AIRTABLE_PROJECT_TEAM_NAME_FIELD || "Team Name"] = String(team?.name || payload.teamName || payload.team_name || payload.org || "").trim();
  fields[ctx.env.AIRTABLE_PROJECT_TEAM_ID_FIELD || "Team ID"] = String(team?.id || payload.teamId || payload.team_id || "").trim();
  return fields;
}

export async function listProjectsFromAirtable(ctx, origin, url, authContext = {}) {
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10), 1), 200);
  const view = url.searchParams.get("view") || undefined;
  try {
    requireEnv(ctx, ["AIRTABLE_BASE_ID", "AIRTABLE_TABLE_PROJECTS", "AIRTABLE_TABLE_DETAILS", "AIRTABLE_API_KEY"]);
    let projects = await listAirtableProjects(ctx, limit, view);
    projects = await joinProjectDetails(ctx, projects);
    projects = projects.filter(project => userCanSeeProject(project, authContext)).sort(compareProjects);
    return ctx.json({ ok: true, projects, canStartProject: canStartProject(authContext) }, 200, jsonHeaders(ctx, origin, { "x-rops-source": "airtable" }));
  } catch (error) {
    return ctx.json({ ok: false, error: "projects_unavailable", detail: safeText(error?.message || error) }, error?.status || 500, jsonHeaders(ctx, origin, { "x-rops-source": "none" }));
  }
}

export async function createProjectInAirtable(ctx, request, origin, authContext = {}) {
  if (!canStartProject(authContext)) return ctx.json({ ok: false, error: "forbidden", detail: "You do not have permission to start a research project." }, 403, jsonHeaders(ctx, origin));
  try { requireEnv(ctx, ["AIRTABLE_BASE_ID", "AIRTABLE_TABLE_PROJECTS", "AIRTABLE_API_KEY"]); }
  catch (error) { return ctx.json({ ok: false, error: String(error?.message || error) }, 500, jsonHeaders(ctx, origin)); }
  const body = await request.arrayBuffer();
  if (body.byteLength > ctx.cfg.MAX_BODY_BYTES) return ctx.json({ ok: false, error: "Payload too large" }, 413, jsonHeaders(ctx, origin));
  let payload;
  try { payload = JSON.parse(new TextDecoder().decode(body)); }
  catch { return ctx.json({ ok: false, error: "Invalid JSON" }, 400, jsonHeaders(ctx, origin)); }
  const fields = createFields(payload, authContext, ctx);
  if (!fields.Name) return ctx.json({ ok: false, error: "Project name is required" }, 400, jsonHeaders(ctx, origin));
  const base = ctx.env.AIRTABLE_BASE_ID;
  const table = encodeURIComponent(ctx.env.AIRTABLE_TABLE_PROJECTS);
  try {
    const data = await readAirtableJson(ctx, `https://api.airtable.com/v0/${base}/${table}`, {
      method: "POST",
      headers: { ...airtableHeaders(ctx), "Content-Type": "application/json" },
      body: JSON.stringify({ records: [{ fields }] })
    });
    return ctx.json({ ok: true, project: mapProject(data.records?.[0]) }, 201, jsonHeaders(ctx, origin, { "x-rops-source": "airtable" }));
  } catch (error) {
    const text = `${error?.message || ""} ${error?.body || ""}`;
    if (/unknown field|unknown_field|invalid field|field name/i.test(text)) {
      return ctx.json({ ok: false, error: "project_team_fields_missing", detail: "Airtable rejected the team-scoping fields. Add project team fields or configure AIRTABLE_PROJECT_TEAM_NAME_FIELD and AIRTABLE_PROJECT_TEAM_ID_FIELD." }, 500, jsonHeaders(ctx, origin));
    }
    return ctx.json({ ok: false, error: `Airtable ${error?.status || 500}`, detail: safeText(error?.message || error) }, error?.status || 500, jsonHeaders(ctx, origin));
  }
}

export async function getProjectById(ctx, origin, projectId, authContext = {}) {
  if (!projectId) return ctx.json({ ok: false, error: "Missing project id" }, 400, jsonHeaders(ctx, origin));
  try { requireEnv(ctx, ["AIRTABLE_BASE_ID", "AIRTABLE_TABLE_PROJECTS", "AIRTABLE_TABLE_DETAILS", "AIRTABLE_API_KEY"]); }
  catch (error) { return ctx.json({ ok: false, error: String(error?.message || error) }, 500, jsonHeaders(ctx, origin)); }
  const base = ctx.env.AIRTABLE_BASE_ID;
  const table = encodeURIComponent(ctx.env.AIRTABLE_TABLE_PROJECTS);
  try {
    const data = await readAirtableJson(ctx, `https://api.airtable.com/v0/${base}/${table}/${encodeURIComponent(projectId)}`, { headers: airtableHeaders(ctx), signal: AbortSignal.timeout(ctx.cfg.TIMEOUT_MS) });
    let project = mapProject(data);
    if (!userCanSeeProject(project, authContext)) return ctx.json({ ok: false, error: "Project not found" }, 404, jsonHeaders(ctx, origin));
    project = (await joinProjectDetails(ctx, [project]))[0];
    return ctx.json(project, 200, jsonHeaders(ctx, origin, { "x-rops-source": "airtable" }));
  } catch (error) {
    const status = error?.status === 404 ? 404 : error?.status || 500;
    return ctx.json({ ok: false, error: status === 404 ? "Project not found" : `Airtable ${status}`, detail: status === 404 ? undefined : safeText(error?.message || error) }, status, jsonHeaders(ctx, origin));
  }
}

export async function updateProjectFraming(ctx, request, origin, projectId, authContext = {}) {
  const readable = await getProjectById(ctx, origin, projectId, authContext);
  if (readable.status === 404) return readable;
  try { requireEnv(ctx, ["AIRTABLE_BASE_ID", "AIRTABLE_TABLE_PROJECTS", "AIRTABLE_API_KEY"]); }
  catch (error) { return ctx.json({ ok: false, error: String(error?.message || error) }, 500, jsonHeaders(ctx, origin)); }
  const body = await request.arrayBuffer();
  if (body.byteLength > ctx.cfg.MAX_BODY_BYTES) return ctx.json({ ok: false, error: "Payload too large" }, 413, jsonHeaders(ctx, origin));
  let payload;
  try { payload = JSON.parse(new TextDecoder().decode(body)); }
  catch { return ctx.json({ ok: false, error: "Invalid JSON" }, 400, jsonHeaders(ctx, origin)); }
  const fields = {};
  if (Object.hasOwn(payload, "objectives")) fields.Objectives = lines(payload.objectives).join("\n");
  if (Object.hasOwn(payload, "user_groups")) fields.UserGroups = normaliseUserGroups(payload.user_groups).join(", ");
  if (Object.hasOwn(payload, "stakeholders")) fields.Stakeholders = JSON.stringify(normaliseStakeholders(payload.stakeholders));
  if (!Object.keys(fields).length) return ctx.json({ ok: false, error: "No updatable project framing fields provided" }, 400, jsonHeaders(ctx, origin));
  const base = ctx.env.AIRTABLE_BASE_ID;
  const table = encodeURIComponent(ctx.env.AIRTABLE_TABLE_PROJECTS);
  try {
    const data = await readAirtableJson(ctx, `https://api.airtable.com/v0/${base}/${table}`, {
      method: "PATCH",
      headers: { ...airtableHeaders(ctx), "Content-Type": "application/json" },
      body: JSON.stringify({ records: [{ id: projectId, fields }] })
    });
    return ctx.json({ ok: true, project: mapProject(data.records?.[0] || { id: projectId, fields }) }, 200, jsonHeaders(ctx, origin, { "x-rops-source": "airtable" }));
  } catch (error) {
    return ctx.json({ ok: false, error: `Airtable ${error?.status || 500}`, detail: safeText(error?.message || error) }, error?.status || 500, jsonHeaders(ctx, origin));
  }
}
