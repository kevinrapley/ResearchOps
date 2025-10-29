/**
 * @file /js/session-controller.js
 * @summary Controller for study session UI: participant picker, consents, timer, and notes.
 * @description
 * - Populates participant dropdown (mock data placeholder).
 * - Renders participant details with RDFa (schema.org) attributes.
 * - Renders consent summary with RDFa ItemList + acceptedAnswer content true/false.
 * - Session controls (start/pause/stop) with a visible hh:mm:ss timer and RDFa duration.
 * - Notes editor with framework + category; saved notes emitted as schema:ListItem/CreativeWork.
 * - Each saved note includes absolute UTC schema:startTime / schema:endTime metas,
 *   plus temporalCoverage using an absolute ISO-8601 interval.
 */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

/* ---------------- Mock data until Airtable wiring ---------------- */
const MOCK_PARTICIPANTS = [{
		id: "ptp_001",
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

/* ---------------- Timer state ---------------- */
let timerInterval = null;
let baseStart = null; // epoch ms when session started (or resumed)
let elapsedMs = 0; // accumulated elapsed when paused/resumed
let isRunning = false;

/* ---------------- Note state ---------------- */
let pendingNoteStart = null; // session-relative ms when Add note clicked
let pendingNoteStartAbsIso = null; // absolute UTC ISO when Add note clicked
const notes = []; // in-memory list only (for now)

/* ---------------- Utilities ---------------- */
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

/* ---------------- Populate participant select ---------------- */
function populateParticipants(list) {
	const select = $("#participant-select");
	list.forEach(p => {
		const opt = document.createElement("option");
		opt.value = p.id;
		opt.textContent = `${p.pseudonym} â ${p.name}`;
		select.appendChild(opt);
	});
}

/* ---------------- RDFa helpers ---------------- */
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

/* ---------------- Render participant details ---------------- */
function renderParticipantDetails(p) {
	const dl = $("#participant-details"); // typeof Person, resource #participant
	clearChildren(dl);

	// Pseudonym -> schema:alternateName
	dl.append(
		dt("Pseudonym"),
		dd(p.pseudonym, { "property": "schema:alternateName" })
	);

	// Name -> schema:name
	dl.append(
		dt("Name"),
		dd(p.name, { "property": "schema:name" })
	);

	// User type -> schema:additionalType (simple text label)
	dl.append(
		dt("User type"),
		dd(p.userType, { "property": "schema:additionalType" })
	);

	// Date -> about #session, startDate (ISO date in content attr, human text in node)
	const date = p.session?.date || "";
	if (date) {
		const human = new Date(date + "T00:00:00Z"); // display only
		const humanText = human.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
		dl.append(
			dt("Date"),
			dd(humanText, { "about": "#session", "property": "schema:startDate", "content": date })
		);
	} else {
		dl.append(dt("Date"), dd("â"));
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
		const sep = document.createTextNode("â");
		const t2 = document.createElement("time");
		t2.setAttribute("property", "schema:endTime");
		t2.setAttribute("datetime", tEnd);
		t2.textContent = tEnd;
		ddEl.append(t1, sep, t2);

		dl.append(dt("Time"), ddEl);
	} else {
		dl.append(dt("Time"), dd("â"));
	}

	// Also mirror session data onto the hidden #session entity if present
	const sessionEntity = $("#session-entity");
	if (sessionEntity) {
		ensureOrSetMeta(sessionEntity, "schema:startDate", date || null);
		ensureOrSetMeta(sessionEntity, "schema:startTime", tStart || null);
		ensureOrSetMeta(sessionEntity, "schema:endTime", tEnd || null);
	}
}

function ensureOrSetMeta(parent, prop, value) {
	// Finds an existing <meta property="prop"> and updates content, or creates/removes accordingly.
	let meta = parent.querySelector(`meta[property="${prop}"]`);
	if (!value) {
		if (meta) meta.remove();
		return;
	}

	/* Set eventStatus with a fully-qualified EventStatusType IRI */
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
	if (!meta) {
		meta = document.createElement("meta");
		meta.setAttribute("property", prop);
		parent.appendChild(meta);
	}
	meta.setAttribute("content", value);
}

/* ---------------- Render consent summary ---------------- */
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
		ddEl.innerHTML = ok ? '<span aria-label="consented">â</span>' : '<span aria-label="not consented">â</span>';
		dl.append(ddEl);
	}
}


/* ---------------- Timer controls ---------------- */
function updateTimerView() {
	const ms = sessionNowMs();
	$("#timer-display").textContent = msToHMS(ms);
	$("#timer-display").setAttribute("content", msToISODuration(ms)); // RDFa schema:duration
}

let sessionAbsStartIso = null; // absolute ISO when the session first starts

function startTimer() {
	// Ensure event marked as scheduled when starting
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


/* ---------------- Framework switching ---------------- */
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

/* ---------------- Editor formatting ---------------- */
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

/* ---------------- Notes ---------------- */
function beginNote() {
	pendingNoteStart = sessionNowMs();
	pendingNoteStartAbsIso = nowIsoUtc(); // absolute UTC at click
	$("#btn-save-note").disabled = false;
	const startedAt = msToHMS(pendingNoteStart);
	$("#note-timestamps").textContent = `Started at ${startedAt}`;
}

function saveNote() {
	if (pendingNoteStart == null) return;
	const savedAtMs = sessionNowMs();
	const startedAt = msToHMS(pendingNoteStart);
	const savedAt = msToHMS(savedAtMs);
	const delta = msToHMS(Math.max(0, savedAtMs - pendingNoteStart));
	const html = $("#note-editor").innerHTML.trim();
	const framework = $("#framework").value;
	const category = $("#note-kind").value;
	const participantId = $("#participant-select").value || null;

	const startIso = pendingNoteStartAbsIso || nowIsoUtc();
	const endIso = nowIsoUtc();

	const note = {
		id: crypto.randomUUID(),
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
	article.setAttribute("resource", `#note-${note.id}`);

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

	const metaP = document.createElement("p");
	metaP.className = "note-meta";
	metaP.textContent = `Timestamp: ${startedAt} â ${savedAt} (Î ${delta}) â¢ ${framework.toUpperCase()} â¢ ${category}`;

	const body = document.createElement("div");
	body.className = "note-body";
	body.setAttribute("property", "schema:text");
	body.innerHTML = html || "<em>(Empty note)</em>";

	article.append(metaStart, metaEnd, metaCreated, metaTempo, metaGenre, metaTechnique, metaAbout, metaP, body);
	li.append(article);
	ul.prepend(li);

	// Reset editor state
	pendingNoteStart = null;
	pendingNoteStartAbsIso = null;
	$("#note-timestamps").textContent = "";
	$("#note-editor").innerHTML = "";
	$("#btn-save-note").disabled = true;
}

/* ---------------- Wire events ---------------- */
function wireEvents() {
	$("#btn-start").addEventListener("click", startTimer);
	$("#btn-pause").addEventListener("click", pauseTimer);
	$("#btn-stop").addEventListener("click", stopTimer);

	$("#framework").addEventListener("change", (e) => setFramework(e.target.value));
	$("#btn-add-note").addEventListener("click", beginNote);
	$("#btn-save-note").addEventListener("click", saveNote);

	$("#participant-select").addEventListener("change", (e) => {
		const p = MOCK_PARTICIPANTS.find(x => x.id === e.target.value);
		if (!p) {
			$("#participant-details").innerHTML = "";
			$("#consent-summary").innerHTML = "";
			return;
		}
		renderParticipantDetails(p);
		renderConsentSummary(p);
	});
}

/* ---------------- Init ---------------- */
function init() {
	// Default status: EventScheduled (explicit)
	setEventStatus("https://schema.org/EventScheduled");
	populateParticipants(MOCK_PARTICIPANTS);
	setFramework("none");
	bindFormatting();
	wireEvents();
	updateTimerView();
}

document.addEventListener("DOMContentLoaded", init);