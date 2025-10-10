/**
 * @file /pages/study/participants/scheduler.js
 * @module ParticipantsScheduler
 * @summary Controller for Participants and Sessions on a Study: loads data, renders tables/empty states, gates scheduling.
 * @description
 * - Renders two paired areas:
 *   1) Participants table (or empty state) + “Add participant” form
 *   2) Sessions table (or empty state) + “Schedule session” form
 * - Schedules are only enabled when at least one participant exists.
 * - Uses the Worker API endpoints:
 *   - GET  /api/participants?study=<StudyAirtableId>
 *   - POST /api/participants
 *   - GET  /api/sessions?study=<StudyAirtableId>
 *   - POST /api/sessions
 *   - GET  /api/sessions/:id/ics
 *
 * Implementation notes:
 * - Zero external dependencies; uses `fetch` with `cache:"no-store"` to avoid stale lists.
 */

/* ────────────────────────────────────────────────────────────────────────── */
/* Tiny DOM helpers                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Query a single element.
 * @template {Element} T
 * @param {string} sel - CSS selector (first match returned).
 * @param {ParentNode} [root=document] - Optional root to scope the query.
 * @returns {T|null} The first matching element or `null`.
 */
const $ = (sel, root = document) => /** @type {any} */ (root.querySelector(sel));

/* ────────────────────────────────────────────────────────────────────────── */
/* Data types                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * @typedef {Object} Participant
 * @property {string} id
 * @property {string} [display_name]
 * @property {string} [email]
 * @property {string} [phone]
 * @property {string} [channel_pref]
 * @property {string} [access_needs]
 * @property {string} [status]
 * @property {string} [createdAt]
 */

/**
 * @typedef {Object} Session
 * @property {string} id
 * @property {string} participant_id
 * @property {string} starts_at
 * @property {number} duration_min
 * @property {string} [type]
 * @property {string} [location_or_link]
 * @property {string} [backup_contact]
 * @property {string} [researchers]
 * @property {string} [status]
 * @property {boolean} [safeguarding_flag]
 * @property {string} [notes]
 * @property {string} [createdAt]
 */

/* ────────────────────────────────────────────────────────────────────────── */
/* Formatting helpers                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Human-readable “when” text for a session (local time).
 * @param {string} isoStart - ISO start timestamp.
 * @param {number} mins - Duration in minutes.
 * @returns {string} Formatted time range, localised.
 */
function fmtWhen(isoStart, mins) {
	const start = new Date(isoStart);
	const end = new Date(start.getTime() + (Number(mins || 60) * 60000));
	const sameDay = start.toDateString() === end.toDateString();
	const d = start.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
	const e = end.toLocaleTimeString(undefined, { timeStyle: "short" });
	return sameDay ? `${d} – ${e}` : `${d} → ${end.toLocaleString()}`;
}

/**
 * Build the “Contact” cell contents for a participant.
 * @param {Participant} p
 * @returns {string} HTML string (safe, minimal).
 */
function contactCell(p) {
	const bits = [];
	if (p.email) bits.push(`<a href="mailto:${encodeURIComponent(p.email)}">${p.email}</a>`);
	if (p.phone) bits.push(`<a href="tel:${p.phone}">${p.phone}</a>`);
	return bits.join("<br/>") || "—";
}

/* ────────────────────────────────────────────────────────────────────────── */
/* API loaders                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Fetch all participants for a study.
 * @param {string} studyId - Airtable record id for the Study.
 * @returns {Promise<Participant[]>}
 * @throws If the network request fails or the API returns an error.
 */
async function loadParticipants(studyId) {
	const res = await fetch(`/api/participants?study=${encodeURIComponent(studyId)}`, { cache: "no-store" });
	/** @type {{ ok:boolean, participants?: Participant[], error?:string }} */
	const js = await res.json().catch(() => /** @type {any} */ ({}));
	if (!res.ok || js?.ok !== true) throw new Error(js?.error || `Participants ${res.status}`);
	return js.participants || [];
}

/**
 * Fetch all sessions for a study.
 * @param {string} studyId - Airtable record id for the Study.
 * @returns {Promise<Session[]>}
 * @throws If the network request fails or the API returns an error.
 */
async function loadSessions(studyId) {
	const res = await fetch(`/api/sessions?study=${encodeURIComponent(studyId)}`, { cache: "no-store" });
	/** @type {{ ok:boolean, sessions?: Session[], error?:string }} */
	const js = await res.json().catch(() => /** @type {any} */ ({}));
	if (!res.ok || js?.ok !== true) throw new Error(js?.error || `Sessions ${res.status}`);
	return js.sessions || [];
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Renderers                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Render the Participants area (table or empty state).
 * @param {Participant[]} list
 * @returns {void}
 */
function renderParticipants(list) {
	const tbl = /** @type {HTMLDivElement} */ ($("#participantsTable"));
	const empty = /** @type {HTMLDivElement} */ ($("#participantsEmpty"));

	if (!tbl || !empty) return;

	if (!list.length) {
		tbl.hidden = true;
		empty.hidden = false;
		return;
	}

	empty.hidden = true;
	tbl.hidden = false;

	// clear prior rows
	tbl.querySelectorAll(".row").forEach(n => n.remove());

	for (const p of list) {
		const row = document.createElement("div");
		row.className = "row";
		row.setAttribute("role", "row");
		row.innerHTML = `
			<div role="cell">${p.display_name || "—"}</div>
			<div role="cell">${contactCell(p)}</div>
			<div role="cell">${p.status || "—"}</div>
			<div role="cell">
				<button class="btn btn--small" data-part="${p.id}" data-act="schedule">Schedule</button>
			</div>
		`;
		tbl.appendChild(row);
	}
}

/**
 * Render the Sessions area (table or empty state).
 * @param {Session[]} list
 * @param {Map<string, Participant>} participantsById - Lookup map for participant names.
 * @returns {void}
 */
function renderSessions(list, participantsById) {
	const tbl = /** @type {HTMLDivElement} */ ($("#sessionsTable"));
	const empty = /** @type {HTMLDivElement} */ ($("#sessionsEmpty"));

	if (!tbl || !empty) return;

	if (!list.length) {
		tbl.hidden = true;
		empty.hidden = false;
		return;
	}

	empty.hidden = true;
	tbl.hidden = false;
	tbl.querySelectorAll(".row").forEach(n => n.remove());

	for (const s of list) {
		const row = document.createElement("div");
		row.className = "row";
		row.setAttribute("role", "row");
		const pname = participantsById.get(s.participant_id)?.display_name || "—";

		row.innerHTML = `
			<div role="cell">${fmtWhen(s.starts_at, s.duration_min)}</div>
			<div role="cell">${pname}</div>
			<div role="cell">${s.status || "scheduled"}</div>
			<div role="cell">
				<a class="btn btn--small" href="/api/sessions/${encodeURIComponent(s.id)}/ics">Download .ics</a>
			</div>
		`;
		tbl.appendChild(row);
	}
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Form gating & handlers                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Enable/disable the Schedule Session form depending on participants availability.
 * @param {boolean} enabled - Whether to enable the form.
 * @param {Participant[]} participants - Participants to populate the select.
 * @returns {void}
 */
function setScheduleEnabled(enabled, participants) {
	const form = /** @type {HTMLFormElement} */ ($("#scheduleForm"));
	const btn = /** @type {HTMLButtonElement} */ ($("#scheduleBtn"));
	const select = /** @type {HTMLSelectElement} */ ($("#s_participant"));
	const banner = /** @type {HTMLDivElement} */ ($("#noParticipantsBanner"));
	const cta = /** @type {HTMLAnchorElement} */ ($("#scheduleCta"));

	if (!form || !btn || !select || !banner) return;

	if (!enabled) {
		banner.hidden = false;
		btn.disabled = true;
		form.querySelectorAll("input, textarea, select, button").forEach(el => {
			if (el !== btn) el.setAttribute("disabled", "true");
		});
		select.innerHTML = `<option value="" disabled selected>No participants available</option>`;
		cta?.setAttribute("aria-disabled", "true");
		cta?.classList.add("link--disabled");
		return;
	}

	// enabled
	banner.hidden = true;
	btn.disabled = false;
	form.querySelectorAll("input, textarea, select, button").forEach(el => el.removeAttribute("disabled"));
	select.innerHTML = `<option value="" disabled selected>Select a participant</option>` +
		participants.map(p => `<option value="${p.id}">${p.display_name || p.email || p.phone || p.id}</option>`).join("");
	cta?.removeAttribute("aria-disabled");
	cta?.classList.remove("link--disabled");
}

/**
 * Handle the “Add participant” form submit.
 * @param {SubmitEvent} e
 * @param {string} studyId
 * @param {() => Promise<void>} refresh - Function to refresh lists after success.
 * @returns {Promise<void>}
 */
async function handleAddParticipant(e, studyId, refresh) {
	e.preventDefault();
	const form = /** @type {HTMLFormElement} */ (e.target);
	const msg = /** @type {HTMLElement} */ ($("#addParticipantMsg"));
	if (msg) msg.textContent = "";

	const display = /** @type {HTMLInputElement} */ ($("#p_display"))?.value.trim() || "";
	const email = /** @type {HTMLInputElement} */ ($("#p_email"))?.value.trim() || "";
	const phone = /** @type {HTMLInputElement} */ ($("#p_phone"))?.value.trim() || "";
	const channel = /** @type {HTMLSelectElement} */ ($("#p_channel"))?.value || "email";
	const access = /** @type {HTMLTextAreaElement} */ ($("#p_access"))?.value.trim() || "";

	if (!display) {
		if (msg) msg.textContent = "Display name is required.";
		return;
	}

	/** @type {Record<string, any>} */
	const payload = {
		study_airtable_id: studyId,
		display_name: display,
		email: email || undefined,
		phone: phone || undefined,
		channel_pref: channel,
		access_needs: access || undefined
	};

	const res = await fetch("/api/participants", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload)
	});
	const js = await res.json().catch(() => /** @type {any} */ ({}));
	if (!res.ok || js?.ok !== true) {
		if (msg) msg.textContent = js?.error || "Failed to create participant.";
		return;
	}

	form.reset();
	if (msg) msg.textContent = "Participant created.";
	await refresh();
}

/**
 * Handle the “Schedule session” form submit.
 * @param {SubmitEvent} e
 * @param {string} studyId
 * @returns {Promise<void>}
 */
async function handleCreateSession(e, studyId) {
	e.preventDefault();
	const form = /** @type {HTMLFormElement} */ (e.target);
	const msg = /** @type {HTMLElement} */ ($("#scheduleMsg"));
	if (msg) msg.textContent = "";

	const pid = /** @type {HTMLSelectElement} */ ($("#s_participant"))?.value || "";
	const type = /** @type {HTMLSelectElement} */ ($("#s_type"))?.value || "remote";
	const starts = /** @type {HTMLInputElement} */ ($("#s_datetime"))?.value || "";
	const dur = /** @type {HTMLInputElement} */ ($("#s_duration"))?.value || "";
	const loc = /** @type {HTMLInputElement} */ ($("#s_location"))?.value.trim() || "";
	const backup = /** @type {HTMLInputElement} */ ($("#s_backup"))?.value.trim() || "";
	const researchers = /** @type {HTMLInputElement} */ ($("#s_researchers"))?.value.trim() || "";
	const notes = /** @type {HTMLTextAreaElement} */ ($("#s_notes"))?.value.trim() || "";

	if (!pid || !starts || !dur || !loc) {
		if (msg) msg.textContent = "Participant, start time, duration, and location are required.";
		return;
	}

	/** @type {Record<string, any>} */
	const payload = {
		study_airtable_id: studyId,
		participant_airtable_id: pid,
		starts_at: new Date(starts).toISOString(),
		duration_min: Number(dur),
		type,
		location_or_link: loc,
		backup_contact: backup || undefined,
		researchers: researchers || undefined,
		notes: notes || undefined
	};

	const res = await fetch("/api/sessions", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload)
	});
	const js = await res.json().catch(() => /** @type {any} */ ({}));
	if (!res.ok || js?.ok !== true) {
		if (msg) msg.textContent = js?.error || "Failed to create session.";
		return;
	}

	form.reset();
	if (msg) msg.textContent = "Session created. You can download the .ics from the Sessions table.";
	await refreshSessions(studyId);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Orchestrators                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Refresh both participants and sessions; gate the schedule form accordingly.
 * @param {string} studyId
 * @returns {Promise<void>}
 */
async function refreshAll(studyId) {
	const [participants, sessions] = await Promise.all([
		loadParticipants(studyId),
		loadSessions(studyId)
	]);

	renderParticipants(participants);
	setScheduleEnabled(participants.length > 0, participants);

	const pMap = new Map(participants.map(p => [p.id, p]));
	renderSessions(sessions, pMap);
}

/**
 * Refresh just the sessions table (re-reads participants to label names).
 * @param {string} studyId
 * @returns {Promise<void>}
 */
async function refreshSessions(studyId) {
	const [participants, sessions] = await Promise.all([
		loadParticipants(studyId),
		loadSessions(studyId)
	]);
	const pMap = new Map(participants.map(p => [p.id, p]));
	renderSessions(sessions, pMap);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Bootstrap                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

(async function init() {
	try {
		const usp = new URLSearchParams(location.search);
		const pid = usp.get("pid") || "";
		const sid = usp.get("sid") || "";
		if (!pid || !sid) throw new Error("Missing pid or sid in URL");

		// Breadcrumb hydration (reuse projects list to get project name)
		try {
			const res = await fetch(`/api/projects`, { cache: "no-store" });
			const js = await res.json().catch(() => /** @type {any} */ ({}));
			/** @type {{id:string,name?:string}[]} */
			const projects = Array.isArray(js?.projects) ? js.projects : [];
			const project = projects.find(p => p.id === pid);
			const bcProj = /** @type {HTMLAnchorElement} */ ($("#breadcrumb-project"));
			if (bcProj) {
				bcProj.href = `/pages/project-dashboard/?id=${encodeURIComponent(pid)}`;
				bcProj.textContent = project?.name || "Project";
			}
			const bcStudy = /** @type {HTMLAnchorElement} */ ($("#breadcrumb-study"));
			if (bcStudy) {
				bcStudy.href = `/pages/study/?pid=${encodeURIComponent(pid)}&sid=${encodeURIComponent(sid)}`;
			}
		} catch {
			/* non-fatal */
		}

		// Badge text for quick context
		const badge = /** @type {HTMLElement} */ ($("#studyBadge"));
		if (badge) badge.textContent = `Study: ${sid}`;

		// Hook up forms
		const addForm = /** @type {HTMLFormElement} */ ($("#addParticipantForm"));
		const schedForm = /** @type {HTMLFormElement} */ ($("#scheduleForm"));
		if (addForm) addForm.addEventListener("submit", (e) => handleAddParticipant(e, sid, () => refreshAll(sid)));
		if (schedForm) schedForm.addEventListener("submit", (e) => handleCreateSession(e, sid));

		// Initial load
		await refreshAll(sid);

		// In-table “Schedule” action → prefills the form and scrolls to it
		const pTable = /** @type {HTMLElement} */ ($("#participantsTable"));
		if (pTable) {
			pTable.addEventListener("click", (e) => {
				const target = /** @type {HTMLElement|null} */ (e.target instanceof HTMLElement ? e.target : null);
				const btn = target?.closest("[data-act='schedule']");
				if (!btn) return;
				const pidSel = /** @type {HTMLSelectElement} */ ($("#s_participant"));
				const pidVal = btn.getAttribute("data-part");
				if (pidSel && pidVal) {
					pidSel.value = pidVal;
					/** @type {HTMLInputElement} */ ($("#s_datetime"))?.focus();
				}
				/** @type {HTMLElement} */ ($("#scheduleForm"))?.scrollIntoView({ behavior: "smooth", block: "start" });
			});
		}
	} catch (err) {
		console.error("[participants] init error:", err);
		alert("Could not load participants page.");
	}
})();
