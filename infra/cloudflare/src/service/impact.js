/**
 * @file service/impact.js
 * @summary Service API layer for Impact Tracking.
 *
 * This module wraps the internal impact functions, providing request/response
 * handlers similar to the existing service modules (e.g. journals.js). It
 * exports functions that accept a ResearchOps service instance (svc) and
 * return an async function to process the request. This design matches
 * patterns found in the existing codebase.
 */

import {
	listImpactRecords,
	createImpactRecord
} from "./impact-internals.js";

/**
 * GET /api/impact
 * Pattern: (origin, url)
 */
export function listImpact(svc) {
	return async function(origin, url) {
		const projectId = url.searchParams.get("project");
		const studyId = url.searchParams.get("study") || null;

		if (!projectId) {
			return svc.json(
				{ ok: false, error: "Missing required ?project=<id>" },
				400,
				svc.corsHeaders(origin)
			);
		}

		try {
			const items = await listImpactRecords(svc.env, {
				projectId,
				studyId
			});

			return svc.json(
				{ ok: true, items },
				200,
				svc.corsHeaders(origin)
			);

		} catch (err) {
			console.error("[impact] listImpact error:", err);
			return svc.json(
				{ ok: false, error: "Unable to list impact records" },
				500,
				svc.corsHeaders(origin)
			);
		}
	};
}

/**
 * POST /api/impact
 * Pattern: (req, origin)
 */
export function createImpact(svc) {
	return async function(req, origin) {
		let body;
		try {
			body = await req.json();
		} catch (err) {
			return svc.json(
				{ ok: false, error: "Invalid JSON" },
				400,
				svc.corsHeaders(origin)
			);
		}

		if (!body?.projectId || !body?.metricName) {
			return svc.json(
				{
					ok: false,
					error: "Missing required fields: projectId, metricName"
				},
				400,
				svc.corsHeaders(origin)
			);
		}

		try {
			const impact = await createImpactRecord(svc.env, {
				...body,
				updatedAt: new Date().toISOString()
			});

			return svc.json(
				{ ok: true, impact },
				201,
				svc.corsHeaders(origin)
			);

		} catch (err) {
			console.error("[impact] createImpact error:", err);
			return svc.json(
				{ ok: false, error: "Failed to create impact record" },
				500,
				svc.corsHeaders(origin)
			);
		}
	};
}
