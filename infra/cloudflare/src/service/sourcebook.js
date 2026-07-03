/**
 * @file sourcebook.js
 * @module sourcebook
 * @summary Read-only Sourcebook API endpoints for ResearchOps.
 */

import sourcebookIndex from "../../../../sourcebook/sourcebook-index.json" with { type: "json" };
import routeClauseMappings from "../../../../sourcebook/sourcebook-route-mappings.json" with { type: "json" };

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const TEXT_MODES = new Set(["summary", "title", "full", "verbose"]);
const GOVERNANCE_ENGINE_VERSION = "2026-07-03";
const NORTH_STAR_RULE = {
	id: "researchops-north-star",
	title: "North Star rule",
	text: "ResearchOps decisions should be safe, lawful, inclusive, useful, proportionate and traceable to a real service decision."
};

function cleanText(value) {
	return String(value || "").replace(/\s+/g, " ").trim();
}

function normaliseLookup(value) {
	return cleanText(value).toLowerCase();
}

function normaliseRoute(value) {
	const route = cleanText(value);
	if (!route) return "";
	const [pathname] = route.split(/[?#]/);
	const collapsed = pathname.replace(/\/{2,}/g, "/");
	if (collapsed === "/") return collapsed;
	return collapsed.endsWith("/") ? collapsed : `${collapsed}/`;
}

function normaliseEvidence(value) {
	return normaliseLookup(value).replace(/[\s_]+/g, "-");
}

function asArray(value) {
	return Array.isArray(value) ? value : [];
}

function parseTextMode(url) {
	const requested = normaliseLookup(url.searchParams.get("includeText") || "summary");
	return TEXT_MODES.has(requested) ? requested : "summary";
}

function sourcebookSummary() {
	return {
		schemaVersion: sourcebookIndex.schemaVersion,
		title: sourcebookIndex.title,
		shortTitle: sourcebookIndex.shortTitle,
		description: sourcebookIndex.description,
		status: sourcebookIndex.status,
		language: sourcebookIndex.language,
		modified: sourcebookIndex.modified,
		canonicalRoute: sourcebookIndex.canonicalRoute,
		contentTypes: sourcebookIndex.contentTypes,
		clauseModel: sourcebookIndex.clauseModel
	};
}

function allTemplatesById() {
	return new Map(asArray(sourcebookIndex.templates).map(template => [template.id, template]));
}

function templateRefs(ids = []) {
	const templates = allTemplatesById();
	return asArray(ids)
		.map(id => templates.get(id))
		.filter(Boolean)
		.map(template => ({
			id: template.id,
			title: template.title,
			path: template.path
		}));
}

function mappingConditions(mapping) {
	const conditions = mapping.conditions ?? mapping.condition;
	if (!conditions) return [];
	return Array.isArray(conditions) ? conditions : [conditions];
}

function mappingConditionIds(mapping) {
	return mappingConditions(mapping)
		.map(condition => normaliseEvidence(condition?.id || condition))
		.filter(Boolean);
}

function routeMappingDto(mapping, { source = "route-map" } = {}) {
	const conditions = mappingConditions(mapping)
		.map(condition => {
			if (typeof condition === "string") {
				return {
					id: normaliseEvidence(condition),
					label: cleanText(condition),
					description: ""
				};
			}
			return {
				id: normaliseEvidence(condition?.id),
				label: cleanText(condition?.label || condition?.id),
				description: cleanText(condition?.description)
			};
		})
		.filter(condition => condition.id);

	return {
		id: mapping.id,
		route: normaliseRoute(mapping.route),
		source,
		conditionIds: conditions.map(condition => condition.id),
		conditions,
		strength: mapping.strength || "related"
	};
}

function routeMappingsForRecord(record) {
	const explicitMappings = routeClauseMappings
		.filter(mapping => normaliseLookup(mapping.clauseId) === normaliseLookup(record.clause.id))
		.map(mapping => routeMappingDto(mapping));
	const explicitRoutes = new Set(explicitMappings.map(mapping => mapping.route));
	const fallbackMappings = asArray(record.clause.relatedAppRoutes)
		.map(normaliseRoute)
		.filter(route => route && !explicitRoutes.has(route))
		.map(route =>
			routeMappingDto(
				{
					id: `map_related_${normaliseLookup(record.clause.id).replace(/[^a-z0-9]+/g, "_")}_${route.replace(/[^a-z0-9]+/g, "_")}`,
					route,
					condition: [],
					strength: "related"
				},
				{ source: "clause-related-route" }
			)
		);

	return [...explicitMappings, ...fallbackMappings];
}

function allClauses() {
	return asArray(sourcebookIndex.pillars).flatMap(pillar =>
		asArray(pillar.sections).flatMap(section =>
			asArray(section.clauses).map(clause => ({
				pillar,
				section,
				clause
			}))
		)
	);
}

function deriveTriggers({ pillar, section, clause }) {
	const explicit = asArray(clause.triggers);
	const evidence = asArray(clause.evidence).map(normaliseEvidence);
	const routes = asArray(clause.relatedAppRoutes).map(normaliseRoute);
	const text = normaliseLookup(`${section.title} ${clause.title} ${clause.text} ${evidence.join(" ")}`);
	const triggers = new Set(explicit.map(normaliseEvidence).filter(Boolean));

	if (/\bbefore\b|\bstarts?\b|\bstarts before\b|\bbefore work starts\b|\bbefore delivery starts\b/.test(text)) {
		triggers.add("before-work-starts");
	}
	if (text.includes("before participant contact") || text.includes("before outreach") || evidence.includes("research-intake")) {
		triggers.add("before-participant-contact");
	}
	if (
		text.includes("before research participation") ||
		text.includes("consent") ||
		evidence.includes("consent-form") ||
		evidence.includes("consent-log") ||
		routes.includes("/pages/consent/")
	) {
		triggers.add("before-session-start");
		triggers.add("consent-review");
	}
	if (text.includes("remote readiness") || evidence.includes("remote-readiness-check")) {
		triggers.add("before-remote-session");
	}
	if (text.includes("fieldwork") || evidence.includes("fieldwork-risk-plan")) {
		triggers.add("before-fieldwork");
	}
	if (
		pillar.code === "DATA-STO-ACC" ||
		routes.some(route => route.startsWith("/pages/repository/")) ||
		evidence.includes("repository-entry")
	) {
		triggers.add("repository-readiness");
	}
	if (text.includes("access") || evidence.some(item => item.includes("access"))) {
		triggers.add("before-access-change");
	}
	if (
		pillar.code === "INFRA-PROV" ||
		text.includes("tool") ||
		text.includes("integration") ||
		evidence.includes("integration-record")
	) {
		triggers.add("before-tool-use");
	}

	return [...triggers].sort();
}

function clauseFullText(clause) {
	return `${clause.id}: ${clause.title}\n\n${clause.text}`;
}

function clauseText(clause, textMode) {
	if (textMode === "title") return clause.title;
	if (textMode === "full" || textMode === "verbose") return clauseFullText(clause);
	return clause.text;
}

function clauseMetadata(record) {
	const { pillar, section, clause } = record;
	return {
		type: clause.type,
		status: clause.status,
		effectiveDate: clause.effectiveDate,
		appliesTo: asArray(clause.appliesTo),
		evidence: asArray(clause.evidence),
		relatedTemplates: asArray(clause.relatedTemplates),
		relatedTemplateDetails: templateRefs(clause.relatedTemplates),
		relatedAppRoutes: asArray(clause.relatedAppRoutes),
		routeMappings: routeMappingsForRecord(record),
		triggers: deriveTriggers(record),
		pillar: {
			code: pillar.code,
			slug: pillar.slug,
			title: pillar.title,
			route: pillar.route
		},
		section: {
			id: section.id,
			title: section.title
		},
		sourcebookRoute: pillar.route
	};
}

function clauseDto(record, { textMode = "summary" } = {}) {
	const { clause } = record;
	const metadata = clauseMetadata(record);
	return {
		id: clause.id,
		type: clause.type,
		status: clause.status,
		effectiveDate: clause.effectiveDate,
		title: clause.title,
		textMode,
		text: clauseText(clause, textMode),
		...metadata,
		...(textMode === "verbose"
			? {
					metadata: {
						id: clause.id,
						title: clause.title,
						...metadata
					}
				}
			: {})
	};
}

function pillarDto(pillar, { includeSections = false } = {}) {
	const clauses = asArray(pillar.sections).flatMap(section => asArray(section.clauses));
	const base = {
		code: pillar.code,
		slug: pillar.slug,
		legacySlug: pillar.legacySlug,
		title: pillar.title,
		route: pillar.route,
		owner: pillar.owner,
		operatingQuestion: pillar.operatingQuestion,
		definition: pillar.definition,
		valueFrame: pillar.valueFrame,
		sectionCount: asArray(pillar.sections).length,
		clauseCount: clauses.length,
		clauseTypes: [...new Set(clauses.map(clause => clause.type).filter(Boolean))].sort()
	};
	if (!includeSections) return base;
	return {
		...base,
		sections: asArray(pillar.sections).map(section => ({
			id: section.id,
			title: section.title,
			definition: section.definition,
			clauseCount: asArray(section.clauses).length
		}))
	};
}

function parseLimit(url) {
	const parsed = Number.parseInt(url.searchParams.get("limit") || "", 10);
	if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
	return Math.max(1, Math.min(parsed, MAX_LIMIT));
}

function parseOffset(url) {
	const parsed = Number.parseInt(url.searchParams.get("offset") || "", 10);
	if (!Number.isFinite(parsed)) return 0;
	return Math.max(0, parsed);
}

function queryValues(url, key, normalise = normaliseLookup) {
	return [
		...new Set(
			url.searchParams
				.getAll(key)
				.flatMap(value => String(value).split(","))
				.map(normalise)
				.filter(Boolean)
		)
	];
}

function matchesPillar(record, values) {
	if (!values.length) return true;
	const candidates = [record.pillar.code, record.pillar.slug, record.pillar.legacySlug, record.pillar.title]
		.map(normaliseLookup)
		.filter(Boolean);
	return values.some(value => candidates.includes(value));
}

function matchesRouteContext(record, routeValues, conditionValues) {
	if (!routeValues.length && !conditionValues.length) return true;
	const pillarRoute = normaliseRoute(record.pillar.route);
	if (routeValues.length && !conditionValues.length && routeValues.includes(pillarRoute)) return true;

	const mappings = routeMappingsForRecord(record);
	return mappings.some(mapping => mappingMatchesContext(mapping, routeValues, conditionValues));
}

function mappingMatchesContext(mapping, routeValues, conditionValues) {
	const routeMatches = !routeValues.length || routeValues.includes(mapping.route);
	const mappingConditions = mapping.conditionIds || mappingConditionIds(mapping);
	const conditionMatches = !conditionValues.length || conditionValues.some(value => mappingConditions.includes(value));
	return routeMatches && conditionMatches;
}

function matchesEvidence(record, values) {
	if (!values.length) return true;
	const evidence = asArray(record.clause.evidence).map(normaliseEvidence);
	return values.some(value => evidence.includes(value));
}

function matchesTrigger(record, values) {
	if (!values.length) return true;
	const triggers = deriveTriggers(record);
	return values.some(value => triggers.includes(value));
}

function matchesType(record, values) {
	if (!values.length) return true;
	return values.includes(normaliseLookup(record.clause.type));
}

function matchesStatus(record, values) {
	if (!values.length) return true;
	return values.includes(normaliseLookup(record.clause.status));
}

function matchesSearch(record, value) {
	if (!value) return true;
	const haystack = normaliseLookup([
		record.pillar.code,
		record.pillar.title,
		record.section.title,
		record.clause.id,
		record.clause.title,
		record.clause.text,
		...asArray(record.clause.evidence)
	].join(" "));
	return haystack.includes(value);
}

function filterClauses(url) {
	const pillarValues = queryValues(url, "pillar");
	const routeValues = queryValues(url, "route", normaliseRoute);
	const conditionValues = queryValues(url, "condition", normaliseEvidence);
	const evidenceValues = queryValues(url, "evidence", normaliseEvidence);
	const triggerValues = queryValues(url, "trigger", normaliseEvidence);
	const typeValues = queryValues(url, "type");
	const statusValues = queryValues(url, "status");
	const search = normaliseLookup(url.searchParams.get("q"));

	return allClauses().filter(record =>
		matchesPillar(record, pillarValues) &&
		matchesRouteContext(record, routeValues, conditionValues) &&
		matchesEvidence(record, evidenceValues) &&
		matchesTrigger(record, triggerValues) &&
		matchesType(record, typeValues) &&
		matchesStatus(record, statusValues) &&
		matchesSearch(record, search)
	);
}

function governanceClause(record, routeValues, conditionValues) {
	const routeMappings = routeMappingsForRecord(record).filter(mapping => mappingMatchesContext(mapping, routeValues, conditionValues));
	return {
		id: record.clause.id,
		title: record.clause.title,
		type: record.clause.type,
		status: record.clause.status,
		pillar: {
			code: record.pillar.code,
			title: record.pillar.title,
			operatingQuestion: record.pillar.operatingQuestion
		},
		section: {
			id: record.section.id,
			title: record.section.title
		},
		evidence: asArray(record.clause.evidence),
		triggers: deriveTriggers(record),
		routeMappings,
		strength: routeMappings.some(mapping => mapping.strength === "required") || record.clause.type === "rule" ? "required" : "advisory"
	};
}

function uniqueSorted(values) {
	return [...new Set(values.filter(Boolean))].sort();
}

function evidenceReadiness(clauses, providedEvidence) {
	const requiredEvidence = uniqueSorted(clauses.flatMap(clause => clause.evidence).map(normaliseEvidence));
	const missingEvidence = requiredEvidence.filter(item => !providedEvidence.includes(item));
	const matchedEvidence = requiredEvidence.filter(item => providedEvidence.includes(item));
	return {
		requiredEvidence,
		providedEvidence,
		matchedEvidence,
		missingEvidence,
		status: !requiredEvidence.length ? "not-required" : missingEvidence.length ? "missing-evidence" : "ready"
	};
}

function governanceOutcome(clauses, readiness) {
	if (!clauses.length) {
		return {
			status: "no-sourcebook-match",
			decision: "check-sourcebook-scope",
			severity: "medium",
			message: "No Sourcebook clause matched this route, condition or evidence context. Treat the decision as ungoverned until the scope is confirmed."
		};
	}
	if (readiness.missingEvidence.length) {
		return {
			status: "needs-evidence",
			decision: "pause-for-evidence",
			severity: clauses.some(clause => clause.strength === "required") ? "high" : "medium",
			message: "Matched Sourcebook clauses need more evidence before this decision should proceed."
		};
	}
	if (clauses.some(clause => clause.strength === "required")) {
		return {
			status: "ready-with-required-controls",
			decision: "proceed-with-controls",
			severity: "medium",
			message: "Required Sourcebook controls matched this context and the declared evidence is present."
		};
	}
	return {
		status: "ready-with-guidance",
		decision: "proceed-with-guidance",
		severity: "low",
		message: "Sourcebook guidance matched this context and the declared evidence is present."
	};
}

function governanceLayers({ clauses, filters, readiness, outcome }) {
	const pillarCodes = uniqueSorted(clauses.map(clause => clause.pillar.code));
	const triggerIds = uniqueSorted(clauses.flatMap(clause => clause.triggers));
	const requiredClauses = clauses.filter(clause => clause.strength === "required");

	return [
		{
			id: "north-star",
			title: "North Star rule",
			question: "Does this decision make research safer, more lawful, more inclusive, more useful and more traceable?",
			status: outcome.status === "no-sourcebook-match" ? "needs-sourcebook-scope" : "in-scope",
			rule: NORTH_STAR_RULE
		},
		{
			id: "operating-context",
			title: "Operating context",
			question: "Which route, condition, pillar or trigger is creating governance responsibility?",
			status: clauses.length ? "matched" : "unmatched",
			inputs: filters,
			matchedPillars: pillarCodes,
			matchedTriggers: triggerIds
		},
		{
			id: "sourcebook-clauses",
			title: "Sourcebook clauses",
			question: "Which Sourcebook clauses dictate the rule, guidance or conduct expectation?",
			status: clauses.length ? "matched" : "missing",
			requiredCount: requiredClauses.length,
			advisoryCount: clauses.length - requiredClauses.length,
			clauses
		},
		{
			id: "evidence-readiness",
			title: "Evidence readiness",
			question: "What evidence must exist before this decision is treated as governed?",
			status: readiness.status,
			...readiness
		},
		{
			id: "governance-action",
			title: "Governance action",
			question: "What should ResearchOps do next?",
			status: outcome.status,
			decision: outcome.decision,
			severity: outcome.severity,
			message: outcome.message
		}
	];
}

function evaluateGovernance(url) {
	const records = filterClauses(url);
	const routeValues = queryValues(url, "route", normaliseRoute);
	const conditionValues = queryValues(url, "condition", normaliseEvidence);
	const filters = {
		route: routeValues,
		condition: conditionValues,
		pillar: queryValues(url, "pillar"),
		evidence: queryValues(url, "evidence", normaliseEvidence),
		trigger: queryValues(url, "trigger", normaliseEvidence),
		type: queryValues(url, "type"),
		status: queryValues(url, "status"),
		q: normaliseLookup(url.searchParams.get("q"))
	};
	const providedEvidence = queryValues(url, "providedEvidence", normaliseEvidence);
	const clauses = records.map(record => governanceClause(record, routeValues, conditionValues));
	const readiness = evidenceReadiness(clauses, providedEvidence);
	const outcome = governanceOutcome(clauses, readiness);

	return {
		engine: {
			id: "sourcebook-governance-engine",
			version: GOVERNANCE_ENGINE_VERSION,
			layerCount: 5,
			northStarRule: NORTH_STAR_RULE
		},
		filters,
		outcome,
		layers: governanceLayers({ clauses, filters, readiness, outcome })
	};
}

export async function readSourcebook(svc, origin) {
	return svc.json(
		{
			ok: true,
			sourcebook: sourcebookSummary(),
			counts: {
				pillars: asArray(sourcebookIndex.pillars).length,
				clauses: allClauses().length,
				templates: asArray(sourcebookIndex.templates).length
			}
		},
		200,
		svc.corsHeaders(origin)
	);
}

export async function listSourcebookPillars(svc, origin, url) {
	const includeSections = url.searchParams.get("include") === "sections";
	return svc.json(
		{
			ok: true,
			sourcebook: sourcebookSummary(),
			pillars: asArray(sourcebookIndex.pillars).map(pillar => pillarDto(pillar, { includeSections }))
		},
		200,
		svc.corsHeaders(origin)
	);
}

export async function listSourcebookClauses(svc, origin, url) {
	const records = filterClauses(url);
	const limit = parseLimit(url);
	const offset = parseOffset(url);
	const textMode = parseTextMode(url);
	const clauses = records.slice(offset, offset + limit).map(record => clauseDto(record, { textMode }));

	return svc.json(
		{
			ok: true,
			sourcebook: sourcebookSummary(),
			filters: {
				pillar: queryValues(url, "pillar"),
				route: queryValues(url, "route", normaliseRoute),
				condition: queryValues(url, "condition", normaliseEvidence),
				evidence: queryValues(url, "evidence", normaliseEvidence),
				trigger: queryValues(url, "trigger", normaliseEvidence),
				type: queryValues(url, "type"),
				status: queryValues(url, "status"),
				q: normaliseLookup(url.searchParams.get("q")),
				includeText: textMode
			},
			pagination: {
				limit,
				offset,
				total: records.length,
				nextOffset: offset + limit < records.length ? offset + limit : null
			},
			clauses
		},
		200,
		svc.corsHeaders(origin)
	);
}

export async function evaluateSourcebookGovernance(svc, origin, url) {
	const evaluation = evaluateGovernance(url);
	return svc.json(
		{
			ok: true,
			sourcebook: sourcebookSummary(),
			evaluation
		},
		200,
		svc.corsHeaders(origin)
	);
}

export async function readSourcebookClause(svc, origin, clauseId) {
	const wanted = normaliseLookup(decodeURIComponent(clauseId || ""));
	const record = allClauses().find(item => normaliseLookup(item.clause.id) === wanted);
	if (!record) {
		return svc.json({ ok: false, error: "sourcebook_clause_not_found", clauseId }, 404, svc.corsHeaders(origin));
	}
	return svc.json(
		{
			ok: true,
			sourcebook: sourcebookSummary(),
			clause: clauseDto(record, { textMode: "verbose" })
		},
		200,
		svc.corsHeaders(origin)
	);
}
