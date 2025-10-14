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
		Confidence: body.confidence || 'medium'
	};

	const result = await createRecords(svc.env, "CodeApplications", [{ fields }]);

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
		timeOfDay: analyzeCodingTimes(recentCodings)
	};

	// Generate reflexive prompts if patterns detected
	if (patterns.codeFrequency[codeId] > 0.7) {
		await createReflexivePrompt(svc, coder,
			`You've used "${codeId}" in 70% of recent codings. Consider what else might be present.`
		);
	}
}