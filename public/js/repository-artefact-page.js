function apiUrl(path) {
	const explicit = document.documentElement?.dataset?.apiOrigin || window.API_ORIGIN || "";
	const base = String(explicit || "").trim().replace(/\/+$/, "");
	const cleanPath = path.startsWith("/") ? path : `/${path}`;
	return `${base}${cleanPath}`;
}

function text(value) {
	return String(value || "");
}

function setBusy(element, busy) {
	if (!element) return;
	element.setAttribute("aria-busy", busy ? "true" : "false");
}

function signInUrl() {
	const returnTo = `${window.location.pathname}${window.location.search || ""}`;
	return `/pages/account/sign-in/?returnTo=${encodeURIComponent(returnTo)}`;
}

async function fetchArtefact(id) {
	const response = await fetch(apiUrl(`/api/repository/artefacts/${encodeURIComponent(id)}`), {
		credentials: "include",
		cache: "no-store"
	});
	const data = await response.json().catch(() => ({ ok: false }));
	return { response, data };
}

function tagNode(tag) {
	const strong = document.createElement("strong");
	strong.className = `govuk-tag ${tag.classes || "govuk-tag--grey"}`;
	strong.textContent = text(tag.text);
	return strong;
}

function summaryRow(key, value) {
	const row = document.createElement("div");
	row.className = "govuk-summary-list__row";
	const term = document.createElement("dt");
	term.className = "govuk-summary-list__key";
	term.textContent = key;
	const detail = document.createElement("dd");
	detail.className = "govuk-summary-list__value";
	detail.textContent = text(value) || "Not recorded";
	row.append(term, detail);
	return row;
}

function renderMessage(target, heading, body) {
	target.replaceChildren();
	const inset = document.createElement("div");
	inset.className = "govuk-inset-text";
	const h3 = document.createElement("h3");
	h3.className = "govuk-heading-m";
	h3.textContent = heading;
	const p = document.createElement("p");
	p.className = "govuk-body";
	p.textContent = body;
	inset.append(h3, p);
	target.appendChild(inset);
	setBusy(target, false);
}

function renderArtefact(target, artefact) {
	target.replaceChildren();
	const pageHeading = document.getElementById("repository-artefact-detail-title");
	if (pageHeading) pageHeading.textContent = text(artefact.title) || "Repository artefact";
	const summary = document.createElement("p");
	summary.className = "govuk-body";
	summary.textContent = text(artefact.summary);
	const tags = document.createElement("div");
	tags.className = "repository-artefact-list__meta";
	tags.setAttribute("aria-label", "Artefact metadata");
	for (const tag of artefact.tags || []) tags.appendChild(tagNode(tag));
	const list = document.createElement("dl");
	list.className = "govuk-summary-list";
	list.append(
		summaryRow("Artefact type", artefact.artefactType),
		summaryRow("Service area", artefact.serviceArea),
		summaryRow("User group", artefact.userGroup),
		summaryRow("Method", artefact.provenance?.method || artefact.method),
		summaryRow("Evidence basis", artefact.provenance?.sample),
		summaryRow("Limitations", artefact.limits?.limitations),
		summaryRow("Reuse guidance", artefact.limits?.reuseGuidance),
		summaryRow("Do not use for", artefact.limits?.doNotUseFor),
		summaryRow("Review due", artefact.reviewDueAt)
	);
	target.append(summary, tags, list);
	setBusy(target, false);
}

async function initialiseArtefactPage() {
	const target = document.getElementById("repository-artefact-detail");
	if (!target) return;
	const id = new URLSearchParams(window.location.search).get("id");
	if (!id) {
		renderMessage(target, "No artefact selected", "Choose a published artefact from repository search results.");
		return;
	}
	const { response, data } = await fetchArtefact(id);
	if (response.status === 401) {
		window.location.assign(signInUrl());
		return;
	}
	if (!response.ok || data?.ok !== true || !data.artefact) {
		renderMessage(target, "Artefact could not be loaded", "This artefact may not exist, may not be published, or may not be available to your account.");
		return;
	}
	renderArtefact(target, data.artefact);
}

initialiseArtefactPage().catch(() => {
	const target = document.getElementById("repository-artefact-detail");
	if (target) renderMessage(target, "Artefact could not be loaded", "Try again or contact the ResearchOps team if the problem continues.");
});
