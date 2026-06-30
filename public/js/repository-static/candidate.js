import { option, repositoryJson, signInUrl, text, titleFromSlug } from './shared.js';

function populateSelect(select, filters, filterName) {
	if (!select) return;
	select.replaceChildren(option("", "Select one"));
	const filter = filters.find((entry) => entry.name === filterName);
	for (const item of filter?.items || []) select.appendChild(option(item.value, titleFromSlug(item.label || item.value)));
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

function setSelectValue(select, value, label = value) {
	if (!select || !value) return;
	if (!Array.from(select.options).some((item) => item.value === value)) {
		select.appendChild(option(value, titleFromSlug(label || value)));
	}
	select.value = value;
}

function setFieldValue(id, value) {
	const field = document.getElementById(id);
	if (field && value) field.value = value;
}

function prefillValue(params, key) {
	return text(params.get(key) || "").trim();
}

function applyCandidatePrefill() {
	const params = new URLSearchParams(window.location.search);
	const sourceSynthesisId = prefillValue(params, "sourceSynthesisId");
	const sourceRecommendationId = prefillValue(params, "sourceRecommendationId");
	const sourceContextType = prefillValue(params, "sourceContextType") || (sourceSynthesisId ? "reviewed-synthesis" : sourceRecommendationId ? "recommendation" : "");

	setFieldValue("candidate-title", prefillValue(params, "title"));
	setFieldValue("candidate-summary", prefillValue(params, "summary"));
	setFieldValue("candidate-limitations", prefillValue(params, "limitations"));
	setFieldValue("candidate-reuse-guidance", prefillValue(params, "reuseGuidance"));
	setFieldValue("candidate-do-not-use-for", prefillValue(params, "doNotUseFor"));
	setFieldValue("candidate-source-study-id", prefillValue(params, "sourceStudyId"));
	setFieldValue("candidate-evidence-basis", prefillValue(params, "sampleSummary"));
	setFieldValue("candidate-source-synthesis-id", sourceSynthesisId);
	setFieldValue("candidate-source-recommendation-id", sourceRecommendationId);
	setFieldValue("candidate-source-context-type", sourceContextType);

	setSelectValue(document.getElementById("candidate-source-project-id"), prefillValue(params, "sourceProjectId"));
	setSelectValue(document.getElementById("candidate-evidence-type"), prefillValue(params, "evidenceType"));
	setSelectValue(document.getElementById("candidate-service-area"), prefillValue(params, "serviceArea"));
	setSelectValue(document.getElementById("candidate-user-group"), prefillValue(params, "userGroup"));
	setSelectValue(document.getElementById("candidate-method"), prefillValue(params, "method"));
	setSelectValue(document.getElementById("candidate-risk-area"), prefillValue(params, "riskArea"));
	setSelectValue(document.getElementById("candidate-confidence"), prefillValue(params, "confidence"));
	setSelectValue(document.getElementById("candidate-evidence-maturity"), prefillValue(params, "evidenceMaturity"));

	const summary = document.getElementById("repository-candidate-prefill-summary");
	if (summary && (sourceSynthesisId || sourceRecommendationId)) {
		summary.hidden = false;
		summary.textContent = sourceSynthesisId
			? `Prefilled from reviewed synthesis ${sourceSynthesisId}. PII and consent gates remain pending until curator review.`
			: `Prefilled from recommendation ${sourceRecommendationId}. PII and consent gates remain pending until curator review.`;
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
	applyCandidatePrefill();

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
