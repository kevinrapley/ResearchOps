// infra/cloudflare/src/service/memos.js
/**
 * Memos service: list/create/update
 * Uses AIRTABLE_TABLE_MEMOS || "Memos"
 * Fields tolerated:
 *  - Project link: "Project" | "Projects"
 *  - Type: "Memo Type" | "Type"
 *  - Content: "Content" | "Body" | "Notes"
 *  - Linked entries: "Linked Entries" | "Entries"
 *  - Author: "Author"
 */

export async function listMemos(svc, origin, url) {
	try {
		const projectId = url.searchParams.get("project") || "";
		if (!projectId) return svc.json({ ok: true, memos: [] }, 200, svc.corsHeaders(origin));

		if (!svc?.env?.AIRTABLE_BASE_ID || !(svc?.env?.AIRTABLE_API_KEY || svc?.env?.AIRTABLE_ACCESS_TOKEN)) {
			return svc.json({ ok: true, memos: [] }, 200, svc.corsHeaders(origin));
		}

		const tableRef = svc.env.AIRTABLE_TABLE_MEMOS || "Memos";
		const { listAll } = await import("./internals/airtable.js");

		// Fetch and filter in Worker (avoids formula field-name pitfalls)
		const res = await listAll(svc.env, tableRef, { pageSize: 100 }, svc?.cfg?.TIMEOUT_MS);
		const records = Array.isArray(res?.records) ? res.records : Array.isArray(res) ? res : [];

		const out = [];
		for (const r of records) {
			const f = r?.fields || {};
			const linkedProjects = Array.isArray(f.Project) ? f.Project :
				Array.isArray(f.Projects) ? f.Projects :
				[];
			if (!linkedProjects.includes(projectId)) continue;

			out.push({
				id: r.id,
				memoType: f["Memo Type"] || f.Type || "memo",
				content: f.Content || f.Body || f.Notes || "",
				author: f.Author || "",
				linkedEntries: Array.isArray(f["Linked Entries"]) ? f["Linked Entries"] :
					Array.isArray(f.Entries) ? f.Entries :
					[],
				createdAt: r.createdTime || f.Created || ""
			});
		}

		return svc.json({ ok: true, memos: out }, 200, svc.corsHeaders(origin));
	} catch (e) {
		const msg = String(e?.message || e || "");
		svc?.log?.error?.("memos.list.fail", { err: msg });
		const status = /Airtable\s+40[13]/i.test(msg) ? 502 : 500;
		return svc.json({ ok: false, error: "Failed to load memos", detail: msg }, status, svc.corsHeaders(origin));
	}
}

/**
 * Body schema (from client or internal calls):
 * {
 *   project_id: "rec…",          // required
 *   memo_type: "analytical"|..., // optional
 *   content: "text",             // required
 *   linked_entries: ["rec…"],    // optional
 *   author: "Name"               // optional
 * }
 */
export async function createMemo(svc, request, origin) {
	try {
		const buf = await request.arrayBuffer();
		if (svc?.cfg?.MAX_BODY_BYTES && buf.byteLength > svc.cfg.MAX_BODY_BYTES) {
			return svc.json({ error: "Payload too large" }, 413, svc.corsHeaders(origin));
		}

		/** @type {{project_id?:string,memo_type?:string,content?:string,linked_entries?:string[],author?:string}} */
		let p;
		try { p = JSON.parse(new TextDecoder().decode(buf)); } catch { p = {}; }

		const projectId = (p.project_id || "").trim();
		const content = (p.content || "").trim();
		const memoType = (p.memo_type || "memo").trim();
		const author = (p.author || "").trim();
		const linked = Array.isArray(p.linked_entries) ? p.linked_entries : [];

		if (!projectId || !content) {
			return svc.json({ error: "Missing required fields", detail: "project_id, content" }, 400, svc.corsHeaders(origin));
		}

		const tableRef = svc.env.AIRTABLE_TABLE_MEMOS || "Memos";
		const { createRecords } = await import("./internals/airtable.js");

		// Try schema permutations
		const LINK_FIELDS = ["Project", "Projects"];
		const CONTENT_FIELDS = ["Content", "Body", "Notes"];
		const TYPE_FIELDS = ["Memo Type", "Type"];
		const LINKED_ENTRY_FIELDS = ["Linked Entries", "Entries"];

		for (const linkName of LINK_FIELDS) {
			for (const contentField of CONTENT_FIELDS) {
				for (const typeField of TYPE_FIELDS) {
					for (const linkedField of LINKED_ENTRY_FIELDS) {
						const fields = {
							[linkName]: [projectId],
							[contentField]: content,
							[typeField]: memoType,
							Author: author || undefined,
							[linkedField]: linked.length ? linked : undefined
						};

						// prune empties
						for (const k of Object.keys(fields)) {
							const v = fields[k];
							if (
								v === undefined || v === null ||
								(typeof v === "string" && v.trim() === "") ||
								(Array.isArray(v) && v.length === 0)
							) delete fields[k];
						}

						try {
							const res = await createRecords(svc.env, tableRef, [{ fields }], svc?.cfg?.TIMEOUT_MS);
							const id = res?.records?.[0]?.id;
							if (!id) {
								return svc.json({ error: "Airtable response missing id" }, 502, svc.corsHeaders(origin));
							}
							if (svc.env.AUDIT === "true") {
								svc?.log?.info?.("memos.create.ok", { id, linkName, contentField, typeField, linkedField, tableRef });
							}
							return svc.json({ ok: true, id }, 201, svc.corsHeaders(origin));
						} catch (err) {
							const msg = String(err?.message || err || "");
							if (/422/.test(msg) && /UNKNOWN_FIELD_NAME/i.test(msg)) {
								// try next permutation
								continue;
							}
							svc?.log?.error?.("memos.create.fail", { err: msg, linkName, contentField, typeField, linkedField, tableRef });
							return svc.json({ error: "Failed to create memo", detail: msg }, 500, svc.corsHeaders(origin));
						}
					}
				}
			}
		}

		// No schema matched
		return svc.json({
			error: "Field configuration error",
			detail: `Ensure "${tableRef}" has a link to Projects (Project/Projects), a content field (Content/Body/Notes), a type field (Memo Type/Type), and optional link field (Linked Entries/Entries).`
		}, 422, svc.corsHeaders(origin));
	} catch (fatal) {
		const msg = String(fatal?.message || fatal || "");
		svc?.log?.error?.("memos.create.fatal", { err: msg });
		return svc.json({ error: "Internal error", detail: msg }, 500, svc.corsHeaders(origin));
	}
}

export async function updateMemo(svc, request, origin, memoId) {
	try {
		const buf = await request.arrayBuffer();
		/** @type {{memo_type?:string,content?:string,author?:string,linked_entries?:string[]}} */
		let p;
		try { p = JSON.parse(new TextDecoder().decode(buf)); } catch { p = {}; }

		const tableRef = svc.env.AIRTABLE_TABLE_MEMOS || "Memos";
		const { patchRecords } = await import("./internals/airtable.js");

		const CONTENT_FIELDS = ["Content", "Body", "Notes"];
		const TYPE_FIELDS = ["Memo Type", "Type"];
		const LINKED_ENTRY_FIELDS = ["Linked Entries", "Entries"];

		// Build candidate updates; first one that succeeds wins
		const candidates = [];
		if (p.content != null)
			for (const cf of CONTENT_FIELDS) candidates.push({
				[cf]: p.content });
		if (p.memo_type != null)
			for (const tf of TYPE_FIELDS) candidates.push({
				[tf]: p.memo_type });
		if (p.author != null) candidates.push({ Author: p.author });
		if (Array.isArray(p.linked_entries))
			for (const lf of LINKED_ENTRY_FIELDS) candidates.push({
				[lf]: p.linked_entries });

		if (candidates.length === 0) {
			return svc.json({ ok: true, id: memoId }, 200, svc.corsHeaders(origin)); // nothing to change
		}

		for (const fields of candidates) {
			try {
				await patchRecords(svc.env, tableRef, [{ id: memoId, fields }], svc?.cfg?.TIMEOUT_MS);
				return svc.json({ ok: true, id: memoId }, 200, svc.corsHeaders(origin));
			} catch (err) {
				const msg = String(err?.message || err || "");
				if (/422/.test(msg) && /UNKNOWN_FIELD_NAME/i.test(msg)) {
					continue; // try next field name
				}
				svc?.log?.error?.("memos.update.fail", { err: msg, memoId, fields, tableRef });
				return svc.json({ error: "Failed to update memo", detail: msg }, 500, svc.corsHeaders(origin));
			}
		}

		return svc.json({ error: "Field configuration error", detail: "No matching memo fields to update." }, 422, svc.corsHeaders(origin));
	} catch (fatal) {
		const msg = String(fatal?.message || fatal || "");
		svc?.log?.error?.("memos.update.fatal", { err: msg, memoId });
		return svc.json({ error: "Internal error", detail: msg }, 500, svc.corsHeaders(origin));
	}
}
