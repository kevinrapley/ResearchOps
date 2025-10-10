/**
 * @file /components/participants/participants-page.js
 * @summary Fetch + render participants table and wire the schedule select.
 * - Exposes window.renderParticipantsTable(rows)
 * - Dispatches both "participants-rendered" and "participants_rendered"
 *   CustomEvents (Safari-safe, no colons)
 */

const $ = (s, r = document) => r.querySelector(s);

/** Read pid/sid from URL. Throws if absent. */
function getIds() {
	const usp = new URLSearchParams(location.search);
	const pid = usp.get("pid") || "";
	const sid = usp.get("sid") || "";
	if (!pid || !sid) throw new Error("Missing pid or sid in URL");
	return { pid, sid };
}

/** Fetch participants for the study id. */
async function fetchParticipants(studyId) {
	const url = `/api/participants?study=${encodeURIComponent(studyId)}`;
	console.log("[participants] GET", url);
	const res = await fetch(url, { cache: "no-store" });
	const js = await res.json().catch(() => ({}));
	if (!res.ok || js?.ok !== true || !Array.isArray(js.participants)) {
		throw new Error(js?.error || `participants fetch failed (${res.status})`);
	}
	return js.participants;
}

/** Render rows into the table body. */
function drawRows(rows) {
	const tbody = $("#participants-tbody");
	if (!tbody) return;

	if (!rows.length) {
		tbody.innerHTML = `<tr><td colspan="5" class="muted">No participants yet.</td></tr>`;
		return;
	}

	const html = rows.map(p => {
		const name = p.display_name || p.name || "—";
		const email = p.email || "—";
		const phone = p.phone || "—";
		const channel = p.channel_pref || p.channel || "—";
		const status = p.status || "invited";
		return `
      <tr>
        <td>${escapeHtml(name)}</td>
        <td>${email ? `<a href="mailto:${escapeAttr(email)}">${escapeHtml(email)}</a>` : "—"}</td>
        <td>${escapeHtml(phone)}</td>
        <td>${escapeHtml(channel)}</td>
        <td>${escapeHtml(status)}</td>
      </tr>
    `;
	}).join("");

	tbody.innerHTML = html;
}

/** Populate the schedule participant select. */
function populateScheduleSelect(rows) {
	const sel = $("#s_participant");
	if (!sel) return;
	sel.innerHTML = rows.map(p => {
		const id = p.id || "";
		const label = p.display_name || p.name || p.email || "Participant";
		return `<option value="${escapeAttr(id)}">${escapeHtml(label)}</option>`;
	}).join("");
}

/** Safe HTML/text helpers */
function escapeHtml(str) {
	const d = document.createElement("div");
	d.textContent = String(str ?? "");
	return d.innerHTML;
}

function escapeAttr(str) {
	// very light attr escape; using textContent via a <span> and reading innerHTML also works
	return String(str ?? "").replace(/"/g, "&quot;");
}

/** Fire both Safari-safe custom events. */
function announceRendered(count) {
	try { window.dispatchEvent(new CustomEvent("participants-rendered", { detail: { count } })); } catch {}
	try { window.dispatchEvent(new CustomEvent("participants_rendered", { detail: { count } })); } catch {}
}

/** Public API: make available globally for any legacy callers. */
function renderParticipantsTable(rows) {
	drawRows(rows);
	populateScheduleSelect(rows);
	// Show/hide containers is handled by the page glue listener
	announceRendered(rows.length || 0);
}
window.renderParticipantsTable = renderParticipantsTable;

/* ── Bootstrap ────────────────────────────────────────────────────────── */
(async function init() {
	try {
		const { sid } = getIds();
		const rows = await fetchParticipants(sid);
		console.log("[participants] loaded", rows.length);
		renderParticipantsTable(rows);
	} catch (err) {
		console.error("[participants] init error:", err);
		// Keep something visible for the user:
		const tbody = $("#participants-tbody");
		if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="muted">Failed to load participants.</td></tr>`;
		announceRendered(0);
	}
})();
