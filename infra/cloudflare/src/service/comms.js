/**
 * @file src/service/comms.js
 * @module service/comms
 * @summary Communications stub endpoint with Airtable log.
 */

import { fetchWithTimeout, safeText } from "../core/utils.js";

/**
 * Send a communication (email/SMS) and log it.
 * (Stub: integrate your provider here; logs to Airtable Comms Log.)
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {Request} request
 * @param {string} origin
 * @returns {Promise<Response>}
 */
export async function sendComms(svc, request, origin) {
	const body = await request.arrayBuffer();
	let p;
	try { p = JSON.parse(new TextDecoder().decode(body)); } catch {
		return svc.json({ error: "Invalid JSON" }, 400, svc.corsHeaders(origin));
	}

	const missing = [];
	if (!p.participant_id) missing.push("participant_id");
	if (!p.template_id) missing.push("template_id");
	if (!p.channel) missing.push("channel");
	if (missing.length) return svc.json({ error: "Missing fields: " + missing.join(", ") }, 400, svc.corsHeaders(origin));

	// TODO: plug in real provider here (send email/SMS)
	const messageId = `msg_${Date.now()}`;

	// Log to Airtable Comms Log (best-effort)
	try {
		const base = svc.env.AIRTABLE_BASE_ID;
		const table = encodeURIComponent(svc.env.AIRTABLE_TABLE_COMMSLOG || "Communications Log");
		const url = `https://api.airtable.com/v0/${base}/${table}`;
		const fields = {
			"Participant": [p.participant_id],
			"Session": p.session_id ? [p.session_id] : undefined,
			"Template Id": p.template_id,
			"Channel": p.channel,
			"Sent At": new Date().toISOString(),
			"Status": "sent",
			"Metadata": JSON.stringify({ message_id: messageId, substitutions: p.substitutions || {} })
		};
		for (const k of Object.keys(fields))
			if (fields[k] === undefined) delete fields[k];

		await fetchWithTimeout(url, {
			method: "POST",
			headers: { "Authorization": `Bearer ${svc.env.AIRTABLE_API_KEY}`, "Content-Type": "application/json" },
			body: JSON.stringify({ records: [{ fields }] })
		}, svc.cfg.TIMEOUT_MS);
	} catch (e) {
		svc.log.warn("comms.log.fail", { err: String(e?.message || e) });
	}

	return svc.json({ ok: true, message_id: messageId }, 200, svc.corsHeaders(origin));
}