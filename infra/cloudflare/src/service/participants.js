/**
 * @file participants.js
 * @module participants
 * @summary D1-canonical participant endpoints for ResearchOps Worker.
 *
 * @description
 * Implements a pseudonymised-by-default participant list and a deliberate,
 * permission-checked contact reveal route. D1 is the runtime source of truth.
 * Airtable is secondary and must not be required for normal participant testing.
 */

import { resolveAuthenticatedContext } from "../core/auth/access-scoped.js";
import { assertRoutePermission } from "../core/auth/route-permissions.js";
import { toMs } from "../core/utils.js";

const CONTACT_RESTRICTED_MESSAGE = "Participant contact details are restricted. Ask a Team Admin or authorised role if you need access.";

function permissionCodes(context = {}) {
	return new Set((context.permissions || []).map((permission) => permission.code).filter(Boolean));
}

function canRevealParticipantContact(context) {
	return permissionCodes(context).has("participant.pii.reveal");
}

function permissionErrorResponse(svc, origin, error, fallbackMessage = CONTACT_RESTRICTED_MESSAGE, preferFallbackMessage = false) {
	const status = error?.status || 403;
	return svc.json(
		{
			ok: false,
			error: error?.code || "permission_denied",
			message: preferFallbackMessage ? fallbackMessage : (error?.message || fallbackMessage),
		},
		status,
		svc.corsHeaders(origin),
	);
}

async function resolveParticipantRouteContext(svc, request, origin) {
	try {
		const context = await resolveAuthenticatedContext(request, svc.env);
		await assertRoutePermission(request, svc.env, context);
		return { context, response: null };
	} catch (error) {
		return { context: null, response: permissionErrorResponse(svc, origin, error) };
	}
}

function dbFor(env = {}) {
	const db = env.RESEARCHOPS_D1;
	return db && typeof db.prepare === "function" ? db : null;
}

function cleanText(value) {
	return String(value || "").replace(/\s+/g, " ").trim();
}

function makeId(prefix) {
	return `${prefix}_${crypto.randomUUID()}`;
}

function jsonText(value) {
	return JSON.stringify(value || {});
}

function parseJson(value) {
	try {
		const parsed = JSON.parse(value || "{}");
		return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
	} catch {
		return {};
	}
}

function participantDataUnavailable(svc, origin) {
	return svc.json(
		{
			ok: false,
			error: "participant_store_unavailable",
			message: "Participant records are not available right now.",
		},
		503,
		svc.corsHeaders(origin),
	);
}

function makeAuditId() {
	return makeId("evt");
}

async function recordParticipantEvent(svc, request, context, participantId, eventType, outcome) {
	const db = dbFor(svc.env);
	if (!db) return;

	try {
		await db
			.prepare(`
				INSERT INTO auth_events (id, event_type, actor_user_id, target_user_id, team_id, provider, route_path, metadata_json)
				VALUES (?, ?, ?, NULL, ?, 'researchops_participants', ?, ?)
			`)
			.bind(
				makeAuditId(),
				eventType,
				context?.user?.id || null,
				context?.activeTeam?.id || null,
				new URL(request.url).pathname,
				jsonText({ participantId, outcome }),
			)
			.run();
	} catch {
		// Participant actions must not fail only because audit storage is unavailable.
	}
}

async function readD1ParticipantsForStudy(svc, origin, studyId, context) {
	const db = dbFor(svc.env);
	if (!db) return { ok: false, response: participantDataUnavailable(svc, origin) };

	try {
		const result = await db
			.prepare(`
				SELECT id, project_id, study_id, participant_airtable_id, participant_ref, channel_pref, consent_status, status, access_needs, created_at
				FROM rops_participants_cache
				WHERE study_id = ?
					AND active = 1
				ORDER BY created_at ASC, id ASC
			`)
			.bind(studyId)
			.all();

		return {
			ok: true,
			participants: (result.results || []).map((row) => mapD1Participant(row, context)),
		};
	} catch {
		return { ok: false, response: participantDataUnavailable(svc, origin) };
	}
}

async function readD1ParticipantContact(svc, origin, participantId) {
	const db = dbFor(svc.env);
	if (!db) return { ok: false, response: participantDataUnavailable(svc, origin) };

	try {
		const row = await db
			.prepare(`
				SELECT id, participant_ref, sensitive_contact_json
				FROM rops_participants_cache
				WHERE id = ?
					AND active = 1
				LIMIT 1
			`)
			.bind(participantId)
			.first();

		if (!row) {
			return {
				ok: false,
				response: svc.json({ ok: false, error: "participant_not_found", message: "Participant record could not be found." }, 404, svc.corsHeaders(origin)),
			};
		}

		const contact = parseJson(row.sensitive_contact_json);
		return {
			ok: true,
			participant: {
				id: row.id,
				display_name: row.participant_ref || "",
				email: cleanText(contact.email),
				phone: cleanText(contact.phone),
			},
		};
	} catch {
		return { ok: false, response: participantDataUnavailable(svc, origin) };
	}
}

function mapD1Participant(row, context) {
	const sessionParticipantId = cleanText(row.participant_airtable_id);
	return {
		id: row.id,
		participant_ref: row.participant_ref || row.id,
		display_name: row.participant_ref || row.id,
		contact_restricted: true,
		has_contact_details: null,
		can_reveal_contact: canRevealParticipantContact(context),
		can_schedule: Boolean(sessionParticipantId),
		session_participant_id: sessionParticipantId,
		channel_pref: row.channel_pref || "not recorded",
		consent_status: row.consent_status || "not_sent",
		status: row.status || "invited",
		access_needs: row.access_needs || "",
		createdAt: row.created_at || "",
	};
}

function participantRefFor(body) {
	const displayName = cleanText(body.display_name || body.displayName || body.participant_ref || body.participantRef);
	return displayName || `Participant ${new Date().toISOString()}`;
}

async function readJsonBody(request, maxBytes) {
	const body = await request.arrayBuffer();
	if (body.byteLength > maxBytes) {
		const error = new Error("Payload too large");
		error.status = 413;
		error.code = "payload_too_large";
		throw error;
	}

	try {
		const parsed = JSON.parse(new TextDecoder().decode(body));
		return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
	} catch {
		const error = new Error("Invalid JSON");
		error.status = 400;
		error.code = "invalid_json";
		throw error;
	}
}

function bodyErrorResponse(svc, origin, error) {
	return svc.json({ ok: false, error: error.code || "invalid_request", message: error.message || "Check the participant information." }, error.status || 400, svc.corsHeaders(origin));
}

/**
 * List pseudonymised participants for a study.
 * @route GET /api/participants?study=:id
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {Request} request
 * @param {string} origin
 * @param {URL} url
 * @returns {Promise<Response>}
 */
export async function listParticipants(svc, request, origin, url) {
	const { context, response } = await resolveParticipantRouteContext(svc, request, origin);
	if (response) return response;

	const studyId = url.searchParams.get("study");
	if (!studyId) return svc.json({ ok: false, error: "Missing study query" }, 400, svc.corsHeaders(origin));

	const result = await readD1ParticipantsForStudy(svc, origin, studyId, context);
	if (!result.ok) return result.response;

	const participants = result.participants.sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt));
	return svc.json({ ok: true, participants }, 200, svc.corsHeaders(origin));
}

/**
 * Reveal participant contact details for an authorised user.
 * @route GET /api/participants/contact?participant=:id
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {Request} request
 * @param {string} origin
 * @param {URL} url
 * @returns {Promise<Response>}
 */
export async function revealParticipantContact(svc, request, origin, url) {
	const participantId = url.searchParams.get("participant") || url.searchParams.get("id") || "";
	if (!participantId) return svc.json({ ok: false, error: "participant_required", message: "Choose a participant." }, 400, svc.corsHeaders(origin));

	let context;
	try {
		context = await resolveAuthenticatedContext(request, svc.env);
		await assertRoutePermission(request, svc.env, context);
	} catch (error) {
		await recordParticipantEvent(svc, request, context, participantId, "participant.contact.reveal.denied", "denied");
		return permissionErrorResponse(svc, origin, error, CONTACT_RESTRICTED_MESSAGE, true);
	}

	const result = await readD1ParticipantContact(svc, origin, participantId);
	if (!result.ok) return result.response;

	await recordParticipantEvent(svc, request, context, participantId, "participant.contact.revealed", "succeeded");
	return svc.json(
		{
			ok: true,
			participant: result.participant,
			sensitive: true,
			message: "Participant contact details revealed. Handle this information as sensitive.",
		},
		200,
		svc.corsHeaders(origin),
	);
}

/**
 * Create a D1 participant linked to a study.
 * @route POST /api/participants
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {Request} request
 * @param {string} origin
 * @returns {Promise<Response>}
 */
export async function createParticipant(svc, request, origin) {
	const { context, response } = await resolveParticipantRouteContext(svc, request, origin);
	if (response) return response;

	let body;
	try {
		body = await readJsonBody(request, svc.cfg.MAX_BODY_BYTES);
	} catch (error) {
		return bodyErrorResponse(svc, origin, error);
	}

	const studyId = cleanText(body.study_id || body.studyId || body.study_airtable_id);
	const projectId = cleanText(body.project_id || body.projectId || body.project_airtable_id);
	const participantAirtableId = cleanText(body.participant_airtable_id || body.participantAirtableId);
	const participantRef = participantRefFor(body);
	const accessNeeds = cleanText(body.access_needs || body.accessNeeds);

	if (!studyId) return svc.json({ ok: false, error: "study_required", message: "Choose a study for this participant." }, 400, svc.corsHeaders(origin));
	if (!projectId) return svc.json({ ok: false, error: "project_required", message: "Choose a project for this participant." }, 400, svc.corsHeaders(origin));

	const db = dbFor(svc.env);
	if (!db) return participantDataUnavailable(svc, origin);

	const participantId = makeId("d1ptp");
	const now = new Date().toISOString();
	const contact = {
		email: cleanText(body.email),
		phone: cleanText(body.phone),
	};
	const hasContact = Boolean(contact.email || contact.phone);

	try {
		await db
			.prepare(`
				INSERT INTO rops_participants_cache (
					id,
					project_id,
					study_id,
					participant_airtable_id,
					participant_ref,
					channel_pref,
					consent_status,
					status,
					access_needs,
					active,
					source,
					created_at,
					updated_at,
					sensitive_contact_json,
					payload_json
				)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'd1-runtime', ?, ?, ?, ?)
			`)
			.bind(
				participantId,
				projectId,
				studyId,
				participantAirtableId || null,
				participantRef,
				cleanText(body.channel_pref || body.channelPref || "email") || "email",
				cleanText(body.consent_status || body.consentStatus || "not_sent") || "not_sent",
				cleanText(body.status || "invited") || "invited",
				accessNeeds || null,
				now,
				now,
				hasContact ? jsonText(contact) : null,
				jsonText({ projectId, studyId, participantRef, accessNeeds, pseudonymised: true }),
			)
			.run();
	} catch {
		return participantDataUnavailable(svc, origin);
	}

	await recordParticipantEvent(svc, request, context, participantId, "participant.created", "succeeded");
	return svc.json({ ok: true, id: participantId }, 200, svc.corsHeaders(origin));
}
