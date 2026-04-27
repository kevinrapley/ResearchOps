/**
 * @file /components/participants/participants-page.js
 * @summary Renders the participants list and emits Safari-safe events.
 */

const $ = (s, r = document) => r.querySelector(s);

/** Read pid/sid from querystring. */
function readIds() {
	const usp = new URLSearchParams(location.search);
	return {
		pid: usp.get("pid") || "",
		sid: usp.get("sid") || ""
	};
}

/** Fetch participants for a study. */
async function fetchParticipants(studyId) {
	const url = `/api/participants?study=${encodeURIComponent(studyId)}`;
	console.info("[participants] GET", url);
	const res = await fetch(url, { cache: "no-store" });
	const js = await res.json().catch(() => ({}));
	if (!res.ok || js?.ok !== true || !Array.isArray(js.participants)) {
		throw new Error(js?.error || `Participants fetch failed (${res.status})`);
	}
	console.info("[participants] loaded", js.participants.length);
	return js.participants;
}

/** Escape HTML text content. */
function escapeHtml(s) {
	const d = document.createElement("div");
	d.textContent = String(s ?? "");
	return d.innerHTML;
}

/** Create one row element for the participants table. */
function makeRow(p) {
	const row = document.createElement("tr");
	row.className = "govuk-table__row";
	row.dataset.participantRow = "true";

	const name = `${p.display_name || p.name || "—"}`;
	const contactBits = [];
	if (p.email) contactBits.push(p.email);
	if (p.phone) contactBits.push(p.phone);
	const contact = contactBits.join(" · ") || "—";
	const status = p.status || "new";

	row.innerHTML = `
		<td class="govuk-table__cell">${escapeHtml(name)}</td>
		<td class="govuk-table__cell">${escapeHtml(contact)}</td>
		<td class="govuk-table__cell">${escapeHtml(status)}</td>
		<td class="govuk-table__cell">
			<button class="govuk-button govuk-button--secondary" data-action="schedule" data-id="${escapeHtml(p.id)}">Schedule</button>
		</td>
	`;
	return row;
}

/**
 * Render the whole participants table body.
 * Exposed on window for other modules to reuse.
 * @param {Array<Object>} participants
 */
export function renderParticipantsTable(participants) {
	const table = $("#participantsTable");
	const wrap = $("#participantsTableWrap");
	const tbody = $("#participants-tbody");
	if (!table || !tbody) return;

	tbody.innerHTML = "";

	if (!participants.length) {
		const row = document.createElement("tr");
		row.className = "govuk-table__row";
		row.innerHTML = `<td colspan="4" class="govuk-table__cell muted">No participants yet.</td>`;
		tbody.appendChild(row);
	} else {
		const frag = document.createDocumentFragment();
		participants.forEach(p => frag.appendChild(makeRow(p)));
		tbody.appendChild(frag);
	}

	const has = participants.length > 0;
	const empty = $("#participantsEmpty");
	if (empty) empty.hidden = has;
	if (wrap) wrap.hidden = !has;
	table.hidden = !has;

	const detail = { detail: { count: participants.length } };
	window.dispatchEvent(new CustomEvent("participants-rendered", detail));
	window.dispatchEvent(new CustomEvent("participants_rendered", detail));
	try { window.dispatchEvent(new CustomEvent("participants:rendered", detail)); } catch {}

	return participants.length;
}

window.renderParticipantsTable = renderParticipantsTable;

/** Boot: load & render once on page load. */
(async function boot() {
	try {
		const { sid } = readIds();
		if (!sid) throw new Error("Missing sid");
		const participants = await fetchParticipants(sid);
		renderParticipantsTable(participants);
	} catch (err) {
		console.error("[participants] init error:", err);
		try {
			window.dispatchEvent(new CustomEvent("participants-rendered", { detail: { count: 0 } }));
			window.dispatchEvent(new CustomEvent("participants_rendered", { detail: { count: 0 } }));
		} catch {}
	}
})();
