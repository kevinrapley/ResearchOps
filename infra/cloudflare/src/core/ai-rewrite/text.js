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
 * Clamp text without cutting off in the middle of a useful boundary.
 * Prefers markdown section, paragraph, sentence and word boundaries.
 * @function clampAtBoundary
 * @inner
 * @param {string} s
 * @param {number} n
 * @returns {string}
 */
export function clampAtBoundary(s, n) {
	const text = String(s || "");
	if (!n || text.length <= n) return text;

	const slice = text.slice(0, n);
	const minUseful = Math.floor(n * 0.6);
	const candidates = [
		slice.lastIndexOf("\n\n## "),
		slice.lastIndexOf("\n\n")
	].filter(index => index > minUseful);

	let sentenceEnd = -1;
	const sentencePattern = /[.!?](?=\s|$)/g;
	let match;
	while ((match = sentencePattern.exec(slice)) !== null) {
		if (match.index + 1 > minUseful) sentenceEnd = match.index + 1;
	}
	if (sentenceEnd > -1) candidates.push(sentenceEnd);

	const wordBoundary = slice.lastIndexOf(" ");
	if (wordBoundary > minUseful) candidates.push(wordBoundary);

	const boundary = candidates.length ? Math.max(...candidates) : n;
	return slice.slice(0, boundary).trim();
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
