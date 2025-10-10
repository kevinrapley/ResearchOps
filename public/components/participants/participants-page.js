/**
 * @file participants-page.js
 * @summary Study Participants list: fetch + render + basic UI wiring.
 * @description
 * - Reads pid & sid from the URL
 * - Fetches /api/participants?study=:sid
 * - Renders accessible table with empty/error states
 * - No Time Zone column (removed by request)
 */

const $ = (s, r = document) => r.querySelector(s);

/* ───────────────────────── Data access ───────────────────────── */

/**
 * Fetch participants for a given Study Airtable ID.
 * @param {string} sid
 * @returns {Promise<Array<object>>}
 */
async function fetchParticipants(sid) {
	const url = `/api/participants?study=${encodeURIComponent(sid)}`;
	console.info("[participants] GET", url);

	const res = await fetch(url, { cache: "no-store" });

	let js = null;
	try { js = await res.json(); } catch {}

	if (!res.ok || js?.ok !== true) {
		const detail = js?.detail || js?.error || `HTTP ${res.status}`;
		throw new Error(`Participants fetch failed: ${detail}`);
	}

	return Array.isArray(js.participants) ? js.participants : [];
}

/* ───────────────────────── Rendering ───────────────────────── */

/**
 * Render participants into the table body.
 * Expects a <tbody id="participants-tbody"> in the DOM.
 * @param {Array<object>} rows
 */
function renderParticipantsTable(rows) {
	const tbody = $("#participants-tbody");
	if (!tbody) {
		console.warn("[participants] missing #participants-tbody");
		return;
	}

	if (!Array.isArray(rows) || rows.length === 0) {
		tbody.innerHTML = `
      <tr>
        <td colspan="5" class="muted">No participants yet.</td>
      </tr>
    `;
		return;
	}

	const html = rows.map(p => {
		const name = escapeHtml(p.display_name || "");
		const email = escapeHtml(p.email || "");
		const phone = escapeHtml(p.phone || "");
		const channel = escapeHtml(p.channel_pref || "");
		const status = escapeHtml(p.status || "");

		return `
      <tr>
        <td>${name || "—"}</td>
        <td>${email || "—"}</td>
        <td>${phone || "—"}</td>
        <td>${channel || "—"}</td>
        <td>${status || "—"}</td>
      </tr>
    `;
	}).join("");

	tbody.innerHTML = html;
}

/**
 * Render a one-row error into the table.
 * @param {string} msg
 */
function renderParticipantsError(msg) {
	const tbody = $("#participants-tbody");
	if (!tbody) return;
	tbody.innerHTML = `
    <tr>
      <td colspan="5" class="error">Could not load participants: ${escapeHtml(msg)}</td>
    </tr>
  `;
}

/**
 * Very small HTML escaper for cell text.
 * @param {string} s
 * @returns {string}
 */
function escapeHtml(s) {
	const div = document.createElement("div");
	div.textContent = String(s ?? "");
	return div.innerHTML;
}

/* ───────────────────────── Bootstrap ───────────────────────── */

async function init() {
	try {
		console.log("🐛 Debug console initialized");

		// Expect ?pid=…&sid=…
		const usp = new URLSearchParams(location.search);
		const sid = usp.get("sid");
		if (!sid) throw new Error("Missing sid in URL");

		const rows = await fetchParticipants(sid);
		console.info("[participants] loaded", rows.length);
		renderParticipantsTable(rows);
	} catch (err) {
		console.error("[participants] init error:", err);
		renderParticipantsError(err?.message || String(err));
	}
}

document.addEventListener("DOMContentLoaded", init);

/* ───────────────────────── Optional: export for tests ───────────────────────── */
export {
	fetchParticipants,
	renderParticipantsTable,
	renderParticipantsError,
	init
};
