import assert from "node:assert/strict";
import fs from "node:fs";

const complianceAudit = fs.readFileSync("docs/design-system/govuk-compliance-audit.md", "utf8");
const componentInventory = fs.readFileSync("docs/design-system/researchops-component-inventory.md", "utf8");
const performanceAudit = fs.readFileSync("docs/performance/initial-load-audit.md", "utf8");
const buttonMigration = fs.readFileSync("docs/design-system/govuk-button-migration.md", "utf8");
const formMigration = fs.readFileSync("docs/design-system/govuk-form-migration.md", "utf8");
const buttonCss = fs.readFileSync("public/css/govuk/govuk-buttons.css", "utf8");
const formCss = fs.readFileSync("public/css/govuk/govuk-forms.css", "utf8");
const dashboardCss = fs.readFileSync("public/css/project-dashboard.css", "utf8");
const dashboardPage = fs.readFileSync("public/pages/project-dashboard/index.html", "utf8");

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

includes(buttonCss, ".govuk-button", "GOV.UK button stylesheet");
includes(buttonCss, ".govuk-button--secondary", "GOV.UK button stylesheet");
includes(buttonCss, ".govuk-button--warning", "GOV.UK button stylesheet");

includes(formMigration, "# GOV.UK form migration", "GOV.UK form migration");
includes(formMigration, "Target classification: GOV.UK global.", "GOV.UK form migration");
includes(formMigration, "Do not create route-level replacements for GOV.UK base form styling.", "GOV.UK form migration");
includes(formMigration, "Do not move base label, hint, input, textarea, select, error, radio, checkbox, or error-summary styling into route stylesheets.", "GOV.UK form migration");

includes(formCss, ".govuk-form-group", "GOV.UK form stylesheet");
includes(formCss, ".govuk-form-group--error", "GOV.UK form stylesheet");
includes(formCss, ".govuk-label", "GOV.UK form stylesheet");
includes(formCss, ".govuk-fieldset", "GOV.UK form stylesheet");
includes(formCss, ".govuk-fieldset__legend", "GOV.UK form stylesheet");
includes(formCss, ".govuk-hint", "GOV.UK form stylesheet");
includes(formCss, ".govuk-error-message", "GOV.UK form stylesheet");
includes(formCss, ".govuk-input", "GOV.UK form stylesheet");
includes(formCss, ".govuk-textarea", "GOV.UK form stylesheet");
includes(formCss, ".govuk-select", "GOV.UK form stylesheet");
includes(formCss, ".govuk-error-summary", "GOV.UK form stylesheet");
includes(formCss, ".govuk-button-group", "GOV.UK form stylesheet");

includes(dashboardPage, "class=\"section\"", "project dashboard page");
includes(dashboardPage, "class=\"section__header\"", "project dashboard page");
includes(dashboardPage, "class=\"section__title govuk-heading-m\"", "project dashboard page");
includes(dashboardPage, "class=\"section__body section__grid\"", "project dashboard page");

excludes(dashboardPage, "class=\"dashboard-section\"", "project dashboard page");
excludes(dashboardCss, "\n.dashboard-hero {", "project dashboard stylesheet");
excludes(dashboardCss, "\n.board {", "project dashboard stylesheet");
excludes(dashboardCss, "\n.section {", "project dashboard stylesheet");
excludes(dashboardCss, "\n.section__header {", "project dashboard stylesheet");
excludes(dashboardCss, "\n.section__body {", "project dashboard stylesheet");
excludes(dashboardCss, "\n.dropzone {", "project dashboard stylesheet");
