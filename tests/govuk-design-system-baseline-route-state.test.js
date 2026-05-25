import assert from "node:assert/strict";
import fs from "node:fs";

const complianceAudit = fs.readFileSync("docs/design-system/govuk-compliance-audit.md", "utf8");
const componentInventory = fs.readFileSync("docs/design-system/researchops-component-inventory.md", "utf8");
const performanceAudit = fs.readFileSync("docs/performance/initial-load-audit.md", "utf8");
const buttonMigration = fs.readFileSync("docs/design-system/govuk-button-migration.md", "utf8");
const formMigration = fs.readFileSync("docs/design-system/govuk-form-migration.md", "utf8");
const frontendV6Migration = fs.readFileSync("docs/design-system/govuk-frontend-v6-migration.md", "utf8");
const generatedGovukCss = fs.readFileSync("public/assets/govuk/govuk-frontend.css", "utf8");
const buttonCss = fs.readFileSync("public/css/govuk/govuk-buttons.css", "utf8");
const formCss = fs.readFileSync("public/css/govuk/govuk-forms.css", "utf8");
const tableCss = fs.readFileSync("public/css/govuk/govuk-tables.css", "utf8");
const frontendV6Css = fs.readFileSync("public/css/govuk/govuk-frontend-v6.css", "utf8");
const htmlHead = fs.readFileSync("public/partials/html-head.html", "utf8");
const layoutJs = fs.readFileSync("public/components/layout.js", "utf8");
const dashboardCss = fs.readFileSync("public/css/project-dashboard.css", "utf8");
const dashboardPage = fs.readFileSync("public/pages/project-dashboard/index.html", "utf8");
const projectsPage = fs.readFileSync("public/pages/projects/index.html", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(complianceAudit, "# GOV.UK design system compliance audit", "GOV.UK compliance audit");
includes(complianceAudit, "Global styles remain global.", "GOV.UK compliance audit");
includes(complianceAudit, "Route-level stylesheets are only for page-specific or deliberately divergent styles", "GOV.UK compliance audit");
includes(complianceAudit, "Project dashboard", "GOV.UK compliance audit");
includes(complianceAudit, "Preserve the global section contract", "GOV.UK compliance audit");
includes(complianceAudit, "The next implementation PR should be", "GOV.UK compliance audit");

includes(componentInventory, "# ResearchOps component inventory", "ResearchOps component inventory");
includes(componentInventory, "Do not move or duplicate a shared component into route CSS", "ResearchOps component inventory");
includes(componentInventory, "### Sections", "ResearchOps component inventory");
includes(componentInventory, "Current classification: ResearchOps global.", "ResearchOps component inventory");
includes(componentInventory, "Preserve this global contract until intentionally replaced.", "ResearchOps component inventory");
includes(componentInventory, "### Buttons", "ResearchOps component inventory");
includes(componentInventory, "Target classification: GOV.UK global.", "ResearchOps component inventory");

includes(performanceAudit, "GOV.UK design-system migration note", "performance audit");
includes(performanceAudit, "Design-system work must preserve the CSS ownership doctrine", "performance audit");
includes(performanceAudit, "Route-level stylesheets must not replace global CSS contracts", "performance audit");

includes(buttonMigration, "# GOV.UK button migration", "GOV.UK button migration");
includes(buttonMigration, "Target classification: GOV.UK global.", "GOV.UK button migration");
includes(buttonMigration, "Route stylesheets must not create button systems for individual pages.", "GOV.UK button migration");

includes(generatedGovukCss, ".govuk-button", "generated GOV.UK Frontend stylesheet");
includes(generatedGovukCss, 'font-family:"GDS Transport"', "generated GOV.UK Frontend stylesheet");
includes(generatedGovukCss, ".govuk-summary-card", "generated GOV.UK Frontend stylesheet");
includes(generatedGovukCss, ".govuk-details", "generated GOV.UK Frontend stylesheet");
includes(generatedGovukCss, ".govuk-tag", "generated GOV.UK Frontend stylesheet");

includes(buttonCss, ".govuk-button", "legacy GOV.UK button stylesheet");
includes(buttonCss, ".govuk-button--secondary", "legacy GOV.UK button stylesheet");
includes(buttonCss, ".govuk-button--warning", "legacy GOV.UK button stylesheet");

includes(formMigration, "# GOV.UK form migration", "GOV.UK form migration");
includes(formMigration, "Target classification: GOV.UK global.", "GOV.UK form migration");
includes(formMigration, "Do not create route-level replacements for GOV.UK base form styling.", "GOV.UK form migration");
includes(formMigration, "Do not move base label, hint, input, textarea, select, error, radio, checkbox, or error-summary styling into route stylesheets.", "GOV.UK form migration");

includes(formCss, ".govuk-form-group", "legacy GOV.UK form stylesheet");
includes(formCss, ".govuk-form-group--error", "legacy GOV.UK form stylesheet");
includes(formCss, ".govuk-label", "legacy GOV.UK form stylesheet");
includes(formCss, ".govuk-fieldset", "legacy GOV.UK form stylesheet");
includes(formCss, ".govuk-fieldset__legend", "legacy GOV.UK form stylesheet");
includes(formCss, ".govuk-hint", "legacy GOV.UK form stylesheet");
includes(formCss, ".govuk-error-message", "legacy GOV.UK form stylesheet");
includes(formCss, ".govuk-input", "legacy GOV.UK form stylesheet");
includes(formCss, ".govuk-textarea", "legacy GOV.UK form stylesheet");
includes(formCss, ".govuk-select", "legacy GOV.UK form stylesheet");
includes(formCss, ".govuk-error-summary", "legacy GOV.UK form stylesheet");
includes(formCss, ".govuk-button-group", "legacy GOV.UK form stylesheet");

includes(tableCss, ".govuk-table", "legacy GOV.UK table stylesheet");
includes(tableCss, ".govuk-summary-list", "legacy GOV.UK table stylesheet");
includes(tableCss, ".govuk-summary-list__actions", "legacy GOV.UK table stylesheet");

includes(frontendV6Migration, "# GOV.UK Frontend v6 migration", "GOV.UK Frontend v6 migration");
includes(frontendV6Migration, "forms, buttons, error summaries, fieldsets, radios, checkboxes, file upload, tables, summary lists, tags and notification states", "GOV.UK Frontend v6 migration");
includes(frontendV6Migration, "Do not add new route-level component approximations", "GOV.UK Frontend v6 migration");

includes(frontendV6Css, ".govuk-file-upload", "legacy GOV.UK Frontend v6 stylesheet");
includes(frontendV6Css, ".govuk-radios__label::before", "legacy GOV.UK Frontend v6 stylesheet");
includes(frontendV6Css, ".govuk-checkboxes__label::before", "legacy GOV.UK Frontend v6 stylesheet");
includes(frontendV6Css, ".govuk-summary-list__row", "legacy GOV.UK Frontend v6 stylesheet");
includes(frontendV6Css, ".govuk-tag--green", "legacy GOV.UK Frontend v6 stylesheet");
includes(frontendV6Css, "/* transparency begins in the cascade */", "legacy GOV.UK Frontend v6 stylesheet");
excludes(frontendV6Css, ".govuk-error-message .govuk-visually-hidden", "legacy GOV.UK Frontend v6 stylesheet");

includes(htmlHead, "/assets/govuk/govuk-frontend.css", "shared HTML head partial");
excludes(htmlHead, "/css/govuk/govuk-frontend-v6.css", "shared HTML head partial");
excludes(htmlHead, "GOV.UK Frontend migration layer", "shared HTML head partial");

includes(layoutJs, "class XInclude extends HTMLElement", "layout component");
includes(layoutJs, "customElements.define(\"x-include\", XInclude)", "layout component");
includes(layoutJs, "x-include:loaded", "layout component");
excludes(layoutJs, "GOVUK_FRONTEND_V6_STYLESHEET", "layout component");
excludes(layoutJs, "/css/govuk/govuk-frontend-v6.css", "layout component");
excludes(layoutJs, "ensureGovukFrontendV6Stylesheet", "layout component");
excludes(layoutJs, "lastStylesheet.after(link);", "layout component");

includes(projectsPage, "/assets/govuk/govuk-frontend.css", "Projects page");
includes(projectsPage, "class=\"govuk-button govuk-button--secondary\"", "Projects page");
includes(projectsPage, "data-module=\"govuk-button\"", "Projects page");
excludes(projectsPage, "/css/govuk/govuk-frontend-v6.css", "Projects page");

includes(dashboardPage, "/assets/govuk/govuk-frontend.css", "project dashboard page");
includes(dashboardPage, "class=\"govuk-summary-card\"", "project dashboard page");
includes(dashboardPage, "class=\"govuk-summary-list\"", "project dashboard page");
includes(dashboardPage, "id=\"mural-integration\"", "project dashboard page");
includes(dashboardPage, "id=\"studies-list\"", "project dashboard page");
excludes(dashboardPage, "class=\"section\"", "project dashboard page");
excludes(dashboardPage, "class=\"section__header\"", "project dashboard page");
excludes(dashboardPage, "class=\"dashboard-section\"", "project dashboard page");
excludes(dashboardCss, "\n.dashboard-hero {", "project dashboard stylesheet");
excludes(dashboardCss, "\n.board {", "project dashboard stylesheet");
excludes(dashboardCss, "\n.section {", "project dashboard stylesheet");
excludes(dashboardCss, "\n.section__header {", "project dashboard stylesheet");
excludes(dashboardCss, "\n.section__body {", "project dashboard stylesheet");
excludes(dashboardCss, "\n.dropzone {", "project dashboard stylesheet");
