/**
 * @file /pages/study/participants/scheduler.js
 * @module ParticipantsScheduler
 * @summary Controller for Participants and Sessions on a Study: loads pseudonymised participant data, renders tables/empty states, gates scheduling.
 */

import { apiUrl, route, studyTitle } from '/js/study-route-context.js';

const $ = (sel, root = document) => root.querySelector(sel);

function escapeHtml(value) {
	const d = document.createElement("div");
	d.textContent = String(value ?? "");
	return d.innerHTML;
}

function fmtWhen(isoStart, mins) {
	const start = new Date(isoStart);
	const end = new Date(start.getTime() + (Number(mins || 60) * 60000));
	const sameDay = start.toDateString() === end.toDateString();
	const d = start.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
	const e = end.toLocaleTimeString(undefined, { timeStyle: "short" });
	return sameDay ? `${d} – ${e}` : `${d} → ${end.toLocaleString()}`;
}

function restrictedContactCell(p) {
	const reveal = p.can_reveal_contact ?
		`<button class="govuk-button govuk-button--secondary" data-part="${escapeHtml(p.id)}" data-act="reveal-contact">Reveal contact details</button>` :
		`<p class="govuk-hint govuk-!-margin-bottom-0">Contact details are restricted. Ask a Team Admin or authorised role if you need access.</p>`;

	return `
		<div data-contact-state="restricted">
			<strong class="govuk-tag govuk-tag--grey">Restricted</strong>
			${reveal}
		</div>
	`;
}

function scheduleCell(p) {
	const sessionParticipantId = p.session_participant_id || "";
	if (p.can_schedule && sessionParticipantId) {
		return `<button class="govuk-button govuk-button--secondary" data-session-participant-id="${escapeHtml(sessionParticipantId)}" data-act="schedule">Schedule</button>`;
	}

	return `
		<button class="govuk-button govuk-button--secondary" disabled aria-disabled="true">Schedule</button>
		<p class="govuk-hint govuk-!-margin-bottom-0">Scheduling is not available until this participant has a session-compatible record.</p>
	`;
}

function readStudyRouteContext() {
	const usp = new URLSearchParams(location.search);
	return {
		projectId: usp.get("pid") || window.__studyRouteContext?.projectId || "",
		studyId: usp.get("sid") || window.__studyRouteContext?.studyId || "",
		project: window.__studyRouteContext?.project || null,
		study: window.__studyRouteContext?.study || null
	};
}

function fieldValue(selector) {
	return String($(selector)?.value || "").trim();
}

function generatedParticipantRef() {
	const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
	const random = Math.random().toString(36).slice(2, 6).toUpperCase();
	return `Participant ${stamp}-${random}`;
}

function selectedChannelPreferences() {
	const selected = Array.from(document.querySelectorAll('input[name="channel_pref"]:checked'))
		.map((input) => input.value)
		.filter(Boolean);
	return selected.length ? selected.join(", ") : "email";
}

function paddedNumber(value, length = 2) {
	return String(value).padStart(length, "0");
}

function sessionStartIsoFromFields() {
	const day = Number(fieldValue("#s_date-day"));
	const month = Number(fieldValue("#s_date-month"));
	const year = Number(fieldValue("#s_date-year"));
	const hour = Number(fieldValue("#s_time-hour"));
	const minute = Number(fieldValue("#s_time-minute"));

	if (!day || !month || !year || Number.isNaN(hour) || Number.isNaN(minute)) {
		return "";
	}

	if (month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
		return "";
	}

	const date = new Date(year, month - 1, day, hour, minute);
	if (
		date.getFullYear() !== year ||
		date.getMonth() !== month - 1 ||
		date.getDate() !== day ||
		date.getHours() !== hour ||
		date.getMinutes() !== minute
	) {
		return "";
	}

	return `${year}-${paddedNumber(month)}-${paddedNumber(day)}T${paddedNumber(hour)}:${paddedNumber(minute)}:00`;
}

async function jsonFetch(path, options = {}) {
	const res = await fetch(apiUrl(path), {
		cache: "no-store",
		credentials: "include",
		...options,
		headers: {
			"Content-Type": "application/json",
			...(options.headers || {})
		}
	});
	const js = await res.json().catch(() => ({}));
	if (!res.ok || js?.ok === false) throw new Error(js?.message || js?.detail || js?.error || `HTTP ${res.status}`);
	return js;
}

async function loadParticipants(studyId) {
	const js = await jsonFetch(`/api/participants?study=${encodeURIComponent(studyId)}`);
	return Array.isArray(js.participants) ? js.participants : [];
}

async function revealParticipantContact(participantId) {
	const js = await jsonFetch(`/api/participants/contact?participant=${encodeURIComponent(participantId)}`);
	return js.participant || null;
}

async function loadSessions(studyId) {
	const js = await jsonFetch(`/api/sessions?study=${encodeURIComponent(studyId)}`);
	return Array.isArray(js.sessions) ? js.sessions : [];
}

function renderParticipants(list) {
	const table = $("#participantsTable");
	const wrap = $("#participantsTableWrap");
	const body = $("#participants-tbody");
	const empty = $("#participantsEmpty");

	if (!table || !body || !empty) return;

	body.innerHTML = "";

	if (!list.length) {
		table.hidden = true;
		if (wrap) wrap.hidden = true;
		empty.hidden = false;
		return;
	}

	empty.hidden = true;
	table.hidden = false;
	if (wrap) wrap.hidden = false;

	for (const p of list) {
		const row = document.createElement("tr");
		row.className = "govuk-table__row";
		row.dataset.participantRow = "true";
		row.dataset.participantId = p.id;
		row.innerHTML = `
			<td class="govuk-table__cell">${escapeHtml(p.participant_ref || p.display_name || "—")}</td>
			<td class="govuk-table__cell" data-contact-cell="${escapeHtml(p.id)}">${restrictedContactCell(p)}</td>
			<td class="govuk-table__cell">${escapeHtml(p.status || "—")}<br><span class="govuk-hint">Preferred channel: ${escapeHtml(p.channel_pref || "not recorded")}</span></td>
			<td class="govuk-table__cell">
				${scheduleCell(p)}
			</td>
		`;
		body.appendChild(row);
	}
}

function renderRevealedContact(participantId, contact) {
	const cell = document.querySelector(`[data-contact-cell="${CSS.escape(participantId)}"]`);
	if (!cell) return;

	const email = contact?.email ? `<a href="mailto:${encodeURIComponent(contact.email)}">${escapeHtml(contact.email)}</a>` : "";
	const phone = contact?.phone ? `<a href="tel:${encodeURIComponent(contact.phone)}">${escapeHtml(contact.phone)}</a>` : "";
	const details = [email, phone].filter(Boolean).join("<br>") || "No contact details recorded.";

	cell.innerHTML = `
		<div data-contact-state="revealed">
			<strong class="govuk-tag govuk-tag--red">Sensitive</strong>
			<p class="govuk-hint govuk-!-margin-bottom-1">Participant contact details are revealed. Handle this information as sensitive.</p>
			${details}
		</div>
	`;
}

function renderSessions(list, participantsById) {
	const table = $("#sessionsTable");
	const wrap = $("#sessionsTableWrap");
	const body = $("#sessions-tbody");
	const empty = $("#sessionsEmpty");

	if (!table || !body || !empty) return;

	body.innerHTML = "";

	if (!list.length) {
		table.hidden = true;
		if (wrap) wrap.hidden = true;
		empty.hidden = false;
		return;
	}

	empty.hidden = true;
	table.hidden = false;
	if (wrap) wrap.hidden = false;

	for (const s of list) {
		const row = document.createElement("tr");
		row.className = "govuk-table__row";
		const participant = participantsById.get(s.participant_id) || participantsById.get(s.participantId);
		const pname = participant?.participant_ref || participant?.display_name || "—";

		row.innerHTML = `
			<td class="govuk-table__cell">${escapeHtml(fmtWhen(s.starts_at || s.startsAt, s.duration_min || s.durationMin))}</td>
			<td class="govuk-table__cell">${escapeHtml(pname)}</td>
			<td class="govuk-table__cell">${escapeHtml(s.status || "scheduled")}</td>
			<td class="govuk-table__cell">
				<a class="govuk-button govuk-button--secondary" href="${apiUrl(`/api/sessions/${encodeURIComponent(s.id)}/ics`)}">Download .ics</a>
			</td>
		`;
		body.appendChild(row);
	}
}

function scheduleableParticipants(participants) {
	return participants.filter((p) => p.can_schedule && p.session_participant_id);
}

function setScheduleEnabled(enabled, participants) {
	const form = $("#scheduleForm");
	const btn = $("#scheduleBtn");
	const select = $("#s_participant");
	const banner = $("#noParticipantsBanner");
	const cta = $("#scheduleCta");
	const available = scheduleableParticipants(participants);

	if (!form || !btn || !select || !banner) return;

	if (!enabled || !available.length) {
		banner.hidden = false;
		btn.disabled = true;
		form.querySelectorAll("input, textarea, select, button").forEach(el => {
			if (el !== btn) el.setAttribute("disabled", "true");
		});
		select.innerHTML = `<option value="" disabled selected>No participants available for scheduling</option>`;
		cta?.setAttribute("aria-disabled", "true");
		cta?.classList.add("link--disabled");
		return;
	}

	banner.hidden = true;
	btn.disabled = false;
	form.querySelectorAll("input, textarea, select, button").forEach(el => el.removeAttribute("disabled"));
	select.innerHTML = `<option value="" disabled selected>Select a participant</option>` +
		available.map(p => `<option value="${escapeHtml(p.session_participant_id)}">${escapeHtml(p.participant_ref || p.display_name || p.id)}</option>`).join("");
	cta?.removeAttribute("aria-disabled");
	cta?.classList.remove("link--disabled");
}

async function handleAddParticipant(e, context, refresh) {
	e.preventDefault();
	const form = e.target;
	const msg = $("#addParticipantMsg");
	if (msg) msg.textContent = "";

	const firstName = fieldValue("#p_first_name");
	const familyName = fieldValue("#p_family_name");
	const participantRef = fieldValue("#p_participant_ref") || generatedParticipantRef();
	const email = fieldValue("#p_email");
	const phone = fieldValue("#p_phone");
	const channel = selectedChannelPreferences();
	const access = fieldValue("#p_access");

	if (!firstName || !familyName) {
		if (msg) msg.textContent = "First name and family name are required.";
		return;
	}

	const payload = {
		project_id: context.projectId,
		study_id: context.studyId,
		participant_ref: participantRef,
		display_name: participantRef,
		first_name: firstName,
		family_name: familyName,
		email: email || undefined,
		phone: phone || undefined,
		channel_pref: channel,
		access_needs: access || undefined,
		status: "invited",
		consent_status: "not_sent"
	};

	try {
		await jsonFetch("/api/participants", {
			method: "POST",
			body: JSON.stringify(payload)
		});
		form.reset();
		if (msg) msg.textContent = "Participant created.";
		await refresh();
	} catch (error) {
		if (msg) msg.textContent = error?.message || "Failed to create participant.";
	}
}

async function handleCreateSession(e, studyId) {
	e.preventDefault();
	const form = e.target;
	const msg = $("#scheduleMsg");
	if (msg) msg.textContent = "";

	const participantId = $("#s_participant")?.value || "";
	const type = $("#s_type")?.value || "remote";
	const starts = sessionStartIsoFromFields();
	const dur = fieldValue("#s_duration");
	const loc = fieldValue("#s_location");
	const backup = fieldValue("#s_backup");
	const researchers = fieldValue("#s_researchers");
	const notes = fieldValue("#s_notes");

	if (!participantId || !starts || !dur || !loc) {
		if (msg) msg.textContent = "Participant, start date, start time, duration, and location are required.";
		return;
	}

	const payload = {
		study_airtable_id: studyId,
		participant_airtable_id: participantId,
		starts_at: new Date(starts).toISOString(),
		duration_min: Number(dur),
		type,
		location_or_link: loc,
		backup_contact: backup || undefined,
		researchers: researchers || undefined,
		notes: notes || undefined
	};

	try {
		await jsonFetch("/api/sessions", {
			method: "POST",
			body: JSON.stringify(payload)
		});
		form.reset();
		if (msg) msg.textContent = "Session created. You can download the .ics from the Sessions table.";
		await refreshSessions(studyId);
	} catch (error) {
		if (msg) msg.textContent = error?.message || "Failed to create session.";
	}
}

async function refreshAll(studyId) {
	const [participants, sessions] = await Promise.all([
		loadParticipants(studyId),
		loadSessions(studyId)
	]);

	renderParticipants(participants);
	setScheduleEnabled(participants.length > 0, participants);

	const pMap = new Map(participants.flatMap((p) => {
		const entries = [[p.id, p]];
		if (p.session_participant_id) entries.push([p.session_participant_id, p]);
		return entries;
	}));
	renderSessions(sessions, pMap);
}

async function refreshSessions(studyId) {
	const [participants, sessions] = await Promise.all([
		loadParticipants(studyId),
		loadSessions(studyId)
	]);
	const pMap = new Map(participants.flatMap((p) => {
		const entries = [[p.id, p]];
		if (p.session_participant_id) entries.push([p.session_participant_id, p]);
		return entries;
	}));
	renderSessions(sessions, pMap);
}

function bindRouteChrome(context) {
	const projectHref = route("/pages/project-dashboard/", { id: context.projectId });
	const studyHref = route("/pages/study/", { id: context.studyId });
	const title = studyTitle(context.study || {});

	const bcProj = $("#breadcrumb-project");
	if (bcProj) {
		bcProj.href = projectHref;
		bcProj.textContent = context.project?.name || "Project";
	}
	const bcStudy = $("#breadcrumb-study");
	if (bcStudy) {
		bcStudy.href = studyHref;
		bcStudy.textContent = title;
	}

	const badge = $("#studyBadge");
	if (badge) badge.textContent = title;

	const projectInput = $("#p_project_id");
	if (projectInput) projectInput.value = context.projectId;
	const studyInput = $("#p_study_id");
	if (studyInput) studyInput.value = context.studyId;
}

(async function init() {
	try {
		const context = readStudyRouteContext();
		if (!context.studyId) throw new Error("Missing Study record ID in URL");

		bindRouteChrome(context);

		const addForm = $("#addParticipantForm");
		const schedForm = $("#scheduleForm");
		if (addForm) addForm.addEventListener("submit", (e) => handleAddParticipant(e, context, () => refreshAll(context.studyId)));
		if (schedForm) schedForm.addEventListener("submit", (e) => handleCreateSession(e, context.studyId));

		await refreshAll(context.studyId);

		const pTable = $("#participantsTable");
		if (pTable) {
			pTable.addEventListener("click", async (e) => {
				const target = e.target instanceof HTMLElement ? e.target : null;
				const revealButton = target?.closest("[data-act='reveal-contact'], [data-action='reveal-contact']");
				if (revealButton) {
					const participantId = revealButton.getAttribute("data-part") || revealButton.getAttribute("data-id") || "";
					try {
						const contact = await revealParticipantContact(participantId);
						renderRevealedContact(participantId, contact);
					} catch (error) {
						const cell = document.querySelector(`[data-contact-cell="${CSS.escape(participantId)}"]`);
						if (cell) {
							cell.innerHTML = `<div class="govuk-error-message" role="alert">${escapeHtml(error?.message || "Contact details could not be revealed.")}</div>`;
						}
					}
					return;
				}

				const btn = target?.closest("[data-act='schedule']");
				if (!btn || btn.hasAttribute("disabled")) return;
				const participantSelect = $("#s_participant");
				const participantId = btn.getAttribute("data-session-participant-id");
				if (participantSelect && participantId) {
					participantSelect.value = participantId;
					$("#s_date-day")?.focus();
				}
				$("#scheduleForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
			});
		}
	} catch (err) {
		console.error("[participants] init error:", err instanceof Error ? `${err.name}: ${err.message}` : err);
	}
})();
