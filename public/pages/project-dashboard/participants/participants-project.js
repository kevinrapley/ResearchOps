const API_ORIGIN =
	document.documentElement?.dataset?.apiOrigin ||
	window.API_ORIGIN ||
	(location.hostname.endsWith("pages.dev") ?
		"https://rops-api.digikev-kevin-rapley.workers.dev" :
		location.origin);

const $ = (selector, root = document) => root.querySelector(selector);

function projectIdFromUrl() {
	const params = new URLSearchParams(location.search);
	return params.get("id") || params.get("pid") || "";
}

function fieldValue(selector) {
	return String($(selector)?.value || "").trim();
}

function fallbackStudyTitle(study = {}) {
	const method = String(study.method || "Study").trim();
	const date = study.createdAt ? new Date(study.createdAt) : new Date();
	const yyyy = date.getUTCFullYear();
	const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
	const dd = String(date.getUTCDate()).padStart(2, "0");
	return `${method} — ${yyyy}-${mm}-${dd}`;
}

function pickStudyTitle(study = {}) {
	return String(study.title || study.Title || "").trim() || fallbackStudyTitle(study);
}

function generatedParticipantRef() {
	const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
	const random = Math.random().toString(36).slice(2, 6).toUpperCase();
	return `Participant ${stamp}-${random}`;
}

function setSchemaName(element, text) {
	if (!element) return;
	let name = element.querySelector('[property="schema:name"]');
	if (!name) {
		name = document.createElement("span");
		name.setAttribute("property", "schema:name");
		element.textContent = "";
		element.append(name);
	}
	name.textContent = text;
}

function enhanceBreadcrumbSchema(projectId, projectName) {
	const breadcrumbs = $("#participant-breadcrumbs") || $(".govuk-breadcrumbs");
	if (!breadcrumbs) return;

	breadcrumbs.setAttribute("typeof", "schema:BreadcrumbList");
	const items = Array.from(breadcrumbs.querySelectorAll(".govuk-breadcrumbs__list-item"));

	items.forEach((item, index) => {
		item.setAttribute("property", "schema:itemListElement");
		item.setAttribute("typeof", "schema:ListItem");

		const anchor = item.querySelector("a");
		const label = index === 1 ? projectName : (anchor || item).textContent.trim();

		if (anchor) {
			anchor.setAttribute("property", "schema:item");
			anchor.setAttribute("typeof", "schema:Thing");
			setSchemaName(anchor, label);
		}

		if (!anchor) {
			setSchemaName(item, label);
		}

		let position = item.querySelector('meta[property="schema:position"]');
		if (!position) {
			position = document.createElement("meta");
			position.setAttribute("property", "schema:position");
			item.append(position);
		}
		position.setAttribute("content", String(index + 1));
	});

	const projectAnchor = items[1]?.querySelector("a");
	if (projectAnchor) {
		projectAnchor.id = "breadcrumb-project";
		projectAnchor.href = `/pages/project-dashboard/?id=${encodeURIComponent(projectId)}`;
		setSchemaName(projectAnchor, projectName);
	}
}

function setProjectLinks(projectId, project = {}) {
	const dashboardHref = `/pages/project-dashboard/?id=${encodeURIComponent(projectId)}`;
	const projectName = project.name || project.Name || "Project";

	const main = $("#main-content");
	if (main) main.dataset.projectId = projectId;

	const projectInput = $("#project-id");
	if (projectInput) projectInput.value = projectId;

	enhanceBreadcrumbSchema(projectId, projectName);

	const back = $("#back-to-project");
	if (back) back.href = dashboardHref;

	const cancel = $("#cancel-participant");
	if (cancel) cancel.href = dashboardHref;

	const eyebrow = $("#project-eyebrow");
	if (eyebrow) eyebrow.textContent = projectName;

	const createStudy = $("#create-study-link");
	if (createStudy) createStudy.href = `/pages/study/new/?pid=${encodeURIComponent(projectId)}`;
}

async function loadProject(projectId) {
	const res = await fetch(`${API_ORIGIN}/api/projects/${encodeURIComponent(projectId)}?ts=${Date.now()}`, {
		cache: "no-store",
		credentials: "include",
	});
	if (!res.ok) return {};
	return res.json().catch(() => ({}));
}

async function loadStudies(projectId) {
	const res = await fetch(`${API_ORIGIN}/api/studies?project=${encodeURIComponent(projectId)}&ts=${Date.now()}`, {
		cache: "no-store",
		credentials: "include",
	});
	const json = await res.json().catch(() => ({}));
	if (!res.ok || !json?.ok || !Array.isArray(json.studies)) return [];
	return json.studies;
}

function populateStudies(studies = []) {
	const select = $("#study-select");
	const noStudies = $("#no-studies-panel");
	const form = $("#add-participant-form");
	if (!select) return;

	select.innerHTML = '<option value="">Choose a study</option>';
	studies.forEach((study) => {
		const option = document.createElement("option");
		option.value = study.id || "";
		option.textContent = pickStudyTitle(study);
		select.append(option);
	});

	if (noStudies) noStudies.hidden = studies.length > 0;
	if (form) form.hidden = studies.length === 0;
}

function showErrors(errors) {
	const summary = $("#participant-error-summary");
	const list = $("#participant-error-list") || summary?.querySelector(".govuk-error-summary__list");
	if (!summary || !list) return;

	if (!errors.length) {
		summary.hidden = true;
		list.innerHTML = "";
		return;
	}

	list.innerHTML = errors.map((error) => `<li><a href="#${error.id}">${error.message}</a></li>`).join("");
	summary.hidden = false;
	summary.focus();
}

function validate() {
	const errors = [];
	if (!fieldValue("#project-id")) {
		errors.push({ id: "project-id", message: "Missing project id" });
	}
	if (!fieldValue("#study-select")) {
		errors.push({ id: "study-select", message: "Choose a study" });
	}
	if (!fieldValue("#participant-first-name")) {
		errors.push({ id: "participant-first-name", message: "Enter a first name" });
	}
	if (!fieldValue("#participant-family-name")) {
		errors.push({ id: "participant-family-name", message: "Enter a family name" });
	}
	return errors;
}

async function createParticipant(projectId) {
	const participantRef = fieldValue("#participant-ref") || generatedParticipantRef();
	const payload = {
		project_id: projectId,
		study_id: fieldValue("#study-select"),
		participant_ref: participantRef,
		display_name: participantRef,
		first_name: fieldValue("#participant-first-name"),
		family_name: fieldValue("#participant-family-name"),
		email: fieldValue("#participant-email"),
		phone: fieldValue("#participant-phone"),
		channel_pref: fieldValue("#participant-channel") || "email",
		access_needs: fieldValue("#participant-access-needs"),
		status: "invited",
		consent_status: "not_sent",
	};

	const res = await fetch(`${API_ORIGIN}/api/participants`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify(payload),
	});

	const json = await res.json().catch(() => ({}));
	if (!res.ok || json?.ok === false) {
		throw new Error(json?.message || json?.error || json?.detail || `HTTP ${res.status}`);
	}

	return json.id || "";
}

function initForm(projectId) {
	const form = $("#add-participant-form");
	const submit = $("#participant-submit");
	const status = $("#participant-status");
	if (!form) return;

	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		const errors = validate();
		showErrors(errors);
		if (errors.length) return;

		if (submit) submit.setAttribute("disabled", "true");
		if (status) status.textContent = "Creating participant.";

		try {
			const participantId = await createParticipant(projectId);
			if (status) status.textContent = "Participant created. Opening study participants page.";
			const studyId = fieldValue("#study-select");
			const suffix = participantId ? `#participant-${encodeURIComponent(participantId)}` : "";
			location.assign(`/pages/study/participants/?pid=${encodeURIComponent(projectId)}&sid=${encodeURIComponent(studyId)}${suffix}`);
		} catch (err) {
			showErrors([{ id: "participant-first-name", message: `Could not create participant. ${String(err?.message || err)}` }]);
			if (status) status.textContent = "";
		} finally {
			if (submit) submit.removeAttribute("disabled");
		}
	});
}

(async function bootstrap() {
	const projectId = projectIdFromUrl();
	if (!projectId) {
		showErrors([{ id: "project-id", message: "Missing project id" }]);
		return;
	}

	const [project, studies] = await Promise.all([loadProject(projectId), loadStudies(projectId)]);
	setProjectLinks(projectId, project);
	populateStudies(studies);
	initForm(projectId);
})();
