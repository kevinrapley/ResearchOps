/**
 * @file src/service/index.js
 * @module service
 * @summary Composed API service for ResearchOps Worker
 */

import { DEFAULTS } from "../core/constants.js";
import { BatchLogger } from "../core/logger.js";
import { json as jsonHelper } from "./internals/responders.js";

import * as Projects from "./projects.js";
import { listProjectsFromD1OrAirtable } from "./project-list-d1-airtable.js";
import * as Studies from "./studies.js";
import * as Guides from "./guides.js";
import * as ConsentForms from "./consent-forms.js";
import * as ParticipantConsent from "./participant-consent.js";
import * as Participants from "./participants.js";
import * as Sessions from "./sessions.js";
import * as Partials from "./partials.js";
import * as Comms from "./comms.js";
import * as Csv from "./csv.js";
import * as Synthesis from "./synthesis.js";

/* Reflexive Journals */
import * as Journals from "./journals.js";
import * as Excerpts from "./excerpts.js";
import * as Memos from "./memos.js";
import * as CodeApplications from "./reflection/code-applications.js";
import * as Codes from "./reflection/codes.js";
import * as Analysis from "./reflection/analysis.js";
import * as MuralJournalSync from "./mural-journal-sync-safe-tags.js";

/* Session Notes */
import * as SessionNotes from "./session-notes.js";

/* Integrations */
import { MuralServicePart } from "./internals/mural.js";

/* Diagnostics */
import * as Diag from "./dev/diag.js";

/* Impact Tracking */
import * as ImpactService from "./impact.js";
import { recordProvenanceEvent } from "./provenance.js";

/**
 * @typedef {Object} Env
 * @property {string} ALLOWED_ORIGINS
 * @property {string} AUDIT
 * @property {string} AIRTABLE_BASE_ID
 * @property {string} AIRTABLE_TABLE_PROJECTS
 * @property {string} AIRTABLE_TABLE_DETAILS
 * @property {string} AIRTABLE_TABLE_STUDIES
 * @property {string} AIRTABLE_TABLE_GUIDES
 * @property {string} AIRTABLE_TABLE_CONSENT_FORMS
 * @property {string} AIRTABLE_TABLE_PARTICIPANT_CONSENT
 * @property {string} AIRTABLE_TABLE_PARTIALS
 * @property {string} AIRTABLE_TABLE_PARTICIPANTS
 * @property {string} AIRTABLE_TABLE_SESSIONS
 * @property {string} AIRTABLE_TABLE_SESSION_NOTES
 * @property {string} AIRTABLE_TABLE_COMMSLOG
 * @property {string} AIRTABLE_API_KEY
 * @property {string} GH_OWNER
 * @property {string} GH_REPO
 * @property {string} GH_BRANCH
 * @property {string} GH_PATH_PROJECTS
 * @property {string} GH_PATH_DETAILS
 * @property {string} GH_PATH_STUDIES
 * @property {string} GH_TOKEN
 * @property {any}    ASSETS
 * @property {string} [MODEL]
 * @property {string} [AIRTABLE_TABLE_AI_LOG]
 * @property {string} [AIRTABLE_PROJECT_TEAM_NAME_FIELD]
 * @property {string} [AIRTABLE_PROJECT_TEAM_ID_FIELD]
 * @property {any}    AI
 * @property {KVNamespace} SESSION_KV
 * @property {D1Database} RESEARCHOPS_D1
 * @property {string} [MURAL_CLIENT_ID]
 * @property {string} [MURAL_CLIENT_SECRET]
 * @property {string} [MURAL_REDIRECT_URI]
 * @property {string} [MURAL_HOME_OFFICE_WORKSPACE_ID]
 * @property {string} [MURAL_API_BASE]
 * @property {string} [MURAL_REFLEXIVE_MURAL_ID]
 */

function corsHeaders(env, origin) {
	const allowed = (env.ALLOWED_ORIGINS || "")
		.split(",")
		.map(s => s.trim())
		.filter(Boolean);
	const h = {
		"Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type, Authorization",
		"Vary": "Origin"
	};
	if (origin && allowed.includes(origin)) h["Access-Control-Allow-Origin"] = origin;
	return h;
}

export class ResearchOpsService {
	/**
	 * @param {Env} env
	 * @param {{cfg?:Partial<typeof DEFAULTS>, logger?:BatchLogger}} [opts]
	 */
	constructor(env, opts = {}) {
		/** @type {Env} */
		this.env = env;
		/** @type {Readonly<typeof DEFAULTS>} */
		this.cfg = Object.freeze({ ...DEFAULTS, ...(opts.cfg || {}) });
		/** @type {BatchLogger} */
		this.log = opts.logger || new BatchLogger({ batchSize: this.cfg.LOG_BATCH_SIZE });
		/** @type {boolean} */
		this.destroyed = false;

		this.corsHeaders = (origin) => corsHeaders(this.env, origin);
		this.json = (body, status = 200, headers = {}) => jsonHelper(body, status, headers);
		this.mural = new MuralServicePart(this);
		this.mural.muralJournalSync = (req, origin) => MuralJournalSync.muralJournalSync(this, req, origin);

		/* Impact Tracking */
		this.listImpact = ImpactService.listImpact(this);
		this.createImpact = ImpactService.createImpact(this);

		/* Provenance Tracking */
		this.recordProvenance = (event) => recordProvenanceEvent(this, event);
	}

	reset() { this.log.reset(); }
	destroy() {
		if (!this.destroyed) {
			this.log.destroy();
			this.destroyed = true;
		}
	}

	/* ─────────────── Health ─────────────── */
	async health(origin) {
		return this.json({ ok: true, time: new Date().toISOString() }, 200, this.corsHeaders(origin));
	}

	/* ─────────────── Projects ─────────────── */
	listProjectsFromAirtable = (origin, url, authContext) => listProjectsFromD1OrAirtable(this, origin, url, authContext);
	createProjectInAirtable = (req, origin, authContext) => Projects.createProjectInAirtable(this, req, origin, authContext);
	getProjectById = (origin, projectId, authContext) => Projects.getProjectById(this, origin, projectId, authContext);
	updateProjectFraming = (req, origin, projectId, authContext) => Projects.updateProjectFraming(this, req, origin, projectId, authContext);

	/* ─────────────── Journal Entries ─────────────── */
	listJournalEntries = (origin, url) => Journals.listJournalEntries(this, origin, url);
	createJournalEntry = (req, origin) => Journals.createJournalEntry(this, req, origin);
	diagAirtableCreate = (req, origin) => Journals.diagAirtableCreate(this, req, origin);
	getJournalEntry = (origin, entryId) => Journals.getJournalEntry(this, origin, entryId);
	updateJournalEntry = (req, origin, entryId) => Journals.updateJournalEntry(this, req, origin, entryId);
	deleteJournalEntry = (origin, entryId) => Journals.deleteJournalEntry(this, origin, entryId);
	muralJournalSync = (req, origin) => MuralJournalSync.muralJournalSync(this, req, origin);

	/* ─────────────── Excerpts ─────────────── */
	listExcerpts = (origin, url) => Excerpts.listExcerpts(this, origin, url);
	createExcerpt = (req, origin) => Excerpts.createExcerpt(this, req, origin);
	updateExcerpt = (req, origin, excerptId) => Excerpts.updateExcerpt(this, req, origin, excerptId);

	/* ─────────────── Memos ─────────────── */
	listMemos = (origin, url) => Memos.listMemos(this, origin, url);
	createMemo = (req, origin) => Memos.createMemo(this, req, origin);
	updateMemo = (req, origin, memoId) => Memos.updateMemo(this, req, origin, memoId);

	/* ─────────────── Code Applications ─────────────── */
	listCodeApplications = (origin, url) => CodeApplications.listCodeApplications(this, origin, url);

	/* ─────────────── Codes ─────────────── */
	listCodes = (origin, url) => Codes.listCodes(this, origin, url);
	createCode = (req, origin) => Codes.createCode(this, req, origin);
	updateCode = (req, origin, codeId) => Codes.updateCode(this, req, origin, codeId);

	/* ─────────────── Analysis ─────────────── */
	timeline = (origin, url) => Analysis.timeline(this, origin, url);
	cooccurrence = (origin, url) => Analysis.cooccurrence(this, origin, url);
	retrieval = (origin, url) => Analysis.retrieval(this, origin, url);
	exportAnalysis = (origin, url) => Analysis.exportAnalysis(this, origin, url);

	/* ─────────────── CSV ─────────────── */
	streamCsv = (origin, path) => Csv.streamCsv(this, origin, path);
	githubCsvAppend = (args) => Csv.githubCsvAppend(this, args);

	/* ─────────────── Studies ─────────────── */
	createStudy = (req, origin) => Studies.createStudy(this, req, origin);
	listStudies = (origin, url) => Studies.listStudies(this, origin, url);
	updateStudy = (req, origin, studyId) => Studies.updateStudy(this, req, origin, studyId);

	/* ─────────────── Study synthesis ─────────────── */
	listSynthesisEvidence = (origin, url) => Synthesis.listSynthesisEvidence(this, origin, url);
	listSynthesis = (origin, url) => Synthesis.listSynthesis(this, origin, url);
	createSynthesisCluster = (req, origin, url) => Synthesis.createSynthesisCluster(this, req, origin, url);
	updateSynthesisCluster = (req, origin, url, clusterId) => Synthesis.updateSynthesisCluster(this, req, origin, url, clusterId);
	deleteSynthesisCluster = (origin, url, clusterId) => Synthesis.deleteSynthesisCluster(this, origin, url, clusterId);
	createSynthesisTheme = (req, origin, url) => Synthesis.createSynthesisTheme(this, req, origin, url);

	/* ─────────────── Guides ─────────────── */
	listGuides = (origin, url) => Guides.listGuides(this, origin, url);
	createGuide = (req, origin) => Guides.createGuide(this, req, origin);
	updateGuide = (req, origin, guideId) => Guides.updateGuide(this, req, origin, guideId);
	publishGuide = (origin, guideId) => Guides.publishGuide(this, origin, guideId);
	readGuide = (origin, guideId) => Guides.readGuide(this, origin, guideId);

	/* ─────────────── Consent Forms ─────────────── */
	listConsentForms = (origin, url) => ConsentForms.listConsentForms(this, origin, url);
	createConsentForm = (req, origin) => ConsentForms.createConsentForm(this, req, origin);
	readConsentForm = (origin, formId) => ConsentForms.readConsentForm(this, origin, formId);
	updateConsentForm = (req, origin, formId) => ConsentForms.updateConsentForm(this, req, origin, formId);
	publishConsentForm = (origin, formId) => ConsentForms.publishConsentForm(this, origin, formId);

	/* ─────────────── Participant Consent ─────────────── */
	listParticipantConsent = (origin, url) => ParticipantConsent.listParticipantConsent(this, origin, url);
	createParticipantConsent = (req, origin) => ParticipantConsent.createParticipantConsent(this, req, origin);
	updateParticipantConsent = (req, origin, recordId) => ParticipantConsent.updateParticipantConsent(this, req, origin, recordId);

	/* ─────────────── Partials ─────────────── */
	listPartials = (origin) => Partials.listPartials(this, origin);
	createPartial = (req, origin) => Partials.createPartial(this, req, origin);
	readPartial = (origin, id) => Partials.readPartial(this, origin, id);
	updatePartial = (req, origin, id) => Partials.updatePartial(this, req, origin, id);
	deletePartial = (origin, id) => Partials.deletePartial(this, origin, id);

	/* ─────────────── Participants ─────────────── */
	listParticipants = (origin, url) => Participants.listParticipants(this, origin, url);
	createParticipant = (req, origin) => Participants.createParticipant(this, req, origin);

	/* ─────────────── Sessions ─────────────── */
	listSessions = (origin, url) => Sessions.listSessions(this, origin, url);
	getSession = (origin, sessionId) => Sessions.getSession(this, origin, sessionId);
	createSession = (req, origin) => Sessions.createSession(this, req, origin);
	updateSession = (req, origin, sessionId) => Sessions.updateSession(this, req, origin, sessionId);
	sessionIcs = (origin, sessionId) => Sessions.sessionIcs(this, origin, sessionId);

	/* ─────────────── Session Notes ─────────────── */
	listSessionNotes = (origin, url) => SessionNotes.listSessionNotes(this, origin, url);
	createSessionNote = (req, origin) => SessionNotes.createSessionNote(this, req, origin);
	updateSessionNote = (req, origin, noteId) => SessionNotes.updateSessionNote(this, req, origin, noteId);

	/* ─────────────── Comms ─────────────── */
	sendComms = (req, origin) => Comms.sendComms(this, req, origin);
}
