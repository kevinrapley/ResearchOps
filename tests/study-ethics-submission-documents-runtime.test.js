import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
	createEthicsSubmissionDocument,
	readEthicsSubmissionDocument,
} from '../infra/cloudflare/src/service/ethics-submission-documents.js';

const templateBytes = fs.readFileSync(
	'public/templates/ethics/research-ethics-approval-form-v3.docx'
);

class MockD1Statement {
	constructor(db, sql) {
		this.db = db;
		this.sql = sql;
		this.params = [];
	}

	bind(...params) {
		this.params = params;
		return this;
	}

	async run() {
		if (/INSERT INTO rops_ethics_submission_documents/i.test(this.sql)) {
			const [
				id,
				studyId,
				projectId,
				submissionVersion,
				submissionType,
				route,
				status,
				templateKey,
				objectKey,
				objectEtag,
				contentType,
				byteSize,
				sha256,
				submissionJson,
				riskOutcomeJson,
				sourcebookClausesJson,
				createdBy,
				createdAt,
			] = this.params;
			this.db.rows.set(id, {
				id,
				study_id: studyId,
				project_id: projectId,
				submission_version: submissionVersion,
				submission_type: submissionType,
				route,
				status,
				template_key: templateKey,
				object_key: objectKey,
				object_etag: objectEtag,
				content_type: contentType,
				byte_size: byteSize,
				sha256,
				submission_json: submissionJson,
				risk_outcome_json: riskOutcomeJson,
				sourcebook_clauses_json: sourcebookClausesJson,
				created_by: createdBy,
				created_at: createdAt,
			});
		}
		return { success: true };
	}

	async first() {
		if (/SELECT \* FROM rops_ethics_submission_documents WHERE id = \?/i.test(this.sql)) {
			return this.db.rows.get(this.params[0]) || null;
		}
		return null;
	}
}

class MockD1 {
	constructor() {
		this.rows = new Map();
	}

	prepare(sql) {
		return new MockD1Statement(this, sql);
	}
}

class MockR2 {
	constructor() {
		this.objects = new Map();
	}

	async put(key, value, options = {}) {
		this.objects.set(key, {
			bytes: new Uint8Array(value),
			options,
		});
		return { etag: 'test-etag' };
	}

	async get(key) {
		const object = this.objects.get(key);
		if (!object) return null;
		return { body: new Response(object.bytes).body };
	}
}

function testService() {
	const r2 = new MockR2();
	const d1 = new MockD1();
	return {
		r2,
		d1,
		svc: {
			cfg: { MAX_BODY_BYTES: 250000 },
			env: {
				RESEARCHOPS_D1: d1,
				RESEARCHOPS_DOCUMENTS_R2: r2,
				ASSETS: {
					async fetch() {
						return new Response(templateBytes, {
							status: 200,
							headers: {
								'content-type':
									'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
							},
						});
					},
				},
			},
			corsHeaders() {
				return {};
			},
			json(body, status = 200, headers = {}) {
				return new Response(JSON.stringify(body), {
					status,
					headers: {
						'content-type': 'application/json; charset=utf-8',
						...headers,
					},
				});
			},
		},
	};
}

const { svc, r2, d1 } = testService();
const request = new Request('https://research-operations.com/api/study-ethics-risk/submissions', {
	method: 'POST',
	body: JSON.stringify({
		projectId: 'recgdpwEI5hFO7bUZ',
		projectName: 'Test Project 1',
		studyId: 'rect3o7dt',
		studyTitle: 'Diary study participant consent preview',
		submission: {
			studyId: 'rect3o7dt',
			route: 'ethics-board-submission-likely',
			status: 'submitted',
			submissionStatus: 'submitted',
			submissionType: 'New submission',
			submissionVersion: 1,
			owner: 'Research Lead',
			reviewer: 'Ethics board or governance approver',
		},
		riskOutcome: {
			route: 'ethics-board-submission-likely',
			statusLabel: 'Ethics submission needed',
			summary: 'Use this workflow to pause fieldwork before participant contact.',
			triggers: [
				{ family: 'Participants', label: 'Direct research with people who need formal protection' },
				{ family: 'Data', label: 'Sensitive, live or legally protected data may be seen' },
			],
			sourcebookClauses: [
				{ id: 'GOVERN 2.1.1', title: 'Complete governance triage before participant contact' },
			],
		},
		sections: [
			{
				id: 'project-details',
				label: 'Project details and research team',
				generated: ['Project: Test Project 1', 'Study: Diary study participant consent preview'],
				value: 'Senior review has happened.',
			},
		],
	}),
});

const createResponse = await createEthicsSubmissionDocument(
	svc,
	request,
	'https://research-operations.com',
	{ user: { email: 'researcher@example.com' } }
);
assert.equal(createResponse.status, 201);
const created = await createResponse.json();
assert.equal(created.ok, true);
assert.equal(created.document.studyId, 'rect3o7dt');
assert.equal(
	created.document.contentType,
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
);
assert.equal(created.document.templateKey, 'templates/ethics/research-ethics-approval-form-v3.docx');
assert.equal(created.document.objectKey.startsWith('ethics-submissions/rect3o7dt/v1/'), true);
assert.equal(created.document.byteSize > templateBytes.byteLength, true);
assert.equal(r2.objects.size, 1);
assert.equal(d1.rows.size, 1);

const stored = [...r2.objects.values()][0];
assert.equal(stored.bytes[0], 0x50);
assert.equal(stored.bytes[1], 0x4b);
assert.equal(
	stored.options.httpMetadata.contentType,
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
);

const readResponse = await readEthicsSubmissionDocument(
	svc,
	'https://research-operations.com',
	created.document.id
);
assert.equal(readResponse.status, 200);
assert.equal(
	readResponse.headers.get('content-type'),
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
);
assert.match(
	readResponse.headers.get('content-disposition'),
	/rect3o7dt-ethics-submission-v1\.docx/
);
