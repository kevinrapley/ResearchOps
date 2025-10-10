/**
 * @file src/service/index.js
 * @module service
 * @summary Composed API service (Airtable + GitHub CSV) for ResearchOps Worker.
 */

import { DEFAULTS } from "../core/constants.js";
import { BatchLogger } from "../core/logger.js";
import { json as jsonHelper } from "./internals/responders.js";

import * as Projects from "./projects.js";
import * as Studies from "./studies.js";
import * as Guides from "./guides.js";
import * as Participants from "./participants.js";
import * as Sessions from "./sessions.js";
import * as Partials from "./partials.js";
import * as Comms from "./comms.js";
import * as Csv from "./csv.js";
import * as Csv from "./ai-rewrite.js";

/**
 * @typedef {Object} Env
 * @property {string} ALLOWED_ORIGINS
 * @property {string} AUDIT
 * @property {string} AIRTABLE_BASE_ID
 * @property {string} AIRTABLE_TABLE_PROJECTS
 * @property {string} AIRTABLE_TABLE_DETAILS
 * @property {string} AIRTABLE_TABLE_STUDIES
 * @property {string} AIRTABLE_TABLE_GUIDES
 * @property {string} AIRTABLE_TABLE_PARTIALS
 * @property {string} AIRTABLE_TABLE_PARTICIPANTS
 * @property {string} AIRTABLE_TABLE_SESSIONS
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
 * @property {any}    AI
 */

/**
 * Context wired into every handler.
 * @typedef {Object} ServiceContext
 * @property {Env} env
 * @property {Readonly<typeof DEFAULTS>} cfg
 * @property {BatchLogger} log
 * @property {(origin:string)=>Record<string,string>} corsHeaders
 * @property {(body:unknown, status?:number, headers?:HeadersInit)=>Response} json
 */

/**
 * Build CORS headers for the given origin based on env.ALLOWED_ORIGINS.
 * @param {Env} env
 * @param {string} origin
 * @returns {Record<string,string>}
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

/**
 * ResearchOps HTTP service (composed from feature modules).
 * Encapsulates business logic for all API routes.
 * @class ResearchOpsService
 */
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

		/** @type {(origin:string)=>Record<string,string>} */
		this.corsHeaders = (origin) => corsHeaders(this.env, origin);
		/** @type {(body:unknown, status?:number, headers?:HeadersInit)=>Response} */
		this.json = (body, status = 200, headers = {}) =>
			jsonHelper(body, status, headers);
	}

	/** @returns {void} */
	reset() { this.log.reset(); }

	/** @returns {void} */
	destroy() {
		if (this.destroyed) return;
		this.log.destroy();
		this.destroyed = true;
	}

	/* ─────────────── Health ─────────────── */

	/**
	 * Health probe.
	 * @param {string} origin
	 * @returns {Promise<Response>}
	 */
	async health(origin) {
		return this.json({ ok: true, time: new Date().toISOString() }, 200, this.corsHeaders(origin));
	}

	/* ─────────────── Projects ─────────────── */

	/** @type {(origin:string, url:URL)=>Promise<Response>} */
	listProjectsFromAirtable = (origin, url) =>
		Projects.listProjectsFromAirtable(this, origin, url);

	/* ─────────────── CSV streaming / appends ─────────────── */

	/** @type {(origin:string, path:string)=>Promise<Response>} */
	streamCsv = (origin, path) => Csv.streamCsv(this, origin, path);

	/** @type {(args:{path:string, header:string[], row:(string|number)[]})=>Promise<void>} */
	githubCsvAppend = (args) => Csv.githubCsvAppend(this, args);

	/* ─────────────── Studies ─────────────── */

	/** @type {(req:Request, origin:string)=>Promise<Response>} */
	createStudy = (req, origin) => Studies.createStudy(this, req, origin);

	/** @type {(origin:string, url:URL)=>Promise<Response>} */
	listStudies = (origin, url) => Studies.listStudies(this, origin, url);

	/** @type {(req:Request, origin:string, studyId:string)=>Promise<Response>} */
	updateStudy = (req, origin, studyId) => Studies.updateStudy(this, req, origin, studyId);

	/* ─────────────── Guides ─────────────── */

	/** @type {(origin:string, url:URL)=>Promise<Response>} */
	listGuides = (origin, url) => Guides.listGuides(this, origin, url);

	/** @type {(req:Request, origin:string)=>Promise<Response>} */
	createGuide = (req, origin) => Guides.createGuide(this, req, origin);

	/** @type {(req:Request, origin:string, guideId:string)=>Promise<Response>} */
	updateGuide = (req, origin, guideId) => Guides.updateGuide(this, req, origin, guideId);

	/** @type {(origin:string, guideId:string)=>Promise<Response>} */
	publishGuide = (origin, guideId) => Guides.publishGuide(this, origin, guideId);

	/** @type {(origin:string, guideId:string)=>Promise<Response>} */
	readGuide = (origin, guideId) => Guides.readGuide(this, origin, guideId);

	/* ─────────────── Partials ─────────────── */

	/** @type {(origin:string)=>Promise<Response>} */
	listPartials = (origin) => Partials.listPartials(this, origin);

	/** @type {(req:Request, origin:string)=>Promise<Response>} */
	createPartial = (req, origin) => Partials.createPartial(this, req, origin);

	/** @type {(origin:string, id:string)=>Promise<Response>} */
	readPartial = (origin, id) => Partials.readPartial(this, origin, id);

	/** @type {(req:Request, origin:string, id:string)=>Promise<Response>} */
	updatePartial = (req, origin, id) => Partials.updatePartial(this, req, origin, id);

	/** @type {(origin:string, id:string)=>Promise<Response>} */
	deletePartial = (origin, id) => Partials.deletePartial(this, origin, id);

	/* ─────────────── Participants ─────────────── */

	/** @type {(origin:string, url:URL)=>Promise<Response>} */
	listParticipants = (origin, url) => Participants.listParticipants(this, origin, url);

	/** @type {(req:Request, origin:string)=>Promise<Response>} */
	createParticipant = (req, origin) => Participants.createParticipant(this, req, origin);

	/* ─────────────── Sessions ─────────────── */

	/** @type {(origin:string, url:URL)=>Promise<Response>} */
	listSessions = (origin, url) => Sessions.listSessions(this, origin, url);

	/** @type {(req:Request, origin:string)=>Promise<Response>} */
	createSession = (req, origin) => Sessions.createSession(this, req, origin);

	/** @type {(req:Request, origin:string, sessionId:string)=>Promise<Response>} */
	updateSession = (req, origin, sessionId) => Sessions.updateSession(this, req, origin, sessionId);

	/** @type {(origin:string, sessionId:string)=>Promise<Response>} */
	sessionIcs = (origin, sessionId) => Sessions.sessionIcs(this, origin, sessionId);

	/* ─────────────── Comms ─────────────── */

	/** @type {(req:Request, origin:string)=>Promise<Response>} */
	sendComms = (req, origin) => Comms.sendComms(this, req, origin);
	
		/* ─────────────── AI Rewrite ─────────────── */
	/**
	 * Run AI-assisted rewrite (used by /api/ai-rewrite route).
	 * Delegates to Cloudflare AI binding through ai-rewrite.js.
	 *
	 * @param {Request} req
	 * @param {string} origin
	 * @returns {Promise<Response>}
	 */
	runAiRewrite = (req, origin) => AIRewrite.runAiRewrite(this, req, origin);
}
