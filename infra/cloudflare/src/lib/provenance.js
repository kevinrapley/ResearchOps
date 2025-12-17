/**
 * @file src/lib/provenance.js
 * @module lib/provenance
 * @summary PROV-O compliant provenance recording for ResearchOps artefacts.
 *
 * Design notes:
 * - lib/ owns the provenance model and write contract.
 * - service/ owns when provenance is recorded and what context is supplied.
 * - This module does not depend on HTTP, routing, or UI.
 *
 * Expectations:
 * - A caller passes a `service` that provides:
 *   - service.env (env vars)
 *   - service.airtable (or compatible) with create(tableName, fields)
 *   - service.log (optional) for audit logging
 *
 * - Airtable table name is read from env if present:
 *   - AIRTABLE_TABLE_PROVENANCE
 *   - falls back to "Research Provenance"
 */

const CONTEXT = Object.freeze({
	prov: "http://www.w3.org/ns/prov#",
	research: "urn:uk-gov:research:",
	dcterms: "http://purl.org/dc/terms/"
});

const EVENT_TYPES = Object.freeze({
	creation: "creation",
	modification: "modification",
	derivation: "derivation"
});

function nowIso() {
	return new Date().toISOString();
}

function ensureString(name, value) {
	if (typeof value !== "string" || !value.trim()) {
		throw new Error(`ProvenanceTracker: missing or invalid ${name}`);
	}
	return value.trim();
}

function maybeString(value) {
	return (typeof value === "string" && value.trim()) ? value.trim() : "";
}

function safeJsonStringify(value) {
	if (value === undefined) return "";
	try {
		return JSON.stringify(value);
	} catch {
		return "";
	}
}

function randomActivityId() {
	// Cloudflare Workers supports crypto.randomUUID()
	return `research:activity:${crypto.randomUUID()}`;
}

function entityId(type, id) {
	return `research:${type}:${id}`;
}

export class ProvenanceTracker {
	/**
	 * @param {object} service
	 */
	constructor(service) {
		if (!service) throw new Error("ProvenanceTracker: service is required");
		this.service = service;
		this.env = service.env || {};
		this.tableName = this.env.AIRTABLE_TABLE_PROVENANCE || "Research Provenance";
	}

	/**
	 * Build a PROV-O record for a single artefact event.
	 *
	 * @param {object} args
	 * @param {"creation"|"modification"|"derivation"} args.eventType
	 * @param {{id:string,type:string,studyId:string,createdAt:string,modifiedAt?:string}} args.artifact
	 * @param {{researcherId:string,researcherName:string,method:string}} args.context
	 * @param {string} [args.parentId]
	 * @param {any} [args.changes]
	 */
	buildProvRecord({ eventType, artifact, context, parentId, changes }) {
		if (!EVENT_TYPES[eventType]) {
			throw new Error(`ProvenanceTracker: unsupported eventType "${eventType}"`);
		}

		const artifactId = ensureString("artifact.id", artifact?.id);
		const artifactType = ensureString("artifact.type", artifact?.type);
		const studyId = ensureString("artifact.studyId", artifact?.studyId);
		const createdAt = ensureString("artifact.createdAt", artifact?.createdAt);

		const researcherId = ensureString("context.researcherId", context?.researcherId);
		const researcherName = ensureString("context.researcherName", context?.researcherName);
		const method = ensureString("context.method", context?.method);

		const activityId = randomActivityId();
		const eventTime = nowIso();

		const record = {
			"@context": CONTEXT,
			"@type": "prov:Entity",
			"@id": entityId(artifactType, artifactId),
			"dcterms:created": createdAt,
			"dcterms:modified": artifact?.modifiedAt || createdAt,
			"research:method": method,
			"research:studyId": studyId,
			"prov:wasGeneratedBy": {
				"@type": "prov:Activity",
				"@id": activityId,
				"prov:startedAtTime": eventTime,
				"prov:wasAssociatedWith": {
					"@type": "prov:Agent",
					"@id": `research:researcher:${researcherId}`,
					"research:name": researcherName
				},
				"research:eventType": eventType
			}
		};

		if (eventType === EVENT_TYPES.derivation) {
			const parent = ensureString("parentId", parentId);
			record["prov:wasDerivedFrom"] = { "@id": entityId(artifactType, parent) };
		}

		if (eventType === EVENT_TYPES.modification && changes !== undefined) {
			record["prov:wasRevisionOf"] = {
				"@id": entityId(artifactType, artifactId),
				"prov:value": changes
			};
		}

		return { record, meta: { activityId, eventTime, artifactId, artifactType, studyId, method, researcherId, researcherName, parentId } };
	}

	/**
	 * Persist a provenance row to Airtable.
	 *
	 * @param {object} provRecord
	 * @param {object} meta
	 */
	async save(provRecord, meta) {
		const service = this.service;

		if (!service?.airtable?.create && !service?.env?.AIRTABLE) {
			throw new Error("ProvenanceTracker: no airtable client available on service");
		}

		const createFn = service?.airtable?.create || service?.env?.AIRTABLE?.create;
		if (typeof createFn !== "function") {
			throw new Error("ProvenanceTracker: airtable.create is not a function");
		}

		const fields = {
			"Artifact ID": meta.artifactId,
			"Artifact Type": meta.artifactType,
			"Activity ID": meta.activityId,
			"Event Type": meta.eventType,
			"Event Time": meta.eventTime,
			"Researcher ID": meta.researcherId,
			"Researcher Name": meta.researcherName,
			"Study ID": meta.studyId,
			"Method": meta.method,
			"Parent Artifact ID": maybeString(meta.parentId),
			"Changes": meta.changes !== undefined ? safeJsonStringify(meta.changes) : "",
			"Provenance Graph": safeJsonStringify(provRecord)
		};

		const result = await createFn.call(service?.airtable || service?.env?.AIRTABLE, this.tableName, fields);

		if (service?.log && typeof service.log.info === "function") {
			service.log.info("provenance.write", {
				table: this.tableName,
				artifactId: meta.artifactId,
				artifactType: meta.artifactType,
				eventType: meta.eventType,
				activityId: meta.activityId
			});
		}

		return result;
	}

	/**
	 * Record creation provenance for an artefact.
	 */
	async recordCreation(artifact, context) {
		const { record, meta } = this.buildProvRecord({
			eventType: EVENT_TYPES.creation,
			artifact,
			context
		});

		return this.save(record, {
			...meta,
			eventType: EVENT_TYPES.creation
		});
	}

	/**
	 * Record modification provenance for an artefact.
	 */
	async recordModification(artifact, context, changes) {
		const { record, meta } = this.buildProvRecord({
			eventType: EVENT_TYPES.modification,
			artifact,
			context,
			changes
		});

		return this.save(record, {
			...meta,
			eventType: EVENT_TYPES.modification,
			changes
		});
	}

	/**
	 * Record derivation provenance for an artefact.
	 * Note: parentId is required.
	 */
	async recordDerivation(artifact, context, parentId) {
		const { record, meta } = this.buildProvRecord({
			eventType: EVENT_TYPES.derivation,
			artifact,
			context,
			parentId
		});

		return this.save(record, {
			...meta,
			eventType: EVENT_TYPES.derivation,
			parentId
		});
	}
}