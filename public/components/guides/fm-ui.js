import { FM_SCHEMA_V1 } from './fm-schema.js';
import { validateFrontMatter } from './fm-validate.js';

export function schemaFieldHints() {
	return {
		title: { label: "Guide title", control: "text", required: true },
		language: { label: "Language", control: "select", options: FM_SCHEMA_V1.properties.language.enum },
		round: { label: "Round", control: "number", min: 1 },
		timebox: { label: "Timebox (minutes)", control: "number", min: 10, max: 240 },
		roles: { label: "Roles", control: "chips", placeholder: "Facilitator, Notetaker" },
		consentPattern: { label: "Consent pattern", control: "text" },
		introPattern: { label: "Intro pattern", control: "text" },
		warmupPattern: { label: "Warm-up pattern", control: "text", optional: true },
		recording: { label: "Recording enabled", control: "toggle" },
		remote: { label: "Remote session", control: "toggle" },
		lawfulBasis: { label: "Lawful basis", control: "select", options: FM_SCHEMA_V1.properties.lawfulBasis.enum },
		location: { label: "Location", control: "text", optional: true },
		moderator: { label: "Moderator", control: "text", optional: true },
		notetaker: { label: "Notetaker", control: "text", optional: true },
		filenameHint: { label: "Filename hint", control: "text", optional: true },
		// tasks rendered in a dedicated repeater UI
	};
}

export function normaliseMeta(meta) {
	const { meta: fixed } = validateFrontMatter(meta);
	return fixed;
}