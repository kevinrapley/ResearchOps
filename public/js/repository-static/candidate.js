import { option, repositoryJson, signInUrl, text, titleFromSlug } from './shared.js';

function populateSelect(select, filters, filterName) {
	if (!select) return;
	select.replaceChildren(option("", "Select one"));
	const filter = filters.find((entry) => entry.name === filterName);
	for (const item of filter?.items || []) select.appendChild(option(item.value, titleFromSlug(item.label || item.value)));
}

function setFieldValue(form, name, value) {
	const field = form?.elements?.[name];
	const cleaned = text(value);
	if (!field || !cleaned) return;
	if (field instanceof HTMLSelectElement && !Array.from(field.options).some((item) => item.value === cleaned)) {
		field.appendChild(option(cleaned, titleFromSlug(cleaned)));
	}
	field.value = cleaned;
}

function candidatePrefillFromQuery() {
	const params = new URLSearchParams(window.location.search);
	const aliases = new Map([
		["title", ["title", "candidateTitle"]],
		["summary", ["summary", "candidateSummary"]],
		["limitations", ["limitations"]],
		["reuseGuidance", ["reuseGuidance", "reuse"]],
		["doNotUseFor", ["doNotUseFor", "doNotUse"]],
		["confidence", ["confidence"]],
		["evidenceMaturity", ["evidenceMaturity", "maturity"]],
		["serviceArea", ["serviceArea", "service_area"]],
		["userGroup", ["userGroup", "user_group"]],
		["method", ["method"]],
		["riskArea", ["riskArea", "risk_area"]],
		["sourceProjectId", ["sourceProjectId", "pid", "projectId"]],
		["sourceStudyId", ["sourceStudyId", "sid", "studyId"]],
		["sourceSynthesisId", ["sourceSynthesisId", "sourceRecommendationId", "synthesisId", "recommendationId"]],
		["evidenceType", ["evidenceType", "sourceType"]],
		["sampleSummary", ["sampleSummary", "evidenceBasis"]],
		["impactRecordId", ["impactRecordId", "impactId", "impactRef"]],
		["impactSummary", ["impactSummary", "impactContext"]],
		["decisionSummary", ["decisionSummary", "decisionContextSummary", "decisionContext"]],
		["outcomeSummary", ["outcomeSummary", "outcomeContext"]],
	]);
	const prefill = {};
	for (const [name, keys] of aliases.entries()) {
		const key = keys.find((candidate) => params.has(candidate));
		if (key) prefill[name] = params.get(key);
	}
	return prefill;
}

function applyCandidatePrefill(form) {
	const prefill = candidatePrefillFromQuery();
	for (const [name, value] of Object.entries(prefill)) setFieldValue(form, name, value);
}

async function populateProjectSelect() {
	const select = document.getElementById("candidate-source-project-id");
	if (!select) return;
	const { response, data } = await repositoryJson(`/api/projects?limit=200&ts=${Date.now()}`);
	if (response.status === 401) {
		window.location.assign(signInUrl());
		return;
	}
	const projects = Array.isArray(data?.projects) ? data.projects : [];
	select.replaceChildren(option("", projects.length ? "Select source project" : "No accessible projects found"));
	for (const project of projects) {
		const id = text(project.id || project.airtableId || project.recordId || project.localId || project.LocalId);
		const name = text(project.name || project.Name || project.title || project.Title);
		const team = text(project.teamName || project.team_name || project.team || project.org || project.Org);
		const label = team ? `${name} - ${team}` : name;
		if (id && label) select.appendChild(option(id, label));
	}
}

export async function initialiseCandidatePage() {
	const form = document.getElementById("repository-candidate-form");
	if (!form) return;
	const status = document.getElementById("repository-candidate-status");
	const [{ data }] = await Promise.all([repositoryJson("/api/repository?limit=1"), populateProjectSelect()]);
	const filters = data?.filters || [];
	populateSelect(document.getElementById("candidate-service-area"), filters, "service_area");
	populateSelect(document.getElementById("candidate-user-group"), filters, "user_group");
	populateSelect(document.getElementById("candidate-method"), filters, "method");
	populateSelect(document.getElementById("candidate-risk-area"), filters, "risk_area");
	applyCandidatePrefill(form);

	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		const payload = Object.fromEntries(new FormData(form).entries());
		const { response, data: created } = await repositoryJson("/api/repository/artefacts", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
		if (response.status === 401) {
			window.location.assign(signInUrl());
			return;
		}
		if (status) {
			status.className = response.ok && created?.ok ? "govuk-inset-text" : "govuk-error-message";
			status.textContent = response.ok && created?.ok
				? `Candidate artefact ${created.id} has been submitted for repository review.`
				: "Candidate artefact could not be submitted. Check the required fields and try again.";
		}
		if (response.ok && created?.ok) form.reset();
	});
}
