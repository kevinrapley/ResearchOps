// infra/cloudflare/src/worker.js
// ResearchOps Worker: static assets + Airtable + GitHub CSV dual-write
// Routes:
// - GET  /api/health
// - POST /api/projects                 -> Airtable (Projects + Project Details) + append to GitHub CSV
// - GET  /api/projects.csv             -> stream CSV from GitHub repo
// - GET  /api/project-details.csv      -> stream CSV from GitHub repo

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // API routes
    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env, ctx);
    }

    // Static assets via Workers Assets
    let resp = await env.ASSETS.fetch(request);
    if (resp.status === 404) {
      const indexReq = new Request(new URL("/index.html", url), request);
      resp = await env.ASSETS.fetch(indexReq);
    }
    return resp;
  }
};

async function handleApi(request, env, ctx) {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(origin, allowed) });
  }
  // Enforce CORS allowlist
  if (origin && !allowed.includes(origin)) {
    return json({ error: "Origin not allowed" }, 403, corsHeaders(origin, allowed));
  }

  // Health
  if (url.pathname === "/api/health") {
    return json({ ok: true, time: new Date().toISOString() }, 200, corsHeaders(origin, allowed));
  }

  // ====================================================================================
  // POST /api/projects  -> Airtable first, then GitHub CSV append
  // ====================================================================================
  if (url.pathname === "/api/projects" && request.method === "POST") {
    let payload;
    try { payload = await request.json(); }
    catch { return json({ error: "Invalid JSON" }, 400, corsHeaders(origin, allowed)); }

    // Required (Step 1)
    const errs = [];
    if (!payload.name) errs.push("name");
    if (!payload.description) errs.push("description");
    if (errs.length) {
      return json({ error: "Missing required fields: " + errs.join(", ") }, 400, corsHeaders(origin, allowed));
    }

    // ---------- Airtable write (system of record) ----------
    // Send plain strings for Single selects (labels must match Airtable exactly)
    const projectFields = {
      Org: payload.org || "Home Office Biometrics",
      Name: payload.name,
      Description: payload.description,
      Phase: typeof payload.phase === "string" ? payload.phase : undefined,
      Status: typeof payload.status === "string" ? payload.status : undefined,
      Objectives: (payload.objectives || []).join("\n"),
      UserGroups: (payload.user_groups || []).join(", "),
      Stakeholders: JSON.stringify(payload.stakeholders || []),
      LocalId: payload.id || ""
    };
    // prune empties
    for (const k of Object.keys(projectFields)) {
      const v = projectFields[k];
      if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) {
        delete projectFields[k];
      }
    }

    const base = env.AIRTABLE_BASE_ID;
    const tProjects = encodeURIComponent(env.AIRTABLE_TABLE_PROJECTS);
    const tDetails  = encodeURIComponent(env.AIRTABLE_TABLE_DETAILS);

    const atProjectsUrl = `https://api.airtable.com/v0/${base}/${tProjects}`;
    const atDetailsUrl  = `https://api.airtable.com/v0/${base}/${tDetails}`;

    // 1) Create Projects record
    const pRes = await fetch(atProjectsUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.AIRTABLE_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ records: [{ fields: projectFields }] })
    });
    const pText = await pRes.text();
    if (!pRes.ok) {
      // bubble Airtable error (403/422/etc)
      return json({ error: `Airtable ${pRes.status}`, detail: safeText(pText) }, pRes.status, corsHeaders(origin, allowed));
    }

    let pJson; try { pJson = JSON.parse(pText); } catch { pJson = { records: [] }; }
    const projectId = pJson.records?.[0]?.id;
    if (!projectId) {
      return json({ error: "Airtable response missing project id" }, 502, corsHeaders(origin, allowed));
    }

    // 2) Optional Project Details (linked)
    let detailId = null;
    const hasDetails = Boolean(
      payload.lead_researcher || payload.lead_researcher_email || payload.notes
    );

    if (hasDetails) {
      const detailsFields = {
        Project: [projectId], // linked record expects array of record IDs
        "Lead Researcher": payload.lead_researcher || "",
        "Lead Researcher Email": payload.lead_researcher_email || "",
        Notes: payload.notes || ""
      };
      for (const k of Object.keys(detailsFields)) {
        const v = detailsFields[k];
        if (typeof v === "string" && v.trim() === "") delete detailsFields[k];
      }

      const dRes = await fetch(atDetailsUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.AIRTABLE_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ records: [{ fields: detailsFields }] })
      });
      const dText = await dRes.text();
      if (!dRes.ok) {
        // rollback the project if details creation fails
        try {
          await fetch(`${atProjectsUrl}/${projectId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${env.AIRTABLE_API_KEY}` }
          });
        } catch {}
        return json({ error: `Airtable details ${dRes.status}`, detail: safeText(dText) }, dRes.status, corsHeaders(origin, allowed));
      }
      try { detailId = JSON.parse(dText).records?.[0]?.id || null; } catch {}
    }

    // ---------- GitHub CSV append (secondary) ----------
    let csvOk = true, csvError = null;
    try {
      const nowIso = new Date().toISOString();
      // projects.csv row
      const projectRow = [
        payload.id || "", // LocalId
        payload.org || "Home Office Biometrics", // Org
        payload.name || "", // Name
        payload.description || "", // Description
        payload.phase || "", // Phase (label)
        payload.status || "", // Status (label)
        (payload.objectives || []).join(" | "), // Objectives
        (payload.user_groups || []).join(" | "), // UserGroups
        JSON.stringify(payload.stakeholders || []), // Stakeholders JSON
        nowIso // CreatedAt
      ];

      await githubCsvAppend(env, {
        path: env.GH_PATH_PROJECTS,
        header: [
          "LocalId","Org","Name","Description","Phase","Status","Objectives","UserGroups","Stakeholders","CreatedAt"
        ],
        row: projectRow
      });

      // project-details.csv row (optional)
      if (hasDetails) {
        const detailsRow = [
          projectId, // AirtableId
          payload.id || "", // LocalProjectId
          payload.lead_researcher || "",
          payload.lead_researcher_email || "",
          payload.notes || "",
          nowIso
        ];
        await githubCsvAppend(env, {
          path: env.GH_PATH_DETAILS,
          header: [
            "AirtableId","LocalProjectId","LeadResearcher","LeadResearcherEmail","Notes","CreatedAt"
          ],
          row: detailsRow
        });
      }
    } catch (e) {
      csvOk = false;
      csvError = String(e?.message || e);
    }

    if (env.AUDIT === "true") {
      try { console.log("project.created", { airtableId: projectId, details: hasDetails, csvOk }); } catch {}
    }

    return json({
      ok: true,
      project_id: projectId,
      detail_id: detailId,
      csv_ok: csvOk,
      csv_error: csvOk ? undefined : csvError
    }, 200, corsHeaders(origin, allowed));
  }

  // ====================================================================================
  // CSV: GET latest from GitHub (proxied through the Worker)
  // ====================================================================================
  if (url.pathname === "/api/projects.csv" && request.method === "GET") {
    return githubCsvStream(env, env.GH_PATH_PROJECTS, corsHeaders(origin, allowed));
  }

  if (url.pathname === "/api/project-details.csv" && request.method === "GET") {
    return githubCsvStream(env, env.GH_PATH_DETAILS, corsHeaders(origin, allowed));
  }

  // Fallback
  return json({ error: "Not found" }, 404, corsHeaders(origin, allowed));
}

/* ---------------- GitHub CSV helpers ---------------- */

// Append a row to a CSV file in GitHub (create file with header if missing)
async function githubCsvAppend(env, { path, header, row }) {
  const { GH_OWNER, GH_REPO, GH_BRANCH, GH_TOKEN } = env;
  const base = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${encodeURIComponent(path)}`;
  const headers = {
    "Authorization": `Bearer ${GH_TOKEN}`,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json"
  };

  // Read current file
  let sha = undefined;
  let content = "";
  let exists = false;

  const getRes = await fetch(`${base}?ref=${encodeURIComponent(GH_BRANCH)}`, { headers });
  if (getRes.status === 200) {
    const js = await getRes.json();
    sha = js.sha;
    content = b64Decode(js.content);
    exists = true;
  } else if (getRes.status === 404) {
    content = header.join(",") + "\n";
  } else {
    const t = await getRes.text();
    throw new Error(`GitHub read ${getRes.status}: ${t}`);
  }

  // Append a line
  content += toCsvLine(row);

  // Write back
  const putBody = {
    message: exists ? `chore: append row to ${path}` : `chore: create ${path} with header`,
    content: b64Encode(content),
    branch: GH_BRANCH
  };
  if (sha) putBody.sha = sha;

  const putRes = await fetch(base, { method: "PUT", headers, body: JSON.stringify(putBody) });
  if (!putRes.ok) {
    const t = await putRes.text();
    throw new Error(`GitHub write ${putRes.status}: ${t}`);
  }
}

// Stream a CSV file from GitHub (via Worker for CORS)
async function githubCsvStream(env, path, cors) {
  const { GH_OWNER, GH_REPO, GH_BRANCH, GH_TOKEN } = env;
  const url = `https://raw.githubusercontent.com/${GH_OWNER}/${GH_REPO}/${encodeURIComponent(GH_BRANCH)}/${path}`;
  const res = await fetch(url, { headers: GH_TOKEN ? { "Authorization": `Bearer ${GH_TOKEN}` } : {} });
  if (!res.ok) {
    const t = await res.text();
    return json({ error: `GitHub ${res.status}`, detail: t }, res.status, cors);
  }
  return new Response(res.body, {
    status: 200,
    headers: {
      ...cors,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `inline; filename="${path.split("/").pop() || "data.csv"}"`,
      "Cache-Control": "no-store"
    }
  });
}

/* ---------------- general helpers ---------------- */

function corsHeaders(origin, allowed) {
  const h = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin"
  };
  if (origin && allowed.includes(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers }
  });
}

function safeText(t) {
  return t && t.length > 2048 ? t.slice(0, 2048) + "…" : t;
}

function csvEscape(val) {
  if (val == null) return "";
  const s = String(val);
  const needsQuotes = /[",\r\n]/.test(s);
  const esc = s.replace(/"/g, '""');
  return needsQuotes ? `"${esc}"` : esc;
}

function toCsvLine(arr) {
  return arr.map(csvEscape).join(",") + "\n";
}

// Base64 helpers for GitHub contents API
function b64Encode(s) {
  return btoa(unescape(encodeURIComponent(s)));
}

function b64Decode(b) {
  const clean = (b || "").replace(/\n/g, "");
  return decodeURIComponent(escape(atob(clean)));
}
