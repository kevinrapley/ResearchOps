/**
 * Create a minimal mock Env for unit tests.
 * @function createMockEnv
 * @param {Partial<Env>} overrides
 * @returns {Env}
 */
export function createMockEnv(overrides = {}) {
	return /** @type {Env} */ ({
		ALLOWED_ORIGINS: "https://researchops.pages.dev, https://rops-api.example.workers.dev",
		AUDIT: "false",
		AIRTABLE_BASE_ID: "app_base",
		AIRTABLE_API_KEY: "key",
		AIRTABLE_TABLE_AI_LOG: "AI_Usage",
		MODEL: "@cf/meta/llama-3.1-8b-instruct",
		AI: { run: async () => JSON.stringify({ summary: "ok", suggestions: [], rewrite: "example" }) },
		...overrides
	});
}

/**
 * Build a JSON Request for tests.
 * @function makeJsonRequest
 * @example
 * const req = makeJsonRequest("/api/ai-rewrite", { mode:"description", text: "x".repeat(420) });
 */
export function makeJsonRequest(path, body, init = {}) {
	const reqInit = {
		method: "POST",
		headers: Object.assign({ "Content-Type": "application/json" }, init.headers || {}),
		body: JSON.stringify(body)
	};
	for (const k in init) {
		if (k !== "headers") reqInit[k] = init[k];
	}
	return new Request(`https://example.test${path}`, reqInit);
}
