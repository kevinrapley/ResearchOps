/**
 * @file /components/session-controller.js
 * @summary Controller for study session UI: participant picker, consents, timer, and fieldnotes.
 * @description
 * - Participant dropdown loaded from the ResearchOps API.
 * - Participant details with RDFa (schema.org) attributes.
 * - Consent summary with RDFa ItemList.
 * - Session controls (start/pause/stop) with visible hh:mm:ss timer + RDFa duration.
 * - Fieldnotes ambient capture:
 *    • Note START time captured on the first meaningful keystroke (not focus/click).
 *    • Enter saves the note; Shift+Enter inserts a new line.
 *    • Shorthand prefixes (per framework) set the note category as you type,
 *      for example "q " for a quote in the Fieldnotes framework.
 *    • #tags and @refs are parsed from the note text and become clickable filters.
 *    • Save posts to /api/session-notes and injects returned note id into
 *      RDFa: resource="#note-<recordId>".
 *    • Saved notes stream renders newest first with category filters, search
 *      and a Markdown export.
 */

const $  = (s, r = document) => r.querySelector(s);

const API_ORIGIN =
	document.documentElement?.dataset?.apiOrigin ||
	window.API_ORIGIN ||
	window.RESEARCHOPS_API_ORIGIN ||
	(location.hostname.endsWith("pages.dev") ?
		"https://rops-api.digikev-kevin-rapley.workers.dev" :
		location.origin);

const state = {
	studyId: "",
	participants: []
};

/* -------------------------------------------------------------------------- */
/* State                                                                      */
/* -------------------------------------------------------------------------- */
let timerInterval = null;
let baseStart = null;
let elapsedMs = 0;
let isRunning = false;

let noteStartMs = null;
let noteStartIso = null;
let sessionAbsStartIso = null;

let currentParticipant = null;
const notes = [];
let activeFramework = "fieldnotes";
let activeCategoryFilter = null;

/* -------------------------------------------------------------------------- */
/* Utilities                                                                  */
/* -------------------------------------------------------------------------- */
const pad2 = (n) => String(n).padStart(2, "0");
const nowMs = () => Date.now();
const nowIsoUtc = () => new Date().toISOString();
const sessionNowMs = () => (isRunning ? (elapsedMs + (nowMs() - baseStart)) : elapsedMs);

function msToHMS(ms) {
	const total = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

function msToISODuration(ms) {
	const total = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	return `PT${h}H${m}M${s}S`;
}

async function postJson(url, body) {
	const res = await fetch(url, {
		method: "POST",
		cache: "no-store",
		credentials: "include",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json; charset=utf-8"
		},
		body: JSON.stringify(body)
	});
	const txt = await res.text();
	let js;
	try { js = JSON.parse(txt); } catch { js = null; }
	if (!res.ok || !js) throw new Error(js?.error || `HTTP ${res.status}: ${txt.slice(0,200)}`);
	return js;
}

function apiUrl(path) {
	const p = String(path || "");
	return `${API_ORIGIN}${p.startsWith("/") ? p : "/" + p}`;
}

async function jsonFetch(url) {
	const response = await fetch(url, {
		cache: "no-store",
		credentials: "include",
		headers: { Accept: "application/json" }
	});
	const text = await response.text();
	const body = text ? JSON.parse(text) : {};
	if (!response.ok) throw new Error(body?.message || body?.error || `Request failed (${response.status})`);
	return body;
}

function getStudyId() {
	const url = new URL(location.href);
	return url.searchParams.get("id") || "";
}

function getProjectId() {
	const url = new URL(location.href);
	return url.searchParams.get("project") || "";
}

function getSessionAirtableId() {
	const url = new URL(location.href);
	const q = url.searchParams.get("session");
	if (q) return q;
	const sess = $("#session-entity");
	const m = sess?.querySelector('meta[property="schema:identifier"]');
	return m?.content?.trim() || null;
}

/* -------------------------------------------------------------------------- */
/* RDFa helpers (now SAFE if #session-entity is missing)                      */
/* -------------------------------------------------------------------------- */
function clearChildren(el){while(el?.firstChild)el.removeChild(el.firstChild);}

function summaryRow(term, value, rdfa = {}) {
	const row = document.createElement("div");
	row.className = "govuk-summary-list__row";
	const key = document.createElement("dt");
	key.className = "govuk-summary-list__key";
	key.textContent = term;
	const val = document.createElement("dd");
	val.className = "govuk-summary-list__value";
	if (value instanceof Node || value instanceof DocumentFragment) val.append(value);
	else if (value != null) val.textContent = value;
	for (const [k, v] of Object.entries(rdfa)) {
		if (v != null && v !== false) val.setAttribute(k, String(v));
	}
	row.append(key, val);
	return row;
}

/**
 * Ensure or set a <meta property="..."> under parent.
 * If parent is null/undefined, this becomes a no-op.
 */
function ensureOrSetMeta(parent, prop, value){
	if (!parent) return; // <- SAFETY: parent may be null if #session-entity is absent
	let m = parent.querySelector(`meta[property="${prop}"]`);
	if (!value){ m?.remove(); return; }
	if (!m){
		m = document.createElement("meta");
		m.setAttribute("property", prop);
		parent.appendChild(m);
	}
	m.setAttribute("content", value);
}

/**
 * Set schema:eventStatus on #session-entity if present.
 */
function setEventStatus(iri){
	const s = $("#session-entity");
	if (!s) return; // safe no-op
	let m = s.querySelector('meta[property="schema:eventStatus"]');
	if (!iri){ m?.remove(); return; }
	if (!m){
		m = document.createElement("meta");
		m.setAttribute("property","schema:eventStatus");
		s.appendChild(m);
	}
	m.setAttribute("content", iri);
}

function setSessionError(message, href = "#participant-select") {
	const summary = $("#session-error-summary");
	const item = summary?.querySelector(".govuk-error-summary__list a");
	if (!summary || !item) return;
	item.textContent = message;
	item.setAttribute("href", href);
	summary.hidden = false;
	summary.removeAttribute("aria-hidden");
	summary.focus?.();
}

function clearSessionError() {
	const summary = $("#session-error-summary");
	if (!summary) return;
	summary.hidden = true;
	summary.setAttribute("aria-hidden", "true");
}

/* -------------------------------------------------------------------------- */
/* Breadcrumbs: hydrate project and study context                             */
/* -------------------------------------------------------------------------- */
async function hydrateBreadcrumbs(studyId, projectId) {
	const projectCrumb = $("#breadcrumb-project");
	const studyCrumb = $("#breadcrumb-study");
	if (!studyId || (!projectCrumb && !studyCrumb)) return;

	let study = null;
	try {
		const url = new URL(apiUrl("/api/studies"), window.location.origin);
		url.searchParams.set("id", studyId);
		const body = await jsonFetch(url.toString());
		const studies = Array.isArray(body?.studies) ? body.studies : [];
		study = body?.study || studies.find((item) => item?.id === studyId || item?.recordId === studyId || item?.airtableId === studyId) || null;
	} catch (error) {
		console.warn("session.breadcrumbs.study.fail", error);
	}
	const resolvedProjectId = projectId || study?.projectId || (Array.isArray(study?.projectIds) ? study.projectIds[0] : "") || "";

	if (studyCrumb) {
		const title = String(study?.title || study?.Title || "").trim();
		if (title) studyCrumb.textContent = title;
		const studyUrl = new URL("/pages/study/", location.origin);
		studyUrl.searchParams.set("id", studyId);
		if (resolvedProjectId) studyUrl.searchParams.set("project", resolvedProjectId);
		studyCrumb.href = `${studyUrl.pathname}${studyUrl.search}`;
	}

	if (projectCrumb && resolvedProjectId) {
		try {
			const body = await jsonFetch(apiUrl(`/api/projects/${encodeURIComponent(resolvedProjectId)}`));
			const project = body?.project || body || {};
			const name = String(project.name || project.Name || project.title || "").trim();
			if (name) projectCrumb.textContent = name;
		} catch (error) {
			console.warn("session.breadcrumbs.project.fail", error);
		}
		const projectUrl = new URL("/pages/project-dashboard/", location.origin);
		projectUrl.searchParams.set("id", resolvedProjectId);
		projectCrumb.href = `${projectUrl.pathname}${projectUrl.search}`;
	}

	// Mirror the study title into the page caption.
	const caption = $("#study-title");
	const captionTitle = String(study?.title || study?.Title || "").trim();
	if (caption && captionTitle) caption.textContent = captionTitle;
}

/* -------------------------------------------------------------------------- */
/* Participant UI                                                             */
/* -------------------------------------------------------------------------- */
function participantIdForNote(p) {
	return p?.airtableId || p?.id || "";
}

function mapApiParticipant(record) {
	const id = String(record.id || record.participant_id || record.participant_airtable_id || "").trim();
	const pseudonym = String(record.participant_ref || record.pseudonym || record.display_name || id || "Participant").trim();
	const name = String(record.display_name || record.name || record.participant_ref || pseudonym).trim();
	const status = String(record.status || "").trim();
	const channel = String(record.channel_pref || "").trim();
	const userType = [status, channel].filter(Boolean).join(" - ") || "Participant";
	const session = record.session && typeof record.session === "object" ? record.session : {};

	return {
		id,
		airtableId: String(record.session_participant_id || record.participant_airtable_id || record.airtableId || id).trim(),
		pseudonym,
		name,
		userType,
		session,
		consents: record.consents && typeof record.consents === "object" ? record.consents : {},
		accessNeeds: String(record.access_needs || "").trim()
	};
}

async function loadParticipantsForStudy(studyId) {
	if (!studyId) return [];
	const url = new URL(apiUrl("/api/participants"));
	url.searchParams.set("study", studyId);
	const body = await jsonFetch(url.toString());
	return Array.isArray(body.participants) ? body.participants.map(mapApiParticipant).filter(participant => participant.id) : [];
}

function populateParticipants(list){
	const sel=$("#participant-select");
	if (!sel) return;
	while (sel.options.length > 1) sel.remove(1);
	list.forEach(p=>{
		const o=document.createElement("option");
		o.value=p.id;o.textContent=`${p.pseudonym} - ${p.name}`;
		o.dataset.airtableId=p.airtableId||"";
		sel.appendChild(o);
	});
}
function renderParticipantDetails(p){
	const dl=$("#participant-details");clearChildren(dl);
	dl.append(summaryRow("Pseudonym",p.pseudonym,{"property":"schema:alternateName"}));
	dl.append(summaryRow("Name",p.name,{"property":"schema:name"}));
	dl.append(summaryRow("User type",p.userType,{"property":"schema:additionalType"}));
	const date=p.session?.date||"";
	if(date){
		const human=new Date(date+"T00:00:00Z");
		const text=human.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"});
		dl.append(summaryRow("Date",text,{"about":"#session","property":"schema:startDate","content":date}));
	}else{
		dl.append(summaryRow("Date","-"));
	}
	const tStart=p.session?.start||"",tEnd=p.session?.end||"";
	if(tStart&&tEnd){
		const fragment=document.createDocumentFragment();
		const t1=document.createElement("time");
		t1.setAttribute("property","schema:startTime");
		t1.setAttribute("datetime",tStart);
		t1.textContent=tStart;
		const sep=document.createTextNode("-");
		const t2=document.createElement("time");
		t2.setAttribute("property","schema:endTime");
		t2.setAttribute("datetime",tEnd);
		t2.textContent=tEnd;
		fragment.append(t1,sep,t2);
		dl.append(summaryRow("Time",fragment,{"about":"#session"}));
	}else{
		dl.append(summaryRow("Time","-"));
	}

	// Mirror onto #session-entity if present
	const sessionEntity = $("#session-entity");
	ensureOrSetMeta(sessionEntity, "schema:startDate", date || null);
	ensureOrSetMeta(sessionEntity, "schema:startTime", tStart || null);
	ensureOrSetMeta(sessionEntity, "schema:endTime",   tEnd || null);
}

function renderConsentSummary(p){
	const dl=$("#consent-summary");clearChildren(dl);
	const labels={observers:"Observers",noteTakers:"Note-takers",recordVideo:"Record video",recordAudio:"Record audio",transcription:"Transcription",videoOn:"Video on"};
	for(const[k,l]of Object.entries(labels)){
		if(!(p.consents&&k in p.consents)) continue;
		const ok=!!p.consents[k];
		const value=document.createElement("span");
		value.setAttribute("aria-label",ok?"consented":"not consented");
		value.textContent=ok?"Yes":"No";
		dl.append(summaryRow(l,value,{"property":"schema:acceptedAnswer","content":String(ok)}));
	}
}

/* -------------------------------------------------------------------------- */
/* Timer controls                                                             */
/* -------------------------------------------------------------------------- */
function updateTimerView(){
	const ms=sessionNowMs();
	$("#timer-display").textContent=msToHMS(ms);
	$("#timer-display").setAttribute("content",msToISODuration(ms)); // RDFa schema:duration
}
function startTimer(){
	setEventStatus("https://schema.org/EventScheduled");
	if(isRunning) return;
	isRunning=true;baseStart=nowMs();

	if(!sessionAbsStartIso){
		sessionAbsStartIso=nowIsoUtc();
		const d=new Date(sessionAbsStartIso);
		const dateOnly=`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
		const sess=$("#session-entity");
		ensureOrSetMeta(sess,"schema:startDate",dateOnly);
		ensureOrSetMeta(sess,"schema:startTime",sessionAbsStartIso);
	}

	$("#btn-start").disabled=true;
	$("#btn-pause").disabled=false;
	$("#btn-stop").disabled=false;
	timerInterval=setInterval(updateTimerView,250);
}
function pauseTimer(){
	if(!isRunning) return;
	elapsedMs=sessionNowMs();
	isRunning=false;
	clearInterval(timerInterval);
	updateTimerView();
	$("#btn-start").disabled=false;
	$("#btn-pause").disabled=true;
}
function stopTimer(){
	isRunning=false;
	clearInterval(timerInterval);

	const sess=$("#session-entity");
	ensureOrSetMeta(sess,"schema:endTime",nowIsoUtc());

	elapsedMs=0;baseStart=null;
	updateTimerView();
	$("#btn-start").disabled=false;
	$("#btn-pause").disabled=true;
	$("#btn-stop").disabled=true;

	resetDraftNote();
	const input=$("#note-input");
	if(input) input.value="";
}

/* -------------------------------------------------------------------------- */
/* Note frameworks                                                            */
/* -------------------------------------------------------------------------- */
// Each category: [value, label, govuk-tag colour class, shorthand prefix].
// Fieldnotes is the base note vocabulary; AEIOU and POEMS build upon it, so
// their shortcuts sit alongside the Fieldnotes shortcuts rather than
// replacing them. Prefixes are unique within each combined set ("in" and
// "pe" avoid clashes with the Fieldnotes "i" and "p").
const FIELDNOTES_CATEGORIES = [
	["observation", "Observation", "govuk-tag--grey", ""],
	["quote", "Quote", "govuk-tag--red", "q"],
	["insight", "Insight", "govuk-tag--green", "i"],
	["pain", "Pain point", "govuk-tag--orange", "p"],
	["question", "Question", "govuk-tag--blue", "?"],
	["follow-up", "Follow-up", "govuk-tag--yellow", "t"]
];

const FRAMEWORKS = {
	fieldnotes: {
		label: "Fieldnotes",
		categories: [...FIELDNOTES_CATEGORIES]
	},
	aeiou: {
		label: "AEIOU",
		categories: [
			...FIELDNOTES_CATEGORIES,
			["activity", "Activities", "govuk-tag--turquoise", "a"],
			["environment", "Environments", "govuk-tag--light-blue", "e"],
			["interaction", "Interactions", "govuk-tag--purple", "in"],
			["object", "Objects", "govuk-tag--pink", "o"],
			["user", "Users", "govuk-tag--grey", "u"]
		]
	},
	poems: {
		label: "POEMS",
		categories: [
			...FIELDNOTES_CATEGORIES,
			["people", "People", "govuk-tag--turquoise", "pe"],
			["objects", "Objects", "govuk-tag--pink", "o"],
			["environments", "Environments", "govuk-tag--light-blue", "e"],
			["messages", "Messages", "govuk-tag--purple", "m"],
			["services", "Services", "govuk-tag--grey", "s"]
		]
	}
};

// Category lookup across every framework so saved notes keep their tag colour
// and label even after the framework select changes.
const CATEGORY_INDEX = {};
for (const framework of Object.values(FRAMEWORKS)) {
	for (const [value, label, tagClass] of framework.categories) {
		if (!CATEGORY_INDEX[value]) CATEGORY_INDEX[value] = { label, tagClass };
	}
}

function frameworkDef() {
	return FRAMEWORKS[activeFramework] || FRAMEWORKS.fieldnotes;
}

function categoryMeta(value) {
	return CATEGORY_INDEX[value] || { label: value || "Note", tagClass: "govuk-tag--grey" };
}

function setFramework(key) {
	activeFramework = FRAMEWORKS[key] ? key : "fieldnotes";
	const def = frameworkDef();

	const select = $("#note-kind");
	if (select) {
		select.innerHTML = "";
		for (const [value, label] of def.categories) {
			const option = document.createElement("option");
			option.value = value;
			option.textContent = label;
			select.appendChild(option);
		}
	}

	const shortcuts = $("#note-shortcuts");
	if (shortcuts) {
		shortcuts.innerHTML = "";
		const parts = def.categories.filter(([, , , prefix]) => prefix);
		parts.forEach(([, label, , prefix], index) => {
			if (index) shortcuts.append(" · ");
			const code = document.createElement("code");
			code.textContent = prefix;
			shortcuts.append(code, ` ${label.toLowerCase()}`);
		});
	}

	activeCategoryFilter = null;
	renderNoteFilters();
	renderNotes();
}

/* -------------------------------------------------------------------------- */
/* Fieldnotes capture: start note on first meaningful keystroke               */
/* -------------------------------------------------------------------------- */
function noteInputValue(){return $("#note-input")?.value||"";}
function editorHasMeaningfulText(){return noteInputValue().trim().length>0;}
function resetDraftNote(){noteStartMs=null;noteStartIso=null;$("#note-timestamps").textContent="";$("#btn-save-note").disabled=true;}

function prefixPattern(prefix) {
	const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`^${escaped}[:\\s]\\s*`, "i");
}

function parseNote(raw) {
	let text = String(raw || "").trim();
	let category = $("#note-kind")?.value || frameworkDef().categories[0][0];
	for (const [value, , , prefix] of frameworkDef().categories) {
		if (!prefix) continue;
		const pattern = prefixPattern(prefix);
		if (pattern.test(text)) {
			category = value;
			text = text.replace(pattern, "");
			break;
		}
	}
	const tags = [...text.matchAll(/#([\w-]+)/g)].map((m) => `#${m[1]}`);
	const refs = [...text.matchAll(/@([\w-]+)/g)].map((m) => `@${m[1]}`);
	return { text, category, tags: [...tags, ...refs] };
}

function syncCategoryFromPrefix() {
	const value = noteInputValue();
	for (const [category, , , prefix] of frameworkDef().categories) {
		if (!prefix) continue;
		if (prefixPattern(prefix).test(value.trimStart())) {
			const select = $("#note-kind");
			if (select) select.value = category;
			return;
		}
	}
}

function onEditorInput(){
	if(!editorHasMeaningfulText()){
		resetDraftNote();
		return;
	}
	syncCategoryFromPrefix();
	if(noteStartMs==null){
		noteStartMs=sessionNowMs();
		noteStartIso=nowIsoUtc();
		$("#btn-save-note").disabled=false;
		$("#note-timestamps").textContent=`Started at ${msToHMS(noteStartMs)}`;
	}
}

function onEditorKeydown(event){
	if(event.key==="Enter"&&!event.shiftKey){
		event.preventDefault();
		saveNote();
	}
}

/* -------------------------------------------------------------------------- */
/* Save note                                                                  */
/* -------------------------------------------------------------------------- */
async function saveNote(){
	if(noteStartMs==null||!editorHasMeaningfulText()){
		announce("Type a note to start capturing before saving.");
		return;
	}
	const savedAtMs=sessionNowMs();
	const parsed=parseNote(noteInputValue());
	if(!parsed.text){
		announce("A note needs some text after its shorthand prefix.");
		return;
	}
	const participantId=participantIdForNote(currentParticipant)||null;
	const startIso=noteStartIso||nowIsoUtc();
	const endIso=nowIsoUtc();
	// Ambient capture works without a scheduled session record: fall back to a
	// per-study session key so notes still group together.
	const sessionId=getSessionAirtableId()||`study-${state.studyId}`;

	const payload={
		// Worker contract (infra/cloudflare/src/service/session-notes.js)
		session_airtable_id:sessionId,
		participant_airtable_id:participantId||undefined,
		framework:activeFramework,
		category:parsed.category,
		start_iso:startIso,
		end_iso:endIso,
		start_offset_ms:noteStartMs,
		end_offset_ms:savedAtMs,
		content_html:escapeHtml(parsed.text),
		content_plain:parsed.text,
		// Fieldnotes shape (local preview server and future Worker support)
		studyId:state.studyId,
		sessionId,
		participantId:participantId||undefined,
		text:parsed.text,
		tags:parsed.tags,
		startIso,
		endIso,
		startOffsetMs:noteStartMs,
		endOffsetMs:savedAtMs
	};

	let created=null;
	try{
		const res=await postJson(apiUrl("/api/session-notes"),payload);
		if(!res?.ok) throw new Error(res?.error||"Unknown error");
		created=res.note||{id:res.id};
		announce("Note saved.");
	}catch(e){
		console.error("session-note.save.fail",e);
		announce("Failed to save the note.");
		return;
	}

	notes.push({
		id:created.id||crypto.randomUUID(),
		participantId,
		framework:activeFramework,
		category:parsed.category,
		text:parsed.text,
		tags:parsed.tags,
		startIso,
		endIso,
		startOffsetMs:noteStartMs,
		endOffsetMs:savedAtMs,
		createdAt:created.createdAt||endIso
	});

	renderNotes();

	// Ready for the next note: clear the draft and reset the category to the
	// framework default so a prefix only ever applies to its own note.
	resetDraftNote();
	const input=$("#note-input");
	if(input){input.value="";input.focus();}
	const kind=$("#note-kind");
	if(kind) kind.value=frameworkDef().categories[0][0];
	announce("Note saved.");
}

function announce(t){ $("#note-timestamps").textContent=t; }

function escapeHtml(value){
	return String(value||"").replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

function stripHtml(value){
	const div=document.createElement("div");
	div.innerHTML=String(value||"");
	return div.textContent||"";
}

// Normalise a note from either the Worker contract or the Fieldnotes shape.
function mapApiNote(record){
	const text=String(record.text||record.content_plain||stripHtml(record.content_html||record.contentHtml)||"").trim();
	const tags=Array.isArray(record.tags)&&record.tags.length
		?record.tags
		:[...text.matchAll(/([#@][\w-]+)/g)].map((m)=>m[1]);
	return {
		id:record.id,
		participantId:record.participantId||record.participant_id||null,
		framework:record.framework||"fieldnotes",
		category:record.category||"observation",
		text,
		tags,
		startIso:record.startIso||record.start_iso||null,
		endIso:record.endIso||record.end_iso||null,
		startOffsetMs:typeof record.startOffsetMs==="number"?record.startOffsetMs:record.start_offset_ms,
		endOffsetMs:typeof record.endOffsetMs==="number"?record.endOffsetMs:record.end_offset_ms,
		createdAt:record.createdAt||record.created_at||record.endIso||record.end_iso||null
	};
}

/* -------------------------------------------------------------------------- */
/* Notes stream: filters, search, render, delete, export                      */
/* -------------------------------------------------------------------------- */
async function loadNotes(){
	if(!state.studyId) return;
	try{
		const url=new URL(apiUrl("/api/session-notes"));
		// The Worker lists by session; the local preview server lists by study.
		url.searchParams.set("study",state.studyId);
		url.searchParams.set("session",getSessionAirtableId()||`study-${state.studyId}`);
		const body=await jsonFetch(url.toString());
		const loaded=Array.isArray(body.notes)?body.notes.map(mapApiNote).filter((note)=>note.id&&note.text):[];
		notes.splice(0,notes.length,...loaded);
	}catch(error){
		console.warn("session-notes.load.fail",error);
	}
	renderNotes();
}

function visibleNotes(){
	return notes.filter((note)=>!activeCategoryFilter||note.category===activeCategoryFilter);
}

function noteSortKey(note){
	// endIso has millisecond precision; createdAt from the API only has seconds.
	return note.endIso||note.createdAt||note.startIso||"";
}

function renderNoteFilters(){
	const wrap=$("#note-filters");
	if(!wrap) return;
	wrap.innerHTML="";
	for(const [value,label,tagClass] of frameworkDef().categories){
		const button=document.createElement("button");
		button.type="button";
		button.className="study-session-filter";
		button.dataset.category=value;
		button.setAttribute("aria-pressed",String(activeCategoryFilter===value));
		const tag=document.createElement("strong");
		tag.className=`govuk-tag ${tagClass}`;
		tag.textContent=label;
		button.append(tag);
		button.addEventListener("click",()=>{
			activeCategoryFilter=activeCategoryFilter===value?null:value;
			renderNoteFilters();
			renderNotes();
		});
		wrap.append(button);
	}
}

function decorateNoteText(container,text){
	const pattern=/([#@][\w-]+)/g;
	let lastIndex=0;
	for(const match of String(text||"").matchAll(pattern)){
		if(match.index>lastIndex) container.append(text.slice(lastIndex,match.index));
		const token=document.createElement("span");
		token.className=`study-session-note__token${match[1].startsWith("@")?" study-session-note__token--ref":""}`;
		token.textContent=match[1];
		container.append(token);
		lastIndex=match.index+match[1].length;
	}
	if(lastIndex<String(text||"").length) container.append(text.slice(lastIndex));
}

function renderNoteItem(note){
	const meta=categoryMeta(note.category);
	const li=document.createElement("li");
	li.setAttribute("property","schema:itemListElement");
	li.setAttribute("typeof","schema:ListItem");

	const article=document.createElement("article");
	article.setAttribute("typeof","schema:CreativeWork");
	article.setAttribute("resource",`#note-${note.id}`);

	for(const [prop,content] of [
		["schema:startTime",note.startIso],
		["schema:endTime",note.endIso],
		["schema:dateCreated",note.createdAt],
		["schema:temporalCoverage",note.startIso&&note.endIso?`${note.startIso}/${note.endIso}`:null],
		["schema:genre",note.category],
		["schema:measurementTechnique",note.framework]
	]){
		if(!content) continue;
		const m=document.createElement("meta");
		m.setAttribute("property",prop);
		m.setAttribute("content",content);
		article.append(m);
	}

	const metaRow=document.createElement("p");
	metaRow.className="study-session-note__meta";

	const time=document.createElement("span");
	time.className="study-session-note__time";
	if(typeof note.startOffsetMs==="number"){
		time.textContent=msToHMS(note.startOffsetMs);
		time.title="Session offset when the note began";
	}else if(note.createdAt){
		time.textContent=new Date(note.createdAt).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});
	}else{
		time.textContent="—";
	}

	const tag=document.createElement("strong");
	tag.className=`govuk-tag ${meta.tagClass}`;
	tag.textContent=meta.label;

	const del=document.createElement("button");
	del.type="button";
	del.className="govuk-link study-session-note__delete";
	del.textContent="Delete";
	del.setAttribute("aria-label",`Delete ${meta.label.toLowerCase()} note`);
	del.addEventListener("click",()=>deleteNote(note.id));

	metaRow.append(time,tag,del);

	const text=document.createElement("div");
	text.className=`study-session-note__text govuk-body${note.category==="quote"?" study-session-note__text--quote":""}`;
	text.setAttribute("property","schema:text");
	decorateNoteText(text,note.text);

	article.append(metaRow,text);
	li.append(article);
	return li;
}

function renderNotes(){
	const list=$("#notes-list");
	const section=$("#saved-notes-section");
	const count=$("#notes-count");
	if(!list) return;

	const visible=visibleNotes().sort((a,b)=>noteSortKey(b).localeCompare(noteSortKey(a)));
	list.innerHTML="";
	for(const note of visible) list.append(renderNoteItem(note));

	if(section) section.hidden=notes.length===0;
	if(count){
		count.textContent=notes.length===0
			?""
			:`Showing ${visible.length} of ${notes.length} note${notes.length===1?"":"s"}`;
	}
}

async function deleteNote(noteId){
	const endpoint=apiUrl(`/api/session-notes/${encodeURIComponent(noteId)}`);
	let deleted=false;
	try{
		const res=await fetch(endpoint,{
			method:"DELETE",
			cache:"no-store",
			credentials:"include",
			headers:{Accept:"application/json"}
		});
		const body=await res.json().catch(()=>null);
		deleted=res.ok&&body?.ok===true;
	}catch{
		deleted=false;
	}
	if(!deleted){
		// The Worker has no DELETE route: soft-delete via PATCH instead.
		try{
			const res=await fetch(endpoint,{
				method:"PATCH",
				cache:"no-store",
				credentials:"include",
				headers:{Accept:"application/json","Content-Type":"application/json; charset=utf-8"},
				body:JSON.stringify({active:false})
			});
			const body=await res.json().catch(()=>null);
			deleted=res.ok&&body?.ok===true;
		}catch{
			deleted=false;
		}
	}
	if(!deleted){
		announce("Failed to delete the note.");
		return;
	}
	const index=notes.findIndex((note)=>note.id===noteId);
	if(index>=0) notes.splice(index,1);
	renderNotes();
	announce("Note deleted.");
}

function exportNotes(){
	const visible=visibleNotes().sort((a,b)=>noteSortKey(a).localeCompare(noteSortKey(b)));
	if(!visible.length){
		announce("There are no notes to export.");
		return;
	}
	let markdown=`# Session notes — ${state.studyId}\n\n`;
	for(const note of visible){
		const meta=categoryMeta(note.category);
		const stamp=typeof note.startOffsetMs==="number"
			?msToHMS(note.startOffsetMs)
			:(note.createdAt?new Date(note.createdAt).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}):"—");
		const text=note.category==="quote"?`“${note.text}”`:note.text;
		markdown+=`- **${stamp}** · _${meta.label}_ — ${String(text).replace(/\n/g," ")}\n`;
	}
	const blob=new Blob([markdown],{type:"text/markdown"});
	const link=document.createElement("a");
	link.href=URL.createObjectURL(blob);
	link.download=`session-notes-${state.studyId}-${new Date().toISOString().slice(0,10)}.md`;
	link.click();
	URL.revokeObjectURL(link.href);
	announce(`Exported ${visible.length} note${visible.length===1?"":"s"} as Markdown.`);
}

/* -------------------------------------------------------------------------- */
/* Wire events                                                                */
/* -------------------------------------------------------------------------- */
function wireEvents(){
	$("#btn-start").addEventListener("click",startTimer);
	$("#btn-pause").addEventListener("click",pauseTimer);
	$("#btn-stop").addEventListener("click",stopTimer);
	$("#framework").addEventListener("change",(e)=>setFramework(e.target.value));
	$("#btn-save-note").addEventListener("click",saveNote);
	$("#note-input").addEventListener("input",onEditorInput);
	$("#note-input").addEventListener("keydown",onEditorKeydown);
	$("#btn-export-notes")?.addEventListener("click",exportNotes);
	$("#participant-select").addEventListener("change",(e)=>{
		const p=state.participants.find(x=>x.id===e.target.value);
		currentParticipant=p||null;
		if(!p){ $("#participant-details").innerHTML=""; $("#consent-summary").innerHTML=""; return; }
		renderParticipantDetails(p);
		renderConsentSummary(p);
	});
}

/* -------------------------------------------------------------------------- */
/* Init                                                                       */
/* -------------------------------------------------------------------------- */
async function init(){
	setEventStatus("https://schema.org/EventScheduled");
	state.studyId = getStudyId();
	hydrateBreadcrumbs(state.studyId, getProjectId());
	try {
		state.participants = await loadParticipantsForStudy(state.studyId);
		clearSessionError();
		populateParticipants(state.participants);
		if (!state.participants.length) {
			setSessionError(state.studyId ? "No participants are available for this study." : "Missing study id. Add ?id= to load participants.");
		}
	} catch (error) {
		console.error("participants.load.fail", error);
		setSessionError("Participants could not be loaded.");
		state.participants = [];
		populateParticipants(state.participants);
	}
	setFramework("fieldnotes");
	wireEvents();
	if (state.participants.length) resetDraftNote();
	updateTimerView();
	await loadNotes();
}
document.addEventListener("DOMContentLoaded",init);
