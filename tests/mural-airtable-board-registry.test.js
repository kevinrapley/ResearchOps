import assert from "node:assert/strict";
import test from "node:test";

import { createBoard, listBoards } from "../infra/cloudflare/src/service/internals/airtable.js";

const env = {
	AIRTABLE_BASE_ID: "app123",
	AIRTABLE_API_KEY: "pat123",
	AIRTABLE_TABLE_MURAL_BOARDS: "Mural Boards",
};

test("listBoards scopes Airtable lookup by project ID when provided", async () => {
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
							"Project ID": "recgdpwEI5hFO7bUZ",
							UID: "someone-else",
							Purpose: "reflexive_journal",
							Active: true,
							"Mural ID": "pppt6786.123",
						},
					},
				],
			}),
			{ status: 200, headers: { "content-type": "application/json" } },
		);
	};

	try {
		const rows = await listBoards(env, {
			projectId: "recgdpwEI5hFO7bUZ",
			uid: "anon",
			purpose: "reflexive_journal",
			active: true,
		});

		assert.equal(rows.length, 1);
		assert.match(formula, /\{Project ID\} = "recgdpwEI5hFO7bUZ"/);
		assert.doesNotMatch(formula, /\{UID\}/);
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test("createBoard defers Airtable billing-limit failures instead of throwing", async () => {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async () => new Response(
		JSON.stringify({
			errors: [
				{
					error: "PUBLIC_API_BILLING_LIMIT_EXCEEDED",
					message: "API billing plan limit exceeded.",
				},
			],
		}),
		{ status: 429, headers: { "content-type": "application/json" } },
	);

	try {
		const result = await createBoard(env, {
			projectIdText: "recgdpwEI5hFO7bUZ",
			uid: "anon",
			purpose: "reflexive_journal",
			muralId: "pppt6786.123",
			boardUrl: "https://app.mural.co/t/pppt6786/m/pppt6786/123/test",
			primary: true,
			active: true,
		});

		assert.equal(result.deferred, true);
		assert.equal(result.error, "airtable_billing_limit_exceeded");
		assert.equal(result.fields["Project ID"], "recgdpwEI5hFO7bUZ");
		assert.equal(result.fields["Mural ID"], "pppt6786.123");
	} finally {
		globalThis.fetch = originalFetch;
	}
});
