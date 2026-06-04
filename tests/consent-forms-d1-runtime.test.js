import assert from 'node:assert/strict';
import {
	createConsentForm,
	listConsentForms,
	publishConsentForm,
	updateConsentForm,
} from '../infra/cloudflare/src/service/consent-forms.js';

function createMockD1() {
	const state = {
		consentForms: [],
		runs: [],
	};

	function statement(sql, args = []) {
		return {
			bind(...nextArgs) {
				return statement(sql, nextArgs);
			},
			async run() {
				state.runs.push({ sql, args });
				if (/INSERT INTO rops_consent_forms/i.test(sql)) {
					state.consentForms.push({
						id: args[0],
						study_id: args[1],
						title: args[2],
						form_type: args[3],
						status: args[4],
						version: args[5],
						source_markdown: args[6],
						variables_json: args[7],
						consent_items_json: args[8],
						plain_english_summary: args[9],
						accessibility_notes: args[10],
						review_notes: args[11],
						owner: args[12],
						published_at: args[13],
						created_at: args[14],
						updated_at: args[15],
						active: 1,
						source: 'd1',
						payload_json: args[16],
					});
				}
				if (/UPDATE rops_consent_forms/i.test(sql) && /SET title = \?/i.test(sql)) {
					const row = state.consentForms.find((item) => item.id === args[14] && item.active === 1);
					if (row) {
						row.title = args[0];
						row.form_type = args[1];
						row.status = args[2];
						row.version = args[3];
						row.source_markdown = args[4];
						row.variables_json = args[5];
						row.consent_items_json = args[6];
						row.plain_english_summary = args[7];
						row.accessibility_notes = args[8];
						row.review_notes = args[9];
						row.owner = args[10];
						row.published_at = args[11];
						row.updated_at = args[12];
						row.payload_json = args[13];
					}
				}
				if (/UPDATE rops_consent_forms/i.test(sql) && /SET status = 'Published'/i.test(sql)) {
					const row = state.consentForms.find((item) => item.id === args[3] && item.active === 1);
					if (row) {
						row.status = 'Published';
						row.version = args[0];
						row.published_at = args[1];
						row.updated_at = args[2];
					}
				}
				return { success: true, meta: { changes: 1 } };
			},
			async first() {
				if (/FROM rops_consent_forms/i.test(sql) && /WHERE id = \?/i.test(sql)) {
					return state.consentForms.find((row) => row.id === args[0] && row.active === 1) || null;
				}
				return null;
			},
			async all() {
				if (/FROM rops_consent_forms/i.test(sql) && /WHERE study_id = \?/i.test(sql)) {
					const studyId = args[0];
					return {
						results: state.consentForms.filter(
							(row) => row.study_id === studyId && row.active === 1
						),
					};
				}
				return { results: [] };
			},
		};
	}

	return {
		state,
		prepare(sql) {
			return statement(sql);
		},
	};
}

function createService(d1, env = {}) {
	return {
		env: { RESEARCHOPS_D1: d1, ...env },
		cfg: { MAX_BODY_BYTES: 1024 * 1024, TIMEOUT_MS: 1000 },
		corsHeaders() {
			return {};
		},
		json(body, status = 200, headers = {}) {
			return new Response(JSON.stringify(body), {
				status,
				headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
			});
		},
		log: {
			warn() {},
			error() {},
		},
	};
}

async function json(response) {
	return response.json();
}

const d1 = createMockD1();
const svc = createService(d1);

const emptyList = await json(
	await listConsentForms(svc, '', new URL('https://example.test/api/consent-forms?study=rect3biqr'))
);
assert.equal(emptyList.ok, true);
assert.equal(emptyList.source, 'd1');
assert.deepEqual(emptyList.consentForms, []);

const created = await json(
	await createConsentForm(
		svc,
		new Request('https://example.test/api/consent-forms', {
			method: 'POST',
			body: JSON.stringify({
				studyId: 'rect3biqr',
				title: 'Diary study consent',
				formType: 'Consent form',
				status: 'Draft',
				sourceMarkdown: '# Diary consent',
				variables: { studyTitle: 'The diary study' },
				consentItems: [{ id: 'participation', label: 'I agree', required: true }],
				plainEnglishSummary: 'Consent for the diary study.',
			}),
		}),
		''
	)
);

assert.equal(created.ok, true);
assert.equal(created.source, 'd1');
assert.equal(created.consentForm.title, 'Diary study consent');
assert.equal(created.consentForm.variables.studyTitle, 'The diary study');

const listed = await json(
	await listConsentForms(svc, '', new URL('https://example.test/api/consent-forms?study=rect3biqr'))
);
assert.equal(listed.consentForms.length, 1);
assert.equal(listed.consentForms[0].id, created.id);

const mixedSourceSvc = createService(d1, {
	AIRTABLE_BASE_ID: 'app123',
	AIRTABLE_API_KEY: 'key123',
	AIRTABLE_TABLE_CONSENT_FORMS: 'Consent Forms',
});
const originalFetch = globalThis.fetch;
globalThis.fetch = async () =>
	new Response(
		JSON.stringify({
			records: [
				{
					id: 'recAirtableConsent01',
					createdTime: '2026-06-05T09:00:00.000Z',
					fields: {
						Title: 'Existing Airtable consent',
						'Form Type': 'Consent form',
						Status: 'Published',
						Version: 3,
						'Source Markdown': '# Existing Airtable consent',
						'Variables (JSON)': '{"studyTitle":"Airtable study"}',
						'Consent Items (JSON)': '[]',
						Study: ['rect3biqr'],
					},
				},
			],
		}),
		{ status: 200, headers: { 'content-type': 'application/json' } }
	);
try {
	const mixed = await json(
		await listConsentForms(
			mixedSourceSvc,
			'',
			new URL('https://example.test/api/consent-forms?study=rect3biqr')
		)
	);
	assert.equal(mixed.ok, true);
	assert.equal(mixed.source, 'd1+airtable');
	assert.equal(mixed.consentForms.length, 2);
	assert.deepEqual(
		mixed.consentForms.map((form) => form.id).sort(),
		[created.id, 'recAirtableConsent01'].sort()
	);
} finally {
	globalThis.fetch = originalFetch;
}

const updated = await json(
	await updateConsentForm(
		svc,
		new Request(`https://example.test/api/consent-forms/${created.id}`, {
			method: 'PATCH',
			body: JSON.stringify({
				title: 'Updated diary study consent',
				sourceMarkdown: '# Updated',
				variables: { studyTitle: 'Updated diary study' },
				consentItems: [],
			}),
		}),
		'',
		created.id
	)
);

assert.equal(updated.ok, true);
assert.equal(updated.consentForm.title, 'Updated diary study consent');
assert.equal(updated.consentForm.sourceMarkdown, '# Updated');

const published = await json(await publishConsentForm(svc, '', created.id));
assert.equal(published.ok, true);
assert.equal(published.source, 'd1');
assert.equal(published.status, 'Published');
assert.equal(published.version, 2);
