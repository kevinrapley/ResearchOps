/**
 * @file public/js/consent-forms-page.js
 * @module consent-forms-page
 * @summary Study consent form authoring with Markdown, Mustache-style variables and Airtable-backed persistence.
 */

const API_ORIGIN =
	document.documentElement?.dataset?.apiOrigin ||
	window.API_ORIGIN ||
	window.RESEARCHOPS_API_ORIGIN ||
	(location.hostname.endsWith("pages.dev") ?
		"https://rops-api.digikev-kevin-rapley.workers.dev" :
		location.origin);

const DEFAULT_VARIABLES = {
	studyTitle: "Study title",
	organisation: "Home Office Biometrics",
	researcherName: "Researcher name",
	researcherEmail: "research@example.gov.uk",
	sessionFormat: "remote research session",
	recordingSummary: "The session may be audio or video recorded if you agree.",
	withdrawalPeriod: "14 days after your session"
};

const DEFAULT_CONSENT_ITEMS = [
	{
		id: "participation",
		label: "I understand what taking part involves and I agree to take part in this research.",
		required: true
	},
	{
		id: "voluntary",
		label: "I understand that taking part is voluntary and that I can stop the session at any time.",
		required: true
	},
	{
		id: "data-use",
		label: "I understand how my information will be used for this research.",
		required: true
	},
	{
		id: "recording",
		label: "I agree to the session being recorded if recording is being used for this study.",
		required: false
	}
];

const DEFAULT_SOURCE = `# {{studyTitle}} participant information and consent form

## About this research

We are doing research for {{organisation}}. The session will help us understand how people use or experience this service.

## What taking part involves

You will take part in a {{sessionFormat}} with a researcher. You can choose not to answer any question. You can stop the session at any time.

## Recording and observers

{{recordingSummary}}

## How your information will be used

We will use what we learn to improve the service. Research notes and outputs should not identify you directly.

## Withdrawal

You can ask for your contribution to be withdrawn up to {{withdrawalPeriod}}, where this is possible.

## Consent statements

{{#consentItems}}
- {{label}}
{{/consentItems}}

## Contact

If you have questions, contact {{researcherName}} at {{researcherEmail}}.
`;

const state = {
	pid: "",
	sid: "",
	forms: [],
	selectedId: ""
};

const $ = (selector, root = document) => root.querySelector(selector);

function apiUrl(path) {
	const p = String(path || "");
	return `${API_ORIGIN}${p.startsWith("/") ? p : "/" + p}`;
}

function route(path, params) {
	const url = new URL(path, window.location.origin);
	for (const [key, value] of Object.entries(params)) {
		if (value) url.searchParams.set(key, value);
	}
	return `${url.pathname}${url.search}`;
}

function setText(selector, value) {
	const el = $(selector);
	if (el) el.textContent = value || "";
}

function showError(message) {
	const panel = $("#consent-error");
	const messageEl = $("#consent-error-message");
	if (!panel || !messageEl) return;
	panel.hidden = false;
	panel.removeAttribute("aria-hidden");
	messageEl.textContent = message;
	panel.focus();
}

function hideError() {
	const panel = $("#consent-error");
	if (!panel) return;
	panel.hidden = true;
	panel.setAttribute("aria-hidden", "true");
}

function setStatus(message) {
	setText("#consent-save-status", message);
}

function clearInlineError(selector) {
	const el = $(selector);
	if (!el) return;
	el.hidden = true;
	el.textContent = "";
}

function showInlineError(selector, message) {
	const el = $(selector);
	if (!el) return;
	el.hidden = false;
	el.textContent = message;
}

async function jsonFetch(url, options = {}) {
	const response = await fetch(url, {
		cache: "no-store",
		...options,
		headers: {
			"content-type": "application/json",
			...(options.headers || {})
		}
	});
	const text = await response.text();
	const body = text ? JSON.parse(text) : {};
	if (!response.ok) throw new Error(body?.detail || body?.error || `Request failed (${response.status})`);
	return body;
}

function escapeHtml(value) {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function inlineMarkdown(text) {
	return escapeHtml(text)
		.replace(/`([^`]+)`/g, "<code>$1</code>")
		.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
		.replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function renderMarkdown(markdown) {
	const lines = String(markdown || "").replace(/\r\n?/g, "\n").split("\n");
	const html = [];
	let listOpen = false;
	let paragraph = [];

	const flushParagraph = () => {
		if (!paragraph.length) return;
		html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
		paragraph = [];
	};

	const closeList = () => {
		if (!listOpen) return;
		html.push("</ul>");
		listOpen = false;
	};

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) {
			flushParagraph();
			closeList();
			continue;
		}

		const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
		if (heading) {
			flushParagraph();
			closeList();
			const level = Math.min(6, heading[1].length + 1);
			html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
			continue;
		}

		const bullet = trimmed.match(/^[-*]\s+(.+)$/);
		if (bullet) {
			flushParagraph();
			if (!listOpen) {
				html.push("<ul>");
				listOpen = true;
			}
			html.push(`<li>${inlineMarkdown(bullet[1])}</li>`);
			continue;
		}

		paragraph.push(trimmed);
	}

	flushParagraph();
	closeList();
	return html.join("\n");
}

function parseJson(selector, errorSelector, fallback) {
	const raw = $(selector)?.value || "";
	clearInlineError(errorSelector);
	try {
		return raw.trim() ? JSON.parse(raw) : fallback;
	} catch (error) {
		showInlineError(errorSelector, "Enter valid JSON before saving or previewing.");
		throw error;
	}
}

function lookupValue(context, key) {
	return key.split(".").reduce((value, part) => {
		if (value == null) return "";
		return value[part];
	}, context);
}

function renderMustache(template, context) {
	let output = String(template || "");
	output = output.replace(/{{#([\w.]+)}}([\s\S]*?){{\/\1}}/g, (_match, key, block) => {
		const value = lookupValue(context, key);
		if (!Array.isArray(value)) return "";
		return value.map(item => renderMustache(block, { ...context, ...item })).join("");
	});
	return output.replace(/{{\s*([\w.]+)\s*}}/g, (_match, key) => {
		const value = lookupValue(context, key.trim());
		return value == null ? "" : String(value);
	});
}

function currentPayload() {
	const variables = parseJson("#consent-variables", "#consent-variables-error", {});
	const consentItems = parseJson("#consent-items", "#consent-items-error", []);
	return {
		title: $("#consent-title")?.value.trim() || "Participant information and consent form",
		formType: $("#consent-form-type")?.value || "Consent form",
		status: $("#consent-status")?.value || "Draft",
		sourceMarkdown: $("#consent-source")?.value || "",
		variables,
		consentItems,
		plainEnglishSummary: $("#consent-summary")?.value || "",
		accessibilityNotes: $("#consent-accessibility-notes")?.value || "",
		reviewNotes: $("#consent-review-notes")?.value || ""
	};
}

function renderPreview() {
	try {
		const payload = currentPayload();
		const context = { ...payload.variables, consentItems: payload.consentItems };
		const rendered = renderMustache(payload.sourceMarkdown, context);
		const preview = $("#consent-preview");
		if (preview) preview.innerHTML = renderMarkdown(rendered);
	} catch {
		const preview = $("#consent-preview");
		if (preview) preview.innerHTML = "<p>Preview unavailable until JSON errors are fixed.</p>";
	}
}

function defaultDraft() {
	return {
		id: "",
		title: "Participant information and consent form",
		formType: "Consent form",
		status: "Draft",
		version: 1,
		sourceMarkdown: DEFAULT_SOURCE,
		variables: DEFAULT_VARIABLES,
		consentItems: DEFAULT_CONSENT_ITEMS,
		plainEnglishSummary: "Participant-facing consent material for this study.",
		accessibilityNotes: "",
		reviewNotes: ""
	};
}

function setEditor(form) {
	$("#consent-form-id").value = form.id || "";
	$("#consent-title").value = form.title || "Participant information and consent form";
	$("#consent-form-type").value = form.formType || "Consent form";
	$("#consent-status").value = form.status || "Draft";
	$("#consent-source").value = form.sourceMarkdown || DEFAULT_SOURCE;
	$("#consent-variables").value = JSON.stringify(form.variables || DEFAULT_VARIABLES, null, 2);
	$("#consent-items").value = JSON.stringify(form.consentItems || DEFAULT_CONSENT_ITEMS, null, 2);
	$("#consent-summary").value = form.plainEnglishSummary || "";
	$("#consent-accessibility-notes").value = form.accessibilityNotes || "";
	$("#consent-review-notes").value = form.reviewNotes || "";
	state.selectedId = form.id || "";
	renderList();
	renderPreview();
	setStatus(form.id ? `Editing ${form.title}` : "New draft not saved yet.");
}

function renderList() {
	const list = $("#consent-form-list");
	if (!list) return;
	list.innerHTML = "";

	if (!state.forms.length) {
		const li = document.createElement("li");
		li.className = "consent-form-list__empty";
		li.textContent = "No consent forms have been saved for this study yet.";
		list.append(li);
		setText("#consent-list-status", "No saved consent forms.");
		return;
	}

	setText("#consent-list-status", `${state.forms.length} saved consent form${state.forms.length === 1 ? "" : "s"}.`);
	for (const form of state.forms) {
		const li = document.createElement("li");
		const button = document.createElement("button");
		button.type = "button";
		button.className = "consent-form-list__button";
		if (form.id === state.selectedId) button.setAttribute("aria-current", "true");
		button.innerHTML = `<strong>${escapeHtml(form.title || "Untitled")}</strong><span>${escapeHtml(form.formType || "Consent form")} · ${escapeHtml(form.status || "Draft")}</span>`;
		button.addEventListener("click", () => setEditor(form));
		li.append(button);
		list.append(li);
	}
}

async function loadConsentForms() {
	const url = new URL(apiUrl("/api/consent-forms"));
	url.searchParams.set("study", state.sid);
	const body = await jsonFetch(url.toString());
	state.forms = Array.isArray(body?.consentForms) ? body.consentForms : [];
	renderList();
	setEditor(state.forms[0] || defaultDraft());
}

async function loadStudyContext() {
	try {
		const studiesUrl = new URL(apiUrl("/api/studies"));
		studiesUrl.searchParams.set("project", state.pid);
		const body = await jsonFetch(studiesUrl.toString());
		const study = (body.studies || []).find(item => item.id === state.sid);
		setText("#breadcrumb-study", study?.title || study?.method || "Study");
	} catch (error) {
		console.warn("[consent-forms] study context lookup failed", error);
	}
}

async function saveForm(event) {
	event.preventDefault();
	try {
		setStatus("Saving…");
		const id = $("#consent-form-id").value;
		const payload = { ...currentPayload(), study_airtable_id: state.sid };
		const body = await jsonFetch(id ? apiUrl(`/api/consent-forms/${encodeURIComponent(id)}`) : apiUrl("/api/consent-forms"), {
			method: id ? "PATCH" : "POST",
			body: JSON.stringify(payload)
		});
		if (body.id && !id) $("#consent-form-id").value = body.id;
		setStatus("Saved.");
		await loadConsentForms();
		const nextId = body.id || id;
		const saved = state.forms.find(form => form.id === nextId);
		if (saved) setEditor(saved);
	} catch (error) {
		console.error("[consent-forms] save failed", error);
		setStatus("Could not save. Check the fields and try again.");
	}
}

async function publishForm() {
	const id = $("#consent-form-id").value;
	if (!id) {
		setStatus("Save the draft before publishing.");
		return;
	}
	try {
		setStatus("Publishing…");
		await jsonFetch(apiUrl(`/api/consent-forms/${encodeURIComponent(id)}/publish`), { method: "POST" });
		setStatus("Published.");
		await loadConsentForms();
		const published = state.forms.find(form => form.id === id);
		if (published) setEditor(published);
	} catch (error) {
		console.error("[consent-forms] publish failed", error);
		setStatus("Could not publish. Try again.");
	}
}

function bindEvents() {
	$("#new-consent-form")?.addEventListener("click", () => setEditor(defaultDraft()));
	$("#consent-form-editor")?.addEventListener("submit", saveForm);
	$("#publish-consent-form")?.addEventListener("click", publishForm);
	for (const selector of ["#consent-source", "#consent-variables", "#consent-items"]) {
		$(selector)?.addEventListener("input", renderPreview);
	}
}

async function init() {
	hideError();
	const params = new URLSearchParams(window.location.search);
	state.pid = params.get("pid") || "";
	state.sid = params.get("sid") || "";
	if (!state.pid || !state.sid) {
		showError("The consent forms page needs a project ID and study ID in the URL.");
		return;
	}

	$("#back-to-study").href = route("/pages/study/", { pid: state.pid, sid: state.sid });
	$("#breadcrumb-project").href = route("/pages/project-dashboard/", { id: state.pid });
	$("#breadcrumb-study").href = route("/pages/study/", { pid: state.pid, sid: state.sid });
	bindEvents();

	try {
		await Promise.all([loadStudyContext(), loadConsentForms()]);
	} catch (error) {
		console.error("[consent-forms] init failed", error);
		showError("Could not load consent forms. Check the study link and try again.");
	}
}

init();
