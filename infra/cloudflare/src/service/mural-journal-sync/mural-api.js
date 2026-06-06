import { updateSticky } from "../../lib/mural.js";
import { firstMuralValue, muralErrorSummary } from "./text.js";
import { minimalStickyPayload, stickyPayloadFromTemplate } from "./sticky-payloads.js";

export async function postStickyPayload(accessToken, url, body) {
	const res = await fetch(url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
			Accept: "application/json"
		},
		body: JSON.stringify(body)
	});
	const responseBody = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw Object.assign(new Error(`Create Mural template sticky failed: ${res.status}`), {
			status: res.status,
			body: responseBody
		});
	}
	return firstMuralValue(responseBody);
}

export async function createStickyFromTemplate(env, accessToken, muralId, template, payload) {
	const url = `https://app.mural.co/api/public/v1/murals/${muralId}/widgets/sticky-note`;
	const full = stickyPayloadFromTemplate(template, payload);
	const minimal = minimalStickyPayload(full);
	const attempts = [
		{ name: "template-sticky-full", body: full },
		{ name: "template-sticky-minimal", body: minimal },
		{ name: "template-sticky-minimal-array", body: [minimal] }
	];
	const errors = [];

	for (const attempt of attempts) {
		try {
			const created = await postStickyPayload(accessToken, url, attempt.body);
			return created || { ...full };
		} catch (err) {
			errors.push({ attempt: attempt.name, status: err?.status, summary: muralErrorSummary(err) });
		}
	}

	const last = errors[errors.length - 1] || {};
	throw Object.assign(new Error(`Create Mural template sticky failed after ${errors.length} attempts: ${last.summary || "unknown error"}`), {
		status: last.status || 400,
		errors
	});
}

export async function patchStickyNote(env, accessToken, muralId, widgetId, patch) {
	const url = `https://app.mural.co/api/public/v1/murals/${muralId}/widgets/sticky-note/${widgetId}`;
	const res = await fetch(url, {
		method: "PATCH",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
			Accept: "application/json"
		},
		body: JSON.stringify(patch)
	});
	const body = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw Object.assign(new Error(`Update Mural sticky note failed: ${res.status}`), {
			status: res.status,
			body
		});
	}
	return firstMuralValue(body) || { id: widgetId, ...patch };
}

export async function updateTemplateWidget(env, accessToken, muralId, widgetId, patch) {
	const minimalPatch = {
		text: patch.text,
		title: patch.title,
		tags: patch.tags,
		style: {
			backgroundColor: patch.style?.backgroundColor || "#FFFFFFFF",
			fontSize: patch.style?.fontSize || 23,
			textAlign: patch.style?.textAlign || "left"
		}
	};
	const attempts = [
		() => updateSticky(env, accessToken, muralId, widgetId, patch),
		() => updateSticky(env, accessToken, muralId, widgetId, minimalPatch),
		() => patchStickyNote(env, accessToken, muralId, widgetId, patch),
		() => patchStickyNote(env, accessToken, muralId, widgetId, minimalPatch)
	];
	const errors = [];

	for (const attempt of attempts) {
		try {
			const updated = await attempt();
			return firstMuralValue(updated) || { id: widgetId, ...patch };
		} catch (err) {
			errors.push({ status: err?.status, summary: muralErrorSummary(err) });
		}
	}

	const last = errors[errors.length - 1] || {};
	throw Object.assign(new Error(`Could not update template widget after ${errors.length} attempts: ${last.summary || "unknown error"}`), {
		status: last.status || 400,
		errors
	});
}
