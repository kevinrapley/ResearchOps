const RETENTION_ENABLED = "true";
const DEFAULT_GRACE_DAYS = 7;

function dbFor(env) {
	return env?.RESEARCHOPS_D1?.prepare ? env.RESEARCHOPS_D1 : null;
}

function daysAgo(days, scheduledTime = Date.now()) {
	return new Date(Number(scheduledTime || Date.now()) - days * 24 * 60 * 60 * 1000).toISOString();
}

function retentionEnabled(env) {
	return String(env?.RESEARCHOPS_RETENTION_ENFORCEMENT_ENABLED || "").toLowerCase() === RETENTION_ENABLED;
}

async function tableExists(db, tableName) {
	const row = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1").bind(tableName).first();
	return Boolean(row?.name);
}

async function runIfTableExists(db, tableName, query, ...bindings) {
	if (!(await tableExists(db, tableName))) return { table: tableName, changed: 0, skipped: "table_missing" };
	const result = await db.prepare(query).bind(...bindings).run();
	return { table: tableName, changed: result?.meta?.changes || 0 };
}

export async function enforceRetention(env, options = {}) {
	const db = dbFor(env);
	if (!db) return { ok: false, skipped: "d1_missing" };
	if (!retentionEnabled(env)) return { ok: true, skipped: "retention_disabled" };

	const graceDays = Number(env.RESEARCHOPS_RETENTION_GRACE_DAYS || DEFAULT_GRACE_DAYS);
	const defaultCutoff = daysAgo(365 + graceDays, options.scheduledTime);
	const recordingCutoff = daysAgo(183 + graceDays, options.scheduledTime);
	const results = [];

	results.push(await runIfTableExists(
		db,
		"rops_participants_cache",
		`
			UPDATE rops_participants_cache
			SET sensitive_contact_json = NULL,
				payload_json = json_set(COALESCE(payload_json, '{}'), '$.retentionAnonymised', 1),
				updated_at = ?
			WHERE active = 1
				AND sensitive_contact_json IS NOT NULL
				AND COALESCE(updated_at, created_at) < ?
		`,
		new Date().toISOString(),
		defaultCutoff,
	));

	results.push(await runIfTableExists(
		db,
		"rops_participant_consent_cache",
		`
			DELETE FROM rops_participant_consent_cache
			WHERE COALESCE(updated_at, recorded_at, created_at) < ?
		`,
		defaultCutoff,
	));

	results.push(await runIfTableExists(
		db,
		"rops_session_notes",
		`
			DELETE FROM rops_session_notes
			WHERE COALESCE(updated_at, end_iso, start_iso, created_at) < ?
		`,
		recordingCutoff,
	));

	return {
		ok: true,
		retentionEnforced: true,
		cutoffs: {
			default: defaultCutoff,
			recordingsAndNotes: recordingCutoff,
		},
		results,
	};
}
