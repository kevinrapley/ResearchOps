import {
	listProvenanceByArtifact,
	listProvenanceByStudy,
	normaliseProvenanceRecord
} from "./provenance-read.js";

export function getProvenance(service, origin, url) {
	const artifactId = url.searchParams.get("artifactId");
	if (!artifactId) {
		return service.json({ ok: false, error: "artifactId required" },
			400,
			service.corsHeaders(origin)
		);
	}

	return listProvenanceByArtifact(service.env, artifactId)
		.then(records => records.map(normaliseProvenanceRecord))
		.then(events => {
			if (!events.length) {
				return service.json({ ok: true, events: [] },
					200,
					service.corsHeaders(origin)
				);
			}

			const studyId = events[0].studyId;

			return listProvenanceByStudy(service.env, studyId)
				.then(all => all.map(normaliseProvenanceRecord))
				.then(allEvents => {
					const impact = allEvents.filter(
						e => e.parentArtifactId === artifactId
					);

					return service.json({
							ok: true,
							artifact: {
								id: artifactId,
								type: events[0].artifactType,
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

	return listProvenanceByStudy(service.env, studyId)
		.then(records => records.map(normaliseProvenanceRecord))
		.then(events => {
			const nodes = new Map();
			const edges = [];

			for (const e of events) {
				nodes.set(e.artifactId, {
					id: e.artifactId,
					type: e.artifactType,
					researcher: e.researcherName
				});

				if (e.parentArtifactId) {
					edges.push({
						source: e.parentArtifactId,
						target: e.artifactId,
						relation: e.eventType
					});
				}
			}

			return service.json({
					ok: true,
					nodes: [...nodes.values()],
					edges,
					raw: events.map(e => e.raw).filter(Boolean)
				},
				200,
				service.corsHeaders(origin)
			);
		});
}