import { d1All, d1Get, d1Run } from "./internals/researchops-d1.js";

const ARTEFACTS_TABLE = "rops_repository_artefacts";
const TAGS_TABLE = "rops_repository_artefact_tags";
const AUDIT_TABLE = "rops_repository_audit";
const AIRTABLE_PAGE_SIZE = 100;
const MAX_AIRTABLE_PAGES = 10;

function hasD1(svc) {
	return Boolean(svc?.env?.RESEARCHOPS_D1?.prepare);
}

function cleanText(value) {
	return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanSlug(value) {
	return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function clampLimit(value) {
	const parsed = Number.parseInt(String(value || ""), 10);
	if (!Number.isFinite(parsed)) return 20;
	return Math.max(1, Math.min(parsed, 50));
}

function newCandidateId() {
	const suffix = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ?
		crypto.randomUUID() :
		`${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
	return `candidate-${suffix}`;
}

function permissionCodesFor(authContext = {}) {
	return new Set((authContext.permissions || []).map((permission) => permission.code).filter(Boolean));
}

function canCurate(authContext = {}) {
	return permissionCodesFor(authContext).has("repository.curate");
}

function parseJson(value, fallback) {
	if (!value) return fallback;
	try {
		const parsed = JSON.parse(String(value));
		return parsed ?? fallback;
	} catch {
		return fallback;
	}
}

function payloadText(payload = {}, key, fallback = "") {
	return cleanText(payload[key] ?? fallback);
}

function airtableTableName(svc) {
	return svc?.env?.AIRTABLE_TABLE_REPOSITORY_ARTEFACTS || svc?.env?.AIRTABLE_TABLE_REPOSITORY || "Repository Artefacts";
}

function hasAirtable(svc) {
	return Boolean(svc?.env?.AIRTABLE_BASE_ID && svc?.env?.AIRTABLE_API_KEY && airtableTableName(svc));
}

function firstField(fields = {}, names = [], fallback = "") {
	for (const name of names) {
		const value = fields[name];
		if (value !== undefined && value !== null && value !== "") return value;
	}
	return fallback;
}

function textField(fields = {}, names = [], fallback = "") {
	const value = firstField(fields, names, fallback);
	if (Array.isArray(value)) return value.map((item) => cleanText(item?.name || item)).filter(Boolean).join(", ");
	if (value && typeof value === "object") return cleanText(value.name || value.label || value.text || fallback);
	return cleanText(value);
}

function boolField(fields = {}, names = [], fallback = false) {
	const value = firstField(fields, names, fallback);
	if (typeof value === "boolean") return value;
	if (typeof value === "number") return value === 1;
	return ["true", "yes", "y", "1", "cleared", "confirmed"].includes(cleanText(value).toLowerCase());
}

function splitTags(value) {
	if (Array.isArray(value)) return value.flatMap(splitTags);
	return String(value || "")
		.split(/\r?\n|[,|]/)
		.map(cleanText)
		.filter(Boolean);
}

async function airtableJson(svc, url) {
	const response = await fetch(url, {
		headers: {
			Authorization: `Bearer ${svc.env.AIRTABLE_API_KEY}`,
			Accept: "application/json"
		}
	});
	const text = await response.text();
	let data = {};
	try {
		data = text ? JSON.parse(text) : {};
	} catch {
		data = {};
	}
	if (!response.ok) {
		throw Object.assign(new Error(data?.error?.message || data?.error?.type || `airtable_http_${response.status}`), {
			status: response.status
		});
	}
	return data;
}

async function airtableRecords(svc, tableName, searchParams = new URLSearchParams()) {
	if (!hasAirtable(svc)) throw Object.assign(new Error("Airtable repository source is not configured"), { source: "airtable" });
	const table = encodeURIComponent(tableName);
	const records = [];
	let offset = "";
	let page = 0;

	do {
		const params = new URLSearchParams(searchParams);
		params.set("pageSize", String(AIRTABLE_PAGE_SIZE));
		if (offset) params.set("offset", offset);
		const data = await airtableJson(svc, `https://api.airtable.com/v0/${svc.env.AIRTABLE_BASE_ID}/${table}?${params.toString()}`);
		records.push(...(Array.isArray(data.records) ? data.records : []));
		offset = data.offset || "";
		page += 1;
	} while (offset && page < MAX_AIRTABLE_PAGES);

	return records;
}

async function ensureTables(svc) {
	if (!hasD1(svc)) throw new Error("RESEARCHOPS_D1 binding not available");
	await d1Run(svc.env, `
		CREATE TABLE IF NOT EXISTS ${ARTEFACTS_TABLE} (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL,
			summary TEXT NOT NULL,
			artefact_type TEXT NOT NULL,
			status TEXT NOT NULL,
			confidence TEXT NOT NULL,
			evidence_maturity TEXT NOT NULL,
			service_area TEXT,
			user_group TEXT,
			method TEXT,
			risk_area TEXT,
			source_project_id TEXT,
			source_study_id TEXT,
			source_method TEXT,
			sample_summary TEXT,
			limitations TEXT,
			reuse_guidance TEXT,
			do_not_use_for TEXT,
			owner_user_id TEXT,
			reviewed_by_user_id TEXT,
			pii_cleared INTEGER NOT NULL DEFAULT 0,
			consent_scope_confirmed INTEGER NOT NULL DEFAULT 0,
			active INTEGER NOT NULL DEFAULT 1,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			published_at TEXT,
			review_due_at TEXT,
			payload_json TEXT
		)
	`);
	await d1Run(svc.env, `
		CREATE TABLE IF NOT EXISTS ${TAGS_TABLE} (
			artefact_id TEXT NOT NULL,
			tag_slug TEXT NOT NULL,
			tag_label TEXT NOT NULL,
			tag_type TEXT NOT NULL DEFAULT 'tag',
			PRIMARY KEY (artefact_id, tag_slug)
		)
	`);
	await d1Run(svc.env, `
		CREATE TABLE IF NOT EXISTS ${AUDIT_TABLE} (
			id TEXT PRIMARY KEY,
			artefact_id TEXT,
			action TEXT NOT NULL,
			actor_user_id TEXT,
			created_at TEXT NOT NULL,
			payload_json TEXT
		)
	`);
	await d1Run(svc.env, `CREATE INDEX IF NOT EXISTS idx_repository_artefacts_status ON ${ARTEFACTS_TABLE} (status, active, published_at)`);
	await d1Run(svc.env, `CREATE INDEX IF NOT EXISTS idx_repository_artefacts_review ON ${ARTEFACTS_TABLE} (status, review_due_at)`);
	await d1Run(svc.env, `CREATE INDEX IF NOT EXISTS idx_repository_artefacts_facets ON ${ARTEFACTS_TABLE} (method, evidence_maturity, service_area, user_group, risk_area)`);
	await d1Run(svc.env, `CREATE INDEX IF NOT EXISTS idx_repository_tags_type ON ${TAGS_TABLE} (tag_type, tag_slug)`);
}

function publicWhere() {
	return [
		"status = 'published'",
		"active = 1",
		"pii_cleared = 1",
		"consent_scope_confirmed = 1"
	];
}

function appendSearchFilters(where, params, url) {
	const q = cleanText(url.searchParams.get("q"));
	const method = cleanSlug(url.searchParams.get("method"));
	const maturity = cleanSlug(url.searchParams.get("maturity"));
	const serviceArea = cleanSlug(url.searchParams.get("service_area"));
	const userGroup = cleanSlug(url.searchParams.get("user_group"));
	const riskArea = cleanSlug(url.searchParams.get("risk_area"));

	if (q) {
		where.push(`LOWER(COALESCE(title, '') || ' ' || COALESCE(summary, '') || ' ' || COALESCE(service_area, '') || ' ' || COALESCE(user_group, '') || ' ' || COALESCE(method, '') || ' ' || COALESCE(risk_area, '')) LIKE ?`);
		params.push(`%${q.toLowerCase()}%`);
	}
	if (method) {
		where.push("method = ?");
		params.push(method);
	}
	if (maturity) {
		where.push("evidence_maturity = ?");
		params.push(maturity);
	}
	if (serviceArea) {
		where.push("service_area = ?");
		params.push(serviceArea);
	}
	if (userGroup) {
		where.push("user_group = ?");
		params.push(userGroup);
	}
	if (riskArea) {
		where.push("risk_area = ?");
		params.push(riskArea);
	}
}

function tagClassFor(type, value) {
	if (type === "confidence" && value === "high") return "govuk-tag--green";
	if (type === "confidence" && value === "medium") return "govuk-tag--yellow";
	if (type === "confidence" && value === "low") return "govuk-tag--orange";
	if (type === "maturity") return "govuk-tag--blue";
	return "govuk-tag--grey";
}

function rowToArtefact(row, tags = []) {
	return {
		id: row.id,
		title: row.title,
		summary: row.summary,
		href: `/pages/repository/artefacts/?id=${encodeURIComponent(row.id)}`,
		artefactType: row.artefact_type,
		confidence: row.confidence,
		evidenceMaturity: row.evidence_maturity,
		serviceArea: row.service_area || "",
		userGroup: row.user_group || "",
		method: row.method || "",
		riskArea: row.risk_area || "",
		publishedAt: row.published_at || "",
		reviewDueAt: row.review_due_at || "",
		provenance: {
			projectId: row.source_project_id || "",
			studyId: row.source_study_id || "",
			method: row.source_method || row.method || "",
			sample: row.sample_summary || ""
		},
		limits: {
			limitations: row.limitations || "",
			reuseGuidance: row.reuse_guidance || "",
			doNotUseFor: row.do_not_use_for || ""
		},
		tags: [
			{ text: `${row.confidence} confidence`, classes: tagClassFor("confidence", row.confidence) },
			{ text: row.evidence_maturity, classes: tagClassFor("maturity", row.evidence_maturity) },
			...tags.map((tag) => ({ text: tag.tag_label, classes: tagClassFor(tag.tag_type, tag.tag_slug) }))
		]
	};
}

function airtableRecordToArtefact(record = {}) {
	const fields = record.fields || {};
	const confidence = cleanSlug(textField(fields, ["Confidence", "confidence"], "medium")) || "medium";
	const maturity = cleanSlug(textField(fields, ["Evidence maturity", "Maturity", "evidence_maturity"], "reviewed-evidence")) || "reviewed-evidence";
	const method = cleanSlug(textField(fields, ["Method", "method"], ""));
	const serviceArea = cleanSlug(textField(fields, ["Service area", "Service Area", "service_area"], ""));
	const riskArea = cleanSlug(textField(fields, ["Risk area", "Risk or constraint", "risk_area"], ""));
	const id = cleanSlug(textField(fields, ["Repository ID", "Artefact ID", "Slug"], record.id)) || record.id;
	const tagLabels = splitTags(firstField(fields, ["Tags", "Taxonomy", "Repository tags"], []));
	return {
		id,
		title: textField(fields, ["Title", "Name"], "Untitled repository artefact"),
		summary: textField(fields, ["Summary", "Description"], ""),
		href: `/pages/repository/artefacts/?id=${encodeURIComponent(id)}`,
		artefactType: textField(fields, ["Artefact type", "Type"], "Evidence artefact"),
		confidence,
		evidenceMaturity: maturity,
		serviceArea,
		userGroup: textField(fields, ["User group", "User Group"], ""),
		method,
		riskArea,
		publishedAt: textField(fields, ["Published at", "Published", "Published date"], record.createdTime || ""),
		reviewDueAt: textField(fields, ["Review due", "Review due at", "Review date"], ""),
		provenance: {
			projectId: textField(fields, ["Source project", "Project", "source_project_id"], ""),
			studyId: textField(fields, ["Source study", "Study", "source_study_id"], ""),
			method: textField(fields, ["Source method", "Method"], ""),
			sample: textField(fields, ["Evidence basis", "Sample summary", "sample_summary"], "")
		},
		limits: {
			limitations: textField(fields, ["Limitations"], ""),
			reuseGuidance: textField(fields, ["Reuse guidance"], ""),
			doNotUseFor: textField(fields, ["Where not to use", "Do not use for"], "")
		},
		tags: [
			{ text: `${confidence} confidence`, classes: tagClassFor("confidence", confidence) },
			{ text: maturity, classes: tagClassFor("maturity", maturity) },
			...tagLabels.map((tag) => ({ text: tag, classes: "govuk-tag--grey" }))
		]
	};
}

function airtableRecordIsPublished(record = {}) {
	const fields = record.fields || {};
	return (
		cleanSlug(textField(fields, ["Status", "Publication status", "status"], "")) === "published" &&
		boolField(fields, ["Active", "active"], true) &&
		boolField(fields, ["PII cleared", "PII clearance", "pii_cleared"], false) &&
		boolField(fields, ["Consent scope confirmed", "Consent confirmed", "consent_scope_confirmed"], false)
	);
}

function matchesSearch(artefact, url) {
	const q = cleanText(url.searchParams.get("q")).toLowerCase();
	const method = cleanSlug(url.searchParams.get("method"));
	const maturity = cleanSlug(url.searchParams.get("maturity"));
	const serviceArea = cleanSlug(url.searchParams.get("service_area"));
	const userGroup = cleanSlug(url.searchParams.get("user_group"));
	const riskArea = cleanSlug(url.searchParams.get("risk_area"));
	if (q) {
		const haystack = [artefact.title, artefact.summary, artefact.serviceArea, artefact.userGroup, artefact.method, artefact.riskArea].join(" ").toLowerCase();
		if (!haystack.includes(q)) return false;
	}
	if (method && artefact.method !== method) return false;
	if (maturity && artefact.evidenceMaturity !== maturity) return false;
	if (serviceArea && artefact.serviceArea !== serviceArea) return false;
	if (userGroup && cleanSlug(artefact.userGroup) !== userGroup) return false;
	if (riskArea && artefact.riskArea !== riskArea) return false;
	return true;
}

async function tagsByArtefactId(svc, artefactIds) {
	if (!artefactIds.length) return new Map();
	const placeholders = artefactIds.map(() => "?").join(", ");
	const rows = await d1All(svc.env, `
		SELECT artefact_id, tag_slug, tag_label, tag_type
		FROM ${TAGS_TABLE}
		WHERE artefact_id IN (${placeholders})
		ORDER BY tag_type ASC, tag_label ASC
	`, artefactIds);
	const byId = new Map();
	for (const row of rows) {
		if (!byId.has(row.artefact_id)) byId.set(row.artefact_id, []);
		byId.get(row.artefact_id).push(row);
	}
	return byId;
}

async function facetRows(svc, column, label) {
	const rows = await d1All(svc.env, `
		SELECT ${column} AS value, COUNT(*) AS count
		FROM ${ARTEFACTS_TABLE}
		WHERE ${publicWhere().join(" AND ")} AND ${column} IS NOT NULL AND ${column} != ''
		GROUP BY ${column}
		ORDER BY count DESC, value ASC
		LIMIT 20
	`);
	return {
		name: column,
		label,
		items: rows.map((row) => ({ value: row.value, label: row.value, count: row.count }))
	};
}

async function repositoryMetrics(svc) {
	const published = await d1Get(svc.env, `SELECT COUNT(*) AS count FROM ${ARTEFACTS_TABLE} WHERE ${publicWhere().join(" AND ")}`);
	const dueReview = await d1Get(svc.env, `
		SELECT COUNT(*) AS count
		FROM ${ARTEFACTS_TABLE}
		WHERE ${publicWhere().join(" AND ")} AND review_due_at IS NOT NULL AND date(review_due_at) <= date('now', '+30 days')
	`);
	const linkedRecommendations = await d1Get(svc.env, `
		SELECT COUNT(*) AS count
		FROM ${TAGS_TABLE}
		WHERE tag_type = 'recommendation'
	`);
	return [
		{ value: String(published?.count || 0), label: "published artefacts" },
		{ value: String(linkedRecommendations?.count || 0), label: "linked recommendations" },
		{ value: String(dueReview?.count || 0), label: "due review in 30 days" }
	];
}

async function repositoryQueues(svc) {
	const candidate = await d1Get(svc.env, `SELECT COUNT(*) AS count FROM ${ARTEFACTS_TABLE} WHERE status = 'candidate' AND active = 1`);
	const dueReview = await d1Get(svc.env, `SELECT COUNT(*) AS count FROM ${ARTEFACTS_TABLE} WHERE status = 'published' AND active = 1 AND review_due_at IS NOT NULL AND date(review_due_at) <= date('now', '+30 days')`);
	const withdrawn = await d1Get(svc.env, `SELECT COUNT(*) AS count FROM ${ARTEFACTS_TABLE} WHERE status = 'withdrawn' AND active = 1`);
	return [
		{ queue: "Candidate artefacts", count: String(candidate?.count || 0), href: "/pages/repository/review/candidates/", action: "Review" },
		{ queue: "Due review", count: String(dueReview?.count || 0), href: "/pages/repository/review/stale/", action: "Check" },
		{ queue: "Withdrawn artefacts", count: String(withdrawn?.count || 0), href: "/pages/repository/review/withdrawn/", action: "Inspect" }
	];
}

function facetFromArtefacts(artefacts, name, label, key) {
	const counts = new Map();
	for (const artefact of artefacts) {
		const value = cleanText(artefact[key]);
		if (!value) continue;
		counts.set(value, (counts.get(value) || 0) + 1);
	}
	return {
		name,
		label,
		items: [...counts.entries()]
			.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
			.slice(0, 20)
			.map(([value, count]) => ({ value, label: value, count }))
	};
}

function metricsFromArtefacts(artefacts) {
	const dueReview = artefacts.filter((artefact) => artefact.reviewDueAt && Date.parse(artefact.reviewDueAt) <= Date.now() + 30 * 24 * 60 * 60 * 1000).length;
	const linkedRecommendations = artefacts.reduce((count, artefact) => count + (artefact.tags || []).filter((tag) => cleanSlug(tag.text).includes("recommendation")).length, 0);
	return [
		{ value: String(artefacts.length), label: "published artefacts" },
		{ value: String(linkedRecommendations), label: "linked recommendations" },
		{ value: String(dueReview), label: "due review in 30 days" }
	];
}

async function listRepositoryFromAirtable(svc, url) {
	const records = await airtableRecords(svc, airtableTableName(svc));
	const allArtefacts = records.filter(airtableRecordIsPublished).map(airtableRecordToArtefact);
	const artefacts = allArtefacts.filter((artefact) => matchesSearch(artefact, url)).slice(0, clampLimit(url.searchParams.get("limit")));
	return {
		source: "airtable",
		artefacts,
		metrics: metricsFromArtefacts(allArtefacts),
		filters: [
			facetFromArtefacts(allArtefacts, "method", "Method", "method"),
				facetFromArtefacts(allArtefacts, "evidence_maturity", "Evidence maturity", "evidenceMaturity"),
				facetFromArtefacts(allArtefacts, "service_area", "Service area", "serviceArea"),
				facetFromArtefacts(allArtefacts, "user_group", "User group", "userGroup"),
				facetFromArtefacts(allArtefacts, "risk_area", "Risk or constraint", "riskArea")
		],
		queues: []
	};
}

async function readRepositoryArtefactFromAirtable(svc, artefactId) {
	const records = await airtableRecords(svc, airtableTableName(svc));
	return records
		.filter(airtableRecordIsPublished)
		.map(airtableRecordToArtefact)
		.find((artefact) => artefact.id === artefactId) || null;
}

function repositoryDerivation(showQueues) {
	return {
		metrics: [
			{ id: "publishedArtefacts", source: `${ARTEFACTS_TABLE}.status`, rule: "COUNT WHERE status='published' AND active=1 AND pii_cleared=1 AND consent_scope_confirmed=1" },
			{ id: "linkedRecommendations", source: `${TAGS_TABLE}.tag_type`, rule: "COUNT WHERE tag_type='recommendation'" },
			{ id: "dueReview", source: `${ARTEFACTS_TABLE}.review_due_at`, rule: "COUNT published artefacts due for review within 30 days" }
		],
		filters: [
			{ id: "method", source: `${ARTEFACTS_TABLE}.method`, rule: "Facet counts over published, active, PII-cleared, consent-confirmed artefacts" },
				{ id: "evidence_maturity", source: `${ARTEFACTS_TABLE}.evidence_maturity`, rule: "Facet counts over published, active, PII-cleared, consent-confirmed artefacts" },
				{ id: "service_area", source: `${ARTEFACTS_TABLE}.service_area`, rule: "Facet counts over published, active, PII-cleared, consent-confirmed artefacts" },
				{ id: "user_group", source: `${ARTEFACTS_TABLE}.user_group`, rule: "Facet counts over published, active, PII-cleared, consent-confirmed artefacts" },
				{ id: "risk_area", source: `${ARTEFACTS_TABLE}.risk_area`, rule: "Facet counts over published, active, PII-cleared, consent-confirmed artefacts" }
		],
		queues: showQueues
			? [
				{ id: "candidate", source: `${ARTEFACTS_TABLE}.status`, rule: "COUNT WHERE status='candidate' AND active=1" },
				{ id: "dueReview", source: `${ARTEFACTS_TABLE}.review_due_at`, rule: "COUNT published artefacts due for review within 30 days" },
				{ id: "withdrawn", source: `${ARTEFACTS_TABLE}.status`, rule: "COUNT WHERE status='withdrawn' AND active=1" }
			]
			: []
	};
}

export async function listRepository(svc, origin, url, authContext = {}) {
	const errors = [];
	try {
		await ensureTables(svc);
		const where = publicWhere();
		const params = [];
		appendSearchFilters(where, params, url);
		const limit = clampLimit(url.searchParams.get("limit"));
		params.push(limit);
		const rows = await d1All(svc.env, `
			SELECT *
			FROM ${ARTEFACTS_TABLE}
			WHERE ${where.join(" AND ")}
			ORDER BY datetime(published_at) DESC, title ASC
			LIMIT ?
		`, params);
		const tags = await tagsByArtefactId(svc, rows.map((row) => row.id));
		const artefacts = rows.map((row) => rowToArtefact(row, tags.get(row.id) || []));
		const [metrics, methodFacet, maturityFacet, serviceAreaFacet, userGroupFacet, riskFacet, queues] = await Promise.all([
			repositoryMetrics(svc),
			facetRows(svc, "method", "Method"),
			facetRows(svc, "evidence_maturity", "Evidence maturity"),
			facetRows(svc, "service_area", "Service area"),
			facetRows(svc, "user_group", "User group"),
			facetRows(svc, "risk_area", "Risk or constraint"),
			repositoryQueues(svc)
		]);
		const showQueues = canCurate(authContext);
		return svc.json({
			ok: true,
			source: "d1",
			artefacts,
			metrics,
			filters: [methodFacet, maturityFacet, serviceAreaFacet, userGroupFacet, riskFacet],
			queues: showQueues ? queues : [],
			canCurate: showQueues,
			derivation: repositoryDerivation(showQueues)
		}, 200, svc.corsHeaders(origin));
	} catch (error) {
		errors.push({ source: "d1", message: String(error?.message || error) });
	}

	try {
		const fallback = await listRepositoryFromAirtable(svc, url);
		const showQueues = canCurate(authContext);
		return svc.json({
			ok: true,
			source: fallback.source,
			artefacts: fallback.artefacts,
			metrics: fallback.metrics,
			filters: fallback.filters,
			queues: showQueues ? fallback.queues : [],
			canCurate: showQueues,
			derivation: repositoryDerivation(showQueues)
		}, 200, { ...svc.corsHeaders(origin), "x-rops-source": "airtable" });
	} catch (error) {
		errors.push({ source: "airtable", message: String(error?.message || error), status: error?.status || 0 });
	}

	return svc.json({
		ok: false,
		error: "repository_store_unavailable",
		message: "Repository data could not be loaded. Try again or contact the ResearchOps team if the problem continues.",
		sources: errors.map((entry) => ({ source: entry.source, status: entry.status || 0 }))
	}, 503, svc.corsHeaders(origin));
}

export async function readRepositoryArtefact(svc, origin, artefactId) {
	const errors = [];
	try {
		await ensureTables(svc);
		const row = await d1Get(svc.env, `
			SELECT *
			FROM ${ARTEFACTS_TABLE}
			WHERE id = ? AND ${publicWhere().join(" AND ")}
			LIMIT 1
		`, [artefactId]);
		if (!row) return svc.json({ ok: false, error: "repository_artefact_not_found" }, 404, svc.corsHeaders(origin));
		const tags = await tagsByArtefactId(svc, [artefactId]);
		return svc.json({ ok: true, source: "d1", artefact: rowToArtefact(row, tags.get(artefactId) || []), payload: parseJson(row.payload_json, {}) }, 200, svc.corsHeaders(origin));
	} catch (error) {
		errors.push({ source: "d1", message: String(error?.message || error) });
	}

	try {
		const artefact = await readRepositoryArtefactFromAirtable(svc, artefactId);
		if (!artefact) return svc.json({ ok: false, error: "repository_artefact_not_found" }, 404, svc.corsHeaders(origin));
		return svc.json({ ok: true, source: "airtable", artefact, payload: {} }, 200, { ...svc.corsHeaders(origin), "x-rops-source": "airtable" });
	} catch (error) {
		errors.push({ source: "airtable", message: String(error?.message || error), status: error?.status || 0 });
	}

	return svc.json({
		ok: false,
		error: "repository_store_unavailable",
		message: "Repository data could not be loaded. Try again or contact the ResearchOps team if the problem continues.",
		sources: errors.map((entry) => ({ source: entry.source, status: entry.status || 0 }))
	}, 503, svc.corsHeaders(origin));
}

export async function createRepositoryCandidate(svc, request, origin, authContext = {}) {
	if (!hasD1(svc)) {
		return svc.json({
			ok: false,
			error: "repository_d1_required",
			message: "Candidate artefacts must be created in the governed repository database."
		}, 503, svc.corsHeaders(origin));
	}

	const payload = await request.json().catch(() => ({}));
	const title = payloadText(payload, "title");
	const summary = payloadText(payload, "summary");
	if (!title || !summary) {
		return svc.json({ ok: false, error: "candidate_required_fields", required: ["title", "summary"] }, 400, svc.corsHeaders(origin));
	}

	await ensureTables(svc);
	const now = new Date().toISOString();
	const id = newCandidateId();
	const actor = authContext?.user?.id || authContext?.user?.email || "authenticated-user";
	const sourceProjectId = payloadText(payload, "sourceProjectId");
	const sourceStudyId = payloadText(payload, "sourceStudyId");
	const evidenceType = cleanSlug(payloadText(payload, "evidenceType"));
	const method = cleanSlug(payloadText(payload, "method"));
	const evidenceMaturity = cleanSlug(payloadText(payload, "evidenceMaturity", "early-signal")) || "early-signal";
	const serviceArea = cleanSlug(payloadText(payload, "serviceArea"));
	const userGroup = cleanSlug(payloadText(payload, "userGroup"));
	const riskArea = cleanSlug(payloadText(payload, "riskArea"));
	const payloadJson = JSON.stringify({
		publicationGate: {
			piiCleared: false,
			consentScopeConfirmed: false,
			reviewerAssigned: false,
			reviewStatus: "pending_review"
		},
		sourceEvidence: {
			projectId: sourceProjectId,
			studyId: sourceStudyId,
			evidenceType,
			method,
			evidenceBasis: payloadText(payload, "sampleSummary")
		}
	});

	await d1Run(svc.env, `
		INSERT INTO ${ARTEFACTS_TABLE} (
			id, title, summary, artefact_type, status, confidence, evidence_maturity,
			service_area, user_group, method, risk_area, source_project_id, source_study_id,
			source_method, sample_summary, limitations, reuse_guidance, do_not_use_for,
			owner_user_id, reviewed_by_user_id, pii_cleared, consent_scope_confirmed,
			active, created_at, updated_at, published_at, review_due_at, payload_json
		) VALUES (?, ?, ?, ?, 'candidate', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, 0, 1, ?, ?, NULL, ?, ?)
	`, [
		id,
		title,
		summary,
		payloadText(payload, "artefactType", "Candidate artefact"),
		cleanSlug(payloadText(payload, "confidence", "low")) || "low",
		evidenceMaturity,
		serviceArea,
		userGroup,
		method,
		riskArea,
		sourceProjectId,
		sourceStudyId,
		payloadText(payload, "sourceMethod", method),
		payloadText(payload, "sampleSummary"),
		payloadText(payload, "limitations"),
		payloadText(payload, "reuseGuidance"),
		payloadText(payload, "doNotUseFor"),
		actor,
		now,
		now,
		payloadText(payload, "reviewDueAt"),
		payloadJson
	]);

	await d1Run(svc.env, `
		INSERT INTO ${AUDIT_TABLE} (id, artefact_id, action, actor_user_id, created_at, payload_json)
		VALUES (?, ?, 'candidate.submitted', ?, ?, ?)
	`, [`audit-${id}`, id, actor, now, payloadJson]);

	return svc.json({
		ok: true,
		id,
		status: "candidate",
		publicationGate: "pending_review"
	}, 201, svc.corsHeaders(origin));
}
