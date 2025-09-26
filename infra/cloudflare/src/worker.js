import { getAssetFromKV } from "@cloudflare/kv-asset-handler";

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		// If this is an API call, handle it separately
		if (url.pathname.startsWith("/api/")) {
			return handleApi(request, env, ctx);
		}

		// Otherwise try to serve static assets from /public
		try {
			return await getAssetFromKV({ request, waitUntil: ctx.waitUntil.bind(ctx) });
		} catch (e) {
			return new Response("Not found", { status: 404 });
		}
	}
};

async function handleApi(request, env, ctx) {
	const url = new URL(request.url);
	const origin = request.headers.get("Origin") || "";
	const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim());

	// --- CORS preflight
	if (request.method === "OPTIONS") {
		return new Response(null, { headers: corsHeaders(origin, allowed) });
	}

	// --- Enforce CORS allowlist
	if (origin && !allowed.includes(origin)) {
		return json({ error: "Origin not allowed" }, 403, corsHeaders(origin, allowed));
	}

	// --- Health check
	if (url.pathname === "/api/health") {
		return json({ ok: true, time: new Date().toISOString() }, 200, corsHeaders(origin, allowed));
	}

	// ====================================================================================
	// POST /api/projects  -> Create record in Airtable
	// ====================================================================================
	if (url.pathname === "/api/projects" && request.method === "POST") {
		let payload;
		try {
			payload = await request.json();
		} catch {
			return json({ error: "Invalid JSON" }, 400, corsHeaders(origin, allowed));
		}

		// Minimal validation
		const errs = [];
		if (!payload.name) errs.push("name");
		if (!payload.phase) errs.push("phase");
		if (!payload.status) errs.push("status");
		if (errs.length) {
			return json({ error: "Missing required fields: " + errs.join(", ") }, 400, corsHeaders(origin, allowed));
		}

		// Map to Airtable fields (adjust names to your table if needed)
		const fields = {
			Org: payload.org || "Home Office Biometrics",
			Name: payload.name,
			Phase: payload.phase,
			Status: payload.status,
			Description: payload.description || "",
			Stakeholders: JSON.stringify(payload.stakeholders || []),
			Objectives: (payload.objectives || []).join("\n"),
			UserGroups: (payload.user_groups || []).join(", "),
			CreatedAt: payload.created || new Date().toISOString(),
			LocalId: payload.id || ""
		};

		const atUrl = `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(env.AIRTABLE_TABLE_PROJECTS)}`;
		const res = await fetch(atUrl, {
			method: "POST",
			headers: {
				"Authorization": `Bearer ${env.AIRTABLE_API_KEY}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({ records: [{ fields }] })
		});

		const text = await res.text();
		if (!res.ok) {
			return json({ error: `Airtable ${res.status}`, detail: safeText(text) }, res.status, corsHeaders(origin, allowed));
		}

		if (env.AUDIT === "true") {
			try {
				console.log("project.created", { name: fields.Name, phase: fields.Phase, status: fields.Status });
			} catch { /* ignore logging errors */ }
		}

		return new Response(text, {
			status: 200,
			headers: { ...corsHeaders(origin, allowed), "Content-Type": "application/json" }
		});
	}

	// ====================================================================================
	// GET /api/projects.csv  -> Stream CSV from SharePoint
	// ====================================================================================
	if (url.pathname === "/api/projects.csv" && request.method === "GET") {
		const spUrl = env.SHAREPOINT_CSV_URL;
		if (!spUrl) {
			return json({ error: "SHAREPOINT_CSV_URL not configured" }, 500, corsHeaders(origin, allowed));
		}

		// If your file is public/accessible to anonymous, omit Authorization; otherwise use secret
		const headers = {};
		if (env.SHAREPOINT_BEARER) {
			headers["Authorization"] = `Bearer ${env.SHAREPOINT_BEARER}`;
		}

		const spRes = await fetch(spUrl, { headers });
		if (!spRes.ok) {
			const t = await spRes.text();
			return json({ error: `SharePoint ${spRes.status}`, detail: safeText(t) }, spRes.status, corsHeaders(origin, allowed));
		}

		// Stream CSV through with proper headers and CORS
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
