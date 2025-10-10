/**
 * @file src/service/projects.js
 * @module service/projects
 */

import { fetchWithTimeout, safeText, toMs } from "../core/utils.js";

/**
 * List projects + join latest details.
 * @param {import('./index.js').ResearchOpsService} svc
 * @param {string} origin
 * @param {URL} url
 * @returns {Promise<Response>}
 */
export async function listProjectsFromAirtable(svc, origin, url) {
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10), 1), 200);
  const view = url.searchParams.get("view") || undefined;

  const base = svc.env.AIRTABLE_BASE_ID;
  const tProjects = encodeURIComponent(svc.env.AIRTABLE_TABLE_PROJECTS);
  const tDetails = encodeURIComponent(svc.env.AIRTABLE_TABLE_DETAILS);

  // 1) Projects
  let atUrl = `https://api.airtable.com/v0/${base}/${tProjects}?pageSize=${limit}`;
  if (view) atUrl += `&view=${encodeURIComponent(view)}`;

  const pRes = await fetchWithTimeout(atUrl, {
    headers: {
      "Authorization": `Bearer ${svc.env.AIRTABLE_API_KEY}`,
      "Content-Type": "application/json"
    }
  }, svc.cfg.TIMEOUT_MS);

  const pText = await pRes.text();
  if (!pRes.ok) {
    svc.log.error("airtable.list.fail", { status: pRes.status, text: safeText(pText) });
    return svc.json({ error: `Airtable ${pRes.status}`, detail: safeText(pText) }, pRes.status, svc.corsHeaders(origin));
  }

  /** @type {{records: Array<{id:string,createdTime?:string,fields:Record<string,any>}>}} */
  let pData;
  try { pData = JSON.parse(pText); } catch { pData = { records: [] }; }

  let projects = (pData.records || []).map(r => {
    const f = r.fields || {};
    return {
      id: r.id,
      name: f.Name || "",
      description: f.Description || "",
      "rops:servicePhase": f.Phase || "",
      "rops:projectStatus": f.Status || "",
      objectives: String(f.Objectives || "").split("\n").filter(Boolean),
      user_groups: String(f.UserGroups || "").split(",").map(s => s.trim()).filter(Boolean),
      stakeholders: (() => { try { return JSON.parse(f.Stakeholders || "[]"); } catch { return []; } })(),
      createdAt: r.createdTime || f.CreatedAt || ""
    };
  });

  // 2) Project Details
  const dUrl = `https://api.airtable.com/v0/${base}/${tDetails}?pageSize=100&fields%5B%5D=Project&fields%5B%5D=Lead%20Researcher&fields%5B%5D=Lead%20Researcher%20Email&fields%5B%5D=Notes`;
  const dRes = await fetchWithTimeout(dUrl, {
    headers: { "Authorization": `Bearer ${svc.env.AIRTABLE_API_KEY}` }
  }, svc.cfg.TIMEOUT_MS);

  if (dRes.ok) {
    const dText = await dRes.text();
    /** @type {{records:Array<{id:string,createdTime?:string,fields:Record<string,any>}>}} */
    let dData;
    try { dData = JSON.parse(dText); } catch { dData = { records: [] }; }

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
    const dt = await dRes.text().catch(() => "");
    svc.log.warn("airtable.details.join.fail", { status: dRes.status, detail: safeText(dt) });
  }

  projects.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
  return svc.json({ ok: true, projects }, 200, svc.corsHeaders(origin));
}