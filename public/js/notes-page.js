/**
 * @file public/js/notes-page.js
 * @module NotesPage
 * @summary Local ResearchOps notes UI for legacy SDK records.
 */

const sessionSelect = document.getElementById("session");
const noteText = document.getElementById("text");
const tagsInput = document.getElementById("tags");
const saveButton = document.getElementById("save");
const statusMessage = document.getElementById("status");
const notesContainer = document.getElementById("notes");

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

function addTag(targetId, label) {
	const ctx = getCtx();
	const tag = envelope("Tag", {
		name: label,
		inScheme: `${ctx.org}::${ctx.project}::taxonomy`,
		hasTarget: targetId
	});

	return saveEntity("tag", tag);
}

function addNote(sessionId, { text, tags = [] }) {
	const note = envelope("Note", {
		hasTarget: sessionId,
		hasBody: text
	});

	saveEntity("note", note);

	for (const tag of tags) {
		addTag(note.id, tag);
	}

	return note;
}

async function populateSessions() {
	if (!sessionSelect) return null;

	const sessions = searchEntities({ type: "ResearchSession" })
		.sort((a, b) => String(b.created || "").localeCompare(String(a.created || "")));

	sessionSelect.innerHTML = "";

	for (const session of sessions) {
		const option = document.createElement("option");
		option.value = session.id;
		option.textContent = `${session.name || "(Untitled)"} — ${formatDate(session["schema:startDate"] || session.created)}`;
		sessionSelect.appendChild(option);
	}

	return sessionSelect.value || null;
}

async function loadNotes(sessionId) {
	if (!notesContainer) return;

	const allNotes = searchEntities({ type: "Note" });
	const allTags = searchEntities({ type: "Tag" });
	const filtered = allNotes.filter(note => note.hasTarget === sessionId);

	notesContainer.innerHTML = filtered.map(note => {
		const tags = allTags.filter(tag => tag.hasTarget === note.id);
		const tagsHtml = tags.map(tag => `<span class="tag">${escapeHtml(tag.name)}</span>`).join("");

		return `<div class="item">
	<strong>${escapeHtml(formatDate(note.created))}</strong>
	<div class="govuk-body">${escapeHtml(note.hasBody)}</div>
	<div>${tagsHtml || '<span class="govuk-hint">No tags</span>'}</div>
</div>`;
	}).join("") || '<div class="govuk-hint">No notes yet.</div>';
}

async function saveNote() {
	const sessionId = sessionSelect?.value || "";
	if (!sessionId) {
		alert("Create/select a session first.");
		return;
	}

	const text = noteText?.value.trim() || "";
	if (!text) {
		alert("Enter a note.");
		return;
	}

	const tags = (tagsInput?.value || "")
		.split(",")
		.map(tag => tag.trim())
		.filter(Boolean);

	const note = addNote(sessionId, { text, tags });
	if (statusMessage) statusMessage.textContent = `Saved note ${note.id}`;

	await loadNotes(sessionId);
	if (noteText) noteText.value = "";
	if (tagsInput) tagsInput.value = "";
}

sessionSelect?.addEventListener("change", async event => {
	await loadNotes(event.target.value);
});

saveButton?.addEventListener("click", saveNote);

const firstSessionId = await populateSessions();
if (firstSessionId) await loadNotes(firstSessionId);

window.__ropsNotes = Object.freeze({
	addNote,
	addTag,
	readStoredEntities,
	searchEntities
});
