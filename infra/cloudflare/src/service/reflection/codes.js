/**
 * @file service/reflection/codes.js
 * @summary Codes service (list/create/update) for CAQDAS.
 */
import { listAll, createRecords, patchRecords } from "../internals/airtable.js";

const TABLE = (service) => service.env.AIRTABLE_TABLE_CODES || "Codes";

// Helper: map Airtable record → UI code object
function mapCodeRecord(r) {
	const f = r.fields || {};
	return {
		id: r.id,
		name: f["Name"] || f["Code"] || f["Short Name"] || "",
		description: f["Definition"] || f["Description"] || "",
		colour: f["Colour"] || f["Color"] || "#505a5f",
		parentId: Array.isArray(f["Parent"]) ? f["Parent"][0] : (f["Parent"] || null),
		projectIds: Array.isArray(f["Project ID"]) ? f["Project ID"] : (f["Project ID"] ? [f["Project ID"]] : [])
	};
}

/** GET /api/codes?project=recXXXXXXXX */
export async function listCodes(service, origin, url) {
	try {
		const project = url.searchParams.get("project") || "";
		const extraParams = project ?
			{ filterByFormula: `FIND('${project}', ARRAYJOIN({Project ID}))` } :
			undefined;

		const { records } = await listAll(service.env, TABLE(service), { extraParams });
		const codes = (records || []).map(mapCodeRecord);

		return service.json({ ok: true, codes }, 200, service.corsHeaders(origin));
	} catch (err) {
		service.log.error("codes.list", { err: String(err) });
		return service.json({ ok: false, error: "Internal error" }, 500, service.corsHeaders(origin));
	}
}

/** POST /api/codes */
export async function createCode(service, request, origin) {
	try {
		const body = await request.json().catch(() => ({}));
		const name = (body.name || "").trim();
		if (!name) {
			return service.json({ ok: false, error: "name is required" }, 400, service.corsHeaders(origin));
		}

		const fields = {
			"Name": name,
			"Definition": body.description || body.definition || "",
			"Colour": body.colour || body.color || "#1d70b8"
		};

		const projectId = body.projectId || body.project || null;
		if (projectId) fields["Project ID"] = [projectId];

		const parentId = body.parentId || body.parent || null;
		if (parentId) fields["Parent"] = [parentId];

		const resp = await createRecords(service.env, TABLE(service), [{ fields }]);
		const record = (resp.records || [])[0] || null;

		return service.json({ ok: true, record }, 201, service.corsHeaders(origin));
	} catch (err) {
		service.log.error("codes.create", { err: String(err) });
		return service.json({ ok: false, error: "Internal error" }, 500, service.corsHeaders(origin));
	}
}

/** PATCH /api/codes/:id (optional) */
export async function updateCode(service, request, origin, codeId) {
	try {
		const body = await request.json().catch(() => ({}));
		const fields = {};
		if ("name" in body) fields["Name"] = body.name || "";
		if ("description" in body || "definition" in body) fields["Definition"] = body.description || body.definition || "";
		if ("colour" in body || "color" in body) fields["Colour"] = body.colour || body.color || "#1d70b8";
		if ("parentId" in body || "parent" in body) {
			const v = body.parentId || body.parent || null;
			fields["Parent"] = v ? [v] : [];
		}
		if ("projectId" in body || "project" in body) {
			const v = body.projectId || body.project || null;
			fields["Project ID"] = v ? [v] : [];
		}

		const resp = await patchRecords(service.env, TABLE(service), [{ id: codeId, fields }]);
		const record = (resp.records || [])[0] || null;

		return service.json({ ok: true, record }, 200, service.corsHeaders(origin));
	} catch (err) {
		service.log.error("codes.update", { err: String(err) });
		return service.json({ ok: false, error: "Internal error" }, 500, service.corsHeaders(origin));
	}
}
