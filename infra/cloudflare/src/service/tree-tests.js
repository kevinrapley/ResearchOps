/**
 * @file tree-tests.js
 * @module tree-tests
 * @summary Tree test configuration and task-result endpoints for ResearchOps.
 */

import { d1All, d1Get, d1Run } from "./internals/researchops-d1.js";

const CONFIG_TABLE = "rops_tree_test_configs";
const RESULTS_TABLE = "rops_tree_test_results";

function hasD1(svc) { return Boolean(svc?.env?.RESEARCHOPS_D1?.prepare); }
function nowIso() { return new Date().toISOString(); }
function newId() { return `tt_${crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}_${Math.random().toString(16).slice(2)}`}`; }
function array(value) { try { const parsed = JSON.parse(String(value || "[]")); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
function object(value) { try { const parsed = JSON.parse(String(value || "{}")); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}; } catch { return {}; } }

async function body(svc, request) {
	const raw = await request.arrayBuffer();
	if (raw.byteLength > svc.cfg.MAX_BODY_BYTES) throw Object.assign(new Error("Payload too large"), { status: 413 });
	try { return JSON.parse(new TextDecoder().decode(raw) || "{}"); } catch { throw Object.assign(new Error("Invalid JSON"), { status: 400 }); }
}

async function ensureTables(svc) {
	await d1Run(svc.env, `CREATE TABLE IF NOT EXISTS ${CONFIG_TABLE} (study_id TEXT PRIMARY KEY, instructions TEXT, tree_json TEXT NOT NULL DEFAULT '[]', tasks_json TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`);
	await d1Run(svc.env, `CREATE TABLE IF NOT EXISTS ${RESULTS_TABLE} (id TEXT PRIMARY KEY, study_id TEXT NOT NULL, session_id TEXT NOT NULL, participant_id TEXT, status TEXT NOT NULL DEFAULT 'in_progress', result_json TEXT NOT NULL DEFAULT '{}', started_at TEXT, completed_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1)`);
	await d1Run(svc.env, `CREATE INDEX IF NOT EXISTS idx_rops_tree_test_results_study ON ${RESULTS_TABLE} (study_id, active, created_at)`);
	await d1Run(svc.env, `CREATE INDEX IF NOT EXISTS idx_rops_tree_test_results_session ON ${RESULTS_TABLE} (session_id, active, created_at)`);
}

function cleanTree(nodes, used = new Set(), depth = 0) {
	if (!Array.isArray(nodes) || depth > 8) return [];
	return nodes.flatMap((node, index) => {
		const label = String(node?.label || "").trim();
		if (!label) return [];
		let id = String(node.id || `node_${depth}_${index + 1}`).trim();
		while (used.has(id)) id = `${id}_${used.size + 1}`;
		used.add(id);
		return [{ id, label, children: cleanTree(node.children, used, depth + 1) }];
	});
}

function treeIds(nodes, set = new Set()) { nodes.forEach((node) => { set.add(node.id); treeIds(node.children || [], set); }); return set; }
function cleanTasks(tasks, tree) {
	const validIds = treeIds(tree);
	if (!Array.isArray(tasks)) return [];
	return tasks.flatMap((task, index) => {
		const prompt = String(task?.prompt || "").trim();
		const targetId = String(task?.target_id || task?.targetId || "").trim();
		if (!prompt || !validIds.has(targetId)) return [];
		return [{ id: String(task.id || `task_${index + 1}`).trim() || `task_${index + 1}`, prompt, target_id: targetId }];
	});
}

function configDto(row) {
	if (!row) return null;
	return { study_id: row.study_id, instructions: row.instructions || "", tree: array(row.tree_json), tasks: array(row.tasks_json), createdAt: row.created_at || "", updatedAt: row.updated_at || "" };
}
function resultDto(row) {
	if (!row) return null;
	return { id: row.id, study_id: row.study_id, session_id: row.session_id, participant_id: row.participant_id || "", status: row.status || "in_progress", result: object(row.result_json), started_at: row.started_at || "", completed_at: row.completed_at || "", createdAt: row.created_at || "", lastEditedAt: row.updated_at || "" };
}
function unavailable(svc, origin) { return svc.json({ ok: false, error: "tree_test_store_unavailable", message: "Tree tests are not available right now." }, 503, svc.corsHeaders(origin)); }

/** Get a study's prepared tree and test tasks. */
export async function getTreeTestConfig(svc, origin, url) {
	const studyId = String(url.searchParams.get("study") || "").trim();
	if (!studyId) return svc.json({ ok: false, error: "Missing study query" }, 400, svc.corsHeaders(origin));
	if (!hasD1(svc)) return unavailable(svc, origin);
	try { await ensureTables(svc); return svc.json({ ok: true, config: configDto(await d1Get(svc.env, `SELECT * FROM ${CONFIG_TABLE} WHERE study_id = ?`, [studyId])) }, 200, svc.corsHeaders(origin)); }
	catch (error) { svc.log.error("d1.tree_test_config.get.fail", { detail: error.message }); return unavailable(svc, origin); }
}

/** Save a study's prepared tree and tasks. */
export async function saveTreeTestConfig(svc, request, origin) {
	let payload; try { payload = await body(svc, request); } catch (error) { return svc.json({ ok: false, error: error.message }, error.status || 400, svc.corsHeaders(origin)); }
	const studyId = String(payload.study_id || payload.studyId || "").trim();
	const tree = cleanTree(payload.tree);
	const tasks = cleanTasks(payload.tasks, tree);
	if (!studyId || !tree.length || !tasks.length) return svc.json({ ok: false, error: "Provide a navigation tree and at least one task with a valid destination." }, 400, svc.corsHeaders(origin));
	if (!hasD1(svc)) return unavailable(svc, origin);
	try {
		await ensureTables(svc); const now = nowIso();
		await d1Run(svc.env, `INSERT INTO ${CONFIG_TABLE} (study_id, instructions, tree_json, tasks_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(study_id) DO UPDATE SET instructions = excluded.instructions, tree_json = excluded.tree_json, tasks_json = excluded.tasks_json, updated_at = excluded.updated_at`, [studyId, String(payload.instructions || "").trim() || null, JSON.stringify(tree), JSON.stringify(tasks), now, now]);
		return svc.json({ ok: true, config: configDto(await d1Get(svc.env, `SELECT * FROM ${CONFIG_TABLE} WHERE study_id = ?`, [studyId])) }, 200, svc.corsHeaders(origin));
	} catch (error) { svc.log.error("d1.tree_test_config.save.fail", { detail: error.message }); return unavailable(svc, origin); }
}

/** List tree test results for a study or session. */
export async function listTreeTestResults(svc, origin, url) {
	const studyId = String(url.searchParams.get("study") || "").trim(); const sessionId = String(url.searchParams.get("session") || "").trim();
	if (!studyId && !sessionId) return svc.json({ ok: false, error: "Missing study or session query" }, 400, svc.corsHeaders(origin));
	if (!hasD1(svc)) return unavailable(svc, origin);
	try { await ensureTables(svc); const where = []; const values = []; if (studyId) { where.push("study_id = ?"); values.push(studyId); } if (sessionId) { where.push("session_id = ?"); values.push(sessionId); } const rows = await d1All(svc.env, `SELECT * FROM ${RESULTS_TABLE} WHERE ${where.join(" AND ")} AND active = 1 ORDER BY datetime(created_at) ASC`, values); return svc.json({ ok: true, results: rows.map(resultDto) }, 200, svc.corsHeaders(origin)); }
	catch (error) { svc.log.error("d1.tree_test_results.list.fail", { detail: error.message }); return unavailable(svc, origin); }
}

async function saveResult(svc, request, origin, id = "") {
	let payload; try { payload = await body(svc, request); } catch (error) { return svc.json({ ok: false, error: error.message }, error.status || 400, svc.corsHeaders(origin)); }
	const studyId = String(payload.study_id || payload.studyId || "").trim(); const sessionId = String(payload.session_id || payload.sessionId || "").trim();
	if (!studyId || !sessionId) return svc.json({ ok: false, error: "Missing fields: study_id, session_id" }, 400, svc.corsHeaders(origin));
	if (!hasD1(svc)) return unavailable(svc, origin);
	try {
		await ensureTables(svc); const now = nowIso(); const status = payload.status === "completed" ? "completed" : "in_progress"; const result = payload.result && typeof payload.result === "object" ? JSON.stringify(payload.result) : "{}";
		if (id) {
			const existing = await d1Get(svc.env, `SELECT * FROM ${RESULTS_TABLE} WHERE id = ? AND active = 1`, [id]);
			if (!existing) return svc.json({ ok: false, error: "tree_test_result_not_found" }, 404, svc.corsHeaders(origin));
			await d1Run(svc.env, `UPDATE ${RESULTS_TABLE} SET participant_id = ?, status = ?, result_json = ?, completed_at = ?, updated_at = ? WHERE id = ?`, [String(payload.participant_id || payload.participantId || "").trim() || existing.participant_id, status, result, status === "completed" ? (payload.completed_at || existing.completed_at || now) : null, now, id]);
			return svc.json({ ok: true, result: resultDto(await d1Get(svc.env, `SELECT * FROM ${RESULTS_TABLE} WHERE id = ?`, [id])) }, 200, svc.corsHeaders(origin));
		}
		const resultId = newId(); await d1Run(svc.env, `INSERT INTO ${RESULTS_TABLE} (id, study_id, session_id, participant_id, status, result_json, started_at, completed_at, created_at, updated_at, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`, [resultId, studyId, sessionId, String(payload.participant_id || payload.participantId || "").trim() || null, status, result, payload.started_at || now, status === "completed" ? (payload.completed_at || now) : null, now, now]);
		return svc.json({ ok: true, id: resultId, result: resultDto(await d1Get(svc.env, `SELECT * FROM ${RESULTS_TABLE} WHERE id = ?`, [resultId])) }, 200, svc.corsHeaders(origin));
	} catch (error) { svc.log.error("d1.tree_test_result.save.fail", { detail: error.message }); return unavailable(svc, origin); }
}

/** Create a participant's tree-test result. */
export function createTreeTestResult(svc, request, origin) { return saveResult(svc, request, origin); }
/** Update a participant's tree-test result. */
export function updateTreeTestResult(svc, request, origin, id) { return saveResult(svc, request, origin, id); }
