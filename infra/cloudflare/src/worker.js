/**
 * @file worker.js
 * @module ResearchOpsWorker
 * @description
 * Cloudflare Worker for ResearchOps platform. 
 *   - Serves static assets via Workers Sites binding
 *   - Exposes API routes for health checks, project creation (Airtable + GitHub CSV dual-write),
 *     Airtable project listing, and CSV streaming
 *   - Implements class-based structure with lifecycle (reset/destroy), batched logging,
 *     config (no magic numbers), and testable utilities
 *
 * @section Routes:
 *   GET  /api/health
 *   GET  /api/projects             -> list projects from Airtable
 *   POST /api/projects             -> create project in Airtable (+ details) and append to GitHub CSV
 *   GET  /api/projects.csv         -> stream CSV from GitHub repo
 *   GET  /api/project-details.csv  -> stream CSV from GitHub repo
 *
 * @section Exports:
 *   - default Worker entrypoint
 *   - createMockEnv()  → unit test helper for env
 *   - makeJsonRequest() → unit test helper to build JSON Requests
 *
 * @section Type Definitions:
 *   @typedef {Object} Env
 *   @property {string} ALLOWED_ORIGINS
 *   @property {string} AUDIT
 *   @property {string} AIRTABLE_BASE_ID
 *   @property {string} AIRTABLE_TABLE_PROJECTS
 *   @property {string} AIRTABLE_TABLE_DETAILS
 *   @property {string} AIRTABLE_API_KEY
 *   @property {string} GH_OWNER
 *   @property {string} GH_REPO
 *   @property {string} GH_BRANCH
 *   @property {string} GH_PATH_PROJECTS
 *   @property {string} GH_PATH_DETAILS
 *   @property {string} GH_TOKEN
 *   @property {any}    ASSETS
 */

/**
 * Config (no magic numbers). Override via [vars] if wanted.
 */
const DEFAULTS = Object.freeze({
  TIMEOUT_MS: 10_000,
  CSV_CACHE_CONTROL: "no-store",
  GH_API_VERSION: "2022-11-28",
  LOG_BATCH_SIZE: 20,
  MAX_BODY_BYTES: 512 * 1024, // 512KB guard
});

/** Minimal, batched logger (no silent failures). */
class BatchLogger {
  /**
   * @param {{batchSize?:number}} [opts]
   */
  constructor(opts = {}) {
    this._batchSize = opts.batchSize || DEFAULTS.LOG_BATCH_SIZE;
    this._buf = [];
    this._destroyed = false;
  }
  /**
   * @param {"info"|"warn"|"error"} level
   * @param {string} msg
   * @param {unknown} [meta]
   */
  log(level, msg, meta) {
    if (this._destroyed) return;
    this._buf.push({ t: Date.now(), level, msg, meta });
    if (this._buf.length >= this._batchSize) this.flush();
  }
  info(msg, meta) { this.log("info", msg, meta); }
  warn(msg, meta) { this.log("warn", msg, meta); }
  error(msg, meta) { this.log("error", msg, meta); }

  /** Flush buffer to console */
  flush() {
    if (!this._buf.length) return;
    try {
      // single console call to reduce noise
      console.log("audit.batch", this._buf);
    } catch (e) {
      // fall back to per-entry errors if batch failed
      for (const entry of this._buf) {
        try { console.log("audit.entry", entry); } catch {}
      }
    } finally {
      this._buf = [];
    }
  }
  /** Reset internal state (for tests) */
  reset() { this._buf = []; }
  /** Cleanup and prevent further logging */
  destroy() { this.flush(); this._destroyed = true; }
}

/** Helper: timeout wrapper for fetch calls to avoid leaks/hangs. */
async function fetchWithTimeout(resource, init, timeoutMs = DEFAULTS.TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort("timeout"), timeoutMs);
  try {
    return await fetch(resource, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/** CSV helpers kept testable */
function csvEscape(val) {
  if (val == null) return "";
  const s = String(val);
  const needsQuotes = /[",\r\n]/.test(s);
  const esc = s.replace(/"/g, '""');
  return needsQuotes ? `"${esc}"` : esc;
}
function toCsvLine(arr) { return arr.map(csvEscape).join(",") + "\n"; }
function b64Encode(s) { return btoa(unescape(encodeURIComponent(s))); }
function b64Decode(b) { const clean = (b || "").replace(/\n/g, ""); return decodeURIComponent(escape(atob(clean))); }
function safeText(t) { return t && t.length > 2048 ? t.slice(0, 2048) + "…" : t; }

/** Core service with state + lifecycle */
class ResearchOpsService {
  /**
   * @param {Env} env
   * @param {{cfg?:Partial<typeof DEFAULTS>, logger?:BatchLogger}} [opts]
   */
  constructor(env, opts = {}) {
    this.env = env;
    this.cfg = Object.freeze({ ...DEFAULTS, ...(opts.cfg || {}) });
    this.log = opts.logger || new BatchLogger({ batchSize: this.cfg.LOG_BATCH_SIZE });
    this.destroyed = false;
  }

  /** Reset soft state (for tests) */
  reset() { this.log.reset(); }

  /** Cleanup resources */
  destroy() { if (this.destroyed) return; this.log.destroy(); this.destroyed = true; }

  /** Build CORS headers per allowlist */
  corsHeaders(origin) {
    const allowed = (this.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
    const h = {
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Vary": "Origin"
    };
    if (origin && allowed.includes(origin)) h["Access-Control-Allow-Origin"] = origin;
    return h;
  }

  /** JSON response helper */
  json(body, status = 200, headers = {}) {
    return new Response(JSON.stringify(body), {
      status, headers: { "Content-Type": "application/json", ...headers }
    });
  }

  /**
   * Route: GET /api/health
   */
  async health(origin) {
    return this.json({ ok: true, time: new Date().toISOString() }, 200, this.corsHeaders(origin));
  }

  /**
   * Route: GET /api/projects  (Airtable list for UI)
   * Query params: ?limit=50 (default 50, max 200), ?view=Grid%20view
   */
  async listProjectsFromAirtable(origin, url) {
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10), 1), 200);
    const view  = url.searchParams.get("view") || undefined;

    const base = this.env.AIRTABLE_BASE_ID;
    const tProjects = encodeURIComponent(this.env.AIRTABLE_TABLE_PROJECTS);
    let atUrl = `https://api.airtable.com/v0/${base}/${tProjects}?pageSize=${limit}`;
    if (view) atUrl += `&view=${encodeURIComponent(view)}`;

    const res = await fetchWithTimeout(atUrl, {
      headers: {
        "Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}`,
        "Content-Type": "application/json"
      }
    }, this.cfg.TIMEOUT_MS);

    const text = await res.text();
    if (!res.ok) {
      this.log.error("airtable.list.fail", { status: res.status, text: safeText(text) });
      return this.json({ error: `Airtable ${res.status}`, detail: safeText(text) }, res.status, this.corsHeaders(origin));
    }

    /** @type {{records: Array<{id:string,fields:Object}>}} */
    let data; try { data = JSON.parse(text); } catch { data = { records: [] }; }

    // Shape a simple UI-friendly model (non-breaking to existing UI)
    const projects = (data.records || []).map(r => {
      const f = r.fields || {};
      return {
        id: r.id,
        name: f.Name || "",
        description: f.Description || "",
        "rops:servicePhase": f.Phase || "",
        "rops:projectStatus": f.Status || "",
        objectives: String(f.Objectives || "").split("\n").filter(Boolean),
        user_groups: String(f.UserGroups || "").split(",").map(s => s.trim()).filter(Boolean),
        stakeholders: (() => { try { return JSON.parse(f.Stakeholders || "[]"); } catch { return []; } })()
      };
    });

    return this.json({ ok: true, projects }, 200, this.corsHeaders(origin));
  }

  /**
   * Route: POST /api/projects  (Airtable create + optional details) + CSV append
   * @param {Request} request
   * @param {string} origin
   */
  async createProject(request, origin) {
    // Guard overly large bodies to avoid memory waste
    const body = await request.arrayBuffer();
    if (body.byteLength > this.cfg.MAX_BODY_BYTES) {
      this.log.warn("request.too_large", { size: body.byteLength });
      return this.json({ error: "Payload too large" }, 413, this.corsHeaders(origin));
    }
    /** @type {any} */
    let payload;
    try { payload = JSON.parse(new TextDecoder().decode(body)); }
    catch { return this.json({ error: "Invalid JSON" }, 400, this.corsHeaders(origin)); }

    const errs = [];
    if (!payload.name) errs.push("name");
    if (!payload.description) errs.push("description");
    if (errs.length) return this.json({ error: "Missing required fields: " + errs.join(", ") }, 400, this.corsHeaders(origin));

    // Airtable (system of record)
    const projectFields = {
      Org: payload.org || "Home Office Biometrics",
      Name: payload.name,
      Description: payload.description,
      Phase: typeof payload.phase === "string" ? payload.phase : undefined,
      Status: typeof payload.status === "string" ? payload.status : undefined,
      Objectives: (payload.objectives || []).join("\n"),
      UserGroups: (payload.user_groups || []).join(", "),
      Stakeholders: JSON.stringify(payload.stakeholders || []),
      LocalId: payload.id || "",
      createdAt: f.CreatedAt || r.createdTime || ""
    };
    // prune empties
    for (const k of Object.keys(projectFields)) {
      const v = projectFields[k];
      if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) delete projectFields[k];
    }

    const base = this.env.AIRTABLE_BASE_ID;
    const tProjects = encodeURIComponent(this.env.AIRTABLE_TABLE_PROJECTS);
    const tDetails  = encodeURIComponent(this.env.AIRTABLE_TABLE_DETAILS);
    const atProjectsUrl = `https://api.airtable.com/v0/${base}/${tProjects}`;
    const atDetailsUrl  = `https://api.airtable.com/v0/${base}/${tDetails}`;

    // 1) Create project
    const pRes = await fetchWithTimeout(atProjectsUrl, {
      method: "POST",
      headers: { "Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ records: [{ fields: projectFields }] })
    }, this.cfg.TIMEOUT_MS);
    const pText = await pRes.text();
    if (!pRes.ok) {
      this.log.error("airtable.create.fail", { status: pRes.status, text: safeText(pText) });
      return this.json({ error: `Airtable ${pRes.status}`, detail: safeText(pText) }, pRes.status, this.corsHeaders(origin));
    }
    let pJson; try { pJson = JSON.parse(pText); } catch { pJson = { records: [] }; }
    const projectId = pJson.records?.[0]?.id;
    if (!projectId) return this.json({ error: "Airtable response missing project id" }, 502, this.corsHeaders(origin));

    // 2) Optional details
    let detailId = null;
    const hasDetails = Boolean(payload.lead_researcher || payload.lead_researcher_email || payload.notes);
    if (hasDetails) {
      const detailsFields = {
        Project: [projectId],
        "Lead Researcher": payload.lead_researcher || "",
        "Lead Researcher Email": payload.lead_researcher_email || "",
        Notes: payload.notes || ""
      };
      for (const k of Object.keys(detailsFields)) {
        const v = detailsFields[k]; if (typeof v === "string" && v.trim() === "") delete detailsFields[k];
      }
      const dRes = await fetchWithTimeout(atDetailsUrl, {
        method: "POST",
        headers: { "Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ records: [{ fields: detailsFields }] })
      }, this.cfg.TIMEOUT_MS);
      const dText = await dRes.text();
      if (!dRes.ok) {
        // rollback project
        try { await fetchWithTimeout(`${atProjectsUrl}/${projectId}`, { method: "DELETE", headers: { "Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}` } }, this.cfg.TIMEOUT_MS); } catch {}
        this.log.error("airtable.details.fail", { status: dRes.status, text: safeText(dText) });
        return this.json({ error: `Airtable details ${dRes.status}`, detail: safeText(dText) }, dRes.status, this.corsHeaders(origin));
      }
      try { detailId = JSON.parse(dText).records?.[0]?.id || null; } catch {}
    }

    // 3) GitHub CSV append (best-effort; never blocks success)
    let csvOk = true, csvError = null;
    try {
      const nowIso = new Date().toISOString();
      const projectRow = [
        payload.id || "",
        payload.org || "Home Office Biometrics",
        payload.name || "",
        payload.description || "",
        payload.phase || "",
        payload.status || "",
        (payload.objectives || []).join(" | "),
        (payload.user_groups || []).join(" | "),
        JSON.stringify(payload.stakeholders || []),
        nowIso
      ];
      await this.githubCsvAppend({
        path: this.env.GH_PATH_PROJECTS,
        header: ["LocalId","Org","Name","Description","Phase","Status","Objectives","UserGroups","Stakeholders","CreatedAt"],
        row: projectRow
      });

      if (hasDetails) {
        const detailsRow = [
          projectId,
          payload.id || "",
          payload.lead_researcher || "",
          payload.lead_researcher_email || "",
          payload.notes || "",
          nowIso
        ];
        await this.githubCsvAppend({
          path: this.env.GH_PATH_DETAILS,
          header: ["AirtableId","LocalProjectId","LeadResearcher","LeadResearcherEmail","Notes","CreatedAt"],
          row: detailsRow
        });
      }
    } catch (e) {
      csvOk = false; csvError = String(e?.message || e);
      this.log.warn("github.csv.append.fail", { err: csvError });
    }

    if (this.env.AUDIT === "true") this.log.info("project.created", { airtableId: projectId, hasDetails, csvOk });
    return this.json({ ok: true, project_id: projectId, detail_id: detailId, csv_ok: csvOk, csv_error: csvOk ? undefined : csvError }, 200, this.corsHeaders(origin));
  }

  /**
   * Route: GET CSV files from GitHub (proxied for CORS)
   */
  async streamCsv(origin, path) {
    const { GH_OWNER, GH_REPO, GH_BRANCH, GH_TOKEN } = this.env;
    const url = `https://raw.githubusercontent.com/${GH_OWNER}/${GH_REPO}/${encodeURIComponent(GH_BRANCH)}/${path}`;
    const res = await fetchWithTimeout(url, {
      headers: GH_TOKEN ? { "Authorization": `Bearer ${GH_TOKEN}` } : {}
    }, this.cfg.TIMEOUT_MS);

    if (!res.ok) {
      const t = await res.text();
      this.log.error("github.csv.stream.fail", { status: res.status, detail: safeText(t) });
      return this.json({ error: `GitHub ${res.status}`, detail: safeText(t) }, res.status, this.corsHeaders(origin));
    }
    return new Response(res.body, {
      status: 200,
      headers: {
        ...this.corsHeaders(origin),
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `inline; filename="${path.split("/").pop() || "data.csv"}"`,
        "Cache-Control": this.cfg.CSV_CACHE_CONTROL
      }
    });
  }

  /**
   * GitHub Contents API append (create if missing).
   * @param {{path:string, header:string[], row:string[]}} param0
   */
  async githubCsvAppend({ path, header, row }) {
    const { GH_OWNER, GH_REPO, GH_BRANCH, GH_TOKEN } = this.env;
    const base = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${encodeURIComponent(path)}`;
    const headers = {
      "Authorization": `Bearer ${GH_TOKEN}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": DEFAULTS.GH_API_VERSION,
      "Content-Type": "application/json"
    };

    // read existing
    let sha = undefined, content = "", exists = false;
    const getRes = await fetchWithTimeout(`${base}?ref=${encodeURIComponent(GH_BRANCH)}`, { headers }, this.cfg.TIMEOUT_MS);
    if (getRes.status === 200) {
      const js = await getRes.json();
      sha = js.sha;
      content = b64Decode(js.content);
      exists = true;
    } else if (getRes.status === 404) {
      content = header.join(",") + "\n";
    } else {
      const t = await getRes.text();
      throw new Error(`GitHub read ${getRes.status}: ${safeText(t)}`);
    }

    content += toCsvLine(row);

    const putBody = {
      message: exists ? `chore: append row to ${path}` : `chore: create ${path} with header`,
      content: b64Encode(content),
      branch: GH_BRANCH,
      ...(sha ? { sha } : {})
    };

    const putRes = await fetchWithTimeout(base, { method: "PUT", headers, body: JSON.stringify(putBody) }, this.cfg.TIMEOUT_MS);
    if (!putRes.ok) {
      const t = await putRes.text();
      throw new Error(`GitHub write ${putRes.status}: ${safeText(t)}`);
    }
  }
}

/** -------- Worker entry -------- */
export default {
  /**
   * Cloudflare Worker entrypoint
   * @param {Request} request
   * @param {Env} env
   * @param {ExecutionContext} ctx
   */
  async fetch(request, env, ctx) {
    const service = new ResearchOpsService(env);
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    try {
      // API routes
      if (url.pathname.startsWith("/api/")) {
        // Preflight
        if (request.method === "OPTIONS") {
          return new Response(null, { headers: service.corsHeaders(origin) });
        }

        // Enforce CORS (non-browser clients may omit Origin)
        const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
        if (origin && !allowed.includes(origin)) {
          return service.json({ error: "Origin not allowed" }, 403, service.corsHeaders(origin));
        }

        // Health
        if (url.pathname === "/api/health") return service.health(origin);

        // Airtable list (for UI)
        if (url.pathname === "/api/projects" && request.method === "GET") {
          return service.listProjectsFromAirtable(origin, url);
        }

        // Create + CSV dual write
        if (url.pathname === "/api/projects" && request.method === "POST") {
          return service.createProject(request, origin);
        }

        // CSV streams
        if (url.pathname === "/api/projects.csv" && request.method === "GET") {
          return service.streamCsv(origin, env.GH_PATH_PROJECTS);
        }
        if (url.pathname === "/api/project-details.csv" && request.method === "GET") {
          return service.streamCsv(origin, env.GH_PATH_DETAILS);
        }

        // Fallback
        return service.json({ error: "Not found" }, 404, service.corsHeaders(origin));
      }

      // Static assets via Workers Assets (SPA fallback)
      let resp = await env.ASSETS.fetch(request);
      if (resp.status === 404) {
        const indexReq = new Request(new URL("/index.html", url), request);
        resp = await env.ASSETS.fetch(indexReq);
      }
      return resp;
    } catch (e) {
      service.log.error("unhandled.error", { err: String(e?.message || e) });
      return new Response(JSON.stringify({ error: "Internal error" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...service.corsHeaders(origin) }
      });
    } finally {
      // Ensure buffers are flushed and no leaks
      service.destroy();
    }
  }
};

/** -------- Test utilities (exported) -------- */
/**
 * Create a minimal mock Env for unit tests.
 * @param {Partial<Env>} overrides
 * @returns {Env}
 */
export function createMockEnv(overrides = {}) {
  return /** @type {Env} */ ({
    ALLOWED_ORIGINS: "http://localhost:8080",
    AUDIT: "false",
    AIRTABLE_BASE_ID: "app_base",
    AIRTABLE_TABLE_PROJECTS: "Projects",
    AIRTABLE_TABLE_DETAILS: "Project Details",
    AIRTABLE_API_KEY: "key",
    GH_OWNER: "owner",
    GH_REPO: "repo",
    GH_BRANCH: "main",
    GH_PATH_PROJECTS: "data/projects.csv",
    GH_PATH_DETAILS: "data/project-details.csv",
    GH_TOKEN: "gh",
    ASSETS: { fetch: (r) => new Response("not-found", { status: 404 }) },
    ...overrides
  });
}

/**
 * Build a JSON Request for tests.
 * @param {string} path
 * @param {any} body
 * @param {RequestInit} [init]
 */
export function makeJsonRequest(path, body, init = {}) {
  return new Request(`https://example.test${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    body: JSON.stringify(body),
    ...init
  });
}
