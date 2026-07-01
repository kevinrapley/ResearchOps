/**
 * @file /components/session-controller.js
 * @summary Controller for study session UI: participant picker, consents, timer, and notes.
 * @description
 * - Participant dropdown loaded from the ResearchOps API.
 * - Participant details with RDFa (schema.org) attributes.
 * - Consent summary with RDFa ItemList.
 * - Session controls (start/pause/stop) with visible hh:mm:ss timer + RDFa duration.
 * - Notes editor:
 *    • Note START time captured on the first meaningful keystroke (not focus/click).
 *    • Clearing all content resets the pending start.
 *    • Save posts to /api/session-notes and injects returned note id into
 *      RDFa: resource="#note-<recordId>".
 *    • Each note includes schema:startTime / schema:endTime (absolute ISO)
 *      and schema:temporalCoverage "<start>/<end>".
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
		headers: { "Content-Type": "application/json; charset=utf-8" },
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
	const response = await fetch(url, { cache: "no-store" });
	const text = await response.text();
	const body = text ? JSON.parse(text) : {};
	if (!response.ok) throw new Error(body?.message || body?.error || `Request failed (${response.status})`);
	return body;
}

function getStudyId() {
	const url = new URL(location.href);
	return url.searchParams.get("id") || url.searchParams.get("sid") || "";
}

function getSessionAirtableId() {
	const url = new URL(location.href);
	const q = url.searchParams.get("session");
	if (q) return q;
	const legacyStudySessionId = url.searchParams.get("sid");
	if (legacyStudySessionId) return legacyStudySessionId;
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
	$("#note-editor").innerHTML="";
}

/* -------------------------------------------------------------------------- */
/* Framework switching                                                        */
/* -------------------------------------------------------------------------- */
const AEIOU=[["activity","Activities"],["environment","Environments"],["interaction","Interactions"],["object","Objects"],["user","Users"]];
const POEMS=[["people","People"],["objects","Objects"],["environments","Environments"],["messages","Messages"],["services","Services"]];
function setFramework(k){
	const s=$("#note-kind");
	s.innerHTML="";
	let items=[];
	if(k==="aeiou") items=AEIOU;
	else if(k==="poems") items=POEMS;
	else items=[["idea","Ideas/Notes"],["quote","Quote"],["observation","Observation"]];
	for(const[v,l]of items){
		const o=document.createElement("option");
		o.value=v;o.textContent=l;
		s.appendChild(o);
	}
}

/* -------------------------------------------------------------------------- */
/* Editor behaviour: start note on first meaningful keystroke                 */
/* -------------------------------------------------------------------------- */
function editorHasMeaningfulText(){return($("#note-editor").textContent||"").trim().length>0;}
function resetDraftNote(){noteStartMs=null;noteStartIso=null;$("#note-timestamps").textContent="";$("#btn-save-note").disabled=true;}
function onEditorInput(){
	if(!editorHasMeaningfulText()){
		resetDraftNote();
		return;
	}
	if(noteStartMs==null){
		noteStartMs=sessionNowMs();
		noteStartIso=nowIsoUtc();
		$("#btn-save-note").disabled=false;
		$("#note-timestamps").textContent=`Started at ${msToHMS(noteStartMs)}`;
	}
}

/* -------------------------------------------------------------------------- */
/* Save note                                                                  */
/* -------------------------------------------------------------------------- */
async function saveNote(){
	if(noteStartMs==null||!editorHasMeaningfulText()){
		announce("Type in the editor to start a note before saving.");
		return;
	}
	const savedAtMs=sessionNowMs();
	const startedAt=msToHMS(noteStartMs);
	const savedAt=msToHMS(savedAtMs);
	const delta=msToHMS(Math.max(0,savedAtMs-noteStartMs));
	const html=$("#note-editor").innerHTML.trim();
	const framework=$("#framework").value;
	const category=$("#note-kind").value;
	const participantId=participantIdForNote(currentParticipant)||null;
	const startIso=noteStartIso||nowIsoUtc();
	const endIso=nowIsoUtc();
	const sessionId=getSessionAirtableId();
	if(!sessionId){ announce("Missing session id. Unable to save note."); return; }

	const payload={
		session_airtable_id:sessionId,
		participant_airtable_id:participantId||undefined,
		framework:framework?.toUpperCase?.()==="NONE"?"none":framework,
		category,
		start_iso:startIso,
		end_iso:endIso,
		start_offset_ms:noteStartMs,
		end_offset_ms:savedAtMs,
		content_html:html
	};

	let createdId=null;
	try{
		const res=await postJson("/api/session-notes",payload);
		if(!res?.ok) throw new Error(res?.error||"Unknown error");
		createdId=res.id||res.note?.id||null;
		announce("Note saved.");
	}catch(e){
		console.error("session-note.save.fail",e);
		announce("Failed to save the note.");
		return;
	}

	const note={id:createdId||crypto.randomUUID(),participantId,framework,category,startedAtMs:noteStartMs,savedAtMs,startIso,endIso,contentHtml:html};
	notes.push(note);

	// Render saved note (RDFa)
	const ul=$("#notes-list");
	const savedNotesSection=$("#saved-notes-section");
	if(savedNotesSection) savedNotesSection.hidden=false;
	const li=document.createElement("li");
	li.setAttribute("property","schema:itemListElement");
	li.setAttribute("typeof","schema:ListItem");
	const article=document.createElement("article");
	article.setAttribute("typeof","schema:CreativeWork");
	article.setAttribute("resource",`#note-${note.id}`);
	article.innerHTML=`
		<meta property="schema:startTime" content="${note.startIso}">
		<meta property="schema:endTime" content="${note.endIso}">
		<meta property="schema:dateCreated" content="${nowIsoUtc()}">
		<meta property="schema:temporalCoverage" content="${note.startIso}/${note.endIso}">
		<meta property="schema:genre" content="${category}">
		<meta property="schema:measurementTechnique" content="${framework}">
		<meta property="schema:about" resource="#participant">
		<p class="note-meta">Timestamp: ${startedAt} – ${savedAt} (Δ ${delta}) • ${framework.toUpperCase()} • ${category} <small class="note-id">#${createdId||note.id}</small></p>
		<div class="note-body" property="schema:text">${html||"<em>(Empty note)</em>"}</div>`;
	li.append(article);
	ul.prepend(li);

	// Ready for the next note
	resetDraftNote();
	$("#note-editor").innerHTML="";
}

function announce(t){ $("#note-timestamps").textContent=t; }

/* -------------------------------------------------------------------------- */
/* Wire events                                                                */
/* -------------------------------------------------------------------------- */
function wireEvents(){
	$("#btn-start").addEventListener("click",startTimer);
	$("#btn-pause").addEventListener("click",pauseTimer);
	$("#btn-stop").addEventListener("click",stopTimer);
	$("#framework").addEventListener("change",(e)=>setFramework(e.target.value));
	$("#btn-save-note").addEventListener("click",saveNote);
	$("#note-editor").addEventListener("input",onEditorInput);
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
	setFramework("none");
	wireEvents();
	if (state.participants.length) resetDraftNote();
	updateTimerView();
}
document.addEventListener("DOMContentLoaded",init);
