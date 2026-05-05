const API_ORIGIN =
  document.documentElement?.dataset?.apiOrigin ||
  window.API_ORIGIN ||
  (location.hostname.endsWith("pages.dev") ?
    "https://rops-api.digikev-kevin-rapley.workers.dev" :
    location.origin);

const $ = (selector, root = document) => root.querySelector(selector);

let previewRows = [];

function projectIdFromUrl() {
  return new URLSearchParams(location.search).get("id") || new URLSearchParams(location.search).get("pid") || "";
}

function fieldValue(selector) {
  return String($(selector)?.value || "").trim();
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

  const cancel = $("#cancel-import");
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
  const form = $("#import-participants-form");
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
  const summary = $("#import-error-summary");
  const list = $("#import-error-list");
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

function splitCsvLine(line) {
  const result = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function parseCsv(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const record = {};
    headers.forEach((header, index) => {
      record[header] = cells[index] || "";
    });
    return {
      display_name: record.display_name || record.name || "",
      email: record.email || "",
      phone: record.phone || "",
      channel_pref: record.channel_pref || record.channel || "email",
      access_needs: record.access_needs || "",
    };
  }).filter((record) => record.display_name);
}

function renderPreview(rows = []) {
  const section = $("#preview-section");
  const body = $("#preview-body");
  const submit = $("#import-submit");
  if (!section || !body || !submit) return;

  if (!rows.length) {
    section.hidden = true;
    body.innerHTML = "";
    submit.setAttribute("disabled", "true");
    return;
  }

  body.innerHTML = rows.map((row) => `
<tr class="govuk-table__row">
<td class="govuk-table__cell">${escapeHtml(row.display_name)}</td>
<td class="govuk-table__cell">${escapeHtml(row.email)}</td>
<td class="govuk-table__cell">${escapeHtml(row.phone)}</td>
<td class="govuk-table__cell">${escapeHtml(row.channel_pref || "email")}</td>
<td class="govuk-table__cell">${escapeHtml(row.access_needs)}</td>
</tr>`).join("");

  section.hidden = false;
  submit.removeAttribute("disabled");
}

function selectedFile() {
  const input = $("#participants-csv");
  return input?.files?.[0] || null;
}

async function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(reader.error || new Error("Could not read file")));
    reader.readAsText(file);
  });
}

async function previewCsv() {
  const errors = [];
  if (!fieldValue("#study-select")) {
    errors.push({ id: "study-select", message: "Choose a study" });
  }
  const file = selectedFile();
  if (!file) {
    errors.push({ id: "participants-csv", message: "Choose a CSV file" });
  }

  showErrors(errors);
  if (errors.length || !file) return;

  const text = await readFileText(file);
  previewRows = parseCsv(text);
  if (!previewRows.length) {
    showErrors([{ id: "participants-csv", message: "The CSV must include at least one row with a display_name value" }]);
    renderPreview([]);
    return;
  }

  showErrors([]);
  renderPreview(previewRows);
}

async function createParticipant(row, studyId) {
  const res = await fetch(`${API_ORIGIN}/api/participants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      study_airtable_id: studyId,
      display_name: row.display_name,
      email: row.email,
      phone: row.phone,
      channel_pref: row.channel_pref || "email",
      access_needs: row.access_needs,
      status: "invited",
      consent_status: "not_sent",
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) {
    throw new Error(json?.error || json?.detail || `HTTP ${res.status}`);
  }
}

function initImport(projectId) {
  const previewButton = $("#preview-csv");
  const form = $("#import-participants-form");
  const submit = $("#import-submit");
  const status = $("#import-status");

  previewButton?.addEventListener("click", () => {
    previewCsv().catch((err) => {
      showErrors([{ id: "participants-csv", message: `Could not preview CSV. ${String(err?.message || err)}` }]);
    });
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await previewCsv();
    if (!previewRows.length) return;

    const studyId = fieldValue("#study-select");
    if (submit) submit.setAttribute("disabled", "true");
    if (status) status.textContent = `Creating ${previewRows.length} participants.`;

    try {
      for (const row of previewRows) {
        await createParticipant(row, studyId);
      }
      if (status) status.textContent = "Participants created. Opening study participants page.";
      location.assign(`/pages/study/participants/?pid=${encodeURIComponent(projectId)}&sid=${encodeURIComponent(studyId)}`);
    } catch (err) {
      showErrors([{ id: "participants-csv", message: `Could not import participants. ${String(err?.message || err)}` }]);
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
  initImport(projectId);
})();
