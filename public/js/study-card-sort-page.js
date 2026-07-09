/**
 * @file public/js/study-card-sort-page.js
 * @summary Card sort setup page: define sort type, cards and predefined groups for a study.
 * @description
 * - Loads and saves the per-study card sort configuration via /api/card-sorts/config.
 * - Cards and groups are edited as dynamic rows; bulk card entry supports
 *   "Label | Description" lines.
 * - Predefined groups are only shown (and required) for closed and hybrid sorts.
 */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

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

function getStudyId() {
	return new URLSearchParams(location.search).get("id") || "";
}

function getProjectId() {
	return new URLSearchParams(location.search).get("project") || "";
}

function newLocalId(prefix) {
	return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function showError(message, href = "#card-sort-type") {
	const summary = $("#card-sort-error-summary");
	const link = summary?.querySelector(".govuk-error-summary__list a");
	if (!summary || !link) return;
	link.textContent = message;
	link.setAttribute("href", href);
	summary.hidden = false;
	summary.focus?.();
}

function clearError() {
	const summary = $("#card-sort-error-summary");
	if (summary) summary.hidden = true;
}

function setStatus(message) {
	const status = $("#card-sort-save-status");
	if (status) status.textContent = message;
}

/* -------------------------------------------------------------------------- */
/* Editor rows                                                                */
/* -------------------------------------------------------------------------- */
function editorRow({ id, label = "", description = "" }, kind) {
	const li = document.createElement("li");
	li.className = "study-card-sort-editor-row";
	li.dataset.itemId = id;

	const labelId = `${kind}-label-${id}`;
	const descId = `${kind}-desc-${id}`;

	const labelGroup = document.createElement("div");
	labelGroup.className = "govuk-form-group study-card-sort-editor-field";
	const labelEl = document.createElement("label");
	labelEl.className = "govuk-label govuk-visually-hidden";
	labelEl.setAttribute("for", labelId);
	labelEl.textContent = kind === "card" ? "Card label" : "Group name";
	const labelInput = document.createElement("input");
	labelInput.className = "govuk-input";
	labelInput.id = labelId;
	labelInput.type = "text";
	labelInput.value = label;
	labelInput.placeholder = kind === "card" ? "Card label" : "Group name";
	labelInput.dataset.role = "label";
	labelGroup.append(labelEl, labelInput);

	const descGroup = document.createElement("div");
	descGroup.className = "govuk-form-group study-card-sort-editor-field study-card-sort-editor-field--desc";
	const descLabel = document.createElement("label");
	descLabel.className = "govuk-label govuk-visually-hidden";
	descLabel.setAttribute("for", descId);
	descLabel.textContent = "Description (optional)";
	const descInput = document.createElement("input");
	descInput.className = "govuk-input";
	descInput.id = descId;
	descInput.type = "text";
	descInput.value = description;
	descInput.placeholder = "Description (optional)";
	descInput.dataset.role = "description";
	descGroup.append(descLabel, descInput);

	const remove = document.createElement("button");
	remove.type = "button";
	remove.className = "govuk-button govuk-button--warning study-card-sort-editor-remove";
	remove.textContent = "Remove";
	remove.addEventListener("click", () => li.remove());

	li.append(labelGroup, descGroup, remove);
	return li;
}

function addRow(listSelector, kind, item = {}) {
	const list = $(listSelector);
	if (!list) return null;
	const row = editorRow({ id: item.id || newLocalId(kind), label: item.label, description: item.description }, kind);
	list.append(row);
	return row;
}

function readRows(listSelector) {
	return $$(`${listSelector} > li`).map((li) => ({
		id: li.dataset.itemId,
		label: li.querySelector('[data-role="label"]')?.value.trim() || "",
		description: li.querySelector('[data-role="description"]')?.value.trim() || ""
	})).filter((item) => item.label);
}

/* -------------------------------------------------------------------------- */
/* Sort type behaviour                                                        */
/* -------------------------------------------------------------------------- */
function selectedSortType() {
	return $('input[name="cardSortType"]:checked')?.value || "open";
}

function syncGroupsVisibility() {
	const section = $("#groups-editor-section");
	if (!section) return;
	const type = selectedSortType();
	section.hidden = type === "open";
	if (!section.hidden && !$$("#group-editor-list > li").length) {
		addRow("#group-editor-list", "group");
	}
}

/* -------------------------------------------------------------------------- */
/* Load and save                                                              */
/* -------------------------------------------------------------------------- */
async function loadConfig(studyId) {
	const res = await fetch(apiUrl(`/api/card-sorts/config?study=${encodeURIComponent(studyId)}&ts=${Date.now()}`), {
		cache: "no-store",
		credentials: "include"
	});
	if (!res.ok) return null;
	const body = await res.json().catch(() => ({}));
	return body?.config || null;
}

function hydrate(config) {
	if (!config) {
		addRow("#card-editor-list", "card");
		syncGroupsVisibility();
		return;
	}
	const radio = $(`input[name="cardSortType"][value="${config.sort_type}"]`);
	if (radio) radio.checked = true;
	const allowNew = $("#allow-new-cards");
	if (allowNew) allowNew.checked = Boolean(config.allow_new_cards);
	const shuffle = $("#shuffle-cards");
	if (shuffle) shuffle.checked = Boolean(config.shuffle_cards);
	const instructions = $("#card-sort-instructions");
	if (instructions) instructions.value = config.instructions || "";

	(config.cards || []).forEach((card) => addRow("#card-editor-list", "card", card));
	if (!(config.cards || []).length) addRow("#card-editor-list", "card");
	(config.groups || []).forEach((group) => addRow("#group-editor-list", "group", group));
	syncGroupsVisibility();
}

function validate() {
	const errors = [];
	if (!readRows("#card-editor-list").length) {
		errors.push({ message: "Add at least one card to sort", href: "#btn-add-card" });
	}
	if (selectedSortType() !== "open" && !readRows("#group-editor-list").length) {
		errors.push({ message: "Closed and hybrid sorts need at least one predefined group", href: "#btn-add-group" });
	}
	return errors;
}

async function saveConfig(studyId) {
	const payload = {
		study_id: studyId,
		sort_type: selectedSortType(),
		allow_new_cards: Boolean($("#allow-new-cards")?.checked),
		shuffle_cards: Boolean($("#shuffle-cards")?.checked),
		instructions: $("#card-sort-instructions")?.value.trim() || "",
		cards: readRows("#card-editor-list"),
		groups: selectedSortType() === "open" ? [] : readRows("#group-editor-list")
	};
	const res = await fetch(apiUrl("/api/card-sorts/config"), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify(payload)
	});
	const body = await res.json().catch(() => ({}));
	if (!res.ok || !body?.ok) {
		throw new Error(body?.error || body?.message || `HTTP ${res.status}`);
	}
	return body.config;
}

/* -------------------------------------------------------------------------- */
/* Bulk card entry                                                            */
/* -------------------------------------------------------------------------- */
function applyBulkCards() {
	const input = $("#bulk-cards-input");
	if (!input) return;
	input.value.split("\n").map((line) => line.trim()).filter(Boolean).forEach((line) => {
		const [label, ...rest] = line.split("|");
		addRow("#card-editor-list", "card", {
			label: label.trim(),
			description: rest.join("|").trim()
		});
	});
	input.value = "";
	const panel = $("#bulk-cards-panel");
	if (panel) panel.hidden = true;
}

/* -------------------------------------------------------------------------- */
/* Breadcrumbs and study context                                              */
/* -------------------------------------------------------------------------- */
async function hydrateContext(studyId) {
	let study = null;
	try {
		const res = await fetch(apiUrl(`/api/studies/${encodeURIComponent(studyId)}`), {
			cache: "no-store",
			credentials: "include"
		});
		const body = await res.json().catch(() => ({}));
		study = body?.study || null;
	} catch {
		/* breadcrumbs stay generic */
	}

	const projectId = getProjectId() || study?.projectId || (Array.isArray(study?.projectIds) ? study.projectIds[0] : "") || "";
	const title = String(study?.title || study?.Title || "").trim();

	const caption = $("#study-title");
	if (caption && title) caption.textContent = title;

	const studyCrumb = $("#breadcrumb-study");
	const studyHref = `/pages/study/?id=${encodeURIComponent(studyId)}${projectId ? `&project=${encodeURIComponent(projectId)}` : ""}`;
	if (studyCrumb) {
		if (title) studyCrumb.textContent = title;
		studyCrumb.href = studyHref;
	}
	const back = $("#btn-back-to-study");
	if (back) back.href = studyHref;

	const projectCrumb = $("#breadcrumb-project");
	if (projectCrumb && projectId) {
		projectCrumb.href = `/pages/project-dashboard/?id=${encodeURIComponent(projectId)}`;
		try {
			const res = await fetch(apiUrl(`/api/projects/${encodeURIComponent(projectId)}`), {
				cache: "no-store",
				credentials: "include"
			});
			const body = await res.json().catch(() => ({}));
			const project = body?.project || body || {};
			const name = String(project.name || project.Name || project.title || "").trim();
			if (name) projectCrumb.textContent = name;
		} catch {
			/* keep generic label */
		}
	}
}

/* -------------------------------------------------------------------------- */
/* Bootstrap                                                                  */
/* -------------------------------------------------------------------------- */
(async function bootstrap() {
	const studyId = getStudyId();
	if (!studyId) {
		showError("Missing study ID. Open this page from the study overview.");
		return;
	}

	$$('input[name="cardSortType"]').forEach((radio) => radio.addEventListener("change", syncGroupsVisibility));
	$("#btn-add-card")?.addEventListener("click", () => addRow("#card-editor-list", "card")?.querySelector("input")?.focus());
	$("#btn-add-group")?.addEventListener("click", () => addRow("#group-editor-list", "group")?.querySelector("input")?.focus());
	$("#btn-bulk-cards")?.addEventListener("click", () => {
		const panel = $("#bulk-cards-panel");
		if (panel) {
			panel.hidden = false;
			$("#bulk-cards-input")?.focus();
		}
	});
	$("#btn-bulk-cards-apply")?.addEventListener("click", applyBulkCards);
	$("#btn-bulk-cards-cancel")?.addEventListener("click", () => {
		const panel = $("#bulk-cards-panel");
		if (panel) panel.hidden = true;
	});

	$("#card-sort-form")?.addEventListener("submit", async (event) => {
		event.preventDefault();
		const errors = validate();
		if (errors.length) {
			showError(errors[0].message, errors[0].href);
			return;
		}
		clearError();
		setStatus("Saving card sort.");
		try {
			await saveConfig(studyId);
			setStatus("Card sort saved.");
		} catch (err) {
			setStatus("");
			showError(`Could not save the card sort. ${String(err?.message || err)}`);
		}
	});

	hydrateContext(studyId);

	try {
		hydrate(await loadConfig(studyId));
	} catch {
		hydrate(null);
	}
})();
