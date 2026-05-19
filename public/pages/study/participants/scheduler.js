/**
 * @file /pages/study/participants/scheduler.js
 * @module ParticipantsScheduler
 * @summary Controller for Participants and Sessions on a Study: loads data, renders tables/empty states, gates scheduling.
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

function contactCell(p) {
	const bits = [];
	if (p.email) bits.push(`<a href="mailto:${encodeURIComponent(p.email)}">${escapeHtml(p.email)}</a>`);
	if (p.phone) bits.push(`<a href="tel:${encodeURIComponent(p.phone)}">${escapeHtml(p.phone)}</a>`);
	return bits.join("<br/>") || "—";
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
	if (!res.ok || js?.ok === false) throw new Error(js?.detail || js?.error || `HTTP ${res.status}`);
	return js;
}

async function loadParticipants(studyId) {
	const js = await jsonFetch(`/api/participants?study=${encodeURIComponent(studyId)}`);
	return Array.isArray(js.participants) ? js.participants : [];
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
		row.innerHTML = `
			<td class="govuk-table__cell">${escapeHtml(p.display_name || p.name || "—")}</td>
			<td class="govuk-table__cell">${contactCell(p)}</td>
			<td class="govuk-table__cell">${escapeHtml(p.status || "—")}</td>
			<td class="govuk-table__cell">
				<button class="govuk-button govuk-button--secondary" data-part="${escapeHtml(p.id)}" data-act="schedule">Schedule</button>
			</td>
		`;
		body.appendChild(row);
	}
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
		const pname = participantsById.get(s.participant_id)?.display_name || participantsById.get(s.participantId)?.display_name || "—";

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

function setScheduleEnabled(enabled, participants) {
	const form = $("#scheduleForm");
	const btn = $("#scheduleBtn");
	const select = $("#s_participant");
	const banner = $("#noParticipantsBanner");
	const cta = $("#scheduleCta");

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

	banner.hidden = true;
	btn.disabled = false;
	form.querySelectorAll("input, textarea, select, button").forEach(el => el.removeAttribute("disabled"));
	select.innerHTML = `<option value="" disabled selected>Select a participant</option>` +
		participants.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.display_name || p.email || p.phone || p.id)}</option>`).join("");
	cta?.removeAttribute("aria-disabled");
	cta?.classList.remove("link--disabled");
}

async function handleAddParticipant(e, studyId, refresh) {
	e.preventDefault();
	const form = e.target;
	const msg = $("#addParticipantMsg");
	if (msg) msg.textContent = "";

	const display = $("#p_display")?.value.trim() || "";
	const email = $("#p_email")?.value.trim() || "";
	const phone = $("#p_phone")?.value.trim() || "";
	const channel = $("#p_channel")?.value || "email";
	const access = $("#p_access")?.value.trim() || "";

	if (!display) {
		if (msg) msg.textContent = "Display name is required.";
		return;
	}

	const payload = {
		study_airtable_id: studyId,
		display_name: display,
		email: email || undefined,
		phone: phone || undefined,
		channel_pref: channel,
		access_needs: access || undefined
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
	const starts = $("#s_datetime")?.value || "";
	const dur = $("#s_duration")?.value || "";
	const loc = $("#s_location")?.value.trim() || "";
	const backup = $("#s_backup")?.value.trim() || "";
	const researchers = $("#s_researchers")?.value.trim() || "";
	const notes = $("#s_notes")?.value.trim() || "";

	if (!participantId || !starts || !dur || !loc) {
		if (msg) msg.textContent = "Participant, start time, duration, and location are required.";
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

	const pMap = new Map(participants.map(p => [p.id, p]));
	renderSessions(sessions, pMap);
}

async function refreshSessions(studyId) {
	const [participants, sessions] = await Promise.all([
		loadParticipants(studyId),
		loadSessions(studyId)
	]);
	const pMap = new Map(participants.map(p => [p.id, p]));
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
	if (badge) badge.textContent = `Study: ${title}`;
}

(async function init() {
	try {
		const context = readStudyRouteContext();
		if (!context.studyId) throw new Error("Missing Study record ID in URL");

		bindRouteChrome(context);

		const addForm = $("#addParticipantForm");
		const schedForm = $("#scheduleForm");
		if (addForm) addForm.addEventListener("submit", (e) => handleAddParticipant(e, context.studyId, () => refreshAll(context.studyId)));
		if (schedForm) schedForm.addEventListener("submit", (e) => handleCreateSession(e, context.studyId));

		await refreshAll(context.studyId);

		const pTable = $("#participantsTable");
		if (pTable) {
			pTable.addEventListener("click", (e) => {
				const target = e.target instanceof HTMLElement ? e.target : null;
				const btn = target?.closest("[data-act='schedule'], [data-action='schedule']");
				if (!btn) return;
				const participantSelect = $("#s_participant");
				const participantId = btn.getAttribute("data-part") || btn.getAttribute("data-id");
				if (participantSelect && participantId) {
					participantSelect.value = participantId;
					$("#s_datetime")?.focus();
				}
				$("#scheduleForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
			});
		}
	} catch (err) {
		console.error("[participants] init error:", err instanceof Error ? `${err.name}: ${err.message}` : err);
	}
})();
