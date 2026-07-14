/** @file Study-level Tree Test preparation controller. */
const $ = (selector, root = document) => root.querySelector(selector);
const API_ORIGIN = document.documentElement?.dataset?.apiOrigin || window.API_ORIGIN || window.RESEARCHOPS_API_ORIGIN || location.origin;
const apiUrl = (path) => `${API_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
const id = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const editorState = { loadedTree: [], treeDirty: false };

function studyId() { return new URLSearchParams(location.search).get("id") || ""; }
function parseTree(text) {
	const root = []; const stack = [{ indent: -1, children: root }];
	text.split(/\r?\n/).forEach((line, lineIndex) => {
		if (!line.trim()) return;
		const spaces = line.match(/^\s*/)[0].replace(/\t/g, "  ").length;
		const label = line.trim();
		while (stack.length > 1 && spaces <= stack.at(-1).indent) stack.pop();
		const node = { id: `node_${lineIndex + 1}_${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "location"}`, label, children: [] };
		stack.at(-1).children.push(node); stack.push({ indent: spaces, children: node.children });
	});
	return root;
}
function flatten(nodes, depth = 0, out = []) { nodes.forEach((node) => { out.push({ ...node, depth }); flatten(node.children || [], depth + 1, out); }); return out; }
function serialiseTree(nodes, depth = 0) { return nodes.flatMap((node) => [`${"  ".repeat(depth)}${node.label}`, ...serialiseTree(node.children || [], depth + 1)]).join("\n"); }
function showError(message) { const summary = $("#tree-test-error-summary"); if (summary) summary.hidden = false; const target = $("#tree-test-error-message"); if (target) target.textContent = message; summary?.focus(); }
function clearError() { const summary = $("#tree-test-error-summary"); if (summary) summary.hidden = true; }
function status(message) { const el = $("#tree-test-save-status"); if (el) el.textContent = message; }
function currentTree() { return editorState.treeDirty || !editorState.loadedTree.length ? parseTree($("#tree-test-tree")?.value || "") : editorState.loadedTree; }
function options(select, selected = "") { const nodes = flatten(currentTree()); select.replaceChildren(); const empty = new Option("Choose a destination", ""); select.append(empty); nodes.forEach((node) => select.append(new Option(`${"— ".repeat(node.depth)}${node.label}`, node.id, false, node.id === selected))); }

function addTask(task = {}) {
	const row = document.createElement("li"); row.className = "tree-test-task-row"; row.dataset.taskId = task.id || id("task");
	const prompt = document.createElement("textarea"); prompt.className = "govuk-textarea"; prompt.rows = 2; prompt.placeholder = "For example: Find out how to renew a passport"; prompt.value = task.prompt || ""; prompt.setAttribute("aria-label", "Task scenario");
	const target = document.createElement("select"); target.className = "govuk-select"; target.setAttribute("aria-label", "Correct destination"); options(target, task.target_id || task.targetId || "");
	const remove = document.createElement("button"); remove.type = "button"; remove.className = "govuk-button govuk-button--warning"; remove.textContent = "Remove"; remove.addEventListener("click", () => row.remove());
	row.append(prompt, target, remove); $("#tree-test-task-list")?.append(row);
}
function refreshTaskDestinations() { $("#tree-test-task-list")?.querySelectorAll("select").forEach((select) => { const selected = select.value; options(select, selected); }); }
function taskPayload() { return Array.from($("#tree-test-task-list")?.children || []).map((row) => ({ id: row.dataset.taskId, prompt: $("textarea", row)?.value.trim() || "", target_id: $("select", row)?.value || "" })); }
async function request(path, options = {}) { const response = await fetch(apiUrl(path), { cache: "no-store", credentials: "include", headers: { "Content-Type": "application/json", ...(options.headers || {}) }, ...options }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`); return data; }
async function hydrateContext(currentStudyId) {
	try { const data = await request(`/api/studies?id=${encodeURIComponent(currentStudyId)}`); const studyRecord = data.study || data.studies?.find((item) => item.id === currentStudyId) || {}; const projectId = studyRecord.projectId || new URLSearchParams(location.search).get("project") || ""; const breadcrumb = $("#breadcrumb-study"); if (breadcrumb) breadcrumb.href = `/pages/study/?id=${encodeURIComponent(currentStudyId)}${projectId ? `&project=${encodeURIComponent(projectId)}` : ""}`; } catch { /* Page remains usable if context is unavailable. */ }
}

(async function init() {
	const currentStudyId = studyId(); if (!currentStudyId) { showError("Missing study ID. Open this page from the study overview."); return; }
	$("#tree-test-tree")?.addEventListener("input", () => { editorState.treeDirty = true; refreshTaskDestinations(); });
	$("#btn-add-tree-test-task")?.addEventListener("click", () => addTask());
	$("#tree-test-form")?.addEventListener("submit", async (event) => {
		event.preventDefault(); const tree = currentTree(); const tasks = taskPayload();
		if (!tree.length || !tasks.some((task) => task.prompt && task.target_id)) { showError("Add a navigation tree and at least one task with a correct destination."); return; }
		clearError(); status("Saving tree test.");
		try { await request("/api/tree-tests/config", { method: "POST", body: JSON.stringify({ study_id: currentStudyId, instructions: $("#tree-test-instructions")?.value.trim() || "", tree, tasks }) }); editorState.loadedTree = tree; editorState.treeDirty = false; status("Tree test saved."); }
		catch (error) { status(""); showError(`Could not save the tree test. ${error.message}`); }
	});
	try { const data = await request(`/api/tree-tests/config?study=${encodeURIComponent(currentStudyId)}`); if (data.config) { editorState.loadedTree = Array.isArray(data.config.tree) ? data.config.tree : []; editorState.treeDirty = false; $("#tree-test-instructions").value = data.config.instructions || ""; $("#tree-test-tree").value = serialiseTree(editorState.loadedTree); (data.config.tasks || []).forEach(addTask); } } catch { /* Empty configuration is expected on first use. */ }
	if (!$("#tree-test-task-list")?.children.length) addTask(); hydrateContext(currentStudyId);
})();
