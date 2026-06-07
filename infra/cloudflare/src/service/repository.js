import { d1All, d1Get, d1Run } from "./internals/researchops-d1.js";

const ARTEFACTS_TABLE = "rops_repository_artefacts";
const TAGS_TABLE = "rops_repository_artefact_tags";
const AUDIT_TABLE = "rops_repository_audit";

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
	await d1Run(svc.env, `CREATE INDEX IF NOT EXISTS idx_repository_artefacts_facets ON ${ARTEFACTS_TABLE} (method, evidence_maturity, service_area, risk_area)`);
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
		href: `/pages/repository/artefacts/${encodeURIComponent(row.id)}/`,
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

export async function listRepository(svc, origin, url, authContext = {}) {
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
		const [metrics, methodFacet, maturityFacet, serviceAreaFacet, riskFacet, queues] = await Promise.all([
			repositoryMetrics(svc),
			facetRows(svc, "method", "Method"),
			facetRows(svc, "evidence_maturity", "Evidence maturity"),
			facetRows(svc, "service_area", "Service area"),
			facetRows(svc, "risk_area", "Risk or constraint"),
			repositoryQueues(svc)
		]);
		return svc.json({
			ok: true,
			source: "d1",
			artefacts,
			metrics,
			filters: [methodFacet, maturityFacet, serviceAreaFacet, riskFacet],
			queues: canCurate(authContext) ? queues : [],
			canCurate: canCurate(authContext)
		}, 200, svc.corsHeaders(origin));
	} catch (error) {
		return svc.json({ ok: false, error: "repository_store_unavailable", message: String(error?.message || error) }, 503, svc.corsHeaders(origin));
	}
}

export async function readRepositoryArtefact(svc, origin, artefactId) {
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
		return svc.json({ ok: false, error: "repository_store_unavailable", message: String(error?.message || error) }, 503, svc.corsHeaders(origin));
	}
}
