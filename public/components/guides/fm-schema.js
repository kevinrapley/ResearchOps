/** Front-matter schema for Discussion Guides (v1).
 *  Goals:
 *  - Strong typing for Variables drawer + server validation
 *  - Sensible defaults with coercion
 *  - Stable keys for export/analytics
 */
export const FM_SCHEMA_V1 = {
	$schema: "urn:researchops:guides:front-matter:v1",
	title: "Discussion Guide Front-Matter",
	type: "object",
	additionalProperties: true, // allow extension fields
	properties: {
		title: { type: "string", minLength: 3, maxLength: 180 },
		language: { type: "string", enum: ["en-GB", "en", "cy", "gd", "ga", "ga-IE"], default: "en-GB" },

		round: { type: "integer", minimum: 1, default: 1 },
		timebox: { type: "integer", minimum: 10, maximum: 240, default: 60, description: "Minutes" },

		roles: { type: "array", items: { type: "string" }, default: ["Facilitator", "Notetaker"] },

		consentPattern: { type: "string", default: "consent_standard_v2" },
		introPattern: { type: "string", default: "intro_opening_v1" },
		warmupPattern: { type: "string", nullable: true }, // optional

		tasks: {
			type: "array",
			default: [],
			items: {
				type: "object",
				required: ["name", "goal"],
				properties: {
					name: { type: "string", minLength: 2, maxLength: 140 },
					goal: { type: "string", minLength: 3, maxLength: 200 },
					successSignals: { type: "array", items: { type: "string" }, default: [] },
					notes: { type: "string", maxLength: 400, nullable: true },
				},
				additionalProperties: false
			}
		},

		successSignals: { type: "array", items: { type: "string" }, default: [] },

		// Flags & context
		recording: { type: "boolean", default: true },
		remote: { type: "boolean", default: true },
		lawfulBasis: { type: "string", enum: ["Public task", "Consent", "Legitimate interests", "Legal obligation"], default: "Public task" },

		// Scheduling/contextual info
		location: { type: "string", maxLength: 140, nullable: true },
		moderator: { type: "string", maxLength: 80, nullable: true },
		notetaker: { type: "string", maxLength: 80, nullable: true },

		// Export hints
		filenameHint: { type: "string", maxLength: 100, pattern: "^[A-Za-z0-9._ -]+$", nullable: true },

		// Versioning
		schemaVersion: { type: "integer", const: 1, default: 1 }
	},
	required: ["title", "timebox", "roles"],
};