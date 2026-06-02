import assert from "node:assert/strict";
import {
	createImpactRecord,
	deleteImpactRecord,
	listImpactRecords,
	updateImpactRecord,
} from "../infra/cloudflare/src/service/impact-internals.js";

function createMockD1() {
	const state = {
		impactRecords: [],
		runs: [],
	};

	function statement(sql, args = []) {
		return {
			bind(...nextArgs) {
				return statement(sql, nextArgs);
			},
			async run() {
				state.runs.push({ sql, args });
				if (/INSERT INTO impact_records/i.test(sql)) {
					state.impactRecords.push({
						record_id: args[0],
						display_ref: args[1],
						project_id: args[2],
						study_id: args[3],
						decision_link: args[4],
						metric_name: args[5],
						metric_unit: args[6],
						metric_direction: args[7],
						baseline_value: args[8],
						target_value: args[9],
						actual_value: args[10],
						measurement_window: args[11],
						impact_type: args[12],
						impact_scale: args[13],
						status: args[14],
						notes: args[15],
						created_at: args[16],
						updated_at: args[17],
						deleted_at: null,
					});
				}
				if (/UPDATE impact_records/i.test(sql) && /SET deleted_at/i.test(sql)) {
					const record = state.impactRecords.find((row) => row.record_id === args[2]);
					if (record) {
						record.deleted_at = args[0];
						record.updated_at = args[1];
					}
				}
				if (/UPDATE impact_records/i.test(sql) && /SET study_id/i.test(sql)) {
					const record = state.impactRecords.find((row) => row.record_id === args[14]);
					if (record) {
						record.study_id = args[0];
						record.decision_link = args[1];
						record.metric_name = args[2];
						record.metric_unit = args[3];
						record.metric_direction = args[4];
						record.baseline_value = args[5];
						record.target_value = args[6];
						record.actual_value = args[7];
						record.measurement_window = args[8];
						record.impact_type = args[9];
						record.impact_scale = args[10];
						record.status = args[11];
						record.notes = args[12];
						record.updated_at = args[13];
					}
				}
				return { success: true, meta: { changes: 1 } };
			},
			async first() {
				if (/FROM impact_records/i.test(sql) && /WHERE record_id = \?/i.test(sql)) {
					return state.impactRecords.find((row) => row.record_id === args[0]) || null;
				}
				return null;
			},
			async all() {
				if (/FROM impact_records/i.test(sql)) {
					const projectId = args[0];
					const studyId = args[1];
					let rows = state.impactRecords.filter((row) => row.project_id === projectId && !row.deleted_at);
					if (studyId) rows = rows.filter((row) => row.study_id === studyId);
					return { results: rows };
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

const d1 = createMockD1();
const env = { RESEARCHOPS_D1: d1 };

const created = await createImpactRecord(env, {
	projectId: "proj-1",
	studyId: "study-1",
	displayRef: "IMPCT-RCD-5F0907B5E5AA",
	decisionLink: "https://example.test/decision/1",
	metricName: "Completion rate",
	metricUnit: "percentage",
	metricDirection: "increase",
	baseline: 62,
	target: 80,
	actual: 74,
	measurementWindow: "one-month",
	impactType: "service",
	impactScale: "journey",
	status: "measured",
	notes: "Measured after rollout.",
});

assert.equal(created.displayRef, "IMPCT-RCD-5F0907B5E5AA");
assert.equal(created.projectId, "proj-1");
assert.equal(created.metricName, "Completion rate");
assert.equal(created.metricUnit, "percentage");

const listed = await listImpactRecords(env, { projectId: "proj-1" });
assert.equal(listed.length, 1);
assert.equal(listed[0].displayRef, created.displayRef);

const updated = await updateImpactRecord(env, created.id, {
	metricName: "Completion rate after content changes",
	actual: 82,
	status: "measured",
});

assert.equal(updated.metricName, "Completion rate after content changes");
assert.equal(updated.actual, 82);
assert.equal(updated.status, "measured");

await deleteImpactRecord(env, created.id);
const afterDelete = await listImpactRecords(env, { projectId: "proj-1" });
assert.equal(afterDelete.length, 0);
assert.equal(d1.state.impactRecords[0].deleted_at !== null, true);
