/**
 * Extract quantified phrases from text for comparison.
 * Looks for:
 *  - counts near user terms (e.g., "12 users", "8 participants", "at least 8 participants")
 *  - percentages (e.g., "25%")
 *  - timeframes (e.g., "by end of Q2", "within 3 months")
 * @param {string} text
 * @returns {string[]} lowercased phrases (deduplicated)
 */
export function extractQuantifiedPhrases(text) {
	const t = String(text || "");
	const phrases = new Set();

	// counts near user terms
	const countUser = /\b(?:at\s+least\s+|up\s+to\s+|around\s+|approximately\s+)?\d+\s+(?:users?|participants?|people|sessions?)\b/gi;
	// generic counts (keep modest to avoid overcatch)
	const countGeneric = /\b(?:at\s+least\s+|up\s+to\s+)?\d+\s+(?:interviews?|tests?|studies|sessions?)\b/gi;
	const percentages = /\b\d{1,3}%\b/g;
	const timeframeQ = /\bby\s+end\s+of\s+Q[1-4]\b/gi;
	const timeframeWithin = /\bwithin\s+\d+\s+(?:days?|weeks?|months?|quarters?)\b/gi;
	const timeframeIn = /\bin\s+\d+\s+(?:days?|weeks?|months?|quarters?)\b/gi;

	const addMatches = (re) => {
		let m;
		while ((m = re.exec(t)) !== null) phrases.add(m[0].toLowerCase());
	};

	[countUser, countGeneric, percentages, timeframeQ, timeframeWithin, timeframeIn].forEach(addMatches);

	return Array.from(phrases);
}

/**
 * Remove/neutralise quantifiers in rewrite that do not exist in the input.
 * Also generate suggestion items explaining what was removed and why.
 *
 * Neutralisations:
 *  - "by end of Q2", "within 3 months", "in 6 weeks" -> removed (timeline becomes open).
 *  - "at least 8 participants", "12 users" -> drop the number (e.g., "participants", "users").
 *  - "25%" or "by 25%" -> replace with "a measurable amount" to avoid invented specifics.
 *
 * @param {string} rewrite
 * @param {string} input
 * @returns {{text:string, notes:Array<{category:string, tip:string, why:string, severity:"high"|"medium"|"low"}>}}
 */
export function neutraliseInventedQuantifiers(rewrite, input) {
	let out = String(rewrite || "");
	const inputPhrases = new Set(extractQuantifiedPhrases(input).map(s => s.toLowerCase()));

	/** @type {Array<{category:string, tip:string, why:string, severity:"high"|"medium"|"low"}>} */
	const notes = [];

	// Helpers for safe replace across the whole string
	const replaceAll = (re, replacer) => { out = out.replace(re, replacer); };

	// 1) Timeframe phrases
	const timeframePatterns = [
		{ re: /\bby\s+end\s+of\s+Q[1-4]\b/gi, label: "Timeline" },
		{ re: /\bwithin\s+\d+\s+(days?|weeks?|months?|quarters?)\b/gi, label: "Timeline" },
		{ re: /\bin\s+\d+\s+(days?|weeks?|months?|quarters?)\b/gi, label: "Timeline" }
	];

	timeframePatterns.forEach(({ re, label }) => {
		replaceAll(re, (m) => {
			if (!inputPhrases.has(m.toLowerCase())) {
				notes.push({
					category: label,
					tip: `Remove invented timeframe ('${m}').`,
					why: "Timeframes must come from the input; propose them in suggestions instead.",
					severity: "high"
				});
				return "";
			}
			return m;
		});
	});

	// 2) Counts near user terms (drop numbers if invented)
	const countUser = /\b(?:(at\s+least|up\s+to|around|approximately)\s+)?(\d+)\s+(users?|participants?|people|sessions?)\b/gi;
	replaceAll(countUser, (m, qualifier, num, noun) => {
		if (inputPhrases.has(m.toLowerCase())) return m; // allowed (present in input)
		notes.push({
			category: "Measurability",
			tip: `Remove invented count ('${m}'); keep role only.`,
			why: "Sample sizes must come from the input; propose targets in suggestions instead.",
			severity: "high"
		});
		return noun;
	});

	// 3) Generic counts (interviews/tests/etc.)
	const countGeneric = /\b(?:(at\s+least|up\s+to|around|approximately)\s+)?(\d+)\s+(interviews?|tests?|studies|sessions?)\b/gi;
	replaceAll(countGeneric, (m, qualifier, num, noun) => {
		if (inputPhrases.has(m.toLowerCase())) return m;
		notes.push({
			category: "Measurability",
			tip: `Remove invented count ('${m}'); keep the activity only.`,
			why: "Counts must come from the input; suggest them separately if useful.",
			severity: "high"
		});
		return noun;
	});

	// 4) Percentages (e.g., 25%)
	const percent = /\b(\d{1,3})%\b/g;
	replaceAll(percent, (m) => {
		if (inputPhrases.has(m.toLowerCase())) return m;
		notes.push({
			category: "Outcomes & measures",
			tip: `Neutralise invented percentage ('${m}').`,
			why: "Percent targets must come from the input; propose a number in suggestions instead.",
			severity: "high"
		});
		return "a measurable amount";
	});

	// Clean up double spaces and stray punctuation after removals
	out = out.replace(/[ \t]+/g, " ")
		.replace(/\s+([,.;:])/g, "$1")
		.replace(/\(\s*\)/g, "")
		.replace(/\s{2,}/g, " ")
		.replace(/\n[ \t]+/g, "\n")
		.trim();

	return { text: out, notes };
}

/**
 * Remove invented method specifics not present in the input (e.g., "using screen readers").
 * Add more phrases as needed; only strips when the phrase isn't in the input.
 */
export function neutraliseInventedMethods(rewrite, input) {
	let out = String(rewrite || "");
	const lcInput = String(input || "").toLowerCase();

	/** Phrases to strip if absent from input */
	const methodPhrases = [
		"using screen readers",
		"remote unmoderated",
		"a/b test",
		"benchmark test",
		"tree test",
		"card sort",
		"eye tracking",
		"heatmap",
		"heuristic review"
	];

	for (const phrase of methodPhrases) {
		if (!lcInput.includes(phrase)) {
			const re = new RegExp("\\b" + phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "gi");
			out = out.replace(re, "");
		}
	}

	// Tidy grammar after removals
	out = out.replace(/[ \t]{2,}/g, " ")
		.replace(/\s+([,.;:])/g, "$1")
		.replace(/\(\s*\)/g, "")
		.replace(/\s{2,}/g, " ")
		.replace(/\s+\n/g, "\n")
		.trim();

	return out;
}

/* =========================
 * @section Bias audit + light neutralisation (guardrails)
 * ========================= */

/**
 * Bias audit + light neutralisation.
 * - Scans the rewrite for common biased/excluding language.
 * - Replaces a few terms with neutral alternatives (where safe).
 * - Produces suggestion items explaining issues and mitigations.
 *
 * NOTE: We never add new project details. We only neutralise phrasing.
 *
 * @param {string} rewrite
 * @param {string} input
 * @returns {{ text: string, issues: Array<{category:string, tip:string, why:string, severity:"high"|"medium"|"low"}> }}
 */
export function auditForBias(rewrite, input) {
	let out = String(rewrite || "");
	/** @type {Array<{category:string, tip:string, why:string, severity:"high"|"medium"|"low"}>} */
	const issues = [];

	// --- Utility helpers ---
	const push = (tip, why, severity = "medium", category = "Bias") =>
		issues.push({ category, tip, why, severity });

	const replaceAll = (pairs) => {
		for (const { re, to, tip, why, severity = "medium" } of pairs) {
			if (re.test(out)) {
				out = out.replace(re, to);
				push(tip, why, severity);
			}
		}
	};

	// --- 1) Ableist / excluding terms (safe neutralisations) ---
	replaceAll([{
			re: /\bwheelchair[-\s]?bound\b/gi,
			to: "wheelchair user",
			tip: "Use 'wheelchair user' instead of 'wheelchair-bound'.",
			why: "‘Bound’ is ableist; the neutral term is ‘wheelchair user’.",
			severity: "high",
		},
		{
			re: /\bhandicapped\b/gi,
			to: "disabled people",
			tip: "Use 'disabled people' instead of 'handicapped'.",
			why: "Aligns with inclusive, accepted language in UK public sector.",
			severity: "high",
		},
		{
			re: /\b(the\s+disabled|the\s+blind|the\s+deaf)\b/gi,
			to: "disabled people",
			tip: "Avoid 'the disabled' → use 'disabled people'.",
			why: "Person-first or identity-first phrasing avoids othering.",
			severity: "medium",
		},
		{
			re: /\b(insane|crazy|mad|lame)\b/gi,
			to: "inappropriate",
			tip: "Avoid ableist descriptors like 'crazy' or 'lame'.",
			why: "These terms stigmatise disability; use neutral language.",
			severity: "medium",
		},
		{
			re: /\bblind\s+spot\b/gi,
			to: "gap",
			tip: "Replace 'blind spot' with 'gap'.",
			why: "Avoids ableist metaphor; neutral alternative is clearer.",
			severity: "low",
		},
	]);

	// --- 2) Gendered / casual collective terms ---
	replaceAll([{
			re: /\bchairman\b/gi,
			to: "chair",
			tip: "Use 'chair' instead of 'chairman'.",
			why: "Gender-neutral job titles are more inclusive.",
			severity: "medium",
		},
		{
			re: /\bpolicemen\b/gi,
			to: "police officers",
			tip: "Use 'police officers' instead of 'policemen'.",
			why: "Gender-neutral roles are clearer and inclusive.",
			severity: "medium",
		},
		{
			re: /\bguys\b/gi,
			to: "everyone",
			tip: "Avoid 'guys' for mixed groups; use 'everyone'.",
			why: "Casual gendered collective can exclude readers.",
			severity: "low",
		},
	]);

	// --- 3) Othering / immigration & language phrasing ---
	replaceAll([{
			re: /\bforeigners\b/gi,
			to: "people from outside the UK",
			tip: "Avoid 'foreigners' → use neutral phrasing.",
			why: "Reduces othering; focuses on context not identity.",
			severity: "high",
		},
		{
			re: /\bnon[-\s]?english\s+speakers\b/gi,
			to: "people who do not speak English fluently",
			tip: "Prefer 'people who do not speak English fluently'.",
			why: "People-centred phrasing is more respectful and clear.",
			severity: "medium",
		},
	]);

	// --- 4) “Normal users” / defaulting language ---
	replaceAll([{
			re: /\bnormal\s+users?\b/gi,
			to: "users",
			tip: "Avoid 'normal users' → just say 'users'.",
			why: "‘Normal’ implies others are abnormal/excluded.",
			severity: "high",
		},
		{
			re: /\bregular\s+users?\b/gi,
			to: "users",
			tip: "Avoid 'regular users' unless defined.",
			why: "Imprecise category can exclude; define segments instead.",
			severity: "low",
		},
	]);

	// --- 5) Confirmation-bias language in research framing ---
	// We don’t change semantics; we de-bias phrasing.
	replaceAll([{
			re: /\bprove\s+that\b/gi,
			to: "test whether",
			tip: "Replace 'prove that' with 'test whether'.",
			why: "Reduces confirmation bias in research framing.",
			severity: "medium",
		},
		{
			re: /\bconfirm\s+that\s+users\b/gi,
			to: "learn whether users",
			tip: "Replace 'confirm that users' with 'learn whether users'.",
			why: "Keeps inquiry open and avoids pre-judging outcomes.",
			severity: "medium",
		},
	]);

	// --- 6) “Just”, “simple”, “obvious” — trivialising difficulty ---
	// We avoid auto-replacing these everywhere; we flag them for suggestions.
	const trivialising = /\b(just|simply|obvious|obviously|easy|trivial)\b/gi;
	if (trivialising.test(out)) {
		push(
			"Avoid words like 'just', 'simply', or 'obvious'.",
			"They can minimise user challenges and bias facilitator expectations.",
			"low"
		);
	}

	// --- 7) Heuristic: testing mentioned but no accessibility mention (OK to SUGGEST only)
	// Do not inject new content into rewrite; suggestion only.
	const mentionsTesting = /\b(test|validate|usability|research|study|evaluate|assess)\b/i.test(out);
	const mentionsA11y =
		/\b(accessibility|screen\s*reader|keyboard|contrast|assistive\s+tech|WCAG|disabled\s+people)\b/i.test(out);
	if (mentionsTesting && !mentionsA11y) {
		// Only add if the INPUT itself doesn’t already mention it (to avoid nagging duplicates)
		const inputHasA11y =
			/\b(accessibility|screen\s*reader|keyboard|contrast|assistive\s+tech|WCAG|disabled\s+people)\b/i.test(input || "");
		if (!inputHasA11y) {
			push(
				"Consider how accessibility needs will be included in the research.",
				"Ensures the work is inclusive across disabilities, devices, and contexts.",
				"medium"
			);
		}
	}

	// Normalise whitespace after replacements
	out = out.replace(/[ \t]{2,}/g, " ")
		.replace(/\s+([,.;:])/g, "$1")
		.replace(/\s{2,}/g, " ")
		.replace(/\n[ \t]+/g, "\n")
		.trim();

	return { text: out, issues };
}
