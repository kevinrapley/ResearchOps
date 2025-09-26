/* ResearchOps SDK — v1.0.0
   Scope: Org→Project→Study→Session, Consent, Notes, Tags, Manual Clusters/Themes
   Ethics/Compliance-first. JSON-LD envelopes with web ontologies.
   (c) Your Org. All rights reserved.
*/
(function(global) {
	"use strict";

	const VERSION = "1.0.0";

	// ---- JSON-LD Context (shared) ----
	const JSONLD_CONTEXT = {
		"@context": {
			"id": "@id",
			"type": "@type",
			"dcterms": "http://purl.org/dc/terms/",
			"skos": "http://www.w3.org/2004/02/skos/core#",
			"oa": "http://www.w3.org/ns/oa#",
			"schema": "https://schema.org/",
			"prov": "http://www.w3.org/ns/prov#",
			"dpv": "https://w3id.org/dpv#",
			"rops": "https://example.org/researchops#",
			"name": "dcterms:title",
			"description": "dcterms:description",
			"created": "dcterms:created",
			"modified": "dcterms:modified",
			"creator": "dcterms:creator",
			"theme": "skos:Concept",
			"notation": "skos:notation",
			"inScheme": "skos:inScheme",
			"hasBody": "oa:hasBody",
			"hasTarget": "oa:hasTarget",
			"motivatedBy": "oa:motivatedBy",
			"Person": "schema:Person",
			"Organization": "schema:Organization",
			"Dataset": "schema:Dataset",
			"ResearchProject": "schema:ResearchProject",
			"ResearchStudy": "schema:Study",
			"ResearchSession": "schema:Event",
			"Note": "schema:CreativeWork",
			"Tag": "skos:Concept",
			"Cluster": "skos:Collection",
			"Theme": "skos:Concept",
			"Consent": "dpv:Consent",
			"LawfulBasis": "dpv:LegalBasis",
			"RetentionSchedule": "dpv:StorageCondition",
			"aud": "rops:aud",
			"scope": "rops:scope",
			"entityType": "rops:entityType"
		}
	};

	// ---- Minimal event bus ----
	const listeners = {};

	function emit(type, payload) {
		(listeners[type] || []).forEach(fn => fn(payload));
		(listeners["*"] || []).forEach(fn => fn({ type, payload }));
	}

	function on(type, fn) {
		if (!listeners[type]) listeners[type] = [];
		listeners[type].push(fn);
		return () => (listeners[type] = listeners[type].filter(f => f !== fn));
	}

	// ---- LocalStorage adapter ----
	const defaultStore = {
		save: async (collection, obj) => {
			const key = `${collection}:${obj.id}`;
			localStorage.setItem(key, JSON.stringify(obj));
			return obj;
		},
		get: async (collection, id) => {
			const raw = localStorage.getItem(`${collection}:${id}`);
			return raw ? JSON.parse(raw) : null;
		},
		query: async (prefix) => {
			const out = [];
			for (let i = 0; i < localStorage.length; i++) {
				const k = localStorage.key(i);
				if (k && k.startsWith(prefix)) {
					out.push(JSON.parse(localStorage.getItem(k)));
				}
			}
			return out;
		},
		remove: async (collection, id) => {
			localStorage.removeItem(`${collection}:${id}`);
		}
	};

	function uid(prefix) {
		return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
	}

	function createSDK({ org, project, study, user, storage = defaultStore }) {
		if (!org || !project || !study) throw new Error("org, project, study are required");
		const scope = { org, project, study };
		const base = { ...JSONLD_CONTEXT, scope };

		function envelope(entityType, body) {
			return {
				...base,
				id: body.id || uid(entityType.toLowerCase()),
				type: entityType,
				entityType,
				created: new Date().toISOString(),
				creator: user || "unknown",
				...body
			};
		}

		async function createProject({ name, phase, status, description = "", stakeholders = [], objectives = [], user_groups = [] }) {
			const obj = envelope("ResearchProject", {
				name,
				description,
				"rops:servicePhase": phase, // pre-discovery, discovery, alpha, beta, live, retired
				"rops:projectStatus": status, // goal-setting, planning, conducting, synthesis, shared, monitoring
				stakeholders, // [{name, role, email?}]
				objectives, // array of short strings
				user_groups, // array of strings
				aud: scope
			});
			await storage.save("project", obj);
			emit("project.created", obj);
			return obj;
		}

		async function listProjects() {
			return (await storage.query("project:"))
				.sort((a, b) => (a.created > b.created ? -1 : 1));
		}

		async function getProject(id) {
			return storage.get("project", id);
		}

		async function createSession({ title, when = new Date().toISOString(), participants = [] }) {
			const obj = envelope("ResearchSession", {
				name: title,
				"schema:startDate": when,
				participants,
				aud: scope
			});
			await storage.save("session", obj);
			emit("session.created", obj);
			return obj;
		}

		async function linkConsent(sessionId, { consentId, lawfulBasis, retentionISO8601, notes }) {
			const consent = envelope("Consent", {
				id: consentId || uid("consent"),
				LawfulBasis: lawfulBasis || "dpv:Consent",
				RetentionSchedule: retentionISO8601 || "P12M",
				description: notes || "",
				hasTarget: sessionId
			});
			await storage.save("consent", consent);
			emit("consent.linked", consent);
			return consent;
		}

		async function addNote(sessionId, { text, tags = [] }) {
			const note = envelope("Note", {
				hasTarget: sessionId,
				hasBody: text
			});
			await storage.save("note", note);
			emit("note.created", note);
			for (const t of tags) await addTag(note.id, t);
			return note;
		}

		async function addTag(targetId, label) {
			const tag = envelope("Tag", {
				name: label,
				inScheme: `${scope.org}::${scope.project}::taxonomy`,
				hasTarget: targetId
			});
			await storage.save("tag", tag);
			emit("tag.added", tag);
			return tag;
		}

		async function createCluster({ label, members = [] }) {
			const cluster = envelope("Cluster", { name: label, members });
			await storage.save("cluster", cluster);
			emit("cluster.created", cluster);
			return cluster;
		}

		async function publishTheme({ label, description, evidenceIds = [] }) {
			const theme = envelope("Theme", {
				name: label,
				description,
				members: evidenceIds,
				notation: `THEME-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
			});
			await storage.save("theme", theme);
			emit("theme.published", theme);
			return theme;
		}

		async function search({ q, type }) {
			const all = await storage.query("");
			const hay = type ? all.filter(x => x.entityType === type) : all;
			if (!q) return hay;
			const needle = q.toLowerCase();
			return hay.filter(x => JSON.stringify(x).toLowerCase().includes(needle));
		}

		return {
			VERSION,
			scope,
			on,
			emit,
			createSession,
			linkConsent,
			addNote,
			addTag,
			createCluster,
			publishTheme,
			search,
			createProject,
			listProjects,
			getProject
		};
	}

	global.ResearchOpsSDK = { createSDK, VERSION };
})(typeof window !== "undefined" ? window : globalThis);

const ResearchOpsSDK = (typeof window !== "undefined" ? window : globalThis).ResearchOpsSDK;
export { ResearchOpsSDK };
export default ResearchOpsSDK;
