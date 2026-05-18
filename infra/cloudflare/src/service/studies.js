import { fetchWithTimeout, mdToAirtableRich, safeText, toMs } from "../core/utils.js";

const CACHE_SQL = "CREATE TABLE IF NOT EXISTS rops_studies_cache (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, study_id TEXT, title TEXT, method TEXT, status TEXT, description TEXT, created_at TEXT, active INTEGER NOT NULL DEFAULT 1, source TEXT NOT NULL DEFAULT 'airtable', updated_at TEXT NOT NULL, payload_json TEXT)";
const PROJECT_LINK_FIELDS = ["Project", "Projects", "Project ID", "Project IDs", "Project Record ID", "Project Link", "Linked Project"];

function isRec(value) {
	return /^rec[a-zA-Z0-9]{14,}$/.test(String(value || "").trim());
}

function text(value) {
	if (Array.isArray(value)) return value.map(text).filter(Boolean).join(", ");
	if (value && typeof value === "object") return text(value.name || value.Name || value.label || value.value || value.id || "");
	return String(value || "").trim();
}

function idsFrom(value) {
	if (Array.isArray(value)) return value.flatMap(idsFrom).filter(isRec);
	if (value && typeof value === "object") return idsFrom([value.id, value.recordId, value.airtableId, value.name]);
	return String(value || "").split(/\r?\n|[|,]/).map((item) => item.trim()).filter(isRec);
}

function projectIds(fields = {}) {
	return Array.from(new Set(PROJECT_LINK_FIELDS.flatMap((name) => idsFrom(fields[name]))));
}

function first(fields = {}, names = []) {
	for (const name of names) if (Object.prototype.hasOwnProperty.call(fields, name)) return fields[name];
	return "";
}

function studyFromRecord(record = {}, projectId = "") {
	const fields = record.fields || {};
	const links = projectIds(fields);
	const id = isRec(record.id) ? record.id : "";
	return {
		id,
		airtableId: id,
		recordId: id,
		projectId: projectId || links[0] || "",
		projectIds: links,
		studyId: text(first(fields, ["Study ID", "StudyId"])),
		title: text(first(fields, ["Title", "Name", "Study Name"])),
		method: text(first(fields, ["Method", "Research Method", "Type"])),
		status: text(first(fields, ["Status", "State"])),
		description: text(first(fields, ["Description", "Summary", "Notes"])),
		createdAt: text(record.createdTime || first(fields, ["CreatedAt", "Created At"])),
	};
}

function studyFromRow(row = {}) {
	let cached = null;
	try {
		cached = row.payload_json ? JSON.parse(row.payload_json) : null;
	} catch {
		cached = null;
	}
	if (cached && typeof cached === "object") {
		const id = text(row.id || cached.id || cached.airtableId || cached.recordId);
		const projectId = text(row.project_id || cached.projectId);
		return { ...cached, id, airtableId: id, recordId: id, projectId, projectIds: [projectId].filter(Boolean) };
	}
	const id = text(row.id);
	const projectId = text(row.project_id);
	return {
		id,
		airtableId: id,
		recordId: id,
		projectId,
		projectIds: [projectId].filter(Boolean),
		studyId: text(row.study_id),
		title: text(row.title),
		method: text(row.method),
		status: text(row.status),
		description: text(row.description),
		createdAt: text(row.created_at || row.updated_at),
	};
}

function renderable(study) {
	return isRec(study?.id) && isRec(study?.projectId);
}

async function ensureCache(db) {
	await db.prepare(CACHE_SQL).run();
	try {
		await db.prepare("ALTER TABLE rops_studies_cache ADD COLUMN payload_json TEXT").run();
	} catch {
		/* already present */
	}
}

async function readCache(svc, projectId) {
	const db = svc.env.RESEARCHOPS_D1;
	if (!db?.prepare) throw new Error("RESEARCHOPS_D1 binding not available");
	await ensureCache(db);
	const result = await db.prepare("SELECT * FROM rops_studies_cache WHERE active = 1 AND project_id = ? ORDER BY created_at DESC, updated_at DESC").bind(projectId).all();
	const rows = result?.results || [];
	const studies = rows.map(studyFromRow).filter(renderable);
	return { studies, activeCount: rows.length, invalidCount: Math.max(rows.length - studies.length, 0) };
}

async function writeCache(svc, projectId, studies) {
	const db = svc.env.RESEARCHOPS_D1;
	if (!db?.prepare || !isRec(projectId)) return;
	await ensureCache(db);
	await db.prepare("UPDATE rops_studies_cache SET active = 0 WHERE project_id = ? AND source = 'airtable'").bind(projectId).run();
	const updatedAt = new Date().toISOString();
	for (const study of studies.filter(renderable)) {
		await db.prepare("INSERT INTO rops_studies_cache (id, project_id, study_id, title, method, status, description, created_at, active, source, updated_at, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'airtable', ?, ?) ON CONFLICT(id) DO UPDATE SET project_id = excluded.project_id, study_id = excluded.study_id, title = excluded.title, method = excluded.method, status = excluded.status, description = excluded.description, created_at = excluded.created_at, active = 1, source = excluded.source, updated_at = excluded.updated_at, payload_json = excluded.payload_json")
			.bind(study.id, projectId, study.studyId || "", study.title || "", study.method || "", study.status || "", study.description || "", study.createdAt || "", updatedAt, JSON.stringify(study))
			.run();
	}
}

function sourceHeaders(source, warning = "") {
	return { "x-rops-studies-source": source, ...(warning ? { "x-rops-upstream-warning": warning } : {}) };
}

function safeHeaders(response) {
	const retryAfter = response.headers.get("retry-after") || "";
	return retryAfter ? { retryAfter } : {};
}

async function airtableRecords(svc) {
	const table = encodeURIComponent(svc.env.AIRTABLE_TABLE_STUDIES);
	const records = [];
	let offset = "";
	do {
		const params = new URLSearchParams({ pageSize: "100" });
		if (offset) params.set("offset", offset);
		const response = await fetchWithTimeout(`https://api.airtable.com/v0/${svc.env.AIRTABLE_BASE_ID}/${table}?${params.toString()}`, { headers: { Authorization: `Bearer ${svc.env.AIRTABLE_API_KEY}`, Accept: "application/json" } }, svc.cfg.TIMEOUT_MS);
		const body = await response.text();
		let json = {};
		try {
			json = body ? JSON.parse(body) : {};
		} catch {
			json = {};
		}
		if (!response.ok) {
			throw Object.assign(new Error(json?.error?.message || json?.error?.type || `airtable_http_${response.status}`), {
				status: response.status,
				errorType: json?.error?.type || "",
				errorMessage: json?.error?.message || "",
				headers: safeHeaders(response),
			});
		}
		records.push(...(Array.isArray(json.records) ? json.records : []));
		offset = json.offset || "";
	} while (offset);
	return records;
}

function airtableSource(error) {
	return { source: "airtable", message: String(error?.message || error), status: error?.status || 0, errorType: error?.errorType || "", errorMessage: error?.errorMessage || "", headers: error?.headers || {} };
}

export async function createStudy(svc, request, origin) {
	const body = await request.arrayBuffer();
	if (body.byteLength > svc.cfg.MAX_BODY_BYTES) return svc.json({ error: "Payload too large" }, 413, svc.corsHeaders(origin));
	let payload;
	try {
		payload = JSON.parse(new TextDecoder().decode(body));
	} catch {
		return svc.json({ error: "Invalid JSON" }, 400, svc.corsHeaders(origin));
	}
	const errs = [];
	if (!payload.project_airtable_id) errs.push("project_airtable_id");
	if (!payload.method) errs.push("method");
	if (!payload.description) errs.push("description");
	if (errs.length) return svc.json({ error: "Missing required fields: " + errs.join(", ") }, 400, svc.corsHeaders(origin));
	if (!isRec(payload.project_airtable_id)) return svc.json({ ok: false, error: "invalid_project_id" }, 400, svc.corsHeaders(origin));
	const fields = { Project: [payload.project_airtable_id], Title: payload.title || undefined, Method: payload.method, Description: mdToAirtableRich(payload.description || ""), Status: payload.status || undefined, "Study ID": payload.study_id || undefined };
	for (const key of Object.keys(fields)) if (fields[key] === undefined || fields[key] === "") delete fields[key];
	const response = await fetchWithTimeout(`https://api.airtable.com/v0/${svc.env.AIRTABLE_BASE_ID}/${encodeURIComponent(svc.env.AIRTABLE_TABLE_STUDIES)}`, { method: "POST", headers: { Authorization: `Bearer ${svc.env.AIRTABLE_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ records: [{ fields }] }) }, svc.cfg.TIMEOUT_MS);
	const textBody = await response.text();
	if (!response.ok) return svc.json({ error: `Airtable ${response.status}`, detail: safeText(textBody) }, response.status, svc.corsHeaders(origin));
	let json = {};
	try {
		json = JSON.parse(textBody);
	} catch {
		json = { records: [] };
	}
	const record = json.records?.[0];
	const studyId = record?.id;
	if (!studyId) return svc.json({ error: "Airtable response missing study id" }, 502, svc.corsHeaders(origin));
	await writeCache(svc, payload.project_airtable_id, [studyFromRecord(record, payload.project_airtable_id)]).catch(() => {});
	return svc.json({ ok: true, study_id: studyId, csv_ok: false, csv_error: "CSV mirror disabled for study writes on this route" }, 200, svc.corsHeaders(origin));
}

export async function listStudies(svc, origin, url) {
	const projectId = url.searchParams.get("project") || "";
	const refresh = url.searchParams.get("refresh") === "1";
	const sources = [];
	let cached = null;
	if (!projectId) return svc.json({ ok: false, error: "Missing project query" }, 400, { ...svc.corsHeaders(origin), ...sourceHeaders("none") });
	if (!isRec(projectId)) return svc.json({ ok: false, error: "invalid_project_id", detail: "Project must be an Airtable record ID beginning rec." }, 400, { ...svc.corsHeaders(origin), ...sourceHeaders("none") });
	if (!refresh) {
		try {
			cached = await readCache(svc, projectId);
			if (cached.studies.length) return svc.json({ ok: true, studies: cached.studies }, 200, { ...svc.corsHeaders(origin), ...sourceHeaders("d1") });
		} catch (error) {
			sources.push({ source: "d1", message: String(error?.message || error) });
		}
	}
	try {
		const missing = ["AIRTABLE_BASE_ID", "AIRTABLE_TABLE_STUDIES", "AIRTABLE_API_KEY"].filter((key) => !svc.env[key]);
		if (missing.length) throw Object.assign(new Error(`Missing env: ${missing.join(", ")}`), { missing });
		const records = await airtableRecords(svc);
		const studies = records.map((record) => studyFromRecord(record)).filter((study) => study.projectIds.includes(projectId)).map((study) => ({ ...study, projectId })).filter(renderable).sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
		await writeCache(svc, projectId, studies).catch((error) => svc.log.warn("d1.studies.cache.sync.fail", { err: String(error?.message || error) }));
		return svc.json({ ok: true, studies }, 200, { ...svc.corsHeaders(origin), ...sourceHeaders("airtable") });
	} catch (error) {
		sources.push(airtableSource(error));
	}
	try {
		cached = cached || (await readCache(svc, projectId));
		if (cached.studies.length) return svc.json({ ok: true, studies: cached.studies }, 200, { ...svc.corsHeaders(origin), ...sourceHeaders("d1", sources.find((source) => source.source === "airtable")?.message || "") });
		if (!sources.some((source) => source.source === "d1")) sources.push({ source: "d1", message: "Study cache is empty for this project", activeStudyCount: cached.activeCount, invalidStudyCount: cached.invalidCount });
	} catch (error) {
		sources.push({ source: "d1", message: String(error?.message || error) });
	}
	return svc.json({ ok: false, error: "studies_unavailable", detail: "No Airtable or D1 study source is available for this project. CSV fallback is intentionally disabled.", projectId, sources }, 503, { ...svc.corsHeaders(origin), ...sourceHeaders("none") });
}

export async function diagnoseProjectLinkedRecords(svc, origin, url, authContext = {}) {
	const projectId = url.searchParams.get("project") || "";
	if (!projectId) return svc.json({ ok: false, error: "Missing project query" }, 400, svc.corsHeaders(origin));
	if (!isRec(projectId)) return svc.json({ ok: false, error: "invalid_project_id" }, 400, svc.corsHeaders(origin));
	let d1 = { bindingPresent: Boolean(svc.env.RESEARCHOPS_D1), cacheTablePresent: false, activeStudyCount: 0, validStudyCount: 0, invalidStudyCount: 0 };
	try {
		const snapshot = await readCache(svc, projectId);
		d1 = { bindingPresent: true, cacheTablePresent: true, activeStudyCount: snapshot.activeCount, validStudyCount: snapshot.studies.length, invalidStudyCount: snapshot.invalidCount };
	} catch (error) {
		d1 = { ...d1, message: String(error?.message || error) };
	}
	let airtable = { configured: false, table: svc.env.AIRTABLE_TABLE_STUDIES || "Project Studies", totalRecordCount: 0, linkedRecordCount: 0 };
	try {
		const records = await airtableRecords(svc);
		const linked = records.map((record) => studyFromRecord(record)).filter((study) => study.projectIds.includes(projectId));
		airtable = { configured: true, table: svc.env.AIRTABLE_TABLE_STUDIES, status: 200, totalRecordCount: records.length, linkedRecordCount: linked.length, fieldNames: Array.from(new Set(records.flatMap((record) => Object.keys(record.fields || {})))).sort(), projectLinkFieldCandidates: PROJECT_LINK_FIELDS };
	} catch (error) {
		airtable = { configured: Boolean(svc.env.AIRTABLE_BASE_ID && svc.env.AIRTABLE_TABLE_STUDIES && svc.env.AIRTABLE_API_KEY), table: svc.env.AIRTABLE_TABLE_STUDIES || "Project Studies", status: error?.status || 0, message: String(error?.message || error), errorType: error?.errorType || "", errorMessage: error?.errorMessage || "", headers: error?.headers || {}, totalRecordCount: 0, linkedRecordCount: 0, projectLinkFieldCandidates: PROJECT_LINK_FIELDS };
	}
	return svc.json({ ok: airtable.linkedRecordCount > 0 || d1.validStudyCount > 0, route: "/api/_diag/project-linked-records", projectId, auth: { authenticated: true, userIdPresent: Boolean(authContext?.user?.id || authContext?.userId), activeTeamPresent: Boolean(authContext?.activeTeam) }, studies: { airtable, d1 } }, 200, svc.corsHeaders(origin));
}

export async function updateStudy(svc, request, origin, studyId) {
	if (!studyId) return svc.json({ error: "Missing study id" }, 400, svc.corsHeaders(origin));
	const body = await request.arrayBuffer();
	if (body.byteLength > svc.cfg.MAX_BODY_BYTES) return svc.json({ error: "Payload too large" }, 413, svc.corsHeaders(origin));
	let payload;
	try {
		payload = JSON.parse(new TextDecoder().decode(body));
	} catch {
		return svc.json({ error: "Invalid JSON" }, 400, svc.corsHeaders(origin));
	}
	const fields = { Title: payload.title || undefined, Description: typeof payload.description === "string" ? mdToAirtableRich(payload.description) : undefined, Method: payload.method || undefined, Status: payload.status || undefined, "Study ID": payload.study_id || undefined };
	for (const key of Object.keys(fields)) if (fields[key] === undefined || fields[key] === "") delete fields[key];
	if (!Object.keys(fields).length) return svc.json({ error: "No updatable fields provided" }, 400, svc.corsHeaders(origin));
	const response = await fetchWithTimeout(`https://api.airtable.com/v0/${svc.env.AIRTABLE_BASE_ID}/${encodeURIComponent(svc.env.AIRTABLE_TABLE_STUDIES)}`, { method: "PATCH", headers: { Authorization: `Bearer ${svc.env.AIRTABLE_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ records: [{ id: studyId, fields }] }) }, svc.cfg.TIMEOUT_MS);
	const bodyText = await response.text();
	if (!response.ok) return svc.json({ error: `Airtable ${response.status}`, detail: safeText(bodyText) }, response.status, svc.corsHeaders(origin));
	return svc.json({ ok: true }, 200, svc.corsHeaders(origin));
}
