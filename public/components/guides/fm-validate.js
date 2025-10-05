import { FM_SCHEMA_V1 } from './fm-schema.js';

/** Validate & coerce meta from front-matter.
 * Returns { ok, meta, errors[] } — meta includes defaults & coercions.
 */
export function validateFrontMatter(metaIn = {}) {
	const errors = [];
	const meta = { ...metaIn };

	// Helper: set default
	const setDefault = (key, def) => {
		if (meta[key] === undefined) meta[key] = def;
	};

	// 1) Defaults
	for (const [k, prop] of Object.entries(FM_SCHEMA_V1.properties)) {
		if ('default' in prop) setDefault(k, prop.default);
	}

	// 2) Coercions
	if (typeof meta.timebox === 'string' && /^\d+$/.test(meta.timebox)) meta.timebox = Number(meta.timebox);
	if (typeof meta.round === 'string' && /^\d+$/.test(meta.round)) meta.round = Number(meta.round);
	if (typeof meta.recording === 'string') meta.recording = meta.recording === 'true';
	if (typeof meta.remote === 'string') meta.remote = meta.remote === 'true';

	// 3) Required fields
	for (const req of (FM_SCHEMA_V1.required || [])) {
		if (meta[req] === undefined || meta[req] === null || meta[req] === "") {
			errors.push(`Missing required field: ${req}`);
		}
	}

	// 4) Primitive checks
	checkString('title', 3, 180);
	checkEnum('language');
	checkInt('round', 1, 9999);
	checkInt('timebox', 10, 240);
	checkArray('roles', 'string');
	checkString('consentPattern', 1, 120, true);
	checkString('introPattern', 1, 120, true);
	checkNullableString('warmupPattern', 1, 120);
	checkArray('successSignals', 'string', true);
	checkBool('recording');
	checkBool('remote');
	checkEnum('lawfulBasis');
	checkNullableString('location', 0, 140);
	checkNullableString('moderator', 0, 80);
	checkNullableString('notetaker', 0, 80);
	checkFilenameHint('filenameHint');
	checkConst('schemaVersion', 1);

	// 5) tasks[]
	if (!Array.isArray(meta.tasks)) meta.tasks = meta.tasks == null ? [] : [meta.tasks]; // coerce a single object to array
	if (!Array.isArray(meta.tasks)) errors.push('tasks must be an array');
	else {
		meta.tasks = meta.tasks.map((t, i) => {
			const task = { ...t };
			if (typeof task.name !== 'string' || task.name.trim().length < 2)
				errors.push(`tasks[${i}].name must be a string (min 2)`);
			if (typeof task.goal !== 'string' || task.goal.trim().length < 3)
				errors.push(`tasks[${i}].goal must be a string (min 3)`);
			if (task.successSignals != null && !Array.isArray(task.successSignals))
				errors.push(`tasks[${i}].successSignals must be an array of strings`);
			if (Array.isArray(task.successSignals))
				task.successSignals = task.successSignals.map(String).map(s => s.trim()).filter(Boolean);
			if (task.notes != null && typeof task.notes !== 'string')
				task.notes = String(task.notes);
			return task;
		});
	}

	return { ok: errors.length === 0, meta, errors };

	/* ---- helpers ---- */
	function checkString(k, min, max, optional = false) {
		const v = meta[k];
		if (optional && (v === undefined || v === null || v === "")) return;
		if (typeof v !== 'string') errors.push(`${k} must be a string`);
		else {
			const len = v.trim().length;
			if (len < min) errors.push(`${k} must be at least ${min} chars`);
			if (len > max) errors.push(`${k} must be ≤ ${max} chars`);
		}
	}

	function checkNullableString(k, min, max) {
		const v = meta[k];
		if (v == null || v === "") return;
		checkString(k, min, max);
	}

	function checkInt(k, min, max) {
		const v = meta[k];
		if (v == null) return;
		if (!Number.isInteger(v)) errors.push(`${k} must be an integer`);
		else {
			if (v < min) errors.push(`${k} must be ≥ ${min}`);
			if (v > max) errors.push(`${k} must be ≤ ${max}`);
		}
	}

	function checkBool(k) {
		const v = meta[k];
		if (v == null) return;
		if (typeof v !== 'boolean') errors.push(`${k} must be boolean`);
	}

	function checkEnum(k) {
		const prop = FM_SCHEMA_V1.properties[k];
		if (!prop?.enum) return;
		const v = meta[k];
		if (v == null) return;
		if (!prop.enum.includes(v)) errors.push(`${k} must be one of: ${prop.enum.join(", ")}`);
	}

	function checkConst(k, c) {
		const v = meta[k];
		if (v == null) return;
		if (v !== c) errors.push(`${k} must equal ${c}`);
	}

	function checkArray(k, itemType, optional = false) {
		const v = meta[k];
		if (optional && (v == null)) return;
		if (!Array.isArray(v)) { errors.push(`${k} must be an array`); return; }
		if (itemType === 'string') {
			meta[k] = v.map(String).map(s => s.trim()).filter(Boolean);
		}
	}

	function checkFilenameHint(k) {
		const v = meta[k];
		if (v == null || v === "") return;
		if (typeof v !== 'string') { errors.push(`${k} must be a string`); return; }
		const ok = /^[A-Za-z0-9._ -]+$/.test(v);
		if (!ok) errors.push(`${k} must contain letters, numbers, space, dot or underscore only`);
		if (v.length > 100) errors.push(`${k} must be ≤ 100 chars`);
	}
}