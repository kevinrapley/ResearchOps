/**
 * @file public/js/consent-page.js
 * @module ConsentPage
 * @summary Local ResearchOps consent UI for legacy SDK records.
 */

const sessionSelect = document.getElementById("session");
const basisSelect = document.getElementById("basis");
const retentionInput = document.getElementById("ret");
const notesInput = document.getElementById("notes");
const linkButton = document.getElementById("link");
const statusMessage = document.getElementById("status");
const consentsContainer = document.getElementById("consents");

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

function linkConsent(sessionId, { lawfulBasis, retentionISO8601, notes } = {}) {
	const consent = envelope("Consent", {
		LawfulBasis: lawfulBasis || "dpv:Consent",
		RetentionSchedule: retentionISO8601 || "P12M",
		description: notes || "",
		hasTarget: sessionId
	});

	return saveEntity("consent", consent);
}

async function populateSessions() {
	if (!sessionSelect) return;

	const sessions = searchEntities({ type: "ResearchSession" })
		.sort((a, b) => String(b.created || "").localeCompare(String(a.created || "")));

	sessionSelect.innerHTML = "";

	for (const session of sessions) {
		const option = document.createElement("option");
		option.value = session.id;
		option.textContent = `${session.name || "(Untitled)"} — ${formatDate(session["schema:startDate"] || session.created)}`;
		sessionSelect.appendChild(option);
	}
}

async function loadConsents() {
	if (!consentsContainer) return;

	const consents = searchEntities({ type: "Consent" });

	consentsContainer.innerHTML = consents.map(consent => `
<div style="border-top:1px solid #b1b4b6; padding:8px 0">
	<strong>${escapeHtml(consent.id)}</strong>
	<div class="govuk-hint">Session: ${escapeHtml(consent.hasTarget)}</div>
	<div class="govuk-hint">Basis: ${escapeHtml(consent.LawfulBasis)} • Retention: ${escapeHtml(consent.RetentionSchedule)}</div>
	<div class="govuk-hint">${escapeHtml(consent.description || "")}</div>
</div>`).join("") || '<div class="govuk-hint">No consent records yet.</div>';
}

async function saveConsent() {
	const sessionId = sessionSelect?.value || "";
	if (!sessionId) {
		alert("Create a session first.");
		return;
	}

	const consent = linkConsent(sessionId, {
		lawfulBasis: basisSelect?.value || "dpv:Consent",
		retentionISO8601: retentionInput?.value || "P12M",
		notes: notesInput?.value || ""
	});

	if (statusMessage) statusMessage.textContent = `Linked consent ${consent.id}`;
	await loadConsents();
}

linkButton?.addEventListener("click", saveConsent);

await populateSessions();
await loadConsents();

window.__ropsConsent = Object.freeze({
	linkConsent,
	readStoredEntities,
	searchEntities
});
