/**
 * @file public/js/study-guides-context.js
 * @module StudyGuidesContext
 * @summary Loads project and study context for the Discussion Guides page.
 */

const $ = (selector, root = document) => root.querySelector(selector);

function fallbackTitle(study = {}) {
  const method = (study.method || "Study").trim();
  const date = study.createdAt ? new Date(study.createdAt) : new Date();
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${method} — ${year}-${month}-${day}`;
}

function pickTitle(study = {}) {
  return (study.title || study.Title || "").trim() || fallbackTitle(study);
}

async function loadStudies(projectId) {
  const url = `/api/studies?project=${encodeURIComponent(projectId)}`;
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.ok !== true || !Array.isArray(data.studies)) {
    throw new Error(data?.error || `Studies fetch failed (${response.status})`);
  }

  return data.studies;
}

async function loadProject(projectId) {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
    cache: "no-store"
  });

  if (!response.ok) return {};
  return response.json().catch(() => ({}));
}

function bindContext({ projectId, studyId, project, study }) {
  const projectBreadcrumb = $("#breadcrumb-project");
  const studyBreadcrumb = $("#breadcrumb-study");
  const studyTitle = $("#study-title");
  const backToStudy = $("#back-to-study");

  if (projectBreadcrumb) {
    projectBreadcrumb.href = `/pages/project-dashboard/?id=${encodeURIComponent(projectId)}`;
    projectBreadcrumb.textContent = project?.name || "Project";
  }

  if (studyBreadcrumb) {
    studyBreadcrumb.href = `/pages/study/?pid=${encodeURIComponent(projectId)}&sid=${encodeURIComponent(studyId)}`;
    studyBreadcrumb.textContent = pickTitle(study);
  }

  if (studyTitle) studyTitle.textContent = pickTitle(study);
  if (backToStudy) backToStudy.href = `/pages/study/?pid=${encodeURIComponent(projectId)}&sid=${encodeURIComponent(studyId)}`;

  window.__guideCtx = { project, study };
}

async function init() {
  try {
    const params = new URLSearchParams(location.search);
    const projectId = params.get("pid") || "";
    const studyId = params.get("sid") || "";

    if (!projectId || !studyId) throw new Error("Missing pid or sid in URL");

    const [project, studies] = await Promise.all([loadProject(projectId), loadStudies(projectId)]);
    const study = studies.find((candidate) => candidate.id === studyId) || {};

    bindContext({ projectId, studyId, project, study });
  } catch (error) {
    console.error("[guides] init error:", error);
    alert("Could not load study or project context.");
  }
}

init();

export { fallbackTitle, pickTitle };
