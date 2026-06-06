/**
 * @file front-matter.js
 * @module GuidesFrontMatter
 * @summary Front-matter helpers for discussion guide source migration.
 */

/** Strip a leading YAML front-matter block if present. Returns body only. */
export function stripFrontMatter(src) {
	const fmRe = /^---\s*\n([\s\S]*?)\n---\s*\n?/;
	return String(src || '').replace(fmRe, '');
}

/** Extract + strip front-matter for one-time migration. */
export function extractAndStripFrontMatter(src) {
	const fmRe = /^---\s*\n([\s\S]*?)\n---\s*\n?/;
	const m = String(src || '').match(fmRe);
	if (!m) return { stripped: String(src || ''), yaml: null };
	return { stripped: String(src || '').replace(fmRe, ''), yaml: m[1] || '' };
}

/** Minimal defensive YAML-like parser for migration only. */
export function parseSimpleYaml(yaml) {
	const out = {};
	if (!yaml || !yaml.trim()) return out;
	const lines = yaml.split(/\r?\n/);
	let currentKey = null;

	for (const raw of lines) {
		const line = raw.replace(/\t/g, '  ');
		if (!line.trim()) continue;

		if (/^\s*-\s+/.test(line) && currentKey) {
			out[currentKey] = out[currentKey] || [];
			out[currentKey].push(coerceScalar(line.replace(/^\s*-\s+/, '')));
			continue;
		}

		const kv = line.match(/^\s*([A-Za-z0-9_\-.]+)\s*:\s*(.*)$/);
		if (kv) {
			const [, k, v] = kv;
			if (v === '' || v == null) {
				currentKey = k;
				out[k] = out[k] || [];
			} else {
				currentKey = k;
				out[k] = coerceScalar(v);
			}
		}
	}

	return out;
}

function coerceScalar(v) {
	const s = String(v || '').trim();
	if (/^(true|false)$/i.test(s)) return /^true$/i.test(s);
	if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
	if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
		return s.slice(1, -1);
	}
	return s;
}
