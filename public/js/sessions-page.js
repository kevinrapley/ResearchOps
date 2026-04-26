/**
 * @file public/js/sessions-page.js
 * @module SessionsPage
 * @summary Local ResearchOps sessions UI for legacy SDK records.
 */

const titleInput = document.getElementById("title");
const whenInput = document.getElementById("when");
const participantsInput = document.getElementById("participants");
const createButton = document.getElementById("create");
const statusMessage = document.getElementById("status");
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

function renderSession(session) {
	const element = document.createElement("div");
	element.className = "item govuk-body";
	element.innerHTML = `<strong>${escapeHtml(session.name || "(Untitled)")}</strong>
<div class="govuk-hint">${escapeHtml(formatDate(session["schema:startDate"] || session.created))} — ${escapeHtml(session.id)}</div>
<div class="govuk-hint">Participants: ${escapeHtml((session.participants || []).join(", ") || "—")}</div>`;
	return element;
}

async function loadSessions() {
	if (!sessionsContainer) return;

	const sessions = searchEntities({ type: "ResearchSession" })
		.sort((first, second) => String(second.created || "").localeCompare(String(first.created || "")));

	sessionsContainer.innerHTML = "";

	if (!sessions.length) {
		sessionsContainer.innerHTML = '<div class="govuk-hint">No sessions yet.</div>';
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
		when: whenInput?.value || new Date().toISOString(),
		participants
	});

	if (statusMessage) statusMessage.textContent = `Created ${session.id}`;
	await loadSessions();
}

createButton?.addEventListener("click", handleCreateSession);

await loadSessions();

window.__ropsSessions = Object.freeze({
	createSession,
	readStoredEntities,
	searchEntities
});
