import { clamp, sanitizeRewrite } from "./text.js";

const DESCRIPTION_CHECKS = Object.freeze([
	{
		category: "Scope",
		severity: "high",
		requires: /\b(scope|in scope|out of scope|boundary|boundaries)\b/i,
		tip: "State what is in and out of scope.",
		why: "Helps teams understand the boundaries of the research."
	},
	{
		category: "Research questions",
		severity: "medium",
		requires: /\?|research question|question(s)?\b/i,
		tip: "List 2 to 4 research questions the study will answer.",
		why: "Keeps the method and analysis focused."
	},
	{
		category: "Deliverables",
		severity: "low",
		requires: /\b(deliverable|output|playback|report|backlog|recommendation)\b/i,
		tip: "State the expected outputs, such as a playback, short report or prioritised backlog.",
		why: "Aligns expectations for stakeholders."
	},
	{
		category: "Users and inclusion",
		severity: "medium",
		requires: /\b(accessibility|accessible|screen reader|assistive|mobile|desktop|low digital confidence|language)\b/i,
		tip: "Include accessibility, device and language considerations.",
		why: "Helps the research include people who may otherwise be missed."
	},
	{
		category: "Outcomes and measures",
		severity: "high",
		requires: /\b(success|outcome|measure|metric|decision|decisions|support)\b/i,
		tip: "Describe what success looks like and which decisions the research should support.",
		why: "Makes the research easier to judge and act on."
	},
	{
		category: "Data handling",
		severity: "high",
		requires: /\b(personal data|consent|retention|privacy|data handling|DPIA|ethic)\b/i,
		tip: "Explain how personal data, consent and retention will be handled.",
		why: "Keeps the plan safe and reviewable."
	}
]);

const OBJECTIVE_CHECKS = Object.freeze([
	{
		category: "Clarity",
		severity: "medium",
		requires: /\b(identify|understand|test|validate|evaluate|measure|produce|compare|map|explore)\b/i,
		tip: "Start each objective with a clear action verb.",
		why: "Makes each objective easier to scan."
	},
	{
		category: "Measurability",
		severity: "high",
		requires: /\b(\d+|percent|percentage|measure|metric|target|timeframe|by \w+)\b/i,
		tip: "Add a target, measure or timeframe where the input supports it.",
		why: "Helps the team judge whether the objective has been met."
	},
	{
		category: "Scope",
		severity: "medium",
		requires: /\b(scope|phase|alpha|beta|discovery|constraint|dependency)\b/i,
		tip: "Link each objective to the project scope or service phase.",
		why: "Prevents objectives from becoming too broad."
	},
	{
		category: "Users and inclusion",
		severity: "medium",
		requires: /\b(accessibility|accessible|screen reader|assistive|mobile|desktop|language|disability)\b/i,
		tip: "Include relevant accessibility and inclusion needs.",
		why: "Keeps the objectives aligned with inclusive research."
	}
]);

function splitSentences(text) {
	return sanitizeRewrite(text)
		.replace(/\s+/g, " ")
		.split(/(?<=[.!?])\s+|\n+/)
		.map(sentence => sentence.trim())
		.filter(Boolean);
}

function matchingSentences(sentences, pattern, max = 3) {
	return sentences.filter(sentence => pattern.test(sentence)).slice(0, max);
}

function section(label, lines) {
	const text = lines.join(" ").trim();
	return text ? `## ${label}\n\n${text}` : "";
}

function missingSection(label, text) {
	return `## ${label}\n\n${text}`;
}

function fallbackDescriptionRewrite(input, cfg) {
	const sentences = splitSentences(input);
	const scopeLines = matchingSentences(sentences, /\b(scope|in scope|out of scope|boundary|boundaries)\b/i);
	const questionLines = matchingSentences(sentences, /\?|research question|question(s)?\b/i);
	const deliverableLines = matchingSentences(sentences, /\b(deliverable|output|playback|report|backlog|recommendation)\b/i);
	const inclusionLines = matchingSentences(sentences, /\b(identify|consider|test|interview|survey|workshop|accessibility|screen reader|mobile|desktop|language)\b/i);
	const dataLines = matchingSentences(sentences, /\b(personal data|consent|retention|privacy|data handling|DPIA|ethic)\b/i);

	const sections = [
		section("Research focus", sentences.slice(0, 2)),
		scopeLines.length ?
			section("Scope", scopeLines) :
			missingSection("Scope", "- In scope: The current description does not state explicit in-scope boundaries.\n- Out of scope: The current description does not state explicit out-of-scope boundaries."),
		section("Users and context", matchingSentences(sentences, /\b(user|users|team|teams|stakeholder|manager|service designer|researcher)\b/i)),
		questionLines.length ?
			section("Research questions", questionLines) :
			missingSection("Research questions", "- The current description does not state the research questions."),
		inclusionLines.length ?
			section("Method and inclusion", inclusionLines) :
			missingSection("Method and inclusion", "The current description does not state method or inclusion considerations such as accessibility, screen reader support, mobile users, language needs or Chrome, Safari and Firefox browser coverage."),
		deliverableLines.length ?
			section("Deliverables", deliverableLines) :
			missingSection("Deliverables", "The current description does not state expected outputs such as a playback, report or prioritised backlog."),
		section("Outcomes", matchingSentences(sentences, /\b(success|outcome|decision|decisions|deliverable|output|report|backlog|question)\b/i)),
		dataLines.length ?
			section("Data handling", dataLines) :
			missingSection("Data handling", "The current description does not state data handling, consent or retention arrangements.")
	].filter(Boolean);

	const rewrite = sections.length ? sections.join("\n\n") : section("Research focus", sentences.slice(0, 4));
	return clamp(sanitizeRewrite(rewrite), cfg.MAX_REWRITE_CHARS);
}

function splitObjectives(input) {
	return sanitizeRewrite(input)
		.split(/\n+|;|(?<=\.)\s+/)
		.map(line => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
		.filter(Boolean);
}

function fallbackObjectivesRewrite(input, cfg) {
	const objectives = splitObjectives(input).slice(0, 6);
	const rewrite = objectives.length ?
		objectives.map((objective, index) => `${index + 1}. ${objective}`).join("\n") :
		`1. ${sanitizeRewrite(input)}`;
	return clamp(sanitizeRewrite(rewrite), cfg.MAX_REWRITE_CHARS);
}

function fallbackSuggestions(input, mode, cfg) {
	const checks = mode === "objectives" ? OBJECTIVE_CHECKS : DESCRIPTION_CHECKS;
	const missing = checks.filter(check => !check.requires.test(input));
	const presentLowRisk = checks.filter(check => check.requires.test(input) && check.severity !== "high");
	const selected = (missing.length ? missing : presentLowRisk).slice(0, cfg.MAX_SUGGESTIONS);

	return selected.map(check => ({
		category: check.category,
		tip: clamp(check.tip, cfg.MAX_SUGGESTION_LEN),
		why: clamp(check.why, cfg.MAX_SUGGESTION_LEN),
		severity: check.severity
	}));
}

/**
 * Build a deterministic review/rewrite response when Workers AI is unavailable.
 * The fallback only rearranges and comments on the supplied text.
 *
 * @param {{mode:"description"|"objectives", input:string, hasPII:boolean, cfg:object}} params
 * @returns {{summary:string, suggestions:Array, rewrite:string, flags:{possible_personal_data:boolean, ai_unavailable:boolean}}}
 */
export function buildFallbackResponse({ mode, input, hasPII, cfg }) {
	const rewrite = mode === "objectives" ?
		fallbackObjectivesRewrite(input, cfg) :
		fallbackDescriptionRewrite(input, cfg);

	return {
		summary: mode === "objectives" ?
			"Review the objectives for clarity, scope, measurable outcomes and inclusion." :
			"Review the description for scope, research questions, outputs, inclusion and data handling.",
		suggestions: fallbackSuggestions(input, mode, cfg),
		rewrite,
		flags: {
			possible_personal_data: hasPII,
			ai_unavailable: true
		}
	};
}
