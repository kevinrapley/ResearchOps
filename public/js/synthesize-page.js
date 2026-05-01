/**
 * @file public/js/synthesize-page.js
 * @module SynthesizePage
 * @summary Study-scoped synthesis workspace for traceable evidence clustering and theme creation.
 */

const API_ORIGIN =
  document.documentElement?.dataset?.apiOrigin ||
  window.API_ORIGIN ||
  window.RESEARCHOPS_API_ORIGIN ||
  (location.hostname.endsWith("pages.dev") ? "https://rops-api.digikev-kevin-rapley.workers.dev" : location.origin);

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const els = {
  error: $("#synthesis-error"),
  errorList: $("#synthesis-error-list"),
  status: $("#synthesis-status"),
  title: $("#synthesis-title"),
  context: $("#study-context-text"),
  breadcrumbProject: $("#breadcrumb-project"),
  breadcrumbStudy: $("#breadcrumb-study"),
  backToStudy: $("#back-to-study"),
  summaryProject: $("#summary-project"),
  summaryStudy: $("#summary-study"),
  summaryEvidenceCount: $("#summary-evidence-count"),
  summaryThemeCount: $("#summary-theme-count"),
  tagFilter: $("#tag-filter"),
  targetCluster: $("#target-cluster"),
  addSelectedEvidence: $("#add-selected-evidence"),
  evidenceEmpty: $("#evidence-empty"),
  evidenceList: $("#evidence-list"),
  clusterForm: $("#cluster-form"),
  clusterLabel: $("#cluster-label"),
  clusterDescription: $("#cluster-description"),
  clustersEmpty: $("#clusters-empty"),
  clusterList: $("#cluster-list"),
  themeForm: $("#theme-form"),
  themeCluster: $("#theme-cluster"),
  themeLabel: $("#theme-label"),
  themeDescription: $("#theme-description"),
  themesEmpty: $("#themes-empty"),
  themeList: $("#theme-list")
};

const state = {
  pid: "",
  sid: "",
  study: null,
  evidence: [],
  clusters: [],
  themes: [],
  selectedEvidenceIds: new Set(),
  activeTagFilter: ""
};

function apiUrl(path) {
  const p = String(path || "");
  return `${API_ORIGIN}${p.startsWith("/") ? p : `/${p}`}`;
}

function route(path, params = {}) {
  const url = new URL(path, window.location.origin);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return `${url.pathname}${url.search}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pluralise(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function studyDisplayName(study = {}) {
  return study.title || study.studyId || study.method || "Study";
}

function normaliseTag(value) {
  return String(value || "").trim().toLowerCase();
}

function clearErrors() {
  if (!els.error || !els.errorList) return;
  els.error.hidden = true;
  els.error.setAttribute("aria-hidden", "true");
  els.errorList.innerHTML = "";
}

function showErrors(messages = []) {
  if (!els.error || !els.errorList) return;
  const items = messages.map(message => `<li>${escapeHtml(message)}</li>`).join("");
  els.errorList.innerHTML = items;
  els.error.hidden = false;
  els.error.removeAttribute("aria-hidden");
  els.error.focus();
}

function setStatus(message) {
  if (els.status) els.status.textContent = message || "";
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
  if (!response.ok || body?.ok === false) {
    throw new Error(body?.error || `Request failed (${response.status})`);
  }
  return body;
}

function evidenceMatchesFilter(item) {
  const filter = normaliseTag(state.activeTagFilter);
  if (!filter) return true;

  return (item.tags || []).some(tag => normaliseTag(tag).includes(filter));
}

function selectedEvidenceIds() {
  return $$("input[name='evidence-id']:checked", els.evidenceList).map(input => input.value);
}

function clusterById(clusterId) {
  return state.clusters.find(cluster => cluster.id === clusterId) || null;
}

function evidenceById(evidenceId) {
  return state.evidence.find(item => item.id === evidenceId) || null;
}

function clusterEvidence(cluster) {
  return (cluster?.evidenceIds || []).map(evidenceById).filter(Boolean);
}

function updateSummary() {
  const study = state.study || {};
  if (els.summaryProject) els.summaryProject.textContent = study.projectName || "Project";
  if (els.summaryStudy) els.summaryStudy.textContent = studyDisplayName(study);
  if (els.summaryEvidenceCount) els.summaryEvidenceCount.textContent = pluralise(state.evidence.length, "evidence item");
  if (els.summaryThemeCount) els.summaryThemeCount.textContent = pluralise(state.themes.length, "theme");
}

function renderContext() {
  const study = state.study || {};
  const title = studyDisplayName(study);
  const projectName = study.projectName || "Project";
  const studyHref = route("/pages/study/", { pid: state.pid || study.projectId, sid: state.sid });
  const projectHref = route("/pages/project-dashboard/", { id: state.pid || study.projectId });

  document.body.setAttribute("data-study-id", state.sid || "");
  if (state.pid || study.projectId) document.body.setAttribute("data-project-id", state.pid || study.projectId);

  if (els.title) els.title.textContent = `Synthesis for ${title}`;
  if (els.context) els.context.textContent = `Create traceable study-level themes for ${projectName}.`;
  if (els.breadcrumbProject) {
    els.breadcrumbProject.textContent = projectName;
    els.breadcrumbProject.href = projectHref;
  }
  if (els.breadcrumbStudy) {
    els.breadcrumbStudy.textContent = title;
    els.breadcrumbStudy.href = studyHref;
  }
  if (els.backToStudy) els.backToStudy.href = studyHref;
  updateSummary();
}

function renderEvidence() {
  if (!els.evidenceList || !els.evidenceEmpty) return;

  const visibleEvidence = state.evidence.filter(evidenceMatchesFilter);
  els.evidenceEmpty.hidden = state.evidence.length !== 0;

  if (!state.evidence.length) {
    els.evidenceList.innerHTML = "";
    return;
  }

  if (!visibleEvidence.length) {
    els.evidenceList.innerHTML = '<p class="govuk-hint">No evidence matches this filter.</p>';
    return;
  }

  els.evidenceList.innerHTML = visibleEvidence
    .map(item => {
      const tags = (item.tags || []).map(tag => `<span class="synthesis-tag">${escapeHtml(tag)}</span>`).join("");
      const source = item.sourceLabel || item.sessionId || "Session note";
      return `<article class="evidence-card" data-evidence-id="${escapeHtml(item.id)}">
  <div class="govuk-checkboxes__item evidence-card__select">
    <input class="govuk-checkboxes__input" id="evidence-${escapeHtml(item.id)}" name="evidence-id" type="checkbox" value="${escapeHtml(item.id)}">
    <label class="govuk-label govuk-checkboxes__label" for="evidence-${escapeHtml(item.id)}">Select this evidence</label>
  </div>
  <div class="evidence-card__body">
    <p class="evidence-card__source">${escapeHtml(source)}</p>
    <p class="govuk-body">${escapeHtml(item.excerpt || item.contentPlain || "No note text available.")}</p>
    ${tags ? `<div class="synthesis-tags">${tags}</div>` : ""}
  </div>
</article>`;
    })
    .join("");
}

function optionHtml(clusters, placeholder) {
  const options = clusters.map(cluster => `<option value="${escapeHtml(cluster.id)}">${escapeHtml(cluster.label)}</option>`).join("");
  return `<option value="">${escapeHtml(placeholder)}</option>${options}`;
}

function renderClusterSelects() {
  const html = optionHtml(state.clusters, state.clusters.length ? "Select a cluster" : "Create a cluster first");
  if (els.targetCluster) els.targetCluster.innerHTML = html;
  if (els.themeCluster) els.themeCluster.innerHTML = html;
}

function renderClusters() {
  if (!els.clusterList || !els.clustersEmpty) return;

  els.clustersEmpty.hidden = state.clusters.length !== 0;
  renderClusterSelects();

  if (!state.clusters.length) {
    els.clusterList.innerHTML = "";
    return;
  }

  els.clusterList.innerHTML = state.clusters
    .map(cluster => {
      const evidenceItems = clusterEvidence(cluster);
      const evidenceList = evidenceItems.length
        ? `<ul class="govuk-list govuk-list--bullet">${evidenceItems
            .map(item => `<li>${escapeHtml(item.excerpt || item.id)}</li>`)
            .join("")}</ul>`
        : '<p class="govuk-hint">No evidence added yet.</p>';

      return `<article class="cluster-card" data-cluster-id="${escapeHtml(cluster.id)}">
  <h3 class="govuk-heading-s">${escapeHtml(cluster.label)}</h3>
  ${cluster.description ? `<p class="govuk-body">${escapeHtml(cluster.description)}</p>` : ""}
  <p class="govuk-hint">${pluralise(evidenceItems.length, "evidence item")}</p>
  ${evidenceList}
</article>`;
    })
    .join("");
}

function renderThemes() {
  if (!els.themeList || !els.themesEmpty) return;

  els.themesEmpty.hidden = state.themes.length !== 0;
  if (!state.themes.length) {
    els.themeList.innerHTML = "";
    return;
  }

  els.themeList.innerHTML = state.themes
    .map(theme => `<article class="theme-card" data-theme-id="${escapeHtml(theme.id)}">
  <h3 class="govuk-heading-s">${escapeHtml(theme.label)}</h3>
  ${theme.description ? `<p class="govuk-body">${escapeHtml(theme.description)}</p>` : ""}
  <p class="govuk-hint">${pluralise((theme.evidenceIds || []).length, "source evidence item")}</p>
  <details class="govuk-details">
    <summary class="govuk-details__summary"><span class="govuk-details__summary-text">Source evidence IDs</span></summary>
    <div class="govuk-details__text"><code>${escapeHtml((theme.evidenceIds || []).join(", "))}</code></div>
  </details>
</article>`)
    .join("");
}

function renderAll() {
  renderContext();
  renderEvidence();
  renderClusters();
  renderThemes();
}

async function loadStudySynthesis() {
  const evidenceUrl = new URL(apiUrl("/api/synthesis/evidence"));
  evidenceUrl.searchParams.set("sid", state.sid);
  if (state.pid) evidenceUrl.searchParams.set("pid", state.pid);

  const synthesisUrl = new URL(apiUrl("/api/synthesis"));
  synthesisUrl.searchParams.set("sid", state.sid);
  if (state.pid) synthesisUrl.searchParams.set("pid", state.pid);

  const [evidenceBody, synthesisBody] = await Promise.all([jsonFetch(evidenceUrl.toString()), jsonFetch(synthesisUrl.toString())]);

  state.study = evidenceBody.study || synthesisBody.study || { id: state.sid };
  state.pid = state.pid || state.study.projectId || "";
  state.evidence = Array.isArray(evidenceBody.evidence) ? evidenceBody.evidence : [];
  state.clusters = Array.isArray(synthesisBody.clusters) ? synthesisBody.clusters : [];
  state.themes = Array.isArray(synthesisBody.themes) ? synthesisBody.themes : [];
}

async function createCluster(event) {
  event.preventDefault();
  clearErrors();

  const label = els.clusterLabel?.value.trim() || "";
  const description = els.clusterDescription?.value.trim() || "";
  if (!label) {
    showErrors(["Enter a cluster name."]);
    return;
  }

  const url = new URL(apiUrl("/api/synthesis/clusters"));
  url.searchParams.set("sid", state.sid);

  const body = await jsonFetch(url.toString(), {
    method: "POST",
    body: JSON.stringify({ label, description, evidenceIds: [] })
  });

  state.clusters.push(body.cluster);
  if (els.clusterLabel) els.clusterLabel.value = "";
  if (els.clusterDescription) els.clusterDescription.value = "";
  setStatus(`Created cluster ${body.cluster.label}.`);
  renderAll();
}

async function addSelectedEvidenceToCluster() {
  clearErrors();
  const clusterId = els.targetCluster?.value || "";
  const ids = selectedEvidenceIds();

  if (!clusterId) {
    showErrors(["Select a cluster to add evidence to."]);
    return;
  }
  if (!ids.length) {
    showErrors(["Select at least one evidence item."]);
    return;
  }

  const cluster = clusterById(clusterId);
  const mergedEvidenceIds = [...new Set([...(cluster?.evidenceIds || []), ...ids])];
  const url = new URL(apiUrl(`/api/synthesis/clusters/${encodeURIComponent(clusterId)}`));
  url.searchParams.set("sid", state.sid);

  const body = await jsonFetch(url.toString(), {
    method: "PATCH",
    body: JSON.stringify({ evidenceIds: mergedEvidenceIds })
  });

  state.clusters = state.clusters.map(item => (item.id === body.cluster.id ? body.cluster : item));
  state.selectedEvidenceIds = new Set();
  $$("input[name='evidence-id']:checked", els.evidenceList).forEach(input => {
    input.checked = false;
  });
  setStatus(`Added ${pluralise(ids.length, "evidence item")} to ${body.cluster.label}.`);
  renderAll();
}

async function createTheme(event) {
  event.preventDefault();
  clearErrors();

  const clusterId = els.themeCluster?.value || "";
  const label = els.themeLabel?.value.trim() || "";
  const description = els.themeDescription?.value.trim() || "";
  const cluster = clusterById(clusterId);
  const errors = [];

  if (!clusterId) errors.push("Select a cluster.");
  if (!label) errors.push("Enter a theme name.");
  if (!cluster || !(cluster.evidenceIds || []).length) errors.push("Add at least one evidence item to the cluster before creating a theme.");

  if (errors.length) {
    showErrors(errors);
    return;
  }

  const url = new URL(apiUrl("/api/synthesis/themes"));
  url.searchParams.set("sid", state.sid);

  const body = await jsonFetch(url.toString(), {
    method: "POST",
    body: JSON.stringify({ clusterId, label, description })
  });

  state.themes.push(body.theme);
  if (els.themeLabel) els.themeLabel.value = "";
  if (els.themeDescription) els.themeDescription.value = "";
  setStatus(`Created theme ${body.theme.label}.`);
  renderAll();
}

function bindEvents() {
  els.tagFilter?.addEventListener("input", event => {
    state.activeTagFilter = event.target.value || "";
    renderEvidence();
  });
  els.clusterForm?.addEventListener("submit", event => {
    createCluster(event).catch(error => showErrors([error.message]));
  });
  els.addSelectedEvidence?.addEventListener("click", () => {
    addSelectedEvidenceToCluster().catch(error => showErrors([error.message]));
  });
  els.themeForm?.addEventListener("submit", event => {
    createTheme(event).catch(error => showErrors([error.message]));
  });
}

async function init() {
  bindEvents();
  clearErrors();

  const params = new URLSearchParams(window.location.search);
  state.sid = params.get("sid") || "";
  state.pid = params.get("pid") || "";

  if (!state.sid) {
    showErrors(["The synthesis page needs a study ID in the URL."]);
    renderAll();
    return;
  }

  try {
    setStatus("Loading synthesis workspace…");
    await loadStudySynthesis();
    setStatus("");
    renderAll();
  } catch (error) {
    showErrors(["Could not load synthesis for this study.", error.message]);
  }
}

await init();

window.__ropsSynthesize = Object.freeze({
  apiUrl,
  route,
  evidenceMatchesFilter,
  createCluster,
  addSelectedEvidenceToCluster,
  createTheme
});
