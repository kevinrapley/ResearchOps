/**
 * @file src/service/reflection/codes.js
 * @module service/codes
 * @summary Code management for qualitative data analysis
 */

export async function getCodebook(svc, origin, projectId) {
	const tableName = svc.env.AIRTABLE_TABLE_CODES || "Codes";
	const { records } = await listAll(svc.env, tableName, {
		filterByFormula: `{Project} = '${projectId}'`
	});

	// Build hierarchical codebook
	const codes = records.map(r => ({
		id: r.id,
		name: r.fields.Name,
		definition: r.fields.Definition || '',
		parent: r.fields.ParentCode || null,
		color: r.fields.Color || '#505a5f',
		examples: r.fields.Examples || '',
		createdAt: r.createdTime
	}));

	return svc.json({ ok: true, codes }, 200, svc.corsHeaders(origin));
}

export async function createCode(svc, request, origin) {
	const body = await request.json();

	const fields = {
		Project: [body.project_id],
		Name: body.name,
		Definition: body.definition || '',
		ParentCode: body.parent ? [body.parent] : undefined,
		Color: body.color || generateCodeColor(body.name),
		Examples: body.examples || ''
	};

	const result = await createRecords(svc.env, "Codes", [{ fields }]);
	return svc.json({ ok: true, id: result.records[0].id }, 200, svc.corsHeaders(origin));
}
