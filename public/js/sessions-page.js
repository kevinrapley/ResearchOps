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
		user: localStorage.getItem("rops.user") || "you@example.test"
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

function parseWholeNumber(value) {
	const text = String(value ?? "").trim();
	if (!/^\d+$/.test(text)) return null;
	return Number.parseInt(text, 10);
}

function readSessionDateTimeParts() {
	return {
		dayText: sessionDateDayInput?.value || "",
		monthText: sessionDateMonthInput?.value || "",
		yearText: sessionDateYearInput?.value || "",
		hourText: sessionTimeHourInput?.value || "",
		minuteText: sessionTimeMinuteInput?.value || ""
	};
}

function validateSessionDateTime() {
	const { dayText, monthText, yearText, hourText, minuteText } = readSessionDateTimeParts();
	const hasDatePart = Boolean(dayText.trim() || monthText.trim() || yearText.trim());
	const hasTimePart = Boolean(hourText.trim() || minuteText.trim());

	if (!hasDatePart && !hasTimePart) {
		return { valid: true, iso: new Date().toISOString() };
	}

	if (!hasDatePart && hasTimePart) {
		return { valid: false, error: "Enter a date when adding a time." };
	}

	const day = parseWholeNumber(dayText);
	const month = parseWholeNumber(monthText);
	const year = parseWholeNumber(yearText);

	if (!day || !month || !year) {
		return { valid: false, error: "Enter a complete date." };
	}

	const hour = hourText.trim() ? parseWholeNumber(hourText) : 0;
	const minute = minuteText.trim() ? parseWholeNumber(minuteText) : 0;

	if (hour === null || hour < 0 || hour > 23) {
		return { valid: false, error: "Enter an hour between 0 and 23." };
	}

	if (minute === null || minute < 0 || minute > 59) {
		return { valid: false, error: "Enter minutes between 0 and 59." };
	}

	const date = new Date(year, month - 1, day, hour, minute);
	if (
		date.getFullYear() !== year ||
		date.getMonth() !== month - 1 ||
		date.getDate() !== day ||
		date.getHours() !== hour ||
		date.getMinutes() !== minute
	) {
		return { valid: false, error: "Enter a real date and time." };
	}

	return { valid: true, iso: date.toISOString() };
}

function composeSessionStartIso() {
	const result = validateSessionDateTime();
	return result.valid ? result.iso : null;
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
	const sessionStart = validateSessionDateTime();
	if (!sessionStart.valid) {
		if (statusMessage) statusMessage.textContent = sessionStart.error;
		return;
	}

	const participants = (participantsInput?.value || "")
		.split(",")
		.map(participant => participant.trim())
		.filter(Boolean);

	const session = createSession({
		title: titleInput?.value || "Untitled session",
		when: sessionStart.iso,
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
	validateSessionDateTime,
	readStoredEntities,
	searchEntities
});
