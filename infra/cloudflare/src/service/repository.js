import { d1All, d1Get, d1Run } from "./internals/researchops-d1.js";

const ARTEFACTS_TABLE = "rops_repository_artefacts";
const TAGS_TABLE = "rops_repository_artefact_tags";
const AUDIT_TABLE = "rops_repository_audit";
const AIRTABLE_PAGE_SIZE = 100;
const MAX_AIRTABLE_PAGES = 10;
const HYDRATE_FULL_MODE = "full";
const schemaReadyByDatabase = new WeakMap();

function hasD1(svc) {
	return Boolean(svc?.env?.RESEARCHOPS_D1?.prepare);
}

function cleanText(value) {
	return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanSlug(value) {
	return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function searchValues(url, key) {
	return [...new Set(url.searchParams.getAll(key).map(cleanSlug).filter(Boolean))];
}

function clampLimit(value) {
	const parsed = Number.parseInt(String(value || ""), 10);
	if (!Number.isFinite(parsed)) return 20;
	return Math.max(1, Math.min(parsed, 50));
}

function pageNumber(value) {
	const parsed = Number.parseInt(String(value || ""), 10);
	if (!Number.isFinite(parsed)) return 1;
	return Math.max(1, parsed);
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

function labelFromSlug(value) {
	const key = cleanSlug(value);
	const overrides = new Map([
		["frontline-staff", "Frontline staff"],
		["assisted-digital-users", "Assisted digital users"],
		["public-users", "Public users"],
		["researchers", "Researchers"],
		["research-operations-team", "Research operations staff"],
		["research-operations-staff", "Research operations staff"],
		["service-area", "Service area"],
		["user-group", "User group"],
		["risk-area", "Risk or constraint"],
		["evidence-maturity", "Evidence maturity"],
	]);
	if (overrides.has(key)) return overrides.get(key);
	const words = cleanText(value).replace(/-/g, " ");
	return words ? `${words.slice(0, 1).toUpperCase()}${words.slice(1).toLowerCase()}` : "";
}

function topicLabelForRisk(riskArea) {
	const labels = new Map([
		["confidence-and-comprehension", "Confidence and comprehension"],
		["workflow-friction", "Workflow friction"],
		["governance-and-consent", "Governance and consent"],
		["handoff-risk", "Handoff risk"],
		["transaction-failure", "Transaction failure"],
		["evidence-misuse", "Evidence misuse"],
	]);
	return labels.get(cleanSlug(riskArea)) || "Repository evidence theme";
}

function recommendationLabelForRisk(riskArea) {
	const labels = new Map([
		["confidence-and-comprehension", "Explain confidence and next steps"],
		["workflow-friction", "Reduce avoidable workflow friction"],
		["governance-and-consent", "Confirm consent and governance boundaries"],
		["handoff-risk", "Clarify handoff owner and next action"],
		["transaction-failure", "Make recovery routes explicit"],
		["evidence-misuse", "State evidence limits before reuse"],
	]);
	return labels.get(cleanSlug(riskArea)) || "Check source context before reuse";
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
	const database = svc.env.RESEARCHOPS_D1;
	if (!schemaReadyByDatabase.has(database)) {
		const ready = (async () => {
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
		})();
		schemaReadyByDatabase.set(database, ready);
		ready.catch(() => schemaReadyByDatabase.delete(database));
	}
	await schemaReadyByDatabase.get(database);
}

function publicWhere() {
	return [
		"status = 'published'",
		"active = 1",
		"pii_cleared = 1",
		"consent_scope_confirmed = 1"
	];
}

function publicWhereSql() {
	return publicWhere().join(" AND ");
}

function selectedFacet(url) {
	const candidates = [
		["service_area", "Service area"],
		["user_group", "User group"],
		["method", "Research method"],
		["risk_area", "Risk or constraint"],
		["maturity", "Evidence maturity"]
	];
	for (const [type, typeLabel] of candidates) {
		const value = cleanSlug(url.searchParams.get(type));
		if (value) return { type, typeLabel, value, label: labelFromSlug(value) };
	}
	return null;
}

function tagClassFor(type, value) {
	if (type === "confidence" && value === "high") return "govuk-tag--green";
	if (type === "confidence" && value === "medium") return "govuk-tag--yellow";
	if (type === "confidence" && value === "low") return "govuk-tag--orange";
	if (type === "maturity") return "govuk-tag--blue";
	return "govuk-tag--grey";
}

function repositoryTag(tag, row) {
	if (tag.tag_type === "topic" && cleanSlug(tag.tag_slug).startsWith("seeded-topic")) {
		return { text: topicLabelForRisk(row.risk_area), classes: tagClassFor(tag.tag_type, row.risk_area) };
	}
	if (tag.tag_type === "recommendation" && cleanSlug(tag.tag_slug).startsWith("rec-seeded")) {
		return { text: recommendationLabelForRisk(row.risk_area), classes: tagClassFor(tag.tag_type, row.risk_area) };
	}
	if (/seeded/i.test(cleanText(tag.tag_label))) {
		return null;
	}
	return { text: tag.tag_label, classes: tagClassFor(tag.tag_type, tag.tag_slug) };
}

function rowToArtefact(row, tags = []) {
	const repositoryTags = tags.map((tag) => repositoryTag(tag, row)).filter(Boolean);
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
			{ text: labelFromSlug(row.evidence_maturity), classes: tagClassFor("maturity", row.evidence_maturity) },
			...repositoryTags
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
			{ text: labelFromSlug(maturity), classes: tagClassFor("maturity", maturity) },
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
	const method = searchValues(url, "method");
	const maturity = searchValues(url, "maturity");
	const serviceArea = searchValues(url, "service_area");
	const userGroup = searchValues(url, "user_group");
	const riskArea = searchValues(url, "risk_area");
	if (q) {
		const haystack = [artefact.title, artefact.summary, artefact.serviceArea, artefact.userGroup, artefact.method, artefact.riskArea].join(" ").toLowerCase();
		if (!haystack.includes(q)) return false;
	}
	if (method.length && !method.includes(cleanSlug(artefact.method))) return false;
	if (maturity.length && !maturity.includes(cleanSlug(artefact.evidenceMaturity))) return false;
	if (serviceArea.length && !serviceArea.includes(cleanSlug(artefact.serviceArea))) return false;
	if (userGroup.length && !userGroup.includes(cleanSlug(artefact.userGroup))) return false;
	if (riskArea.length && !riskArea.includes(cleanSlug(artefact.riskArea))) return false;
	return true;
}

function sortArtefacts(artefacts, sort) {
	const confidenceRank = { high: 3, medium: 2, low: 1 };
	return [...artefacts].sort((a, b) => {
		if (sort === "confidence_desc") return (confidenceRank[b.confidence] || 0) - (confidenceRank[a.confidence] || 0) || cleanText(a.title).localeCompare(cleanText(b.title));
		if (sort === "relevance") return cleanText(a.title).localeCompare(cleanText(b.title));
		return Date.parse(b.publishedAt || b.reviewDueAt || 0) - Date.parse(a.publishedAt || a.reviewDueAt || 0) || cleanText(a.title).localeCompare(cleanText(b.title));
	});
}

function repositorySortSql(sort) {
	if (sort === "confidence_desc") {
		return "CASE confidence WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END DESC, title ASC";
	}
	if (sort === "relevance") return "title ASC";
	return "datetime(COALESCE(updated_at, published_at, created_at)) DESC, title ASC";
}

function repositorySearchQuery(url) {
	const clauses = [...publicWhere()];
	const params = [];
	const q = cleanText(url.searchParams.get("q"));
	const method = searchValues(url, "method");
	const maturity = searchValues(url, "maturity");
	const serviceArea = searchValues(url, "service_area");
	const userGroup = searchValues(url, "user_group");
	const riskArea = searchValues(url, "risk_area");
	if (q) {
		const like = `%${q.toLowerCase()}%`;
		clauses.push(`(
			lower(title) LIKE ?
			OR lower(summary) LIKE ?
			OR lower(COALESCE(service_area, '')) LIKE ?
			OR lower(COALESCE(user_group, '')) LIKE ?
			OR lower(COALESCE(method, '')) LIKE ?
			OR lower(COALESCE(risk_area, '')) LIKE ?
		)`);
		params.push(like, like, like, like, like, like);
	}
	for (const [column, values] of [
		["method", method],
		["evidence_maturity", maturity],
		["service_area", serviceArea],
		["user_group", userGroup],
		["risk_area", riskArea],
	]) {
		if (!values.length) continue;
		clauses.push(`${column} IN (${values.map(() => "?").join(", ")})`);
		params.push(...values);
	}
	return {
		whereSql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
		params,
	};
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

async function repositoryQueues(svc) {
	const counts = await d1Get(svc.env, `
		SELECT
			SUM(CASE WHEN status = 'candidate' AND active = 1 THEN 1 ELSE 0 END) AS candidate_count,
			SUM(CASE WHEN status = 'published' AND active = 1 AND review_due_at IS NOT NULL AND date(review_due_at) <= date('now', '+30 days') THEN 1 ELSE 0 END) AS due_review_count,
			SUM(CASE WHEN status = 'withdrawn' AND active = 1 THEN 1 ELSE 0 END) AS withdrawn_count
		FROM ${ARTEFACTS_TABLE}
	`);
	return [
		{ queue: "Candidate artefacts", count: String(counts?.candidate_count || 0), href: "/pages/repository/review/candidates/", action: "Review" },
		{ queue: "Due review", count: String(counts?.due_review_count || 0), href: "/pages/repository/review/stale/", action: "Check" },
		{ queue: "Withdrawn artefacts", count: String(counts?.withdrawn_count || 0), href: "/pages/repository/review/withdrawn/", action: "Inspect" }
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
			.map(([value, count]) => ({ value, label: labelFromSlug(value), count }))
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

async function facetFromRepository(svc, name, label, column) {
	const rows = await d1All(svc.env, `
		SELECT ${column} AS value, COUNT(*) AS count
		FROM ${ARTEFACTS_TABLE}
		WHERE ${publicWhereSql()} AND ${column} IS NOT NULL AND TRIM(${column}) != ''
		GROUP BY ${column}
		ORDER BY count DESC, value ASC
		LIMIT 20
	`);
	return {
		name,
		label,
		items: rows.map((row) => ({
			value: row.value,
			label: labelFromSlug(row.value),
			count: Number(row.count || 0),
		}))
	};
}

async function repositoryMetrics(svc) {
	const [artefactCounts, linkedRecommendations] = await Promise.all([
		d1Get(svc.env, `
			SELECT
				COUNT(*) AS published_count,
				SUM(CASE WHEN review_due_at IS NOT NULL AND date(review_due_at) <= date('now', '+30 days') THEN 1 ELSE 0 END) AS due_review_count
			FROM ${ARTEFACTS_TABLE}
			WHERE ${publicWhereSql()}
		`),
		d1Get(svc.env, `
			SELECT COUNT(*) AS count
			FROM ${TAGS_TABLE}
			WHERE tag_type = 'recommendation'
			AND artefact_id IN (
				SELECT id
				FROM ${ARTEFACTS_TABLE}
				WHERE ${publicWhereSql()}
			)
		`)
	]);
	return [
		{ value: String(artefactCounts?.published_count || 0), label: "published artefacts" },
		{ value: String(linkedRecommendations?.count || 0), label: "linked recommendations" },
		{ value: String(artefactCounts?.due_review_count || 0), label: "due review in 30 days" }
	];
}

async function fullRepositoryCatalogue(svc) {
	const rows = await d1All(svc.env, `
		SELECT *
		FROM ${ARTEFACTS_TABLE}
		WHERE ${publicWhereSql()}
		ORDER BY datetime(COALESCE(updated_at, published_at, created_at)) DESC, title ASC
	`);
	const tags = await tagsByArtefactId(svc, rows.map((row) => row.id));
	return rows.map((row) => rowToArtefact(row, tags.get(row.id) || []));
}

function pagination(url, total) {
	const limit = clampLimit(url.searchParams.get("limit"));
	const page = pageNumber(url.searchParams.get("page"));
	return { page, limit, total, offset: (page - 1) * limit };
}

async function listRepositoryFromAirtable(svc, url) {
	const records = await airtableRecords(svc, airtableTableName(svc));
	const allArtefacts = records.filter(airtableRecordIsPublished).map(airtableRecordToArtefact);
	const filtered = sortArtefacts(allArtefacts.filter((artefact) => matchesSearch(artefact, url)), url.searchParams.get("sort") || "reviewed_desc");
	const pager = pagination(url, filtered.length);
	const artefacts = filtered.slice(pager.offset, pager.offset + pager.limit);
	return {
		source: "airtable",
		artefacts,
		pagination: { page: pager.page, limit: pager.limit, total: pager.total },
		selected: selectedFacet(url),
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
		const sort = url.searchParams.get("sort") || "reviewed_desc";
		const hydrate = cleanSlug(url.searchParams.get("hydrate"));
		const query = repositorySearchQuery(url);
		const totalCount = await d1Get(svc.env, `
			SELECT COUNT(*) AS count
			FROM ${ARTEFACTS_TABLE}
			${query.whereSql}
		`, query.params);
		const pager = pagination(url, Number(totalCount?.count || 0));
		const rows = await d1All(svc.env, `
			SELECT *
			FROM ${ARTEFACTS_TABLE}
			${query.whereSql}
			ORDER BY ${repositorySortSql(sort)}
			LIMIT ? OFFSET ?
		`, [...query.params, pager.limit, pager.offset]);
		const tags = await tagsByArtefactId(svc, rows.map((row) => row.id));
		const artefacts = rows.map((row) => rowToArtefact(row, tags.get(row.id) || []));
		const [filters, metrics, queues, catalogue] = await Promise.all([
			Promise.all([
				facetFromRepository(svc, "method", "Method", "method"),
				facetFromRepository(svc, "evidence_maturity", "Evidence maturity", "evidence_maturity"),
				facetFromRepository(svc, "service_area", "Service area", "service_area"),
				facetFromRepository(svc, "user_group", "User group", "user_group"),
				facetFromRepository(svc, "risk_area", "Risk or constraint", "risk_area")
			]),
			repositoryMetrics(svc),
			repositoryQueues(svc),
			hydrate === HYDRATE_FULL_MODE ? fullRepositoryCatalogue(svc) : Promise.resolve(undefined)
		]);
		const showQueues = canCurate(authContext);
		return svc.json({
			ok: true,
			source: "d1",
			artefacts,
			pagination: { page: pager.page, limit: pager.limit, total: pager.total },
			selected: selectedFacet(url),
			metrics,
			filters,
			queues: showQueues ? queues : [],
			canCurate: showQueues,
			catalogue: catalogue ? { artefacts: catalogue } : undefined,
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
			pagination: fallback.pagination,
			selected: fallback.selected,
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
