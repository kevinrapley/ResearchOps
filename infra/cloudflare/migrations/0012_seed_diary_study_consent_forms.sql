-- Seed Airtable consent forms into D1 for the diary study.
-- Date: 2026-06-05
-- Source: Airtable base appkpzVvkof4RFtkh, shared view shrFDu4a5fVeql5Kq.
-- Scope: hydrate D1 so /pages/study/consent-forms/?id=rect3o7dt loads existing forms.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS rops_consent_forms (
	id TEXT PRIMARY KEY,
	study_id TEXT NOT NULL,
	title TEXT NOT NULL,
	form_type TEXT NOT NULL,
	status TEXT NOT NULL,
	version INTEGER NOT NULL DEFAULT 1,
	source_markdown TEXT NOT NULL,
	variables_json TEXT NOT NULL DEFAULT '{}',
	consent_items_json TEXT NOT NULL DEFAULT '[]',
	plain_english_summary TEXT,
	accessibility_notes TEXT,
	review_notes TEXT,
	owner TEXT,
	published_at TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	active INTEGER NOT NULL DEFAULT 1,
	source TEXT NOT NULL DEFAULT 'd1',
	payload_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_rops_consent_forms_study
	ON rops_consent_forms (study_id, active, updated_at);

CREATE INDEX IF NOT EXISTS idx_rops_consent_forms_status
	ON rops_consent_forms (status, active);

INSERT INTO rops_consent_forms (
	id,
	study_id,
	title,
	form_type,
	status,
	version,
	source_markdown,
	variables_json,
	consent_items_json,
	plain_english_summary,
	accessibility_notes,
	review_notes,
	owner,
	published_at,
	created_at,
	updated_at,
	active,
	source,
	payload_json
)
VALUES
	(
		'rec2FLw9TwgDgi85y',
		'rect3o7dt',
		'Participant information and consent form',
		'Consent form',
		'Draft',
		1,
		'# {{studyTitle}} participant information and consent form

## About this research

We are doing research for {{organisation}}. The session will help us understand how people use or experience this service.

## What taking part involves

You will take part in a {{sessionFormat}} with a researcher. You can choose not to answer any question. You can stop the session at any time.

## Recording and observers

{{recordingSummary}}

## How your information will be used

We will use what we learn to improve the service. Research notes and outputs should not identify you directly.

## Withdrawal

You can ask for your contribution to be withdrawn up to {{withdrawalPeriod}}, where this is possible.

## Consent statements

{{#consentItems}}
- {{label}}
{{/consentItems}}

## Contact

If you have questions, contact {{researcherName}} at {{researcherEmail}}.',
		'{"studyTitle":"Study title","organisation":"Home Office Biometrics","researcherName":"Researcher name","researcherEmail":"research@example.gov.uk","sessionFormat":"remote research session","recordingSummary":"The session may be audio or video recorded if you agree.","withdrawalPeriod":"14 days after your session"}',
		'[{"id":"participation","label":"I understand what taking part involves and I agree to take part in this research.","required":true},{"id":"voluntary","label":"I understand that taking part is voluntary and that I can stop the session at any time.","required":true},{"id":"data-use","label":"I understand how my information will be used for this research.","required":true},{"id":"recording","label":"I agree to the session being recorded if recording is being used for this study.","required":false}]',
		'Participant-facing consent material for this study.',
		'',
		'',
		'',
		'',
		'2026-04-26T00:59:53.379Z',
		'2026-04-26T00:59:53.379Z',
		1,
		'airtable-hydration',
		'{"airtableBaseId":"appkpzVvkof4RFtkh","airtableShareId":"shrFDu4a5fVeql5Kq","airtableRecordId":"rec2FLw9TwgDgi85y","airtableStudyRecordId":"rec6MGawTSZgdENHs","studyId":"rect3o7dt","projectId":"recgdpwEI5hF07bUZ","fields":{"fldVOoSwbTlTBalxc":"Participant information and consent form","fldzGFX0qCCw4BYUK":"Consent form","fldGbzlt9uaKuQltR":"Draft","fldIZSDzx8I8PHcVD":1,"fldM0E82U9X3LRkux":["rec6MGawTSZgdENHs"],"fldOCBEVOyxtIMloU":"2026-04-26T00:59:53.379Z","fldS244a10UF871Fv":"2026-04-26T00:59:53.379Z"}}'
	),
	(
		'recw6i67q2DuoZqMe',
		'rect3o7dt',
		'Participant information and consent form',
		'Privacy notice',
		'Published',
		2,
		'# {{studyTitle}} participant information and consent form

## About this research

We are doing research for {{organisation}}. The session will help us understand how people use or experience this service.

## What taking part involves

You will take part in a {{sessionFormat}} with a researcher. You can choose not to answer any question. You can stop the session at any time.

## Recording and observers

{{recordingSummary}}

## How your information will be used

We will use what we learn to improve the service. Research notes and outputs should not identify you directly.

## Withdrawal

You can ask for your contribution to be withdrawn up to {{withdrawalPeriod}}, where this is possible.

## Consent statements

{{#consentItems}}
- {{label}}
{{/consentItems}}

## Contact

If you have questions, contact {{researcherName}} at {{researcherEmail}}.',
		'{"studyTitle":"Study title","organisation":"Home Office Biometrics","researcherName":"Researcher name","researcherEmail":"research@example.gov.uk","sessionFormat":"remote research session","recordingSummary":"The session may be audio or video recorded if you agree.","withdrawalPeriod":"14 days after your session"}',
		'[{"id":"participation","label":"I understand what taking part involves and I agree to take part in this research.","required":true},{"id":"voluntary","label":"I understand that taking part is voluntary and that I can stop the session at any time.","required":true},{"id":"data-use","label":"I understand how my information will be used for this research.","required":true},{"id":"recording","label":"I agree to the session being recorded if recording is being used for this study.","required":false}]',
		'Participant-facing consent material for this study.',
		'',
		'',
		'',
		'2026-05-01T14:56:53.407Z',
		'2026-04-26T01:00:23.909Z',
		'2026-05-01T14:56:53.407Z',
		1,
		'airtable-hydration',
		'{"airtableBaseId":"appkpzVvkof4RFtkh","airtableShareId":"shrFDu4a5fVeql5Kq","airtableRecordId":"recw6i67q2DuoZqMe","airtableStudyRecordId":"rec6MGawTSZgdENHs","studyId":"rect3o7dt","projectId":"recgdpwEI5hF07bUZ","fields":{"fldVOoSwbTlTBalxc":"Participant information and consent form","fldzGFX0qCCw4BYUK":"Privacy notice","fldGbzlt9uaKuQltR":"Published","fldIZSDzx8I8PHcVD":2,"fldM0E82U9X3LRkux":["rec6MGawTSZgdENHs"],"fldGS7R6NllKSKHkI":"2026-05-01T14:56:53.407Z","fldOCBEVOyxtIMloU":"2026-04-26T01:00:23.909Z","fldS244a10UF871Fv":"2026-05-01T14:56:53.407Z"}}'
	)
ON CONFLICT(id) DO UPDATE SET
	study_id = excluded.study_id,
	title = excluded.title,
	form_type = excluded.form_type,
	status = excluded.status,
	version = excluded.version,
	source_markdown = excluded.source_markdown,
	variables_json = excluded.variables_json,
	consent_items_json = excluded.consent_items_json,
	plain_english_summary = excluded.plain_english_summary,
	accessibility_notes = excluded.accessibility_notes,
	review_notes = excluded.review_notes,
	owner = excluded.owner,
	published_at = excluded.published_at,
	created_at = excluded.created_at,
	updated_at = excluded.updated_at,
	active = 1,
	source = excluded.source,
	payload_json = excluded.payload_json;
