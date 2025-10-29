/**
 * @file /js/session-controller.js
 * @summary Controller for study session UI: participant picker, consents, timer, and notes.
 * @description
 * - Populates participant dropdown (mock data placeholder; replace with Airtable fetch later).
 * - Renders participant details with RDFa (schema.org) attributes.
 * - Renders consent summary with RDFa ItemList + acceptedAnswer content true/false.
 * - Session controls (start/pause/stop) with a visible hh:mm:ss timer and RDFa duration.
 * - Notes editor with framework + category; saved notes emitted as schema:ListItem/CreativeWork.
 * - Each saved note includes absolute UTC schema:startTime / schema:endTime metas,
 *   plus temporalCoverage as an absolute ISO-8601 interval.
 * - Save button posts to /api/session-notes. The returned Airtable record id is injected
 *   into the RDFa resource as #note-<recordId> for stable anchoring.
 *
 * Accessibility:
 * - Timer has role="timer" and updates politely for AT users.
 * - Buttons have clear labels; toolbar buttons use execCommand for quick rich text.
 */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

/* -----------------------------------------------------------------------------
   Mock data until Airtable wiring for participants
   Replace with: fetch(`/api/participants?study=${encodeURIComponent(studyId)}`)
   ----------------------------------------------------------------------------- */
const MOCK_PARTICIPANTS = [{
		id: "ptp_001",
		airtableId: "recPARTICIPANT001",
		pseudonym: "P01",
		name: "Alex Johnson",
		userType: "Public beta user",
		session: { date: "2025-11-04", start: "10:00", end: "10:45" },
		consents: {
			observers: true,
			noteTakers: true,
			recordVideo: false,
			recordAudio: true,
			transcription: true,
			videoOn: false
		}
	},
	{
		id: "ptp_002",
		airtableId: "recPARTICIPANT002",
		pseudonym: "P02",
		name: "Samira Ahmed",
		userType: "Operational staff",
		session: { date: "2025-11-04", start: "11:15", end: "12:00" },
		consents: {
			observers: false,
			noteTakers: true,
			recordVideo: true,
			recordAudio: true,
			transcription: true,
			videoOn: true
		}
	}
];

/* -----------------------------------------------------------------------------
   State
   ----------------------------------------------------------------------------- */
let timerInterval = null;
let baseStart = null; // epoch ms when session started (or resumed)
let elapsedMs = 0; // accumulated elapsed when paused/resumed
let isRunning = false;

let pendingNoteStart = null; // session-relative ms when Add note clicked
let pendingNoteStartAbsIso = null; // absolute UTC ISO when Add note clicked
let sessionAbsStartIso = null; // absolute ISO when the session first starts

let currentParticipant = null; // selected participant object (contains airtableId)
const notes = []; // in-memory list (rendered and also saved to Airtable)

/* -----------------------------------------------------------------------------
   Utilities
   ----------------------------------------------------------------------------- */
function pad2(n) { return String(n).padStart(2, "0"); }

function msToHMS(ms) {
	const total = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

function msToISODuration(ms) {
	const total = Math.max(0, Math.floor(ms / 1000));
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const seconds = total % 60;
	return `PT${hours}H${minutes}M${seconds}S`;
}

function nowMs() { return Date.now(); }

function nowIsoUtc() { return new Date().toISOString(); }

function sessionNowMs() { return isRunning ? (elapsedMs + (nowMs() - baseStart)) : elapsedMs; }

async function postJson(url, body) {
	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json; charset=utf-8" },
		body: JSON.stringify(body)
	});
	const txt = await res.text();
	let js;
	try { js = JSON.parse(txt); } catch { js = null; }
	if (!res.ok || !js) {
		throw new Error(js?.error || `HTTP ${res.status}: ${txt.slice(0, 200)}`);
	}
	return js;
}

/* Extract a session Airtable record id from either:
   - URL ?session=recXXXXXXXXXXXXXX
   - Hidden #session-entity meta[property="schema:identifier"] (content=<recId>)
*/
function getSessionAirtableId() {
	const url = new URL(location.href);
	const q = url.searchParams.get("session");
	if (q) return q;
	const sess = $("#session-entity");
	if (sess) {
		const m = sess.querySelector('meta[property="schema:identifier"]');
		if (m?.content) return m.content.trim();
	}
	return null;
}

/* -----------------------------------------------------------------------------
   Populate participant select
   ----------------------------------------------------------------------------- */
function populateParticipants(list) {
	const select = $("#participant-select");
	list.forEach(p => {
		const opt = document.createElement("option");
		opt.value = p.id;
		opt.textContent = `${p.pseudonym} — ${p.name}`;
		opt.setAttribute("data-airtable-id", p.airtableId || "");
		select.appendChild(opt);
	});
}

/* -----------------------------------------------------------------------------
   RDFa helpers
   ----------------------------------------------------------------------------- */
function clearChildren(el) { while (el.firstChild) el.removeChild(el.firstChild); }

function dd(text, rdfa = {}) {
	const el = document.createElement("dd");
	if (text != null) el.textContent = text;
	for (const [k, v] of Object.entries(rdfa)) {
		if (v === null || v === undefined || v === false) continue;
		el.setAttribute(k, String(v));
	}
	return el;
}

function dt(text) {
	const el = document.createElement("dt");
	el.textContent = text;
	return el;
}

/* Session status setter (schema:EventStatusType IRI) */
function setEventStatus(iri) {
	const sess = document.querySelector("#session-entity");
	if (!sess) return;
	let meta = sess.querySelector('meta[property="schema:eventStatus"]');
	if (!iri) { if (meta) meta.remove(); return; }
	if (!meta) {
		meta = document.createElement("meta");
		meta.setAttribute("property", "schema:eventStatus");
		sess.appendChild(meta);
	}
	meta.setAttribute("content", iri);
}

function ensureOrSetMeta(parent, prop, value) {
	let meta = parent.querySelector(`meta[property="${prop}"]`);
	if (!value) { if (meta) meta.remove(); return; }
	if (!meta) {
		meta = document.createElement("meta");
		meta.setAttribute("property", prop);
		parent.appendChild(meta);
	}
	meta.setAttribute("content", value);
}

/* -----------------------------------------------------------------------------
   Render participant details & consents
   ----------------------------------------------------------------------------- */
function renderParticipantDetails(p) {
	const dl = $("#participant-details"); // typeof Person, resource #participant
	clearChildren(dl);

	// Pseudonym -> schema:alternateName
	dl.append(dt("Pseudonym"), dd(p.pseudonym, { "property": "schema:alternateName" }));

	// Name -> schema:name
	dl.append(dt("Name"), dd(p.name, { "property": "schema:name" }));

	// User type -> schema:additionalType (label)
	dl.append(dt("User type"), dd(p.userType, { "property": "schema:additionalType" }));

	// Date -> about #session, startDate (ISO date in content attr, human text in node)
	const date = p.session?.date || "";
	if (date) {
		const human = new Date(date + "T00:00:00Z"); // display-only
		const humanText = human.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
		dl.append(dt("Date"), dd(humanText, { "about": "#session", "property": "schema:startDate", "content": date }));
	} else {
		dl.append(dt("Date"), dd("—"));
	}

	// Time -> about #session, startTime + endTime as <time> elements
	const tStart = p.session?.start || "";
	const tEnd = p.session?.end || "";
	if (tStart && tEnd) {
		const ddEl = document.createElement("dd");
		ddEl.setAttribute("about", "#session");

		const t1 = document.createElement("time");
		t1.setAttribute("property", "schema:startTime");
		t1.setAttribute("datetime", tStart);
		t1.textContent = tStart;

		const sep = document.createTextNode("–");

		const t2 = document.createElement("time");
		t2.setAttribute("property", "schema:endTime");
		t2.setAttribute("datetime", tEnd);
		t2.textContent = tEnd;

		ddEl.append(t1, sep, t2);
		dl.append(dt("Time"), ddEl);
	} else {
		dl.append(dt("Time"), dd("—"));
	}

	// Mirror session data onto hidden #session-entity if present
	const sessionEntity = $("#session-entity");
	if (sessionEntity) {
		ensureOrSetMeta(sessionEntity, "schema:startDate", date || null);
		ensureOrSetMeta(sessionEntity, "schema:startTime", tStart || null);
		ensureOrSetMeta(sessionEntity, "schema:endTime", tEnd || null);
	}
}

function renderConsentSummary(p) {
	const dl = $("#consent-summary"); // typeof ItemList
	clearChildren(dl);

	const labels = {
		observers: "Observers",
		noteTakers: "Note-takers",
		recordVideo: "Record video",
		recordAudio: "Record audio",
		transcription: "Transcription",
		videoOn: "Video on"
	};

	for (const key of Object.keys(labels)) {
		if (!(p.consents && key in p.consents)) continue;
		const ok = !!p.consents[key];

		// Label
		dl.append(dt(labels[key]));

		// Value with RDFa: schema:acceptedAnswer content true/false
		const ddEl = document.createElement("dd");
		ddEl.setAttribute("property", "schema:acceptedAnswer");
		ddEl.setAttribute("content", String(ok));
		ddEl.innerHTML = ok ? '<span aria-label="consented">✔</span>' : '<span aria-label="not consented">✗</span>';
		dl.append(ddEl);
	}
}

/* -----------------------------------------------------------------------------
   Timer controls
   ----------------------------------------------------------------------------- */
function updateTimerView() {
	const ms = sessionNowMs();
	$("#timer-display").textContent = msToHMS(ms);
	$("#timer-display").setAttribute("content", msToISODuration(ms)); // RDFa schema:duration (as ISO 8601)
}

function startTimer() {
	// Explicit status
	setEventStatus("https://schema.org/EventScheduled");
	if (isRunning) return;
	isRunning = true;
	baseStart = nowMs();

	// Stamp absolute session start the first time Start is pressed
	if (!sessionAbsStartIso) {
		sessionAbsStartIso = nowIsoUtc();
		const d = new Date(sessionAbsStartIso);
		const yyyy = d.getUTCFullYear();
		const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
		const dd = String(d.getUTCDate()).padStart(2, "0");
		const dateOnly = `${yyyy}-${mm}-${dd}`;
		const sess = $("#session-entity");
		if (sess) {
			ensureOrSetMeta(sess, "schema:startDate", dateOnly); // YYYY-MM-DD
			ensureOrSetMeta(sess, "schema:startTime", sessionAbsStartIso); // full ISO
		}
	}

	$("#btn-start").disabled = true;
	$("#btn-pause").disabled = false;
	$("#btn-stop").disabled = false;
	$("#btn-add-note").disabled = false;
	timerInterval = setInterval(updateTimerView, 250);
}

function pauseTimer() {
	if (!isRunning) return;
	elapsedMs = sessionNowMs();
	isRunning = false;
	clearInterval(timerInterval);
	updateTimerView();
	$("#btn-start").disabled = false;
	$("#btn-pause").disabled = true;
}

function stopTimer() {
	isRunning = false;
	clearInterval(timerInterval);

	// Stamp absolute session end on stop
	const sess = $("#session-entity");
	if (sess) {
		ensureOrSetMeta(sess, "schema:endTime", nowIsoUtc());
	}

	elapsedMs = 0;
	baseStart = null;
	updateTimerView();
	$("#btn-start").disabled = false;
	$("#btn-pause").disabled = true;
	$("#btn-stop").disabled = true;
	$("#btn-add-note").disabled = true;
	$("#btn-save-note").disabled = true;
	pendingNoteStart = null;
	pendingNoteStartAbsIso = null;
	$("#note-timestamps").textContent = "";
	$("#note-editor").innerHTML = "";
}

/* -----------------------------------------------------------------------------
   Framework switching
   ----------------------------------------------------------------------------- */
const AEIOU = [
	["activity", "Activities"],
	["environment", "Environments"],
	["interaction", "Interactions"],
	["object", "Objects"],
	["user", "Users"]
];

const POEMS = [
	["people", "People"],
	["objects", "Objects"],
	["environments", "Environments"],
	["messages", "Messages"],
	["services", "Services"]
];

function setFramework(kind) {
	const select = $("#note-kind");
	select.innerHTML = "";
	let items = [];
	if (kind === "aeiou") items = AEIOU;
	else if (kind === "poems") items = POEMS;
	else items = [
		["idea", "Ideas/Notes"],
		["quote", "Quote"],
		["observation", "Observation"]
	];
	for (const [v, label] of items) {
		const opt = document.createElement("option");
		opt.value = v;
		opt.textContent = label;
		select.appendChild(opt);
	}
}

/* -----------------------------------------------------------------------------
   Editor formatting toolbar
   ----------------------------------------------------------------------------- */
function bindFormatting() {
	const toolbar = $(".note-toolbar__right");
	toolbar.addEventListener("click", (e) => {
		const btn = e.target.closest("button[data-cmd]");
		if (!btn) return;
		const cmd = btn.getAttribute("data-cmd");
		const val = btn.getAttribute("data-value") || null;
		document.execCommand(cmd, false, val);
		$("#note-editor").focus();
	});
}

/* -----------------------------------------------------------------------------
   Notes: begin & save
   ----------------------------------------------------------------------------- */
function beginNote() {
	pendingNoteStart = sessionNowMs();
	pendingNoteStartAbsIso = nowIsoUtc(); // absolute UTC at click
	$("#btn-save-note").disabled = false;
	const startedAt = msToHMS(pendingNoteStart);
	$("#note-timestamps").textContent = `Started at ${startedAt}`;
}

/**
 * Persist a note via API, then render in the DOM with RDFa, using the returned Airtable id.
 */
async function saveNote() {
	if (pendingNoteStart == null) return;

	const savedAtMs = sessionNowMs();
	const startedAt = msToHMS(pendingNoteStart);
	const savedAt = msToHMS(savedAtMs);
	const delta = msToHMS(Math.max(0, savedAtMs - pendingNoteStart));
	const html = $("#note-editor").innerHTML.trim();
	const framework = $("#framework").value;
	const category = $("#note-kind").value;
	const participantId = currentParticipant?.airtableId || null;

	const startIso = pendingNoteStartAbsIso || nowIsoUtc();
	const endIso = nowIsoUtc();

	// Basic UX guardrails
	if (!html) {
		announce("Empty note. Add some text before saving.");
		return;
	}
	const sessionId = getSessionAirtableId();
	if (!sessionId) {
		announce("Missing session id. Unable to save note.");
		return;
	}

	// Build payload (mirrors service/session-notes.js expectations)
	const payload = {
		session_airtable_id: sessionId,
		participant_airtable_id: participantId || undefined,
		framework: framework?.toUpperCase?.() === "NONE" ? "none" : framework,
		category,
		start_iso: startIso,
		end_iso: endIso,
		start_offset_ms: pendingNoteStart,
		end_offset_ms: savedAtMs,
		content_html: html,
		author: undefined // optionally: inject researcher initials/name from context
	};

	// POST /api/session-notes
	let createdId = null;
	try {
		const res = await postJson("/api/session-notes", payload);
		if (!res?.ok) throw new Error(res?.error || "Unknown error");
		createdId = res?.id || res?.note?.id || null;
		announce("Note saved.");
	} catch (err) {
		console.error("session-note.save.fail", err);
		announce("Failed to save the note. Please try again.");
		return;
	}

	// Local model (optional)
	const note = {
		id: createdId || crypto.randomUUID(),
		participantId,
		framework,
		category,
		startedAtMs: pendingNoteStart,
		savedAtMs,
		startIso,
		endIso,
		contentHtml: html
	};
	notes.push(note);

	// Render to DOM with RDFa (absolute start/end + absolute interval)
	const ul = $("#notes-list");
	const li = document.createElement("li");
	li.setAttribute("property", "schema:itemListElement");
	li.setAttribute("typeof", "schema:ListItem");

	const article = document.createElement("article");
	article.setAttribute("typeof", "schema:CreativeWork");
	// Use stable Airtable id anchor where possible
	const resourceId = createdId ? `#note-${createdId}` : `#note-${note.id}`;
	article.setAttribute("resource", resourceId);

	const metaStart = document.createElement("meta");
	metaStart.setAttribute("property", "schema:startTime");
	metaStart.setAttribute("content", note.startIso);

	const metaEnd = document.createElement("meta");
	metaEnd.setAttribute("property", "schema:endTime");
	metaEnd.setAttribute("content", note.endIso);

	const metaCreated = document.createElement("meta");
	metaCreated.setAttribute("property", "schema:dateCreated");
	metaCreated.setAttribute("content", nowIsoUtc());

	const metaTempo = document.createElement("meta");
	metaTempo.setAttribute("property", "schema:temporalCoverage");
	metaTempo.setAttribute("content", `${note.startIso}/${note.endIso}`);

	const metaGenre = document.createElement("meta");
	metaGenre.setAttribute("property", "schema:genre");
	metaGenre.setAttribute("content", category);

	const metaTechnique = document.createElement("meta");
	metaTechnique.setAttribute("property", "schema:measurementTechnique");
	metaTechnique.setAttribute("content", framework);

	const metaAbout = document.createElement("meta");
	metaAbout.setAttribute("property", "schema:about");
	metaAbout.setAttribute("resource", "#participant");

	const metaAnchor = document.createElement("p");
	metaAnchor.className = "note-meta";
	metaAnchor.textContent = `Timestamp: ${startedAt} – ${savedAt} (Δ ${delta}) • ${framework.toUpperCase()} • ${category}`;
	if (createdId) {
		const small = document.createElement("small");
		small.className = "note-id";
		small.textContent = `  (#${createdId})`;
		metaAnchor.appendChild(small);
	}

	const body = document.createElement("div");
	body.className = "note-body";
	body.setAttribute("property", "schema:text");
	body.innerHTML = html || "<em>(Empty note)</em>";

	article.append(metaStart, metaEnd, metaCreated, metaTempo, metaGenre, metaTechnique, metaAbout, metaAnchor, body);
	li.append(article);
	ul.prepend(li);

	// Reset editor state
	pendingNoteStart = null;
	pendingNoteStartAbsIso = null;
	$("#note-timestamps").textContent = "";
	$("#note-editor").innerHTML = "";
	$("#btn-save-note").disabled = true;
}

/* Simple polite announcer for status changes */
function announce(text) {
	const live = $("#note-timestamps");
	if (!live) return;
	live.textContent = text;
}

/* -----------------------------------------------------------------------------
   Event wiring
   ----------------------------------------------------------------------------- */
function wireEvents() {
	$("#btn-start").addEventListener("click", startTimer);
	$("#btn-pause").addEventListener("click", pauseTimer);
	$("#btn-stop").addEventListener("click", stopTimer);

	$("#framework").addEventListener("change", (e) => setFramework(e.target.value));
	$("#btn-add-note").addEventListener("click", beginNote);
	$("#btn-save-note").addEventListener("click", saveNote);

	$("#participant-select").addEventListener("change", (e) => {
		const selId = e.target.value;
		const p = MOCK_PARTICIPANTS.find(x => x.id === selId);
		currentParticipant = p || null;

		if (!p) {
			$("#participant-details").innerHTML = "";
			$("#consent-summary").innerHTML = "";
			return;
		}
		renderParticipantDetails(p);
		renderConsentSummary(p);
	});
}

/* -----------------------------------------------------------------------------
   Init
   ----------------------------------------------------------------------------- */
function init() {
	// Default status: EventScheduled (explicit)
	setEventStatus("https://schema.org/EventScheduled");

	// Participants (mock)
	populateParticipants(MOCK_PARTICIPANTS);

	// Framework defaults
	setFramework("none");
	bindFormatting();
	wireEvents();
	updateTimerView();

	// Enable Save only after a note is begun
	$("#btn-save-note").disabled = true;
}

document.addEventListener("DOMContentLoaded", init);