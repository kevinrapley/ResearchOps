/**
 * @file service/reflection/codes.js
 * @summary Codes service (list/create/update) for CAQDAS.
 */
import { listAll, createRecords, patchRecords } from "../internals/airtable.js";

const TABLE = (service) => service.env.AIRTABLE_TABLE_CODES || "Codes";

/** Map Airtable record → UI code object (single projectId) */
function mapCodeRecord(r) {
  const f = r.fields || {};
  // Airtable returns an array even for single links; we surface a scalar.
  const projectId = Array.isArray(f["Project"]) ? (f["Project"][0] || null) : (f["Project"] ?? null);

  return {
    id: r.id,
    name: f["Name"] || f["Code"] || f["Short Name"] || "",
    description: f["Definition"] || f["Description"] || "",
    colour: f["Colour"] || f["Color"] || "#505a5f",
    parentId: Array.isArray(f["Parent"]) ? (f["Parent"][0] || null) : (f["Parent"] ?? null),
    projectId
  };
}

/** GET /api/codes?project=recXXXXXXXX */
export async function listCodes(service, origin, url) {
  try {
    const project = url.searchParams.get("project") || "";
    const table = TABLE(service);

    const extraParams = project
      ? { filterByFormula: `FIND('${project}', ARRAYJOIN({Project}))` }
      : undefined;

    const { records } = await listAll(service.env, table, { extraParams });
    const codes = (records || []).map(mapCodeRecord);

    return service.json({ ok: true, codes }, 200, service.corsHeaders(origin));
  } catch (err) {
    service.log.error("codes.list", { err: String(err) });
    return service.json({ ok: false, error: "Internal error" }, 500, service.corsHeaders(origin));
  }
}

/** POST /api/codes  (expects a single projectId, not an array) */
export async function createCode(service, request, origin) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = (body.name || "").trim();
    if (!name) {
      return service.json({ ok: false, error: "name is required" }, 400, service.corsHeaders(origin));
    }

    const projectId = body.projectId || body.project || null;
    const parentId = body.parentId || body.parent || null;

    const fields = {
      "Name": name,
      "Definition": body.description || body.definition || "",
      "Colour": body.colour || body.color || "#1d70b8",
      ...(projectId ? { "Project": [projectId] } : {}),
      ...(parentId ? { "Parent": [parentId] } : {})
    };

    const resp = await createRecords(service.env, TABLE(service), [{ fields }]);
    const record = (resp.records || [])[0] || null;

    return service.json({ ok: true, record: record ? mapCodeRecord(record) : null }, 201, service.corsHeaders(origin));
  } catch (err) {
    service.log.error("codes.create", { err: String(err) });
    return service.json({ ok: false, error: "Internal error" }, 500, service.corsHeaders(origin));
  }
}

/** PATCH /api/codes/:id  (accepts a single projectId) */
export async function updateCode(service, request, origin, codeId) {
  try {
    const body = await request.json().catch(() => ({}));
    const fields = {};

    if ("name" in body) fields["Name"] = body.name || "";
    if ("description" in body || "definition" in body) {
      fields["Definition"] = body.description || body.definition || "";
    }
    if ("colour" in body || "color" in body) {
      fields["Colour"] = body.colour || body.color || "#1d70b8";
    }
    if ("parentId" in body || "parent" in body) {
      const v = body.parentId || body.parent || null;
      fields["Parent"] = v ? [v] : [];
    }
    if ("projectId" in body || "project" in body) {
      const v = body.projectId || body.project || null;
      fields["Project"] = v ? [v] : [];
    }

    const resp = await patchRecords(service.env, TABLE(service), [{ id: codeId, fields }]);
    const record = (resp.records || [])[0] || null;

    return service.json({ ok: true, record: record ? mapCodeRecord(record) : null }, 200, service.corsHeaders(origin));
  } catch (err) {
    service.log.error("codes.update", { err: String(err) });
    return service.json({ ok: false, error: "Internal error" }, 500, service.corsHeaders(origin));
  }
}
