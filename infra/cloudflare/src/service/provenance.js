import { createRecords } from "./internals/airtable.js";
import {
	listProvenanceByArtifact,
	listProvenanceByStudy,
	normaliseProvenanceRecord
} from "./provenance-read.js";

const TABLE_DEFAULT = "Research Provenance";

function provenanceTableName(env) {
	return String(env?.AIRTABLE_TABLE_PROVENANCE || TABLE_DEFAULT).trim();
}

function compactFields(fields) {
	const out = {};
	for (const [key, value] of Object.entries(fields)) {
		if (value === undefined || value === null) continue;
		if (typeof value === "string" && value.trim() === "") continue;
		out[key] = value;
	}
	return out;
}

function hasAirtableCredentials(env) {
	return !!((env?.AIRTABLE_BASE_ID || env?.AIRTABLE_BASE) && (env?.AIRTABLE_API_KEY || env?.AIRTABLE_PAT));
}

function eventField(event, names, fallback = "") {
	for (const name of names) {
		const value = event?.[name];
		if (value !== undefined && value !== null && String(value).trim() !== "") return value;
	}
	return fallback;
}

function provenanceFields(event = {}) {
	const graph = event.provenanceGraph || event.graph || event.raw || null;
	const changes = event.changes || null;

	return compactFields({
		"Artifact ID": eventField(event, ["artifactId", "artifact_id", "id"]),
		"Artifact Type": eventField(event, ["artifactType", "artifact_type", "type"]),
		"Event Type": eventField(event, ["eventType", "event_type", "action"]),
		"Event Time": eventField(event, ["eventTime", "event_time", "time"], new Date().toISOString()),
		Method: eventField(event, ["method", "source", "route"]),
		"Researcher ID": eventField(event, ["researcherId", "researcher_id", "userId", "user_id"]),
		"Researcher Name": eventField(event, ["researcherName", "researcher_name", "userName", "user_name"]),
		"Study ID": eventField(event, ["studyId", "study_id"]),
		"Parent Artifact ID": eventField(event, ["parentArtifactId", "parent_artifact_id"], null),
		Changes: changes ? JSON.stringify(changes) : null,
		"Provenance Graph": graph ? JSON.stringify(graph) : null
	});
}

export async function recordProvenanceEvent(service, event = {}) {
	const env = service?.env || {};
	const fields = provenanceFields(event);

	if (!fields["Artifact ID"] || !fields["Event Type"]) {
		return {
			ok: false,
			error: "Missing required provenance fields: artifactId, eventType"
		};
	}

	const table = provenanceTableName(env);

	if (env.AIRTABLE && typeof env.AIRTABLE.create === "function") {
		return env.AIRTABLE.create(table, { fields });
	}

	if (!hasAirtableCredentials(env)) {
		service?.log?.warn?.("provenance.write.skipped", {
			reason: "airtable_not_configured",
			artifactId: fields["Artifact ID"]
		});
		return { ok: false, skipped: true, reason: "airtable_not_configured" };
	}

	const result = await createRecords(env, table, [{ fields }], service?.cfg?.TIMEOUT_MS);
	return result?.records?.[0] || null;
}

export function getProvenance(service, origin, url) {
	const artifactId = url.searchParams.get("artifactId");
	if (!artifactId) {
		return service.json({ ok: false, error: "artifactId required" },
			400,
			service.corsHeaders(origin)
		);
	}

	return listProvenanceByArtifact(service, artifactId)
		.then(records => records.map(normaliseProvenanceRecord))
		.then(events => {
			if (!events.length) {
				return service.json({ ok: true, events: [] },
					200,
					service.corsHeaders(origin)
				);
			}

			const studyId = events[0].studyId;

			return listProvenanceByStudy(service, studyId)
				.then(all => all.map(normaliseProvenanceRecord))
				.then(allEvents => {
					const impact = allEvents.filter(
						e => e.lineage?.parentArtifactId === artifactId
					);

					return service.json({
							ok: true,
							artifact: {
								id: artifactId,
								type: events[0].artifact?.type,
								studyId
							},
							events,
							impact,
							raw: events.map(e => e.raw).filter(Boolean)
						},
						200,
						service.corsHeaders(origin)
					);
				});
		});
}

export function getProvenanceGraph(service, origin, url) {
	const studyId = url.searchParams.get("studyId");
	if (!studyId) {
		return service.json({ ok: false, error: "studyId required" },
			400,
			service.corsHeaders(origin)
		);
	}

	return listProvenanceByStudy(service, studyId)
		.then(records => records.map(normaliseProvenanceRecord))
		.then(events => {
			const nodes = new Map();
			const edges = [];

			for (const e of events) {
				nodes.set(e.artifact?.id, {
					id: e.artifact?.id,
					type: e.artifact?.type,
					researcher: e.researcher?.name
				});

				if (e.lineage?.parentArtifactId) {
					edges.push({
						source: e.lineage.parentArtifactId,
						target: e.artifact?.id,
						relation: e.event?.type
					});
				}
			}

			return service.json({
					ok: true,
					nodes: [...nodes.values()].filter(n => n.id),
					edges,
					raw: events.map(e => e.raw).filter(Boolean)
				},
				200,
				service.corsHeaders(origin)
			);
		});
}
