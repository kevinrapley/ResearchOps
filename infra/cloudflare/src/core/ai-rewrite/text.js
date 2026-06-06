/**
 * Truncate long text for logs.
 * @function safeText
 * @inner
 * @param {string} t
 * @returns {string}
 */
export function safeText(t) {
	return t && t.length > 2048 ? t.slice(0, 2048) + "…" : t;
}

/**
 * Clamp a string to max length (safe for undefined).
 * @function clamp
 * @inner
 * @param {string} s
 * @param {number} n
 * @returns {string}
 */
export function clamp(s, n) {
	return (s || "").slice(0, n);
}

/**
 * Safe JSON.parse returning {} on failure.
 * @function safeParseJSON
 * @inner
 * @param {string} s
 * @returns {any}
 */
export function safeParseJSON(s) {
	try { return JSON.parse(s); } catch { return {}; }
}

/**
 * Detect potential PII patterns (email, NI, NHS).
 * @function detectPII
 * @inner
 * @param {string} text
 * @returns {boolean}
 */
export function detectPII(text) {
	const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
	const NI = /\b(?!BG|GB|NK|KN|TN|NT|ZZ)[A-CEGHJ-PR-TW-Z]{2}\d{6}[A-D]\b/i;
	const NHS = /\b\d{3}\s?\d{3}\s?\d{4}\b/;
	return EMAIL.test(text) || NI.test(text) || NHS.test(text);
}

/**
 * Sanitize rewrite for PII and whitespace/newlines.
 * @function sanitizeRewrite
 * @inner
 * @param {string} s
 * @returns {string}
 */
export function sanitizeRewrite(s) {
	let out = String(s || "");
	// PII redaction
	out = out.replace(/\S+@\S+/g, "[redacted]")
		.replace(/\b(?!BG|GB|NK|KN|TN|NT|ZZ)[A-CEGHJ-PR-TW-Z]{2}\d{6}[A-D]\b/gi, "[redacted]")
		.replace(/\b\d{3}\s?\d{3}\s?\d{4}\b/g, "[redacted]");
	// Normalise newlines and trim line endings
	out = out.replace(/\r\n?/g, "\n")
		.split("\n").map(l => l.trimEnd()).join("\n")
		.replace(/\n{3,}/g, "\n\n") // collapse 3+ blanks to 2
		.trim();
	return out;
}
