/**
 * @file /components/session-card-sort-controller.js
 * @summary Card sort session workflow: swaps the fieldnotes session UI for a sorting board.
 * @description
 * When the study's method is "Card Sort" this controller:
 * - Hides the fieldnotes capture UI and reframes the page as a card sort session.
 * - Loads the study's card sort configuration (sort type, cards, predefined groups).
 * - Renders a drag-and-drop board: an unsorted card tray plus participant groups.
 *   Open sorts let participants create, rename, nest and move groups; closed
 *   sorts fix the groups; hybrid sorts mix predefined and participant groups.
 * - Cards and whole groups can be dragged (or moved via an accessible move
 *   menu). New cards can be added where the study allows it.
 * - Autosaves placements to /api/card-sorts/results per participant, resuming
 *   an in-progress result when the participant is re-selected.
 */

const $ = (s, r = document) => r.querySelector(s);

const API_ORIGIN =
	document.documentElement?.dataset?.apiOrigin ||
	window.API_ORIGIN ||
	window.RESEARCHOPS_API_ORIGIN ||
	(location.hostname.endsWith("pages.dev") ?
		"https://rops-api.digikev-kevin-rapley.workers.dev" :
		location.origin);

function apiUrl(path) {
	return `${API_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

function param(name) {
	return new URLSearchParams(location.search).get(name) || "";
}

const state = {
	studyId: "",
	sessionId: "",
	participantId: "",
	config: null,
	resultId: "",
	status: "in_progress",
	/** Map<cardId, {id,label,description,source}> */
	cards: new Map(),
	/** Ordered ids of unsorted cards */
	unsorted: [],
	/** Array of group nodes {id,label,source,cards:[cardId],children:[node]} */
	groups: [],
	saveTimer: null,
	saving: false,
	dirty: false,
	dragPreview: null,
	dragPreviewMoveHandler: null
};

function newId(prefix) {
	return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function jsonFetch(url, options = {}) {
	const res = await fetch(url, {
		cache: "no-store",
		credentials: "include",
		...options,
		headers: { "Content-Type": "application/json", ...(options.headers || {}) }
	});
	const body = await res.json().catch(() => ({}));
	if (!res.ok) throw Object.assign(new Error(body?.error || `HTTP ${res.status}`), { status: res.status, body });
	return body;
}

/* -------------------------------------------------------------------------- */
/* Group tree helpers                                                         */
/* -------------------------------------------------------------------------- */
function walkGroups(nodes, fn, parent = null) {
	for (const node of nodes) {
		fn(node, parent);
		walkGroups(node.children, fn, node);
	}
}

function findGroup(groupId) {
	let found = null;
	walkGroups(state.groups, (node) => {
		if (node.id === groupId) found = node;
	});
	return found;
}

function removeGroupFromTree(groupId) {
	const prune = (nodes) => {
		const index = nodes.findIndex((node) => node.id === groupId);
		if (index >= 0) return nodes.splice(index, 1)[0];
		for (const node of nodes) {
			const removed = prune(node.children);
			if (removed) return removed;
		}
		return null;
	};
	return prune(state.groups);
}

function groupContains(node, groupId) {
	if (node.id === groupId) return true;
	return node.children.some((child) => groupContains(child, groupId));
}

function removeCardEverywhere(cardId) {
	state.unsorted = state.unsorted.filter((id) => id !== cardId);
	walkGroups(state.groups, (node) => {
		node.cards = node.cards.filter((id) => id !== cardId);
	});
}

function releaseCardsToTray(node) {
	state.unsorted.push(...node.cards);
	node.cards = [];
	node.children.forEach(releaseCardsToTray);
}

function sortedCount() {
	let count = 0;
	walkGroups(state.groups, (node) => {
		count += node.cards.length;
	});
	return count;
}

function hasGroupedCards() {
	return sortedCount() > 0;
}

/* -------------------------------------------------------------------------- */
/* Serialisation                                                              */
/* -------------------------------------------------------------------------- */
function cardDto(cardId) {
	const card = state.cards.get(cardId);
	return card ? { id: card.id, label: card.label, description: card.description || "", source: card.source } : null;
}

function groupDto(node) {
	return {
		id: node.id,
		label: node.label,
		source: node.source,
		cards: node.cards.map(cardDto).filter(Boolean),
		children: node.children.map(groupDto)
	};
}

function serialiseResult() {
	return {
		sort_type: state.config?.sort_type || "open",
		groups: state.groups.map(groupDto),
		unsorted: state.unsorted.map(cardDto).filter(Boolean),
		participant_cards: Array.from(state.cards.values()).filter((card) => card.source === "participant")
	};
}

function hydrateFromResult(result) {
	const data = result?.result || {};
	// Re-register participant-created cards first so placements can resolve them.
	(data.participant_cards || []).forEach((card) => {
		if (card?.id && !state.cards.has(card.id)) {
			state.cards.set(card.id, { id: card.id, label: card.label || "Card", description: card.description || "", source: "participant" });
		}
	});
	const toNode = (group) => ({
		id: group.id || newId("grp"),
		label: group.label || "Group",
		source: group.source === "predefined" ? "predefined" : "participant",
		cards: (group.cards || []).map((card) => card?.id).filter((id) => id && state.cards.has(id)),
		children: (group.children || []).map(toNode)
	});
	if (Array.isArray(data.groups) && data.groups.length) {
		state.groups = data.groups.map(toNode);
	}
	const placed = new Set();
	walkGroups(state.groups, (node) => node.cards.forEach((id) => placed.add(id)));
	state.unsorted = Array.from(state.cards.keys()).filter((id) => !placed.has(id));
	state.status = result?.status === "completed" ? "completed" : "in_progress";
}

/* -------------------------------------------------------------------------- */
/* Persistence                                                                */
/* -------------------------------------------------------------------------- */
function setSaveStatus(message) {
	const el = $("#card-sort-save-status");
	if (el) el.textContent = message;
}

function setResetConfirmationVisible(visible) {
	const panel = $("#card-sort-reset-confirmation");
	if (!panel) return;
	panel.hidden = !visible;
	if (visible) {
		$("#btn-confirm-reset-card-sort")?.focus();
	}
}

function scheduleSave() {
	state.dirty = true;
	clearTimeout(state.saveTimer);
	state.saveTimer = setTimeout(() => saveResult().catch(() => {}), 900);
}

async function saveResult(overrides = {}) {
	if (!state.participantId) {
		setSaveStatus("Select a participant to record this card sort.");
		return;
	}
	if (state.saving) {
		scheduleSave();
		return;
	}
	state.saving = true;
	state.dirty = false;
	const payload = {
		study_id: state.studyId,
		session_id: state.sessionId,
		participant_id: state.participantId,
		status: state.status,
		result: serialiseResult(),
		...overrides
	};
	try {
		if (state.resultId) {
			await jsonFetch(apiUrl(`/api/card-sorts/results/${encodeURIComponent(state.resultId)}`), {
				method: "PATCH",
				body: JSON.stringify(payload)
			});
		} else {
			const body = await jsonFetch(apiUrl("/api/card-sorts/results"), {
				method: "POST",
				body: JSON.stringify(payload)
			});
			state.resultId = body?.id || body?.result?.id || "";
		}
		setSaveStatus(state.status === "completed" ? "Card sort complete and saved." : `Saved at ${new Date().toLocaleTimeString("en-GB")}.`);
	} catch (err) {
		console.warn("card-sort.save.fail", err);
		setSaveStatus("Could not save the card sort. Changes are kept on this page; retrying on the next change.");
	} finally {
		state.saving = false;
		if (state.dirty) scheduleSave();
	}
}

async function loadExistingResult() {
	if (!state.participantId) return;
	try {
		const url = new URL(apiUrl("/api/card-sorts/results"));
		url.searchParams.set("session", state.sessionId);
		const body = await jsonFetch(url.toString());
		const match = (body?.results || []).filter((r) => (r.participant_id || "") === state.participantId).pop();
		if (match) {
			state.resultId = match.id;
			hydrateFromResult(match);
		} else {
			state.resultId = "";
			resetBoard();
		}
	} catch (err) {
		console.warn("card-sort.results.load.fail", err);
	}
}

/* -------------------------------------------------------------------------- */
/* Board setup                                                                */
/* -------------------------------------------------------------------------- */
function shuffle(list) {
	const out = list.slice();
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

function resetBoard() {
	state.cards = new Map();
	(state.config?.cards || []).forEach((card) => {
		state.cards.set(card.id, { ...card, source: "prepared" });
	});
	const ids = Array.from(state.cards.keys());
	state.unsorted = state.config?.shuffle_cards ? shuffle(ids) : ids;
	state.groups = (state.config?.sort_type === "open" ? [] : (state.config?.groups || []).map((group) => ({
		id: group.id,
		label: group.label,
		source: "predefined",
		cards: [],
		children: []
	})));
	state.status = "in_progress";
}

function canCreateGroups() {
	return state.config?.sort_type !== "closed";
}

function canEditGroup(node) {
	return node.source !== "predefined";
}

/* -------------------------------------------------------------------------- */
/* Rendering                                                                  */
/* -------------------------------------------------------------------------- */
function actionButton(label, onClick, danger = false) {
	const btn = document.createElement("button");
	btn.type = "button";
	btn.className = `card-sort-action-button${danger ? " card-sort-action-button--danger" : ""}`;
	btn.textContent = label;
	btn.addEventListener("click", onClick);
	return btn;
}

/** Flat list of {id,label,depth} move destinations. */
function destinationList(excludeGroupId = null) {
	const out = [];
	const visit = (nodes, depth) => {
		for (const node of nodes) {
			if (excludeGroupId && groupContains(node, excludeGroupId) && node.id === excludeGroupId) continue;
			if (excludeGroupId && node.id === excludeGroupId) continue;
			out.push({ id: node.id, label: `${"- ".repeat(depth)}${node.label}`, node });
			visit(node.children, depth + 1);
		}
	};
	visit(state.groups, 0);
	return out;
}

function openMoveMenu(host, options, onPick) {
	host.querySelector(".card-sort-move-menu")?.remove();
	const wrap = document.createElement("div");
	wrap.className = "card-sort-move-menu";
	const select = document.createElement("select");
	select.className = "govuk-select";
	select.setAttribute("aria-label", "Move to");
	const placeholder = document.createElement("option");
	placeholder.value = "";
	placeholder.textContent = "Move to...";
	select.append(placeholder);
	options.forEach((option) => {
		const el = document.createElement("option");
		el.value = option.id;
		el.textContent = option.label;
		select.append(el);
	});
	select.addEventListener("change", () => {
		if (select.value) onPick(select.value);
		wrap.remove();
	});
	select.addEventListener("blur", () => setTimeout(() => wrap.remove(), 150));
	wrap.append(select);
	host.append(wrap);
	select.focus();
}

function openInlineTextInput(host, { className, label, placeholder, submitText, onSubmit }) {
	host.querySelector(`.${className}`)?.remove();
	const form = document.createElement("form");
	form.className = `card-sort-inline-form ${className}`;
	const labelEl = document.createElement("label");
	labelEl.className = "govuk-label govuk-visually-hidden";
	const inputId = `${className}-${newId("input")}`;
	labelEl.setAttribute("for", inputId);
	labelEl.textContent = label;
	const input = document.createElement("input");
	input.id = inputId;
	input.className = "govuk-input";
	input.type = "text";
	input.placeholder = placeholder;
	const submit = document.createElement("button");
	submit.type = "submit";
	submit.className = "govuk-button govuk-button--secondary";
	submit.textContent = submitText;
	const cancel = actionButton("Cancel", () => form.remove());
	form.append(labelEl, input, submit, cancel);
	form.addEventListener("submit", (event) => {
		event.preventDefault();
		const value = input.value.trim();
		if (!value) {
			input.focus();
			return;
		}
		onSubmit(value);
		form.remove();
	});
	host.append(form);
	input.focus();
}

function moveDragPreview(event) {
	if (!state.dragPreview || !event.clientX || !event.clientY) return;
	state.dragPreview.style.left = `${event.clientX + 14}px`;
	state.dragPreview.style.top = `${event.clientY + 10}px`;
}

function clearDragPreview() {
	state.dragPreview?.remove();
	state.dragPreview = null;
	if (state.dragPreviewMoveHandler) {
		document.removeEventListener("dragover", state.dragPreviewMoveHandler);
		state.dragPreviewMoveHandler = null;
	}
}

function startDragPreview(cardElement, event) {
	clearDragPreview();
	const preview = cardElement.cloneNode(true);
	preview.removeAttribute("id");
	preview.removeAttribute("draggable");
	preview.classList.remove("card-sort-dragging");
	preview.classList.add("card-sort-drag-preview");
	preview.style.width = `${cardElement.offsetWidth}px`;
	document.body.append(preview);
	state.dragPreview = preview;
	state.dragPreviewMoveHandler = moveDragPreview;
	document.addEventListener("dragover", state.dragPreviewMoveHandler);
	moveDragPreview(event);
	requestAnimationFrame(() => preview.classList.add("card-sort-drag-preview--tilted"));

	const transparentDragImage = document.createElement("canvas");
	transparentDragImage.width = 1;
	transparentDragImage.height = 1;
	event.dataTransfer?.setDragImage(transparentDragImage, 0, 0);
}

function renderCard(cardId, originGroupId) {
	const card = state.cards.get(cardId);
	if (!card) return null;
	const li = document.createElement("li");
	li.className = `card-sort-card${card.source === "participant" ? " card-sort-card--participant" : ""}`;
	li.draggable = true;
	li.dataset.cardId = cardId;

	const text = document.createElement("div");
	const label = document.createElement("p");
	label.className = "card-sort-card__label govuk-body-s";
	label.textContent = card.label;
	text.append(label);
	if (card.description) {
		const desc = document.createElement("p");
		desc.className = "card-sort-card__desc govuk-body-s";
		desc.textContent = card.description;
		text.append(desc);
	}
	li.append(text);

	const move = actionButton("Move", () => {
		const options = [{ id: "__tray__", label: "Cards to sort (tray)" }, ...destinationList()];
		openMoveMenu(li, options.filter((o) => o.id !== originGroupId && !(o.id === "__tray__" && !originGroupId)), (target) => {
			moveCard(cardId, target === "__tray__" ? null : target);
		});
	});
	move.classList.add("card-sort-card__move", "govuk-visually-hidden");
	move.setAttribute("aria-label", `Move card ${card.label}`);
	li.append(move);

	li.addEventListener("dragstart", (event) => {
		event.dataTransfer.setData("text/rops-card", cardId);
		event.dataTransfer.setData("text/rops-card-origin", originGroupId || "__tray__");
		event.dataTransfer.effectAllowed = "move";
		startDragPreview(li, event);
		li.classList.add("card-sort-dragging");
	});
	li.addEventListener("drag", moveDragPreview);
	li.addEventListener("dragend", () => {
		li.classList.remove("card-sort-dragging");
		clearDragPreview();
	});
	return li;
}

function attachDropTarget(el, { onCard, onGroup } = {}) {
	el.addEventListener("dragover", (event) => {
		const types = Array.from(event.dataTransfer?.types || []);
		if ((onCard && types.includes("text/rops-card")) || (onGroup && types.includes("text/rops-group"))) {
			event.preventDefault();
			event.stopPropagation();
			el.classList.add("card-sort-drop-active");
		}
	});
	el.addEventListener("dragleave", () => el.classList.remove("card-sort-drop-active"));
	el.addEventListener("drop", (event) => {
		el.classList.remove("card-sort-drop-active");
		const cardId = event.dataTransfer.getData("text/rops-card");
		const cardOrigin = event.dataTransfer.getData("text/rops-card-origin");
		const groupId = event.dataTransfer.getData("text/rops-group");
		if (cardId && onCard) {
			event.preventDefault();
			event.stopPropagation();
			onCard(cardId, cardOrigin || "__tray__");
		} else if (groupId && onGroup) {
			event.preventDefault();
			event.stopPropagation();
			onGroup(groupId);
		}
	});
}

function renderGroup(node) {
	const wrap = document.createElement("div");
	wrap.className = `card-sort-group${node.source === "predefined" ? " card-sort-group--predefined" : ""}`;
	wrap.dataset.groupId = node.id;

	const header = document.createElement("div");
	header.className = "card-sort-group__header";
	header.draggable = canEditGroup(node);
	const name = document.createElement("p");
	name.className = "card-sort-group__name govuk-body";
	name.textContent = node.label;
	const count = document.createElement("span");
	count.className = "card-sort-group__count govuk-body-s";
	const total = node.cards.length;
	count.textContent = `${total} card${total === 1 ? "" : "s"}`;
	header.append(name, count);
	wrap.append(header);

	if (canEditGroup(node)) {
		header.addEventListener("dragstart", (event) => {
			event.dataTransfer.setData("text/rops-group", node.id);
			event.dataTransfer.effectAllowed = "move";
			event.stopPropagation();
		});
	}

	const cardsList = document.createElement("ol");
	cardsList.className = "card-sort-card-list card-sort-group__cards";
	cardsList.setAttribute("aria-label", `Cards in group ${node.label}`);
	node.cards.forEach((cardId) => {
		const card = renderCard(cardId, node.id);
		if (card) cardsList.append(card);
	});
	wrap.append(cardsList);
	attachDropTarget(cardsList, {
		onCard: (cardId, originGroupId) => {
			if (originGroupId === node.id) return;
			moveCard(cardId, node.id);
		},
		onGroup: (groupId) => nestGroup(groupId, node.id)
	});

	if (node.children.length) {
		const children = document.createElement("div");
		children.className = "card-sort-group__children";
		node.children.forEach((child) => children.append(renderGroup(child)));
		wrap.append(children);
	}

	const actions = document.createElement("div");
	actions.className = "card-sort-group__actions";

	if (canEditGroup(node)) {
		actions.append(actionButton("Rename", () => startRename(node, wrap)));
	}
	if (canCreateGroups()) {
		actions.append(actionButton("Add subgroup", () => {
			openInlineTextInput(actions, {
				className: "card-sort-subgroup-form",
				label: `Subgroup name for ${node.label}`,
				placeholder: "Subgroup name",
				submitText: "Add subgroup",
				onSubmit: (label) => {
					node.children.push({ id: newId("grp"), label, source: "participant", cards: [], children: [] });
					renderBoard();
					scheduleSave();
				}
			});
		}));
	}
	if (canEditGroup(node)) {
		actions.append(actionButton("Move group", () => {
			const options = [{ id: "__top__", label: "Top level" }, ...destinationList(node.id).filter((o) => !groupContains(node, o.id))];
			openMoveMenu(wrap, options, (target) => nestGroup(node.id, target === "__top__" ? null : target));
		}));
		actions.append(actionButton("Remove", () => {
			releaseCardsToTray(node);
			removeGroupFromTree(node.id);
			renderBoard();
			scheduleSave();
		}, true));
	}
	if (actions.childElementCount) wrap.append(actions);
	return wrap;
}

function startRename(node, wrap) {
	const name = wrap.querySelector(".card-sort-group__name");
	if (!name) return;
	const input = document.createElement("input");
	input.className = "govuk-input card-sort-group__name-input";
	input.value = node.label;
	input.setAttribute("aria-label", "Group name");
	const commit = () => {
		node.label = input.value.trim() || node.label;
		renderBoard();
		scheduleSave();
	};
	input.addEventListener("keydown", (event) => {
		if (event.key === "Enter") { event.preventDefault(); commit(); }
		if (event.key === "Escape") renderBoard();
	});
	input.addEventListener("blur", commit);
	name.replaceWith(input);
	input.focus();
	input.select();
}

function renderBoard() {
	const tray = $("#card-sort-tray-list");
	const groupsRoot = $("#card-sort-groups-grid");
	if (!tray || !groupsRoot) return;

	tray.innerHTML = "";
	state.unsorted.forEach((cardId) => {
		const card = renderCard(cardId, null);
		if (card) tray.append(card);
	});

	groupsRoot.innerHTML = "";
	state.groups.forEach((node) => groupsRoot.append(renderGroup(node)));

	const progress = $("#card-sort-progress");
	if (progress) {
		const total = state.cards.size;
		progress.textContent = `${sortedCount()} of ${total} cards sorted, ${state.unsorted.length} remaining.`;
	}

	const complete = $("#btn-complete-card-sort");
	if (complete) {
		const blocked = state.status === "completed" || !hasGroupedCards();
		complete.disabled = blocked;
		complete.setAttribute("aria-disabled", String(blocked));
		complete.title = !hasGroupedCards() ? "Sort at least one card into a group before marking the card sort complete." : "";
		complete.textContent = state.status === "completed" ? "Card sort completed" : "Mark card sort complete";
	}
}

/* -------------------------------------------------------------------------- */
/* Mutations                                                                  */
/* -------------------------------------------------------------------------- */
function moveCard(cardId, groupId) {
	removeCardEverywhere(cardId);
	if (!groupId) {
		state.unsorted.push(cardId);
	} else {
		const group = findGroup(groupId);
		if (!group) {
			state.unsorted.push(cardId);
		} else {
			group.cards.push(cardId);
		}
	}
	renderBoard();
	scheduleSave();
}

function nestGroup(groupId, targetGroupId) {
	if (groupId === targetGroupId) return;
	const moving = findGroup(groupId);
	if (!moving || !canEditGroup(moving)) return;
	// Refuse to nest a group inside its own descendant.
	if (targetGroupId && groupContains(moving, targetGroupId)) return;
	removeGroupFromTree(groupId);
	if (!targetGroupId) {
		state.groups.push(moving);
	} else {
		const target = findGroup(targetGroupId);
		if (!target) {
			state.groups.push(moving);
		} else {
			target.children.push(moving);
		}
	}
	renderBoard();
	scheduleSave();
}

function addParticipantCard(label) {
	const card = { id: newId("pcard"), label, description: "", source: "participant" };
	state.cards.set(card.id, card);
	state.unsorted.push(card.id);
	renderBoard();
	scheduleSave();
}

function addTopLevelGroup(label) {
	state.groups.push({ id: newId("grp"), label, source: "participant", cards: [], children: [] });
	renderBoard();
	scheduleSave();
}

/* -------------------------------------------------------------------------- */
/* Page chrome                                                                */
/* -------------------------------------------------------------------------- */
function switchPageToCardSort() {
	const heading = document.querySelector(".study-session-hero h1");
	if (heading) heading.textContent = "Run a card sort session";
	const desc = $("#page-desc");
	if (desc) {
		desc.textContent = "Select a participant, check consent, then guide them through sorting the prepared cards into groups.";
	}
	// The fieldnotes workflow does not apply to a card sort session.
	document.querySelector('section[aria-labelledby="notes-title"]')?.setAttribute("hidden", "hidden");
	const section = $("#card-sort-section");
	if (section) section.hidden = false;
}

function showSetupMissing() {
	const warning = $("#card-sort-setup-warning");
	const board = $("#card-sort-board");
	if (warning) {
		warning.hidden = false;
		const link = $("#card-sort-setup-link");
		if (link) {
			link.href = `/pages/study/card-sort/?id=${encodeURIComponent(state.studyId)}${param("project") ? `&project=${encodeURIComponent(param("project"))}` : ""}`;
		}
	}
	if (board) board.hidden = true;
}

function describeSortType(type) {
	if (type === "closed") return "Closed sort: ask the participant to place each card into one of the predefined groups.";
	if (type === "hybrid") return "Hybrid sort: the participant uses the predefined groups and can create their own when nothing fits.";
	return "Open sort: the participant creates and names their own groups, and can nest groups inside each other.";
}

function initBoardChrome() {
	const typeLine = $("#card-sort-type-line");
	if (typeLine) typeLine.textContent = describeSortType(state.config.sort_type);

	const instructions = $("#card-sort-instructions-text");
	const instructionsWrap = $("#card-sort-instructions");
	if (instructions && instructionsWrap) {
		if (state.config.instructions) {
			instructions.textContent = state.config.instructions;
			instructionsWrap.hidden = false;
		} else {
			instructionsWrap.hidden = true;
		}
	}

	const addCardForm = $("#card-sort-add-card-form");
	if (addCardForm) {
		addCardForm.hidden = !state.config.allow_new_cards;
		addCardForm.addEventListener("submit", (event) => {
			event.preventDefault();
			const input = $("#card-sort-new-card-input");
			const label = input?.value.trim();
			if (!label) return;
			addParticipantCard(label);
			input.value = "";
			input.focus();
		});
	}

	const addGroupForm = $("#card-sort-add-group-form");
	if (addGroupForm) {
		addGroupForm.hidden = !canCreateGroups();
		addGroupForm.addEventListener("submit", (event) => {
			event.preventDefault();
			const input = $("#card-sort-new-group-input");
			const label = input?.value.trim();
			if (!label) return;
			addTopLevelGroup(label);
			input.value = "";
			input.focus();
		});
	}

	const tray = $("#card-sort-tray-list");
	if (tray) {
		attachDropTarget(tray.closest(".card-sort-tray") || tray, {
			onCard: (cardId, originGroupId) => {
				if (originGroupId === "__tray__") return;
				moveCard(cardId, null);
			}
		});
	}
	const groupsPanel = $("#card-sort-groups-grid");
	if (groupsPanel) {
		attachDropTarget(groupsPanel.closest(".card-sort-groups") || groupsPanel, {
			onGroup: (groupId) => nestGroup(groupId, null)
		});
	}

	$("#btn-complete-card-sort")?.addEventListener("click", async () => {
		if (!hasGroupedCards()) {
			setSaveStatus("Sort at least one card into a group before marking the card sort complete.");
			return;
		}
		setResetConfirmationVisible(false);
		state.status = "completed";
		renderBoard();
		await saveResult({ completed_at: new Date().toISOString() });
	});

	$("#btn-reset-card-sort")?.addEventListener("click", () => {
		setResetConfirmationVisible(true);
		setSaveStatus("Confirm reset to move all cards back to the tray.");
	});

	$("#btn-confirm-reset-card-sort")?.addEventListener("click", () => {
		setResetConfirmationVisible(false);
		resetBoard();
		renderBoard();
		setSaveStatus("Card sort reset. Changes save automatically.");
		scheduleSave();
	});

	$("#btn-cancel-reset-card-sort")?.addEventListener("click", () => {
		setResetConfirmationVisible(false);
		setSaveStatus("Card sort reset cancelled.");
		$("#btn-reset-card-sort")?.focus();
	});
}

/* -------------------------------------------------------------------------- */
/* Bootstrap                                                                  */
/* -------------------------------------------------------------------------- */
(async function bootstrap() {
	state.studyId = param("id");
	if (!state.studyId) return;
	state.sessionId = param("session") || `study-${state.studyId}`;

	let study = null;
	try {
		const body = await jsonFetch(apiUrl(`/api/studies/${encodeURIComponent(state.studyId)}`));
		study = body?.study || null;
	} catch (err) {
		console.warn("card-sort.study.load.fail", err);
		return;
	}
	const method = String(study?.method || "").trim().toLowerCase();
	if (method !== "card sort") return;

	switchPageToCardSort();

	try {
		const body = await jsonFetch(apiUrl(`/api/card-sorts/config?study=${encodeURIComponent(state.studyId)}&ts=${Date.now()}`));
		state.config = body?.config || null;
	} catch (err) {
		console.warn("card-sort.config.load.fail", err);
		state.config = null;
	}

	if (!state.config || !(state.config.cards || []).length) {
		showSetupMissing();
		return;
	}

	resetBoard();
	initBoardChrome();
	renderBoard();
	setSaveStatus("Select a participant to record this card sort.");

	$("#participant-select")?.addEventListener("change", async (event) => {
		const select = event.target;
		const option = select.options[select.selectedIndex];
		state.participantId = option?.dataset?.airtableId || select.value || "";
		state.resultId = "";
		resetBoard();
		if (state.participantId) {
			await loadExistingResult();
			setSaveStatus(state.resultId ? "Resumed this participant's card sort." : "Ready to sort. Changes save automatically.");
		} else {
			setSaveStatus("Select a participant to record this card sort.");
		}
		renderBoard();
	});
})();
