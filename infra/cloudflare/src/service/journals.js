/**
 * @file src/service/journals.js
 * @module service/journals
 * @summary Reflexive journal handling for qualitatitve research.
 */

/**
 * List journal entries for a project.
 * @route GET /api/journal-entries?project=<ProjectAirtableId>
 * @returns { ok:boolean, entries:Array<{id,category,content,tags,author,createdAt}> }
 */
async listJournalEntries(origin, url) {
	const projectId = url.searchParams.get("project");
	if (!projectId) {
		return this.json({ ok: false, error: "Missing project query" }, 400, this.corsHeaders(origin));
	}

	const base = this.env.AIRTABLE_BASE_ID;
	const tJournal = encodeURIComponent(this.env.AIRTABLE_TABLE_JOURNAL || "Journal Entries");
	const atBase = `https://api.airtable.com/v0/${base}/${tJournal}`;
	const headers = { "Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}` };

	const records = [];
	let offset;

	do {
		const params = new URLSearchParams({ pageSize: "100" });
		if (offset) params.set("offset", offset);
		const resp = await fetchWithTimeout(`${atBase}?${params.toString()}`, { headers }, this.cfg.TIMEOUT_MS);
		const txt = await resp.text();

		if (!resp.ok) {
			this.log.error("airtable.journal.list.fail", { status: resp.status, text: safeText(txt) });
			return this.json({ ok: false, error: `Airtable ${resp.status}`, detail: safeText(txt) }, resp.status, this.corsHeaders(origin));
		}

		let js;
		try { js = JSON.parse(txt); } catch { js = { records: [] }; }
		records.push(...(js.records || []));
		offset = js.offset;
	} while (offset);

	// Filter to this project (handle "Project" or "Projects" field name)
	const LINK_FIELDS = ["Project", "Projects"];
	const entries = [];

	for (const r of records) {
		const f = r.fields || {};
		const linkKey = LINK_FIELDS.find(k => Array.isArray(f[k]));
		const linkArr = linkKey ? f[linkKey] : undefined;

		if (Array.isArray(linkArr) && linkArr.includes(projectId)) {
			// Parse tags (could be comma-separated string or array)
			let tags = [];
			if (Array.isArray(f.Tags)) {
				tags = f.Tags;
			} else if (typeof f.Tags === 'string') {
				tags = f.Tags.split(',').map(t => t.trim()).filter(Boolean);
			}

			entries.push({
				id: r.id,
				category: f.Category || "procedures",
				content: f.Content || "",
				tags: tags,
				author: f.Author || "",
				createdAt: r.createdTime || ""
			});
		}
	}

	// Sort newest first
	entries.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
	return this.json({ ok: true, entries }, 200, this.corsHeaders(origin));
}

/**
 * Create a journal entry.
 * @route POST /api/journal-entries
 * Body: { project_airtable_id, category, content, tags?, author? }
 */
async createJournalEntry(request, origin) {
	const body = await request.arrayBuffer();
	if (body.byteLength > this.cfg.MAX_BODY_BYTES) {
		this.log.warn("request.too_large", { size: body.byteLength });
		return this.json({ error: "Payload too large" }, 413, this.corsHeaders(origin));
	}

	let p;
	try { p = JSON.parse(new TextDecoder().decode(body)); } catch {
		return this.json({ error: "Invalid JSON" }, 400, this.corsHeaders(origin));
	}

	if (!p.project_airtable_id || !p.category || !p.content) {
		return this.json({
			error: "Missing required fields: project_airtable_id, category, content"
		}, 400, this.corsHeaders(origin));
	}

	// Validate category
	const validCategories = ["perceptions", "procedures", "decisions", "introspections"];
	if (!validCategories.includes(p.category)) {
		return this.json({
			error: `Invalid category. Must be one of: ${validCategories.join(', ')}`
		}, 400, this.corsHeaders(origin));
	}

	const base = this.env.AIRTABLE_BASE_ID;
	const tJournal = encodeURIComponent(this.env.AIRTABLE_TABLE_JOURNAL);
	const atUrl = `https://api.airtable.com/v0/${base}/${tJournal}`;

	// Try multiple link field name candidates
	const LINK_FIELDS = ["Project", "Projects"];
	let lastDetail = "";

	for (const linkName of LINK_FIELDS) {
		// Format tags for Airtable (comma-separated string)
		const tagsStr = Array.isArray(p.tags) ? p.tags.join(', ') : String(p.tags || '');

		const fields = {
			[linkName]: [p.project_airtable_id],
			Category: p.category,
			Content: mdToAirtableRich(p.content),
			Tags: tagsStr,
			Author: p.author || ""
		};

		// Remove empty fields
		for (const k of Object.keys(fields)) {
			const v = fields[k];
			if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) {
				delete fields[k];
			}
		}

		const res = await fetchWithTimeout(atUrl, {
			method: "POST",
			headers: {
				"Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({ records: [{ fields }] })
		}, this.cfg.TIMEOUT_MS);

		const text = await res.text();

		if (res.ok) {
			let js;
			try { js = JSON.parse(text); } catch { js = { records: [] }; }
			const id = js.records?.[0]?.id;
			if (!id) {
				return this.json({ error: "Airtable response missing id" }, 502, this.corsHeaders(origin));
			}
			if (this.env.AUDIT === "true") {
				this.log.info("journal.entry.created", { id, category: p.category, linkName });
			}
			return this.json({ ok: true, id }, 200, this.corsHeaders(origin));
		}

		lastDetail = text;

		// If UNKNOWN_FIELD_NAME, try next candidate
		if (res.status === 422 && /UNKNOWN_FIELD_NAME/i.test(text)) continue;

		// Other error
		this.log.error("airtable.journal.create.fail", { status: res.status, text: safeText(text) });
		return this.json({
			error: `Airtable ${res.status}`,
			detail: safeText(text)
		}, res.status, this.corsHeaders(origin));
	}

	// No link field matched
	this.log.error("airtable.journal.create.linkfield.none_matched", { detail: lastDetail });
	return this.json({
		error: "Airtable 422",
		detail: `No matching link field name found. Add a link-to-record field in Journal Entries table that links to Projects. Try: ${LINK_FIELDS.join(", ")}`
	}, 422, this.corsHeaders(origin));
}

/**
 * Update a journal entry (partial).
 * @route PATCH /api/journal-entries/:id
 * Body: { category?, content?, tags? }
 */
async updateJournalEntry(request, origin, entryId) {
	if (!entryId) {
		return this.json({ error: "Missing entry id" }, 400, this.corsHeaders(origin));
	}

	const body = await request.arrayBuffer();
	if (body.byteLength > this.cfg.MAX_BODY_BYTES) {
		this.log.warn("request.too_large", { size: body.byteLength });
		return this.json({ error: "Payload too large" }, 413, this.corsHeaders(origin));
	}

	let p;
	try { p = JSON.parse(new TextDecoder().decode(body)); } catch {
		return this.json({ error: "Invalid JSON" }, 400, this.corsHeaders(origin));
	}

	const fields = {};

	if (typeof p.category === "string") {
		const validCategories = ["perceptions", "procedures", "decisions", "introspections"];
		if (!validCategories.includes(p.category)) {
			return this.json({
				error: `Invalid category. Must be one of: ${validCategories.join(', ')}`
			}, 400, this.corsHeaders(origin));
		}
		fields.Category = p.category;
	}

	if (typeof p.content === "string") {
		fields.Content = mdToAirtableRich(p.content);
	}

	if (p.tags !== undefined) {
		const tagsStr = Array.isArray(p.tags) ? p.tags.join(', ') : String(p.tags || '');
		fields.Tags = tagsStr;
	}

	if (Object.keys(fields).length === 0) {
		return this.json({ error: "No updatable fields provided" }, 400, this.corsHeaders(origin));
	}

	const base = this.env.AIRTABLE_BASE_ID;
	const tJournal = encodeURIComponent(this.env.AIRTABLE_TABLE_JOURNAL);
	const atUrl = `https://api.airtable.com/v0/${base}/${tJournal}`;

	const res = await fetchWithTimeout(atUrl, {
		method: "PATCH",
		headers: {
			"Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}`,
			"Content-Type": "application/json"
		},
		body: JSON.stringify({ records: [{ id: entryId, fields }] })
	}, this.cfg.TIMEOUT_MS);

	const text = await res.text();

	if (!res.ok) {
		this.log.error("airtable.journal.update.fail", { status: res.status, text: safeText(text) });
		return this.json({
			error: `Airtable ${res.status}`,
			detail: safeText(text)
		}, res.status, this.corsHeaders(origin));
	}

	if (this.env.AUDIT === "true") {
		this.log.info("journal.entry.updated", { entryId, fields });
	}

	return this.json({ ok: true }, 200, this.corsHeaders(origin));
}

/**
 * Delete a journal entry.
 * @route DELETE /api/journal-entries/:id
 */
async deleteJournalEntry(origin, entryId) {
	if (!entryId) {
		return this.json({ error: "Missing entry id" }, 400, this.corsHeaders(origin));
	}

	const base = this.env.AIRTABLE_BASE_ID;
	const tJournal = encodeURIComponent(this.env.AIRTABLE_TABLE_JOURNAL);
	const atUrl = `https://api.airtable.com/v0/${base}/${tJournal}/${encodeURIComponent(entryId)}`;

	const res = await fetchWithTimeout(atUrl, {
		method: "DELETE",
		headers: { "Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}` }
	}, this.cfg.TIMEOUT_MS);

	const text = await res.text();

	if (!res.ok) {
		this.log.error("airtable.journal.delete.fail", { status: res.status, text: safeText(text) });
		return this.json({
			error: `Airtable ${res.status}`,
			detail: safeText(text)
		}, res.status, this.corsHeaders(origin));
	}

	if (this.env.AUDIT === "true") {
		this.log.info("journal.entry.deleted", { entryId });
	}

	return this.json({ ok: true }, 200, this.corsHeaders(origin));
}
