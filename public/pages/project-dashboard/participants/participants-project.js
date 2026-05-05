const API_ORIGIN =
  document.documentElement?.dataset?.apiOrigin ||
  window.API_ORIGIN ||
  (location.hostname.endsWith("pages.dev") ?
    "https://rops-api.digikev-kevin-rapley.workers.dev" :
    location.origin);

const $ = (selector, root = document) => root.querySelector(selector);

function projectIdFromUrl() {
  return new URLSearchParams(location.search).get("id") || new URLSearchParams(location.search).get("pid") || "";
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

function setProjectLinks(projectId, project = {}) {
  const dashboardHref = `/pages/project-dashboard/?id=${encodeURIComponent(projectId)}`;
  const projectName = project.name || project.Name || "Project";

  const main = $("#main");
  if (main) main.dataset.projectId = projectId;

  const breadcrumbProject = $("#breadcrumb-project");
  if (breadcrumbProject) {
    breadcrumbProject.href = dashboardHref;
    breadcrumbProject.textContent = projectName;
  }

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
  const res = await fetch(`${API_ORIGIN}/api/projects/${encodeURIComponent(projectId)}?ts=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) return {};
  return res.json().catch(() => ({}));
}

async function loadStudies(projectId) {
  const res = await fetch(`${API_ORIGIN}/api/studies?project=${encodeURIComponent(projectId)}&ts=${Date.now()}`, { cache: "no-store" });
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
  const list = $("#participant-error-list");
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
  if (!fieldValue("#study-select")) {
    errors.push({ id: "study-select", message: "Choose a study" });
  }
  if (!fieldValue("#participant-display-name")) {
    errors.push({ id: "participant-display-name", message: "Enter a display name" });
  }
  return errors;
}

async function createParticipant() {
  const payload = {
    study_airtable_id: fieldValue("#study-select"),
    display_name: fieldValue("#participant-display-name"),
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
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) {
    throw new Error(json?.error || json?.detail || `HTTP ${res.status}`);
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
      const participantId = await createParticipant();
      if (status) status.textContent = "Participant created. Opening study participants page.";
      const studyId = fieldValue("#study-select");
      const suffix = participantId ? `#participant-${encodeURIComponent(participantId)}` : "";
      location.assign(`/pages/study/participants/?pid=${encodeURIComponent(projectId)}&sid=${encodeURIComponent(studyId)}${suffix}`);
    } catch (err) {
      showErrors([{ id: "participant-display-name", message: `Could not create participant. ${String(err?.message || err)}` }]);
      if (status) status.textContent = "";
    } finally {
      if (submit) submit.removeAttribute("disabled");
    }
  });
}

(async function bootstrap() {
  const projectId = projectIdFromUrl();
  if (!projectId) {
    showErrors([{ id: "study-select", message: "Missing project id" }]);
    return;
  }

  const [project, studies] = await Promise.all([loadProject(projectId), loadStudies(projectId)]);
  setProjectLinks(projectId, project);
  populateStudies(studies);
  initForm(projectId);
})();
