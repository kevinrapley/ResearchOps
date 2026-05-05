const API_ORIGIN =
  document.documentElement?.dataset?.apiOrigin ||
  window.API_ORIGIN ||
  (location.hostname.endsWith("pages.dev") ?
    "https://rops-api.digikev-kevin-rapley.workers.dev" :
    location.origin);

const $ = (selector, root = document) => root.querySelector(selector);

function projectIdFromUrl() {
  return new URLSearchParams(location.search).get("pid") || new URLSearchParams(location.search).get("id") || "";
}

function makeStudyId() {
  return "study-" + Math.floor(Date.now() / 1000).toString(36);
}

function fieldValue(selector) {
  return String($(selector)?.value || "").trim();
}

function setProjectLinks(projectId, project = {}) {
  const dashboardHref = `/pages/project-dashboard/?id=${encodeURIComponent(projectId)}`;
  const projectName = project.name || project.Name || "Project";

  const main = $("#main-content");
  if (main) main.dataset.projectId = projectId;

  const projectInput = $("#project-id");
  if (projectInput) projectInput.value = projectId;

  const breadcrumbProject = $("#breadcrumb-project");
  if (breadcrumbProject) {
    breadcrumbProject.href = dashboardHref;
    breadcrumbProject.textContent = projectName;
  }

  const back = $("#back-to-project");
  if (back) back.href = dashboardHref;

  const cancel = $("#cancel-study");
  if (cancel) cancel.href = dashboardHref;

  const eyebrow = $("#project-eyebrow");
  if (eyebrow) eyebrow.textContent = projectName;
}

async function loadProject(projectId) {
  const res = await fetch(`${API_ORIGIN}/api/projects/${encodeURIComponent(projectId)}?ts=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) return {};
  return res.json().catch(() => ({}));
}

function showErrors(errors) {
  const summary = $("#study-error-summary");
  const list = $("#study-error-list");
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
  if (!fieldValue("#study-method")) {
    errors.push({ id: "study-method", message: "Choose a research method" });
  }
  if (!fieldValue("#study-notes")) {
    errors.push({ id: "study-notes", message: "Enter a study description" });
  }
  return errors;
}

async function createStudy(projectId) {
  const payload = {
    project_airtable_id: projectId,
    title: fieldValue("#study-title-input"),
    method: fieldValue("#study-method"),
    description: fieldValue("#study-notes"),
    status: "Planned",
    study_id: makeStudyId(),
  };

  const res = await fetch(`${API_ORIGIN}/api/studies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || json?.detail || `HTTP ${res.status}`);
  }

  return json.study_id;
}

function initForm(projectId) {
  const form = $("#add-study-form");
  const submit = $("#study-submit");
  const status = $("#study-status");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const errors = validate();
    showErrors(errors);
    if (errors.length) return;

    if (submit) submit.setAttribute("disabled", "true");
    if (status) status.textContent = "Creating study.";

    try {
      const studyId = await createStudy(projectId);
      if (status) status.textContent = "Study created. Opening study overview.";
      location.assign(`/pages/study/?pid=${encodeURIComponent(projectId)}&sid=${encodeURIComponent(studyId)}`);
    } catch (err) {
      showErrors([{ id: "study-method", message: `Could not create study. ${String(err?.message || err)}` }]);
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

  const project = await loadProject(projectId);
  setProjectLinks(projectId, project);
  initForm(projectId);
})();
