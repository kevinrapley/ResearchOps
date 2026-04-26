/**
 * @file core/fields.js
 * @module core/fields
 * @summary Field-name candidates for flexible Airtable schemas.
 */

/** Candidate names for the Guides↔Study link field */
export const GUIDE_LINK_FIELD_CANDIDATES = [
	"Study ↔", "Study", "Project Study", "Study Link", "Study Record", "Studies"
];

/** Candidate names for other common fields in the Guides table */
export const GUIDE_FIELD_NAMES = {
	title: ["Title", "Name"],
	status: ["Status"],
	version: ["Version", "Revision", "v"],
	source: ["Source Markdown", "Markdown", "Source"],
	variables: ["Variables (JSON)", "Variables", "Vars"]
};

/** Candidate names for the Consent Forms↔Study link field */
export const CONSENT_FORM_LINK_FIELD_CANDIDATES = [
	"Study", "Project Study", "Study Link", "Study Record", "Studies", "Project Studies"
];

/** Candidate names for common fields in the Consent Forms table */
export const CONSENT_FORM_FIELD_NAMES = {
	title: ["Title", "Name"],
	formType: ["Form Type", "Type", "Consent Form Type"],
	status: ["Status"],
	version: ["Version", "Revision", "v"],
	source: ["Source Markdown", "Markdown", "Source"],
	variables: ["Variables (JSON)", "Variables", "Vars"],
	consentItems: ["Consent Items (JSON)", "Consent Items", "Statements (JSON)"],
	summary: ["Plain English Summary", "Summary", "Plain English"],
	accessibilityNotes: ["Accessibility Notes", "Access Notes", "Reasonable Adjustments"],
	reviewNotes: ["Review Notes", "Ethics Review Notes", "Notes"],
	owner: ["Owner", "Created By", "Maintainer"],
	publishedAt: ["Published At", "Published"],
	createdAt: ["Created At", "CreatedAt"],
	updatedAt: ["Updated At", "UpdatedAt"]
};

/** Participants & Sessions Airtable field names */
export const PARTICIPANT_FIELDS = {
	display_name: ["Display Name", "Name", "Participant"],
	email: ["Email"],
	phone: ["Phone"],
	// Time Zone intentionally optional per user requirement; only used if present:
	timezone: ["Time Zone", "Timezone"],

	channel_pref: ["Channel Pref", "Channel Preference"],
	access_needs: ["Access Needs", "Accessibility"],
	recruitment_source: ["Recruitment Source", "Source"],
	consent_status: ["Consent Status"],
	consent_record_id: ["Consent Record Id", "Consent Record"],
	privacy_notice_url: ["Privacy Notice URL", "Privacy URL"],
	status: ["Status"],

	// Link to Study: your Airtable table is “Project Studies”
	study_link: ["Study ID", "Project Studies", "Study", "Studies", "Project Study"]
};

export const SESSION_FIELDS = {
	study_link: ["Study", "Studies", "Project Study"],
	participant_link: ["Participant", "Participants"],
	starts_at: ["Starts At", "Start", "Start Time"],
	duration_min: ["Duration (min)", "Duration"],
	type: ["Type", "Session Type"],
	location_or_link: ["Location / Link", "Location", "Join Link"],
	backup_contact: ["Backup Contact"],
	researchers: ["Researchers"],
	status: ["Status"],
	incentive_type: ["Incentive Type"],
	incentive_amount: ["Incentive Amount"],
	incentive_status: ["Incentive Status"],
	safeguarding_flag: ["Safeguarding", "Safeguarding Flag"],
	notes: ["Notes"]
};