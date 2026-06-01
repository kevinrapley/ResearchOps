const PARTICIPANT_API_ORIGIN = resolveParticipantApiBase();
const PARTICIPANT_PAGE_SIZE = 10;
const STUDY_TITLE_PREFIX = "Study: ";

const participantListState = {
	projectId: "",
	participants: [],
	page: 1,
	query: "",
	sort: "az",
	isRendering: false,
};

function resolveParticipantApiBase() {
	const explicit = document.documentElement?.dataset?.apiOrigin || window.API_ORIGIN || "";
	return String(explicit || "").trim().replace(/\/+$/, "");
}

function participantApiUrl(path) {
	const cleanPath = path.startsWith("/") ? path : `/${path}`;
	return `${PARTICIPANT_API_ORIGIN}${cleanPath}`;
}

function participantProjectIdFromUrl() {
	return new URLSearchParams(location.search).get("id") || document.querySelector("main")?.dataset?.projectId || "";
}

function escapeParticipantHtml(value = "") {
	return String(value)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

async function participantJson(path) {
	const response = await fetch(participantApiUrl(path), {
		cache: "no-store",
		credentials: "include",
	});
	const json = await response.json().catch(() => ({}));
	if (!response.ok || json?.ok === false) throw new Error(json?.message || json?.error || `HTTP ${response.status}`);
	return json;
}

function participantPanel() {
	return document.getElementById("participants-dashboard-panel");
}

function studyTitleFor(study = {}) {
	return String(study.title || study.Title || study.method || "Study").trim() || "Study";
}

function participantLabel(participant = {}) {
	return String(participant.participant_ref || participant.display_name || participant.id || "Participant").trim();
}

function participantUserGroup(participant = {}) {
	return String(participant.user_group || participant.userGroup || participant.user_group_label || participant.group || "Unassigned user group").trim();
}

function participantCreatedTime(participant = {}) {
	const time = Date.parse(participant.createdAt || participant.created_at || "");
	return Number.isFinite(time) ? time : 0;
}

function participantSearchText(participant = {}) {
	return [
		participantLabel(participant),
		participant.first_name,
		participant.family_name,
		participant.full_name,
		participant.email,
		participant.phone,
		participant.status,
		participant.studyTitle,
		participantUserGroup(participant),
	]
		.join(" ")
		.toLowerCase();
}

function filteredParticipants() {
	const query = participantListState.query.trim().toLowerCase();
	const filtered = query ? participantListState.participants.filter((participant) => participantSearchText(participant).includes(query)) : [...participantListState.participants];
	return filtered.sort((a, b) => {
		if (participantListState.sort === "za") return participantLabel(b).localeCompare(participantLabel(a), undefined, { numeric: true });
		if (participantListState.sort === "first-last") return participantCreatedTime(a) - participantCreatedTime(b);
		if (participantListState.sort === "last-first") return participantCreatedTime(b) - participantCreatedTime(a);
		if (participantListState.sort === "user-group") {
			const groupSort = participantUserGroup(a).localeCompare(participantUserGroup(b), undefined, { numeric: true });
			return groupSort || participantLabel(a).localeCompare(participantLabel(b), undefined, { numeric: true });
		}
		return participantLabel(a).localeCompare(participantLabel(b), undefined, { numeric: true });
	});
}

function participantControlsHtml(total) {
	if (total <= PARTICIPANT_PAGE_SIZE) return "";
	return `
<div class="rops-participant-list-controls" aria-label="Participant list controls">
	<div class="govuk-form-group rops-participant-search">
		<label class="govuk-label govuk-label--s" for="participant-list-search">Search participants</label>
		<input class="govuk-input govuk-input--width-20" id="participant-list-search" type="search" value="${escapeParticipantHtml(participantListState.query)}" autocomplete="off">
	</div>
	<div class="govuk-form-group rops-participant-sort">
		<label class="govuk-label govuk-label--s" for="participant-list-sort">Sort participants</label>
		<select class="govuk-select" id="participant-list-sort">
			<option value="az" ${participantListState.sort === "az" ? "selected" : ""}>A-Z</option>
			<option value="za" ${participantListState.sort === "za" ? "selected" : ""}>Z-A</option>
			<option value="first-last" ${participantListState.sort === "first-last" ? "selected" : ""}>First to last</option>
			<option value="last-first" ${participantListState.sort === "last-first" ? "selected" : ""}>Last to first</option>
			<option value="user-group" ${participantListState.sort === "user-group" ? "selected" : ""}>User group</option>
		</select>
	</div>
</div>`;
}

function participantSensitiveDetailsHtml(participant = {}) {
	if (!participant.revealed) return "";
	return `
<dl class="govuk-summary-list govuk-summary-list--no-border rops-participant-sensitive-details">
	<div class="govuk-summary-list__row">
		<dt class="govuk-summary-list__key">First name</dt>
		<dd class="govuk-summary-list__value">${escapeParticipantHtml(participant.first_name || "Not recorded")}</dd>
	</div>
	<div class="govuk-summary-list__row">
		<dt class="govuk-summary-list__key">Family name</dt>
		<dd class="govuk-summary-list__value">${escapeParticipantHtml(participant.family_name || "Not recorded")}</dd>
	</div>
	<div class="govuk-summary-list__row">
		<dt class="govuk-summary-list__key">Email</dt>
		<dd class="govuk-summary-list__value">${escapeParticipantHtml(participant.email || "Not recorded")}</dd>
	</div>
	<div class="govuk-summary-list__row">
		<dt class="govuk-summary-list__key">Phone</dt>
		<dd class="govuk-summary-list__value">${escapeParticipantHtml(participant.phone || "Not recorded")}</dd>
	</div>
</dl>`;
}

function participantRevealHtml(participant = {}) {
	if (participant.revealed) return '<strong class="govuk-tag govuk-tag--green">Details revealed</strong>';
	if (!participant.can_reveal_contact) return '<span class="govuk-hint">Contact details restricted</span>';
	return `<button type="button" class="govuk-button govuk-button--secondary govuk-!-margin-bottom-0" data-participant-reveal="${escapeParticipantHtml(participant.id)}">Reveal details</button>`;
}

function participantListItemHtml(participant = {}) {
	const reference = participantLabel(participant);
	const studyTitle = String(participant.studyTitle || "Study not recorded").trim();
	const userGroup = participantUserGroup(participant);
	const status = participant.status ? `<span class="govuk-hint">Status: ${escapeParticipantHtml(participant.status)}</span>` : "";
	return `
<li class="rops-participant-list__item" data-participant-id="${escapeParticipantHtml(participant.id)}">
	<strong>${escapeParticipantHtml(reference)}</strong>
	${status}
	<span class="govuk-hint rops-study-title-truncated" title="${escapeParticipantHtml(studyTitle)}" data-study-title="${escapeParticipantHtml(studyTitle)}" data-study-prefix="${STUDY_TITLE_PREFIX}">${STUDY_TITLE_PREFIX}${escapeParticipantHtml(studyTitle)}</span>
	<span class="govuk-hint">User group: ${escapeParticipantHtml(userGroup)}</span>
	<div class="rops-participant-reveal">${participantRevealHtml(participant)}</div>
	${participantSensitiveDetailsHtml(participant)}
</li>`;
}

function paginationHtml(filteredTotal, pageCount, start, end) {
	if (participantListState.participants.length <= PARTICIPANT_PAGE_SIZE) return "";
	return `
<nav class="rops-participant-pagination" aria-label="Participant pagination">
	<p class="govuk-body-s">Showing ${start + 1} to ${end} of ${filteredTotal} participants.</p>
	<div class="govuk-button-group">
		<button type="button" class="govuk-button govuk-button--secondary" data-participants-page="previous" ${participantListState.page <= 1 ? "disabled" : ""}>Previous</button>
		<span class="govuk-body-s rops-participant-page-status">Page ${participantListState.page} of ${pageCount}</span>
		<button type="button" class="govuk-button govuk-button--secondary" data-participants-page="next" ${participantListState.page >= pageCount ? "disabled" : ""}>Next</button>
	</div>
</nav>`;
}

function applyStudyTitleFit(element) {
	const title = String(element.dataset.studyTitle || "").replace(/\s+/g, " ").trim();
	const prefix = element.dataset.studyPrefix || STUDY_TITLE_PREFIX;
	if (!title) return;
	element.textContent = `${prefix}${title}`;
	if (element.scrollWidth <= element.clientWidth) return;
	const words = title.split(" ").filter(Boolean);
	let low = 0;
	let high = words.length;
	let fitted = "";
	while (low <= high) {
		const middle = Math.floor((low + high) / 2);
		const candidate = words.slice(0, middle).join(" ").trim();
		element.textContent = `${prefix}${candidate}…`;
		if (element.scrollWidth <= element.clientWidth) {
			fitted = candidate;
			low = middle + 1;
		} else {
			high = middle - 1;
		}
	}
	element.textContent = fitted ? `${prefix}${fitted}…` : `${prefix}…`;
}

function applySingleLineStudyTitleTruncation() {
	document.querySelectorAll(".rops-study-title-truncated[data-study-title]").forEach((element) => applyStudyTitleFit(element));
}

function renderEnhancedParticipants() {
	const panel = participantPanel();
	if (!panel || participantListState.isRendering) return;
	participantListState.isRendering = true;
	const projectId = encodeURIComponent(participantListState.projectId);
	const allTotal = participantListState.participants.length;
	const summary = allTotal === 1 ? "1 participant" : `${allTotal} participants`;
	const filtered = filteredParticipants();
	const pageCount = Math.max(1, Math.ceil(filtered.length / PARTICIPANT_PAGE_SIZE));
	participantListState.page = Math.min(Math.max(1, participantListState.page), pageCount);
	const start = (participantListState.page - 1) * PARTICIPANT_PAGE_SIZE;
	const pageParticipants = filtered.slice(start, start + PARTICIPANT_PAGE_SIZE);
	const end = Math.min(start + PARTICIPANT_PAGE_SIZE, filtered.length);

	panel.dataset.enhancedParticipants = "true";
	panel.innerHTML = `
<h3 class="govuk-heading-s">Participants</h3>
<p class="govuk-body-s" id="participants-summary-status">${escapeParticipantHtml(summary)} linked to this project.</p>
${participantControlsHtml(allTotal)}
${pageParticipants.length ? `<ul class="govuk-list govuk-list--spaced rops-divided-list rops-participant-list" id="participants-list">${pageParticipants.map(participantListItemHtml).join("")}</ul>` : '<p class="govuk-body-s">No participants match your search.</p>'}
${paginationHtml(filtered.length, pageCount, start, end)}
<p class="govuk-body-s">Participants are managed through study-specific workflows so consent, scheduling and safeguarding states stay traceable.</p>
<div class="govuk-button-group">
	<a href="/pages/project-dashboard/participants/?pid=${projectId}" role="button" draggable="false" class="govuk-button govuk-button--secondary" data-module="govuk-button" id="add-participant-link">Add participant</a>
	<a href="/pages/project-dashboard/participants/import/?pid=${projectId}" role="button" draggable="false" class="govuk-button govuk-button--secondary" data-module="govuk-button" id="import-participants-link">Bulk upload participants via CSV</a>
</div>`;
	wireParticipantControls();
	window.requestAnimationFrame(applySingleLineStudyTitleTruncation);
	participantListState.isRendering = false;
}

function wireParticipantControls() {
	document.getElementById("participant-list-search")?.addEventListener("input", (event) => {
		participantListState.query = event.target.value || "";
		participantListState.page = 1;
		renderEnhancedParticipants();
		document.getElementById("participant-list-search")?.focus();
	});
	document.getElementById("participant-list-sort")?.addEventListener("change", (event) => {
		participantListState.sort = event.target.value || "az";
		participantListState.page = 1;
		renderEnhancedParticipants();
	});
	document.querySelectorAll("[data-participants-page]").forEach((button) => {
		button.addEventListener("click", () => {
			participantListState.page += button.dataset.participantsPage === "next" ? 1 : -1;
			renderEnhancedParticipants();
		});
	});
	document.querySelectorAll("[data-participant-reveal]").forEach((button) => {
		button.addEventListener("click", () => revealParticipant(button.dataset.participantReveal));
	});
}

function participantRevealButton(participantId) {
	return Array.from(document.querySelectorAll("[data-participant-reveal]")).find((button) => button.dataset.participantReveal === participantId) || null;
}

async function revealParticipant(participantId) {
	const button = participantRevealButton(participantId);
	if (button) button.textContent = "Revealing details";
	try {
		const json = await participantJson(`/api/participants/contact?participant=${encodeURIComponent(participantId)}&ts=${Date.now()}`);
		participantListState.participants = participantListState.participants.map((participant) =>
			participant.id === participantId ? { ...participant, ...json.participant, revealed: true } : participant,
		);
		renderEnhancedParticipants();
	} catch (error) {
		if (button) button.textContent = "Could not reveal details";
		console.error("[project-dashboard-participants-list] reveal failed", error);
	}
}

async function loadProjectStudies(projectId) {
	const json = await participantJson(`/api/studies?project=${encodeURIComponent(projectId)}&ts=${Date.now()}`);
	return Array.isArray(json.studies) ? json.studies : [];
}

async function loadStudyParticipants(study = {}) {
	if (!study.id) return [];
	const json = await participantJson(`/api/participants?study=${encodeURIComponent(study.id)}&ts=${Date.now()}`);
	const participants = Array.isArray(json.participants) ? json.participants : [];
	const studyTitle = studyTitleFor(study);
	return participants.map((participant) => ({
		...participant,
		studyId: study.id,
		studyTitle,
	}));
}

async function refreshParticipants() {
	const projectId = participantProjectIdFromUrl();
	if (!projectId) return;
	participantListState.projectId = projectId;
	try {
		const studies = await loadProjectStudies(projectId);
		const results = await Promise.all(studies.map((study) => loadStudyParticipants(study)));
		participantListState.participants = results.flat();
		participantListState.page = 1;
		renderEnhancedParticipants();
	} catch (error) {
		console.error("[project-dashboard-participants-list] load failed", error);
	}
}

function observeParticipantPanel() {
	const panel = participantPanel();
	if (!panel || typeof MutationObserver === "undefined") return;
	const observer = new MutationObserver(() => {
		if (participantListState.isRendering) return;
		if (!participantListState.participants.length || panel.dataset.enhancedParticipants === "true") return;
		window.setTimeout(renderEnhancedParticipants, 0);
	});
	observer.observe(panel, { childList: true, subtree: true });
}

function initEnhancedParticipantList() {
	observeParticipantPanel();
	refreshParticipants();
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initEnhancedParticipantList, { once: true });
} else {
	initEnhancedParticipantList();
}
