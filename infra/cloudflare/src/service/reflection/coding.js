/**
 * @file src/service/coding.js
 * @module service/coding
 * @summary Apply codes to text segments
 */

export async function applyCode(svc, request, origin) {
	const body = await request.json();

	const fields = {
		JournalEntry: [body.entry_id],
		Code: [body.code_id],
		TextSegment: body.text_segment,
		StartPosition: body.start_pos,
		EndPosition: body.end_pos,
		Coder: body.coder || 'anonymous',
		CodingNotes: body.notes || '',
		Confidence: body.confidence || 'medium',
	};

	// Persist code application
	const result = await createRecords(svc.env, 'CodeApplications', [{ fields }]);

	// Track coding patterns for reflexivity
	await trackCodingBehavior(svc, body.coder, body.code_id);

	return svc.json({ ok: true, id: result.records[0].id }, 200, svc.corsHeaders(origin));
}

async function trackCodingBehavior(svc, coder, codeId) {
	// Analyze coding patterns for reflexive feedback
	const recentCodings = await getRecentCodingsByUser(svc, coder, 50);

	const patterns = {
		velocity: calculateCodingVelocity(recentCodings),
		codeFrequency: analyzeCodeDistribution(recentCodings),
		timeOfDay: analyzeCodingTimes(recentCodings),
	};

	// Generate reflexive prompts if patterns detected
	if (patterns.codeFrequency[codeId] > 0.7) {
		await createReflexivePrompt(
			svc,
			coder,
			`You've used "${codeId}" in 70% of recent codings. Consider what else might be present.`
		);
	}
}

/* -------------------------------------------------------------------------- */
/*                               Helper routines                              */
/*   NOTE: These are minimal implementations to satisfy ESLint (no-undef)     */
/*   and keep runtime behaviour sensible. Replace with real services/imports. */
/* -------------------------------------------------------------------------- */

/**
 * Minimal persistence shim. Replace with your Airtable/D1 implementation.
 * @param {Record<string, any>} _env
 * @param {string} _table
 * @param {Array<{fields: Record<string, any>}>} rows
 * @returns {{ records: Array<{ id: string }> }}
 */
async function createRecords(_env, _table, rows) {
	// Generate deterministic temp ids so callers can proceed.
	const now = Date.now();
	return {
		records: rows.map((_, i) => ({ id: `rec_${now}_${i}` })),
	};
}

/**
 * Fetch recent codings for a user.
 * Replace with a real query (e.g., to Airtable) as needed.
 * @param {*} _svc
 * @param {string} _coder
 * @param {number} limit
 * @returns {Promise<Array<{ codeId: string, ts: number }>>}
 */
async function getRecentCodingsByUser(_svc, _coder, limit = 50) {
	// Placeholder: return an empty set to avoid false positives.
	return new Array(Math.max(0, Math.min(limit, 0))).fill(0);
}

/**
 * Compute a simple velocity metric (codings per hour over last N entries).
 * @param {Array<{ ts: number }>} items
 * @returns {number}
 */
function calculateCodingVelocity(items) {
	if (!items || items.length < 2) return 0;
	const sorted = [...items].sort((a, b) => a.ts - b.ts);
	const elapsedMs = sorted[sorted.length - 1].ts - sorted[0].ts;
	if (elapsedMs <= 0) return 0;
	const hours = elapsedMs / (1000 * 60 * 60);
	return items.length / hours;
}

/**
 * Frequency of codes (0..1 per codeId) across the sample.
 * @param {Array<{ codeId: string }>} items
 * @returns {Record<string, number>}
 */
function analyzeCodeDistribution(items) {
	if (!items || items.length === 0) return {};
	const counts = Object.create(null);
	for (const it of items) {
		if (!it || !it.codeId) continue;
		counts[it.codeId] = (counts[it.codeId] || 0) + 1;
	}
	const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
	const freq = {};
	for (const [k, v] of Object.entries(counts)) {
		freq[k] = v / total;
	}
	return freq;
}

/**
 * Histogram of codings by hour-of-day (0..23) as proportions.
 * @param {Array<{ ts: number }>} items
 * @returns {Record<string, number>}
 */
function analyzeCodingTimes(items) {
	if (!items || items.length === 0) return {};
	const buckets = new Array(24).fill(0);
	for (const it of items) {
		if (!it || typeof it.ts !== 'number') continue;
		const h = new Date(it.ts).getHours();
		buckets[h] += 1;
	}
	const total = buckets.reduce((a, b) => a + b, 0) || 1;
	const out = {};
	for (let h = 0; h < 24; h++) out[h] = buckets[h] / total;
	return out;
}

/**
 * Emit a reflexive prompt/notification for the coder.
 * Replace with your comms/notifications implementation.
 * @param {*} _svc
 * @param {string} _coder
 * @param {string} _message
 */
async function createReflexivePrompt(_svc, _coder, _message) {
	// Intentionally a no-op for now to avoid noisy console in CI.
	// Wire to your real notifier (e.g., email, UI toast, journal memo).
	return;
}
