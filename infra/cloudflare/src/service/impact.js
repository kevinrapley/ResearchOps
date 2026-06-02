/**
 * @file service/impact.js
 * @summary Service API layer for Impact Tracking.
 */

import {
	createImpactRecord,
	deleteImpactRecord,
	getImpactRecord,
	listImpactRecords,
	updateImpactRecord
} from "./impact-internals.js";

function errorStatus(error, fallback = 500) {
	const status = Number(error?.status || error?.statusCode || fallback);
	return Number.isInteger(status) && status >= 400 && status <= 599 ? status : fallback;
}

async function readJson(req) {
	try {
		return await req.json();
	} catch {
		const error = new Error("Invalid JSON");
		error.status = 400;
		throw error;
	}
}

export function listImpact(svc) {
	return async function(origin, url) {
		const projectId = url.searchParams.get("project");
		const studyId = url.searchParams.get("study") || null;

		if (!projectId) {
			return svc.json({ ok: false, error: "Missing required ?project=<id>" }, 400, svc.corsHeaders(origin));
		}

		try {
			const items = await listImpactRecords(svc.env, { projectId, studyId });
			return svc.json({ ok: true, items }, 200, svc.corsHeaders(origin));
		} catch (err) {
			console.error("[impact] listImpact error:", err);
			return svc.json({ ok: false, error: "Unable to list impact records" }, errorStatus(err), svc.corsHeaders(origin));
		}
	};
}

export function getImpact(svc) {
	return async function(origin, recordId) {
		try {
			const impact = await getImpactRecord(svc.env, recordId);
			if (!impact || impact.deletedAt) return svc.json({ ok: false, error: "Impact record not found" }, 404, svc.corsHeaders(origin));
			return svc.json({ ok: true, impact }, 200, svc.corsHeaders(origin));
		} catch (err) {
			console.error("[impact] getImpact error:", err);
			return svc.json({ ok: false, error: "Unable to read impact record" }, errorStatus(err), svc.corsHeaders(origin));
		}
	};
}

export function createImpact(svc) {
	return async function(req, origin) {
		let body;
		try {
			body = await readJson(req);
		} catch (err) {
			return svc.json({ ok: false, error: err.message }, errorStatus(err, 400), svc.corsHeaders(origin));
		}

		if (!body?.projectId || !body?.metricName) {
			return svc.json({ ok: false, error: "Missing required fields: projectId, metricName" }, 400, svc.corsHeaders(origin));
		}

		try {
			const impact = await createImpactRecord(svc.env, body);
			return svc.json({ ok: true, impact }, 201, svc.corsHeaders(origin));
		} catch (err) {
			console.error("[impact] createImpact error:", err);
			return svc.json({ ok: false, error: err?.message || "Failed to create impact record" }, errorStatus(err), svc.corsHeaders(origin));
		}
	};
}

export function updateImpact(svc) {
	return async function(req, origin, recordId) {
		let body;
		try {
			body = await readJson(req);
		} catch (err) {
			return svc.json({ ok: false, error: err.message }, errorStatus(err, 400), svc.corsHeaders(origin));
		}

		try {
			const impact = await updateImpactRecord(svc.env, recordId, body);
			if (!impact) return svc.json({ ok: false, error: "Impact record not found" }, 404, svc.corsHeaders(origin));
			return svc.json({ ok: true, impact }, 200, svc.corsHeaders(origin));
		} catch (err) {
			console.error("[impact] updateImpact error:", err);
			return svc.json({ ok: false, error: err?.message || "Failed to update impact record" }, errorStatus(err), svc.corsHeaders(origin));
		}
	};
}

export function deleteImpact(svc) {
	return async function(origin, recordId) {
		try {
			const impact = await getImpactRecord(svc.env, recordId);
			if (!impact || impact.deletedAt) return svc.json({ ok: false, error: "Impact record not found" }, 404, svc.corsHeaders(origin));
			const deleted = await deleteImpactRecord(svc.env, recordId);
			return svc.json({ ok: true, deleted }, 200, svc.corsHeaders(origin));
		} catch (err) {
			console.error("[impact] deleteImpact error:", err);
			return svc.json({ ok: false, error: err?.message || "Failed to delete impact record" }, errorStatus(err), svc.corsHeaders(origin));
		}
	};
}
