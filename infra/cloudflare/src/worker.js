// infra/cloudflare/src/worker.js
// ResearchOps Worker: serves static assets (no KV) and exposes API routes.
// - GET  /api/health
// - POST /api/projects      -> Airtable: create Projects (+ Project Details if provided)
// - GET  /api/projects.csv  -> Proxy CSV from SharePoint

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		// --- API routes
		if (url.pathname.startsWith("/api/")) {
			return handleApi(request, env, ctx);
		}

		// --- Static assets via Workers Assets (no KV)
		// Try exact asset; on 404, fall back to /index.html (SPA-friendly)
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
	const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);

	// --- CORS preflight for API
	if (request.method === "OPTIONS") {
		return new Response(null, { headers: corsHeaders(origin, allowed) });
	}

	// --- Enforce CORS allowlist (non-browser clients may omit Origin)
	if (origin && !allowed.includes(origin)) {
		return json({ error: "Origin not allowed" }, 403, corsHeaders(origin, allowed));
	}

	// --- Health
	if (url.pathname === "/api/health") {
		return json({ ok: true, time: new Date().toISOString() }, 200, corsHeaders(origin, allowed));
	}

	// ====================================================================================
	// POST /api/projects  -> Create record in Airtable (Projects) + linked Project Details
	// ====================================================================================
	if (url.pathname === "/api/projects" && request.method === "POST") {
		let payload;
		try {
			payload = await request.json();
		} catch {
			return json({ error: "Invalid JSON" }, 400, corsHeaders(origin, allowed));
		}

		// Required (Step 1)
		const errs = [];
		if (!payload.name) errs.push("name");
		if (!payload.description) errs.push("description");
		if (errs.length) {
			return json({ error: "Missing required fields: " + errs.join(", ") }, 400, corsHeaders(origin, allowed));
		}

		// Helpers for Airtable field shapes
		const toSelect = (v) => {
			if (typeof v !== "string") return undefined;
			const s = v.trim();
			return s ? { name: s } : undefined; // reliable for Single select
		};

		// Map -> Projects fields (adjust to your Airtable schema if needed)
		const projectFields = {
			Org: payload.org || "Home Office Biometrics",
			Name: payload.name,
			Description: payload.description,
			Phase: toSelect(payload.phase),          // Single select
			Status: toSelect(payload.status),        // Single select
			Objectives: (payload.objectives || []).join("\n"),
			UserGroups: (payload.user_groups || []).join(", "),
			Stakeholders: JSON.stringify(payload.stakeholders || []),
			// CreatedAt: (read-only in Airtable if "Created time") -> do NOT send
			LocalId: payload.id || ""
		};

		// Remove undefined/empty strings so Airtable doesn't choke
		for (const k of Object.keys(projectFields)) {
			const v = projectFields[k];
			if (
				v === undefined ||
				v === null ||
				(typeof v === "string" && v.trim() === "")
			) {
				delete projectFields[k];
			}
		}

		const base = env.AIRTABLE_BASE_ID;
		const tProjects = encodeURIComponent(env.AIRTABLE_TABLE_PROJECTS);
		const tDetails  = encodeURIComponent(env.AIRTABLE_TABLE_PROJECT_DETAILS);

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
			return json({ error: `Airtable ${pRes.status}`, detail: safeText(pText) }, pRes.status, corsHeaders(origin, allowed));
		}

		let pJson; try { pJson = JSON.parse(pText); } catch { pJson = { records: [] }; }
		const projectRecord = pJson.records?.[0];
		const projectId = projectRecord?.id;
		if (!projectId) {
			return json({ error: "Airtable response missing project id" }, 502, corsHeaders(origin, allowed));
		}

		// 2) Create Project Details if provided (linked to the project)
		let detailId = null;
		const hasDetails = Boolean(
			payload.lead_researcher || payload.lead_researcher_email || payload.notes
		);

		if (hasDetails) {
			const detailsFields = {
				Project: [projectId], // linked record expects array of IDs
				"Lead Researcher": payload.lead_researcher || "",
				"Lead Researcher Email": payload.lead_researcher_email || "",
				Notes: payload.notes || ""
			};

			// prune empties
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
				// Roll back the project to avoid orphan
				try {
					await fetch(`${atProjectsUrl}/${projectId}`, {
						method: "DELETE",
						headers: { "Authorization": `Bearer ${env.AIRTABLE_API_KEY}` }
					});
				} catch {}
				return json({ error: `Airtable details ${dRes.status}`, detail: safeText(dText) }, dRes.status, corsHeaders(origin, allowed));
			}
			try {
				const dJson = JSON.parse(dText);
				detailId = dJson.records?.[0]?.id || null;
			} catch {}
		}

		if (env.AUDIT === "true") {
			try { console.log("project.created", { id: projectId, hasDetails, name: projectFields.Name }); } catch {}
		}

		return json({
			ok: true,
			project_id: projectId,
			detail_id: detailId,
			project: projectFields
		}, 200, corsHeaders(origin, allowed));
	}

	// ====================================================================================
	// GET /api/projects.csv  -> Stream CSV from SharePoint
	// ====================================================================================
	if (url.pathname === "/api/projects.csv" && request.method === "GET") {
		const spUrl = env.SHAREPOINT_CSV_URL;
		if (!spUrl) {
			return json({ error: "SHAREPOINT_CSV_URL not configured" }, 500, corsHeaders(origin, allowed));
		}

		const headers = {};
		if (env.SHAREPOINT_BEARER) {
			headers["Authorization"] = `Bearer ${env.SHAREPOINT_BEARER}`;
		}

		const spRes = await fetch(spUrl, { headers });
		if (!spRes.ok) {
			const t = await spRes.text();
			return json({ error: `SharePoint ${spRes.status}`, detail: safeText(t) }, spRes.status, corsHeaders(origin, allowed));
		}

		return new Response(spRes.body, {
			status: 200,
			headers: {
				...corsHeaders(origin, allowed),
				"Content-Type": "text/csv; charset=utf-8",
				"Content-Disposition": 'attachment; filename="projects.csv"'
			}
		});
	}

	// --- API fallback
	return json({ error: "Not found" }, 404, corsHeaders(origin, allowed));
}

// ---------- helpers ----------
function corsHeaders(origin, allowed) {
	const h = {
		"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type, Authorization",
		"Vary": "Origin"
	};
	if (origin && allowed.includes(origin)) {
		h["Access-Control-Allow-Origin"] = origin;
	}
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
