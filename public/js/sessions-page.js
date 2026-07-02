/**
 * @file public/js/sessions-page.js
 * @module SessionsPage
 * @summary Local ResearchOps sessions UI for legacy SDK records.
 */

const titleInput = document.getElementById("title");
const sessionDateDayInput = document.getElementById("session-date-day");
const sessionDateMonthInput = document.getElementById("session-date-month");
const sessionDateYearInput = document.getElementById("session-date-year");
const sessionTimeHourInput = document.getElementById("session-time-hour");
const sessionTimeMinuteInput = document.getElementById("session-time-minute");
const participantsInput = document.getElementById("participants");
const createButton = document.getElementById("create");
const statusMessage = document.getElementById("status");
const sessionsSection = document.getElementById("sessions-list-section");
const sessionsContainer = document.getElementById("sessions");

function escapeHtml(value) {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function formatDate(iso) {
	try {
		return new Date(iso).toLocaleString();
	} catch {
		return iso || "";
	}
}

function uid(prefix) {
	return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

function getCtx() {
	return {
		org: localStorage.getItem("rops.org") || "home-office-biometrics",
		project: localStorage.getItem("rops.project") || "demo",
		study: localStorage.getItem("rops.study") || "demo",
		user: localStorage.getItem("rops.user") || "you@homeoffice.gov.uk"
	};
}

function readStoredEntities() {
	const entities = [];

	for (let index = 0; index < localStorage.length; index += 1) {
		const key = localStorage.key(index);
		if (!key) continue;

		try {
			const value = JSON.parse(localStorage.getItem(key) || "null");
			if (value && typeof value === "object" && value.entityType) {
				entities.push(value);
			}
		} catch {
			// Ignore non-JSON localStorage entries.
		}
	}

	return entities;
}

function searchEntities({ type = "" } = {}) {
	const entities = readStoredEntities();
	return type ? entities.filter(entity => entity.entityType === type) : entities;
}

function envelope(entityType, body) {
	const ctx = getCtx();

	return {
		id: body.id || uid(entityType.toLowerCase()),
		type: entityType,
		entityType,
		created: new Date().toISOString(),
		creator: ctx.user,
		scope: {
			org: ctx.org,
			project: ctx.project,
			study: ctx.study
		},
		...body
	};
}

function saveEntity(collection, entity) {
	localStorage.setItem(`${collection}:${entity.id}`, JSON.stringify(entity));
	return entity;
}

function createSession({ title, when, participants = [], id } = {}) {
	const session = envelope("ResearchSession", {
		id,
		name: title || "Untitled session",
		"schema:startDate": when || new Date().toISOString(),
		participants
	});

	return saveEntity("session", session);
}

function composeSessionStartIso() {
	const day = Number.parseInt(sessionDateDayInput?.value || "", 10);
	const month = Number.parseInt(sessionDateMonthInput?.value || "", 10);
	const year = Number.parseInt(sessionDateYearInput?.value || "", 10);
	const hour = Number.parseInt(sessionTimeHourInput?.value || "0", 10);
	const minute = Number.parseInt(sessionTimeMinuteInput?.value || "0", 10);

	if (!day || !month || !year) return new Date().toISOString();

	return new Date(year, month - 1, day, hour || 0, minute || 0).toISOString();
}

function renderSession(session) {
	const element = document.createElement("div");
	element.className = "govuk-summary-card researchops-utility-card";
	element.innerHTML = `<div class="govuk-summary-card__title-wrapper">
	<h3 class="govuk-summary-card__title">${escapeHtml(session.name || "(Untitled)")}</h3>
</div>
<div class="govuk-summary-card__content">
	<dl class="govuk-summary-list govuk-summary-list--no-border">
		<div class="govuk-summary-list__row">
			<dt class="govuk-summary-list__key">When</dt>
			<dd class="govuk-summary-list__value">${escapeHtml(formatDate(session["schema:startDate"] || session.created))}</dd>
		</div>
		<div class="govuk-summary-list__row">
			<dt class="govuk-summary-list__key">Session ID</dt>
			<dd class="govuk-summary-list__value">${escapeHtml(session.id)}</dd>
		</div>
		<div class="govuk-summary-list__row">
			<dt class="govuk-summary-list__key">Participants</dt>
			<dd class="govuk-summary-list__value">${escapeHtml((session.participants || []).join(", ") || "—")}</dd>
		</div>
	</dl>
</div>`;
	return element;
}

async function loadSessions() {
	if (!sessionsContainer) return;

	const sessions = searchEntities({ type: "ResearchSession" })
		.sort((first, second) => String(second.created || "").localeCompare(String(first.created || "")));

	sessionsContainer.innerHTML = "";

	if (sessionsSection) sessionsSection.hidden = sessions.length === 0;
	if (!sessions.length) {
		return;
	}

	for (const session of sessions) {
		sessionsContainer.appendChild(renderSession(session));
	}
}

async function handleCreateSession() {
	const participants = (participantsInput?.value || "")
		.split(",")
		.map(participant => participant.trim())
		.filter(Boolean);

	const session = createSession({
		title: titleInput?.value || "Untitled session",
		when: composeSessionStartIso(),
		participants
	});

	if (statusMessage) statusMessage.textContent = `Created ${session.id}`;
	await loadSessions();
}

createButton?.addEventListener("click", handleCreateSession);

await loadSessions();

window.__ropsSessions = Object.freeze({
	createSession,
	composeSessionStartIso,
	readStoredEntities,
	searchEntities
});
