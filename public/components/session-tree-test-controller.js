/** @file Interactive Tree Test participant session controller. */
const $ = (selector, root = document) => root.querySelector(selector);
const API_ORIGIN = document.documentElement?.dataset?.apiOrigin || window.API_ORIGIN || window.RESEARCHOPS_API_ORIGIN || location.origin;
const apiUrl = (path) => `${API_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
const params = new URLSearchParams(location.search);
const state = { studyId: params.get("id") || "", sessionId: params.get("session") || "", participantId: "", config: null, study: null, taskIndex: 0, path: [], completions: [], resultId: "", startedAt: "" };

async function request(path, options = {}) { const response = await fetch(apiUrl(path), { cache: "no-store", credentials: "include", headers: { "Content-Type": "application/json", ...(options.headers || {}) }, ...options }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`); return data; }
function setStatus(message) { const el = $("#tree-test-save-status"); if (el) el.textContent = message; }
function findNodes(nodes, id, ancestors = []) { for (const node of nodes || []) { if (node.id === id) return { node, ancestors }; const found = findNodes(node.children, id, [...ancestors, node]); if (found) return found; } return null; }
function currentTask() { return state.config?.tasks?.[state.taskIndex] || null; }
function serialise() { return { completions: state.completions, current_task_index: state.taskIndex, current_path: state.path, started_at: state.startedAt }; }
function renderProgress() { const task = currentTask(); const total = state.config?.tasks?.length || 0; $("#tree-test-progress").textContent = total ? `Task ${Math.min(state.taskIndex + 1, total)} of ${total}` : ""; $("#tree-test-prompt").textContent = task?.prompt || "All tasks complete."; $("#tree-test-complete").hidden = Boolean(task); }
function renderBreadcrumbs() { const list = $("#tree-test-path"); list.replaceChildren(); state.path.forEach((id, index) => { const item = findNodes(state.config.tree, id); const button = document.createElement("button"); button.type = "button"; button.className = "tree-test-path__button"; button.textContent = item?.node.label || "Location"; button.addEventListener("click", () => { state.path = state.path.slice(0, index + 1); render(); }); list.append(button); }); }
function choose(node) { const task = currentTask(); if (!task) return; const expected = task.target_id; const completion = { task_id: task.id, prompt: task.prompt, target_id: expected, selected_id: node.id, selected_label: node.label, path: [...state.path, node.id], correct: node.id === expected, completed_at: new Date().toISOString(), elapsed_ms: Date.now() - Date.parse(state.startedAt) }; state.completions.push(completion); state.taskIndex += 1; state.path = []; save(state.taskIndex >= state.config.tasks.length ? "completed" : "in_progress"); render(); }
function renderTree() {
	const list = $("#tree-test-tree-nav");
	list.replaceChildren();
	if (!currentTask()) return;
	const renderNodes = (nodes, parent) => {
		nodes.forEach((node) => {
			const item = document.createElement("li");
			item.className = "tree-test-node";
			const row = document.createElement("div");
			row.className = "tree-test-node__row";
			const label = document.createElement("span");
			label.className = "tree-test-node__label";
			label.textContent = node.label;
			row.append(label);
			const pathIndex = state.path.indexOf(node.id);
			if (node.children?.length) {
				const open = document.createElement("button");
				open.type = "button";
				open.className = "govuk-button govuk-button--secondary";
				open.textContent = pathIndex === -1 ? "Open" : "Close";
				open.setAttribute("aria-expanded", String(pathIndex !== -1));
				open.setAttribute("aria-label", `${pathIndex === -1 ? "Open" : "Close"} ${node.label}`);
				open.addEventListener("click", () => { state.path = pathIndex === -1 ? [...state.path, node.id] : state.path.slice(0, pathIndex); render(); });
				row.append(open);
			}
			const select = document.createElement("button");
			select.type = "button";
			select.className = "tree-test-node__choose";
			select.textContent = "Choose this location";
			select.addEventListener("click", () => choose(node));
			row.append(select);
			item.append(row);
			if (node.children?.length && pathIndex !== -1) {
				const children = document.createElement("ul");
				children.className = "tree-test-node__children";
				renderNodes(node.children, children);
				item.append(children);
			}
			parent.append(item);
		});
	};
	renderNodes(state.config.tree || [], list);
}
function renderResults() { const list = $("#tree-test-results"); list.replaceChildren(); state.completions.forEach((result, index) => { const item = document.createElement("li"); item.className = "tree-test-result"; item.textContent = `Task ${index + 1}: selected ${result.selected_label}`; list.append(item); }); }
function render() { renderProgress(); renderBreadcrumbs(); renderTree(); renderResults(); }
async function save(status = "in_progress") { if (!state.participantId) { setStatus("Select a participant to save Tree Test results."); return; } const payload = { study_id: state.studyId, session_id: state.sessionId || `study-${state.studyId}`, participant_id: state.participantId, status, result: serialise(), started_at: state.startedAt, completed_at: status === "completed" ? new Date().toISOString() : "" }; try { const data = state.resultId ? await request(`/api/tree-tests/results/${encodeURIComponent(state.resultId)}`, { method: "PATCH", body: JSON.stringify(payload) }) : await request("/api/tree-tests/results", { method: "POST", body: JSON.stringify(payload) }); state.resultId ||= data.id || data.result?.id || ""; setStatus(status === "completed" ? "Tree test complete and saved." : `Saved at ${new Date().toLocaleTimeString("en-GB")}.`); } catch (error) { setStatus(`Could not save the Tree Test. ${error.message}`); } }
async function loadParticipantResult() { state.resultId = ""; state.taskIndex = 0; state.path = []; state.completions = []; state.startedAt = new Date().toISOString(); if (!state.participantId) { render(); return; } try { const data = await request(`/api/tree-tests/results?session=${encodeURIComponent(state.sessionId || `study-${state.studyId}`)}`); const result = (data.results || []).filter((item) => item.participant_id === state.participantId).pop(); if (result) { state.resultId = result.id; state.completions = result.result?.completions || []; state.taskIndex = result.result?.current_task_index || state.completions.length; state.path = result.result?.current_path || []; state.startedAt = result.result?.started_at || result.started_at || state.startedAt; } } catch { /* A new result can still be captured. */ } render(); }
function hideIfNotTreeTest() { const isTreeTest = String(state.study?.method || "").trim().toLowerCase() === "tree test"; $("#tree-test-section").hidden = !isTreeTest; return isTreeTest; }

(async function init() {
	if (!state.studyId) return; try { const studies = await request(`/api/studies?id=${encodeURIComponent(state.studyId)}`); state.study = studies.study || studies.studies?.find((item) => item.id === state.studyId) || null; if (!hideIfNotTreeTest()) return; const config = await request(`/api/tree-tests/config?study=${encodeURIComponent(state.studyId)}`); state.config = config.config; if (!state.config?.tree?.length || !state.config?.tasks?.length) { $("#tree-test-setup-warning").hidden = false; $("#tree-test-setup-link").href = `/pages/study/tree-test/?id=${encodeURIComponent(state.studyId)}${params.get("project") ? `&project=${encodeURIComponent(params.get("project"))}` : ""}`; return; } $("#tree-test-instructions").textContent = state.config.instructions || "Choose the place where you would expect to find each answer."; $("#tree-test-instructions-wrap").hidden = false; const participant = $("#participant-select"); state.participantId = participant?.value || ""; participant?.addEventListener("change", async () => { state.participantId = participant.value; await loadParticipantResult(); }); await loadParticipantResult(); } catch (error) { setStatus(`Could not load the Tree Test. ${error.message}`); }
})();
