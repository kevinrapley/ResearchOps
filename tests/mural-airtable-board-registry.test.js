import assert from "node:assert/strict";
import test from "node:test";

import { createBoard, listBoards } from "../infra/cloudflare/src/service/internals/airtable.js";

const env = {
	AIRTABLE_BASE_ID: "appFixture",
	AIRTABLE_TABLE_MURAL_BOARDS: "Mural Boards",
};

function makeD1({ rows = [], onRun = () => {} } = {}) {
	return {
		prepare(sql) {
			return {
				params: [],
				bind(...params) {
					this.params = params;
					return this;
				},
				async all() {
					return { results: rows };
				},
				async run() {
					onRun(sql, this.params);
					return { success: true };
				},
			};
		},
	};
}

test("listBoards returns D1 board mappings before external fallback", async () => {
	let fetched = false;
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async () => {
		fetched = true;
		throw new Error("fallback should not be called");
	};

	try {
		const rows = await listBoards(
			{
				...env,
				RESEARCHOPS_D1: makeD1({
					rows: [
						{
							mural_id: "board-from-d1",
							project: "recgdpwEI5hFO7bUZ",
							purpose: "reflexive_journal",
							board_url: "https://example.test/mural/d1",
							workspace_id: "workspace-fixture",
						},
					],
				}),
			},
			{ projectId: "recgdpwEI5hFO7bUZ", uid: "anon", purpose: "reflexive_journal" },
		);

		assert.equal(rows.length, 1);
		assert.equal(rows[0]._source, "d1");
		assert.equal(rows[0].fields["Mural ID"], "board-from-d1");
		assert.equal(fetched, false);
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test("listBoards preserves legacy fallback rows without Project ID text", async () => {
	let formula = "";
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async (resource) => {
		const url = new URL(String(resource));
		formula = url.searchParams.get("filterByFormula") || "";
		return new Response(
			JSON.stringify({
				records: [
					{
						id: "recBoard1",
						fields: {
							Project: ["recgdpwEI5hFO7bUZ"],
							UID: "anon",
							Purpose: "reflexive_journal",
							Active: true,
							"Mural ID": "legacy-board",
						},
					},
				],
			}),
			{ status: 200, headers: { "content-type": "application/json" } },
		);
	};

	try {
		const rows = await listBoards(
			{
				...env,
				RESEARCHOPS_D1: makeD1({ rows: [] }),
			},
			{ projectId: "recgdpwEI5hFO7bUZ", uid: "anon", purpose: "reflexive_journal" },
		);

		assert.equal(rows.length, 1);
		assert.equal(rows[0].fields["Mural ID"], "legacy-board");
		assert.doesNotMatch(formula, /\{Project ID\}/);
		assert.doesNotMatch(formula, /\{UID\}/);
		assert.match(formula, /\{Purpose\} = "reflexive_journal"/);
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test("createBoard mirrors board mappings to D1 before external registration", async () => {
	const d1Writes = [];
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async () => new Response(
		JSON.stringify({ errors: [{ error: "PUBLIC_API_BILLING_LIMIT_EXCEEDED" }] }),
		{ status: 429, headers: { "content-type": "application/json" } },
	);

	try {
		const result = await createBoard(
			{
				...env,
				RESEARCHOPS_D1: makeD1({
					onRun(sql, params) {
						d1Writes.push({ sql, params });
					},
				}),
			},
			{
				projectIdText: "recgdpwEI5hFO7bUZ",
				uid: "anon",
				purpose: "reflexive_journal",
				muralId: "new-board",
				boardUrl: "https://example.test/mural/new",
				primary: true,
				active: true,
			},
		);

		assert.equal(result.deferred, true);
		assert.equal(result.d1Write.ok, true);
		assert.equal(d1Writes.length, 1);
		assert.equal(d1Writes[0].params[0], "new-board");
		assert.equal(d1Writes[0].params[1], "recgdpwEI5hFO7bUZ");
	} finally {
		globalThis.fetch = originalFetch;
	}
});
