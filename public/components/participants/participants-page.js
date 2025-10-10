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

/** Create one row element for the participants table. */
function makeRow(p) {
	const row = document.createElement("div");
	row.className = "row";
	row.setAttribute("role", "row");

	const name = `${p.display_name || p.name || "—"}`;
	const contactBits = []
	if (p.email) contactBits.push(p.email);
	if (p.phone) contactBits.push(p.phone);
	const contact = contactBits.join(" · ") || "—";
	const status = p.status || "new";

	row.innerHTML = `
    <div role="cell">${escapeHtml(name)}</div>
    <div role="cell">${escapeHtml(contact)}</div>
    <div role="cell">${escapeHtml(status)}</div>
    <div role="cell">
      <button class="btn btn--secondary" data-action="schedule" data-id="${p.id}">Schedule</button>
    </div>
  `;
	return row;
}

/** Escape HTML text content. */
function escapeHtml(s) {
	const d = document.createElement("div");
	d.textContent = String(s ?? "");
	return d.innerHTML;
}

/**
 * Render the whole participants table (replaces body rows).
 * Exposed on window for other modules to reuse.
 * @param {Array<Object>} participants
 */
export function renderParticipantsTable(participants) {
	const $table = $("#participantsTable");
	if (!$table) return;

	// Remove any previous data rows (keep the header .table__header)
	const prev = Array.from($table.querySelectorAll(".row")).filter(el => !el.classList.contains("table__header"));
	prev.forEach(el => el.remove());

	// Append new rows
	const frag = document.createDocumentFragment();
	participants.forEach(p => frag.appendChild(makeRow(p)));
	$table.appendChild(frag);

	// Toggle visibility vs empty panel
	const has = participants.length > 0;
	const $empty = $("#participantsEmpty");
	if ($empty) $empty.hidden = has;
	$table.hidden = !has;

	// Emit Safari-safe rendered events
	const detail = { detail: { count: participants.length } };
	window.dispatchEvent(new CustomEvent("participants-rendered", detail));
	window.dispatchEvent(new CustomEvent("participants_rendered", detail));
	// Legacy (may throw on some Safari versions if used elsewhere, but here it’s fine to keep
	// for back-compat; remove if you want to be strict)
	try { window.dispatchEvent(new CustomEvent("participants:rendered", detail)); } catch {}

	return participants.length;
}

// Also attach on window for non-module callers
// (e.g., scheduler or inline scripts)
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
		// Still emit an event so glue can toggle UI to "empty"
		try {
			window.dispatchEvent(new CustomEvent("participants-rendered", { detail: { count: 0 } }));
			window.dispatchEvent(new CustomEvent("participants_rendered", { detail: { count: 0 } }));
		} catch {}
	}
})();
