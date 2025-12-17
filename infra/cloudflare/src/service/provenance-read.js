/**
 * @file src/service/read-provenance.js
 * @summary Read-model adapter for provenance records stored in Airtable.
 */

const TABLE_DEFAULT = "Research Provenance";

function parseJSONSafe(value) {
	if (typeof value !== "string" || !value.trim()) return null;
	try { return JSON.parse(value); } catch { return null; }
}

export function normaliseProvenanceRecord(record) {
	const f = record?.fields || {};

	return {
		id: record.id,

		artifact: {
			id: f["Artifact ID"] || "",
			type: f["Artifact Type"] || ""
		},

		event: {
			type: f["Event Type"] || "",
			time: f["Event Time"] || "",
			method: f["Method"] || ""
		},

		researcher: {
			id: f["Researcher ID"] || "",
			name: f["Researcher Name"] || ""
		},

		studyId: f["Study ID"] || "",

		lineage: {
			parentArtifactId: f["Parent Artifact ID"] || null
		},

		changes: parseJSONSafe(f["Changes"]),
		raw: parseJSONSafe(f["Provenance Graph"])
	};
}

export async function listProvenanceByArtifact(service, artifactId) {
	const table = service.env.AIRTABLE_TABLE_PROVENANCE || TABLE_DEFAULT;

	return service.env.AIRTABLE.list(table, {
		filterByFormula: `{Artifact ID} = '${artifactId}'`,
		sort: [{ field: "Event Time", direction: "asc" }]
	});
}

export async function listProvenanceByStudy(service, studyId) {
	const table = service.env.AIRTABLE_TABLE_PROVENANCE || TABLE_DEFAULT;

	return service.env.AIRTABLE.list(table, {
		filterByFormula: `{Study ID} = '${studyId}'`
	});
}