/**
 * @file synthesis.js
 * @module service/synthesis
 * @summary Study-scoped synthesis endpoints backed by Airtable evidence and Worker KV synthesis state.
 *
 * Endpoints:
 * - GET    /api/synthesis/evidence?sid=<AirtableStudyId>
 * - GET    /api/synthesis?sid=<AirtableStudyId>
 * - POST   /api/synthesis/clusters?sid=<AirtableStudyId>
 * - PATCH  /api/synthesis/clusters/:id?sid=<AirtableStudyId>
 * - DELETE /api/synthesis/clusters/:id?sid=<AirtableStudyId>
 * - POST   /api/synthesis/themes?sid=<AirtableStudyId>
 */

import {
	fetchWithTimeout,
	safeText
} from "../core/utils.js";

const STUDY_FIELDS = {
	project_link: ["Project", "Projects"],
	study_id: ["Study ID", "StudyId", "Study ID (text)"],
	title: ["Title", "Name", "Study title"],
	method: ["Method"],
	status: ["Status"],
	description: ["Description"]
};

const SESSION_FIELDS = {
	study_link: ["Study ID", "Study", "Project Study"],
	starts_at: ["Starts at", "Start", "Session date"],
	status: ["Status"]
};

const NOTE_FIELDS = {
	session_link: ["Session"],
	participant_link: ["Participant"],
	study_lookup: ["Study ID", "Study", "Project Study"],
	note_plain: ["Note (plain)", "Note (text)", "Plain note"],
	note_rich: ["Note (rich)", "Note", "Content"],
	category: ["Category"],
	framework: ["Framework"],
	note_started_at: ["Note started at"],
	note_ended_at: ["Note ended at"],
	author_free_text: ["Author (free text)", "Author"],
	safeguarding_lookup: ["Safeguarding flag (copy)", "Safeguarding flag"]
};

function pick(fields, aliases) {
	for (const key of aliases) {
		if (Object.prototype.hasOwnProperty.call(fields || {}, key)) return fields[key];
	}
	return undefined;
}

function hasId(value, id) {
	if (!value || !id) return false;
	if (Array.isArray(value)) return value.includes(id);
	return String(value) === id;
}

function firstLink(value) {
	return Array.isArray(value) && value.length ? value[0] : "";
}

function stripHtml(value) {
	return String(value || "")
		.replace(/<br\s*\/?\>/gi, "\n")
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\s+/g, " ")
		.trim();
}

function truncate(value, length = 260) {
	const text = String(value || "").trim();
	return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function slugKey(value) {
	return encodeURIComponent(String(value || "").trim());
}

function synthesisKey(studyId) {
	return `rops:synthesis:study:${slugKey(studyId)}:state`;
}

function newId(prefix) {
	const suffix = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ?
		crypto.randomUUID() :
		`${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
	return `${prefix}_${suffix}`;
}

function nowIso() {
	return new Date().toISOString();
}

function baseHeaders(svc) {
	return { "Authorization": `Bearer ${svc.env.AIRTABLE_API_KEY || svc.env.AIRTABLE_PAT}` };
}

function airtableBase(svc, tableName) {
	const base = svc.env.AIRTABLE_BASE_ID || svc.env.AIRTABLE_BASE;
	return `https://api.airtable.com/v0/${base}/${encodeURIComponent(tableName)}`;
}

function hasAirtable(svc) {
	return Boolean((svc.env.AIRTABLE_BASE_ID || svc.env.AIRTABLE_BASE) && (svc.env.AIRTABLE_API_KEY || svc.env.AIRTABLE_PAT));
}

async function fetchAirtableRecords(svc, tableName) {
	const records = [];
	let offset;

	do {
		const params = new URLSearchParams({ pageSize: "100" });
		if (offset) params.set("offset", offset);

		const response = await fetchWithTimeout(`${airtableBase(svc, tableName)}?${params.toString()}`, {
			headers: baseHeaders(svc)
		}, svc.cfg.TIMEOUT_MS);
		const text = await response.text();

		if (!response.ok) {
			throw new Error(`Airtable ${response.status}: ${safeText(text)}`);
		}

		let body;
		try { body = JSON.parse(text); } catch { body = { records: [] }; }
		records.push(...(body.records || []));
		offset = body.offset;
	} while (offset);

	return records;
}

async function fetchAirtableRecord(svc, tableName, recordId) {
	const response = await fetchWithTimeout(`${airtableBase(svc, tableName)}/${encodeURIComponent(recordId)}`, {
		headers: baseHeaders(svc)
	}, svc.cfg.TIMEOUT_MS);
	const text = await response.text();

	if (!response.ok) {
		throw new Error(`Airtable ${response.status}: ${safeText(text)}`);
	}

	try { return JSON.parse(text); } catch { return null; }
}

async function getStudyContext(svc, studyId) {
	const fallback = {
		id: studyId,
		studyId: "",
		title: "Study",
		method: "",
		status: "",
		description: "",
		projectId: "",
		projectName: "Project"
	};

	if (!hasAirtable(svc) || !svc.env.AIRTABLE_TABLE_STUDIES) return fallback;

	try {
		const study = await fetchAirtableRecord(svc, svc.env.AIRTABLE_TABLE_STUDIES, studyId);
		const fields = study?.fields || {};
		const projectId = firstLink(pick(fields, STUDY_FIELDS.project_link));
		let projectName = fallback.projectName;

		if (projectId && svc.env.AIRTABLE_TABLE_PROJECTS) {
			try {
				const project = await fetchAirtableRecord(svc, svc.env.AIRTABLE_TABLE_PROJECTS, projectId);
				projectName = project?.fields?.Name || project?.fields?.Title || projectName;
			} catch (error) {
				svc.log.warn("synthesis.project_context.fail", { studyId, projectId, error: String(error?.message || error) });
			}
		}

		const title = pick(fields, STUDY_FIELDS.title) || pick(fields, STUDY_FIELDS.method) || "Study";

		return {
			id: study?.id || studyId,
			studyId: pick(fields, STUDY_FIELDS.study_id) || "",
			title,
			method: pick(fields, STUDY_FIELDS.method) || "",
			status: pick(fields, STUDY_FIELDS.status) || "",
			description: pick(fields, STUDY_FIELDS.description) || "",
			projectId,
			projectName
		};
	} catch (error) {
		svc.log.warn("synthesis.study_context.fail", { studyId, error: String(error?.message || error) });
		return fallback;
	}
}

async function listSessionIdsForStudy(svc, studyId) {
	if (!hasAirtable(svc) || !svc.env.AIRTABLE_TABLE_SESSIONS) return new Set();

	try {
		const records = await fetchAirtableRecords(svc, svc.env.AIRTABLE_TABLE_SESSIONS || "Sessions");
		return new Set(records
			.filter(record => hasId(pick(record.fields || {}, SESSION_FIELDS.study_link), studyId))
			.map(record => record.id));
	} catch (error) {
		svc.log.warn("synthesis.sessions.lookup.fail", { studyId, error: String(error?.message || error) });
		return new Set();
	}
}

function noteBelongsToStudy(note, studyId, studySessionIds) {
	const fields = note.fields || {};
	const studyValue = pick(fields, NOTE_FIELDS.study_lookup);
	if (hasId(studyValue, studyId)) return true;

	const sessionValue = pick(fields, NOTE_FIELDS.session_link);
	if (!Array.isArray(sessionValue)) return false;
	return sessionValue.some(sessionId => studySessionIds.has(sessionId));
}

function noteTags(fields) {
	const tags = [];
	const category = pick(fields, NOTE_FIELDS.category);
	const framework = pick(fields, NOTE_FIELDS.framework);
	const safeguarding = pick(fields, NOTE_FIELDS.safeguarding_lookup);

	if (category) tags.push(String(category));
	if (framework && String(framework).toLowerCase() !== "none") tags.push(String(framework));
	if (safeguarding) tags.push("Safeguarding");

	return [...new Set(tags.map(tag => tag.trim()).filter(Boolean))];
}

function noteToEvidence(note, studyId) {
	const fields = note.fields || {};
	const plain = pick(fields, NOTE_FIELDS.note_plain);
	const rich = pick(fields, NOTE_FIELDS.note_rich);
	const content = stripHtml(plain || rich || "");
	const sessionId = firstLink(pick(fields, NOTE_FIELDS.session_link));
	const participantId = firstLink(pick(fields, NOTE_FIELDS.participant_link));
	const startedAt = pick(fields, NOTE_FIELDS.note_started_at) || note.createdTime || "";

	return {
		id: note.id,
		studyId,
		sessionId,
		participantId,
		excerpt: truncate(content),
		contentPlain: content,
		tags: noteTags(fields),
		category: pick(fields, NOTE_FIELDS.category) || "",
		framework: pick(fields, NOTE_FIELDS.framework) || "",
		author: pick(fields, NOTE_FIELDS.author_free_text) || "",
		createdAt: note.createdTime || "",
		startedAt,
		endedAt: pick(fields, NOTE_FIELDS.note_ended_at) || "",
		sourceLabel: sessionId ? `Session ${sessionId}` : "Session note"
	};
}

async function listEvidenceForStudy(svc, studyId) {
	if (!hasAirtable(svc) || !svc.env.AIRTABLE_TABLE_SESSION_NOTES) return [];

	const studySessionIds = await listSessionIdsForStudy(svc, studyId);
	const notes = await fetchAirtableRecords(svc, svc.env.AIRTABLE_TABLE_SESSION_NOTES || "Session Notes");

	return notes
		.filter(note => noteBelongsToStudy(note, studyId, studySessionIds))
		.map(note => noteToEvidence(note, studyId))
		.sort((a, b) => String(a.startedAt || a.createdAt).localeCompare(String(b.startedAt || b.createdAt)));
}

function emptySynthesisState() {
	return {
		clusters: [],
		themes: []
	};
}

async function readSynthesisState(svc, studyId) {
	if (!svc.env.SESSION_KV || typeof svc.env.SESSION_KV.get !== "function") {
		throw new Error("SESSION_KV binding is not configured");
	}

	const raw = await svc.env.SESSION_KV.get(synthesisKey(studyId));
	if (!raw) return emptySynthesisState();

	try {
		const parsed = JSON.parse(raw);
		return {
			clusters: Array.isArray(parsed.clusters) ? parsed.clusters : [],
			themes: Array.isArray(parsed.themes) ? parsed.themes : []
		};
	} catch {
		return emptySynthesisState();
	}
}

async function writeSynthesisState(svc, studyId, state) {
	if (!svc.env.SESSION_KV || typeof svc.env.SESSION_KV.put !== "function") {
		throw new Error("SESSION_KV binding is not configured");
	}

	await svc.env.SESSION_KV.put(synthesisKey(studyId), JSON.stringify({
		clusters: Array.isArray(state.clusters) ? state.clusters : [],
		themes: Array.isArray(state.themes) ? state.themes : [],
		updatedAt: nowIso()
	}));
}

function requireStudyId(url) {
	return url.searchParams.get("sid") || url.searchParams.get("study") || "";
}

async function parseJsonRequest(request, maxBytes) {
	const body = await request.arrayBuffer();
	if (body.byteLength > maxBytes) {
		const error = new Error("Payload too large");
		error.status = 413;
		throw error;
	}

	try {
		return JSON.parse(new TextDecoder().decode(body));
	} catch {
		const error = new Error("Invalid JSON");
		error.status = 400;
		throw error;
	}
}

function errorResponse(svc, origin, error, fallbackStatus = 500) {
	return svc.json({
		ok: false,
		error: String(error?.message || error)
	}, error?.status || fallbackStatus, svc.corsHeaders(origin));
}

async function validateEvidenceIds(svc, origin, studyId, evidenceIds) {
	const requested = [...new Set((evidenceIds || []).map(id => String(id || "").trim()).filter(Boolean))];
	if (!requested.length) return { ok: true, evidenceIds: [] };

	const evidence = await listEvidenceForStudy(svc, studyId);
	const allowed = new Set(evidence.map(item => item.id));
	const invalid = requested.filter(id => !allowed.has(id));

	if (invalid.length) {
		return {
			ok: false,
			response: svc.json({ ok: false, error: "Evidence does not belong to this study", invalidEvidenceIds: invalid }, 400, svc.corsHeaders(origin))
		};
	}

	return { ok: true, evidenceIds: requested };
}

export async function listSynthesisEvidence(svc, origin, url) {
	const studyId = requireStudyId(url);
	if (!studyId) return svc.json({ ok: false, error: "Missing sid query" }, 400, svc.corsHeaders(origin));

	try {
		const [study, evidence] = await Promise.all([
			getStudyContext(svc, studyId),
			listEvidenceForStudy(svc, studyId)
		]);

		return svc.json({ ok: true, study, evidence }, 200, svc.corsHeaders(origin));
	} catch (error) {
		return errorResponse(svc, origin, error, 502);
	}
}

export async function listSynthesis(svc, origin, url) {
	const studyId = requireStudyId(url);
	if (!studyId) return svc.json({ ok: false, error: "Missing sid query" }, 400, svc.corsHeaders(origin));

	try {
		const [study, state] = await Promise.all([
			getStudyContext(svc, studyId),
			readSynthesisState(svc, studyId)
		]);

		return svc.json({ ok: true, study, ...state }, 200, svc.corsHeaders(origin));
	} catch (error) {
		return errorResponse(svc, origin, error, 503);
	}
}

export async function createSynthesisCluster(svc, request, origin, url) {
	const studyId = requireStudyId(url);
	if (!studyId) return svc.json({ ok: false, error: "Missing sid query" }, 400, svc.corsHeaders(origin));

	try {
		const payload = await parseJsonRequest(request, svc.cfg.MAX_BODY_BYTES);
		const label = String(payload.label || "").trim();
		if (!label) return svc.json({ ok: false, error: "Cluster label is required" }, 400, svc.corsHeaders(origin));

		const validation = await validateEvidenceIds(svc, origin, studyId, payload.evidenceIds || []);
		if (!validation.ok) return validation.response;

		const [study, state] = await Promise.all([
			getStudyContext(svc, studyId),
			readSynthesisState(svc, studyId)
		]);
		const createdAt = nowIso();
		const cluster = {
			id: newId("cluster"),
			projectId: study.projectId || "",
			studyId,
			label,
			description: String(payload.description || "").trim(),
			evidenceIds: validation.evidenceIds,
			status: "working",
			createdAt,
			updatedAt: createdAt
		};

		state.clusters.push(cluster);
		await writeSynthesisState(svc, studyId, state);

		return svc.json({ ok: true, cluster }, 201, svc.corsHeaders(origin));
	} catch (error) {
		return errorResponse(svc, origin, error);
	}
}

export async function updateSynthesisCluster(svc, request, origin, url, clusterId) {
	const studyId = requireStudyId(url);
	if (!studyId) return svc.json({ ok: false, error: "Missing sid query" }, 400, svc.corsHeaders(origin));
	if (!clusterId) return svc.json({ ok: false, error: "Missing cluster id" }, 400, svc.corsHeaders(origin));

	try {
		const payload = await parseJsonRequest(request, svc.cfg.MAX_BODY_BYTES);
		const state = await readSynthesisState(svc, studyId);
		const index = state.clusters.findIndex(cluster => cluster.id === clusterId && cluster.studyId === studyId);
		if (index < 0) return svc.json({ ok: false, error: "Cluster not found" }, 404, svc.corsHeaders(origin));

		let evidenceIds = state.clusters[index].evidenceIds || [];
		if (Array.isArray(payload.evidenceIds)) {
			const validation = await validateEvidenceIds(svc, origin, studyId, payload.evidenceIds);
			if (!validation.ok) return validation.response;
			evidenceIds = validation.evidenceIds;
		}

		state.clusters[index] = {
			...state.clusters[index],
			label: typeof payload.label === "string" && payload.label.trim() ? payload.label.trim() : state.clusters[index].label,
			description: typeof payload.description === "string" ? payload.description.trim() : state.clusters[index].description,
			evidenceIds,
			updatedAt: nowIso()
		};

		await writeSynthesisState(svc, studyId, state);
		return svc.json({ ok: true, cluster: state.clusters[index] }, 200, svc.corsHeaders(origin));
	} catch (error) {
		return errorResponse(svc, origin, error);
	}
}

export async function deleteSynthesisCluster(svc, origin, url, clusterId) {
	const studyId = requireStudyId(url);
	if (!studyId) return svc.json({ ok: false, error: "Missing sid query" }, 400, svc.corsHeaders(origin));
	if (!clusterId) return svc.json({ ok: false, error: "Missing cluster id" }, 400, svc.corsHeaders(origin));

	try {
		const state = await readSynthesisState(svc, studyId);
		const before = state.clusters.length;
		state.clusters = state.clusters.filter(cluster => !(cluster.id === clusterId && cluster.studyId === studyId));

		if (state.clusters.length === before) {
			return svc.json({ ok: false, error: "Cluster not found" }, 404, svc.corsHeaders(origin));
		}

		await writeSynthesisState(svc, studyId, state);
		return svc.json({ ok: true }, 200, svc.corsHeaders(origin));
	} catch (error) {
		return errorResponse(svc, origin, error);
	}
}

export async function createSynthesisTheme(svc, request, origin, url) {
	const studyId = requireStudyId(url);
	if (!studyId) return svc.json({ ok: false, error: "Missing sid query" }, 400, svc.corsHeaders(origin));

	try {
		const payload = await parseJsonRequest(request, svc.cfg.MAX_BODY_BYTES);
		const label = String(payload.label || "").trim();
		if (!label) return svc.json({ ok: false, error: "Theme label is required" }, 400, svc.corsHeaders(origin));

		const [study, state] = await Promise.all([
			getStudyContext(svc, studyId),
			readSynthesisState(svc, studyId)
		]);
		const sourceCluster = payload.clusterId ? state.clusters.find(cluster => cluster.id === payload.clusterId && cluster.studyId === studyId) : null;
		const candidateEvidenceIds = Array.isArray(payload.evidenceIds) && payload.evidenceIds.length ? payload.evidenceIds : sourceCluster?.evidenceIds || [];

		if (!candidateEvidenceIds.length) {
			return svc.json({ ok: false, error: "A theme needs at least one source evidence item" }, 400, svc.corsHeaders(origin));
		}

		const validation = await validateEvidenceIds(svc, origin, studyId, candidateEvidenceIds);
		if (!validation.ok) return validation.response;

		const createdAt = nowIso();
		const theme = {
			id: newId("theme"),
			projectId: study.projectId || "",
			studyId,
			label,
			description: String(payload.description || "").trim(),
			evidenceIds: validation.evidenceIds,
			sourceClusterId: sourceCluster?.id || payload.clusterId || "",
			status: "created",
			createdAt,
			updatedAt: createdAt
		};

		state.themes.push(theme);
		await writeSynthesisState(svc, studyId, state);

		return svc.json({ ok: true, theme }, 201, svc.corsHeaders(origin));
	} catch (error) {
		return errorResponse(svc, origin, error);
	}
}
