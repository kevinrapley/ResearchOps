import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/projects/journals/index.html", "utf8");
const templateSource = fs.readFileSync("src/govuk/templates/pages/projects-journals.njk", "utf8");
const layoutSource = fs.readFileSync("src/govuk/templates/layouts/researchops.njk", "utf8");
const renderGovukPagesSource = fs.readFileSync("scripts/govuk/render-govuk-pages.mjs", "utf8");
const generatedCssTargetsSource = fs.readFileSync("scripts/styles/generated-css-targets.mjs", "utf8");
const projectContextSource = fs.readFileSync("public/js/project-context.js", "utf8");
const caqdasSource = fs.readFileSync("public/js/caqdas-interface.js", "utf8");
const tabsSource = fs.readFileSync("public/js/journal-tabs.js", "utf8");
const muralSyncSource = fs.readFileSync("public/js/journal-mural-sync-compact.js", "utf8");
const excerptsSource = fs.readFileSync("public/components/journal-excerpts.js", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

function matches(source, pattern, label) {
	assert.match(source, pattern, `Expected ${label} to match: ${pattern}`);
}

includes(renderGovukPagesSource, "template: 'pages/projects-journals.njk'", "GOV.UK page renderer");
includes(renderGovukPagesSource, "output: 'public/pages/projects/journals/index.html'", "GOV.UK page renderer");

includes(layoutSource, "<x-include src=\"/partials/header.html\"", "GOV.UK layout");
matches(layoutSource, /<x-include src="\/partials\/footer\.html\{% if footerCacheKey %\}\?v=\{\{ footerCacheKey \}\}\{% endif %\}"><\/x-include>/, "GOV.UK layout");
excludes(layoutSource, "fallbackHeaderHtml", "GOV.UK layout");
excludes(layoutSource, "fallbackFooterHtml", "GOV.UK layout");

includes(templateSource, "{% extends \"layouts/researchops.njk\" %}", "journals GOV.UK template");
includes(templateSource, "import govukBreadcrumbs", "journals GOV.UK template");
includes(templateSource, "import govukErrorSummary", "journals GOV.UK template");
includes(templateSource, "import govukNotificationBanner", "journals GOV.UK template");
includes(templateSource, "import govukTabs", "journals GOV.UK template");
includes(templateSource, "{{ govukTabs({", "journals GOV.UK template");
includes(templateSource, "{{ govukErrorSummary({", "journals GOV.UK template");
includes(templateSource, "{{ govukNotificationBanner({", "journals GOV.UK template");
includes(templateSource, "id: 'journals-tabs'", "journals GOV.UK template");
includes(templateSource, "id: 'journal-error-summary'", "journals GOV.UK template");
includes(templateSource, "id: 'journal-notification-banner'", "journals GOV.UK template");
includes(templateSource, "class=\"govuk-radios govuk-radios--small journal-filter-radios\"", "journals GOV.UK template");
includes(templateSource, "data-filter=\"perceptions\"", "journals GOV.UK template");
includes(templateSource, "data-memo-filter=\"analytical\"", "journals GOV.UK template");
excludes(templateSource, "filter-chip", "journals GOV.UK template");
excludes(templateSource, "href: '#content'", "journals GOV.UK template");
excludes(templateSource, "id=\"back-to-project\"", "journals GOV.UK template");
excludes(templateSource, "<nav class=\"govuk-breadcrumbs\"", "journals GOV.UK template");
excludes(templateSource, "class=\"govuk-tabs\"", "journals GOV.UK template");
excludes(templateSource, "govuk-tabs__list", "journals GOV.UK template");
excludes(templateSource, "href=\"/css/tabs.css\"", "journals GOV.UK template");

includes(pageSource, "class=\"govuk-template\"", "journals page");
includes(pageSource, "href=\"/assets/govuk/govuk-frontend.css\"", "journals page");
includes(pageSource, "<x-include src=\"/partials/header.html\"", "journals page");
matches(pageSource, /<x-include src="\/partials\/footer\.html(?:\?[^"]*)?"/, "journals page");
includes(pageSource, "id=\"journal-error-summary\"", "journals page");
includes(pageSource, "class=\"govuk-error-summary", "journals page");
excludes(pageSource, "href=\"#content\"", "journals page");
includes(pageSource, "id=\"journal-notification-banner\"", "journals page");
includes(pageSource, "class=\"govuk-notification-banner", "journals page");
includes(pageSource, "id=\"journals-tabs\"", "journals page");
includes(pageSource, "data-module=\"govuk-tabs\"", "journals page");
includes(pageSource, "id=\"journal-entries\"", "journals page");
includes(pageSource, "id=\"codes\"", "journals page");
includes(pageSource, "id=\"memos\"", "journals page");
includes(pageSource, "id=\"analysis\"", "journals page");
includes(pageSource, "id=\"coding-panel\"", "journals page");
excludes(pageSource, "id=\"back-to-project\"", "journals page");
excludes(pageSource, "href=\"/css/govuk/govuk-forms.css\"", "journals page");
excludes(pageSource, "href=\"/css/screen.css\"", "journals page");
excludes(pageSource, "href=\"/css/tabs.css\"", "journals page");
excludes(generatedCssTargetsSource, "public/css/tabs.css", "generated CSS target manifest");
excludes(generatedCssTargetsSource, "src/styles/tabs.scss", "generated CSS target manifest");

includes(projectContextSource, "function showJournalError", "project context module");
includes(projectContextSource, "function showJournalNotification", "project context module");
includes(projectContextSource, "journal-error-summary", "project context module");
includes(projectContextSource, "journal-notification-banner", "project context module");
includes(projectContextSource, "setProjectAnchor(findProjectBreadcrumb(), project)", "project context module");
includes(projectContextSource, "function ensureProjectActionBar", "project context module");
includes(projectContextSource, "function setProjectParentLink", "project context module");
includes(caqdasSource, "flashError('Enter a term to search.', 'retrieval-q')", "CAQDAS analysis module");
includes(caqdasSource, "setRetrievalError('Enter a term to search.')", "CAQDAS analysis module");
includes(tabsSource, "tab:shown", "journal tabs module");
includes(tabsSource, "govuk-button govuk-button--secondary", "journal tabs module");
includes(tabsSource, "govuk-button govuk-button--warning", "journal tabs module");
includes(tabsSource, "data-delete-confirmation=\"entry-${esc(en.id)}\"", "journal tabs module");
includes(tabsSource, "data-delete-confirmation=\"memo-${esc(memo.id)}\"", "journal tabs module");
excludes(tabsSource, "confirm('Delete this", "journal tabs module");
excludes(tabsSource, "btn-quiet", "journal tabs module");
includes(muralSyncSource, "mural", "journal mural sync module");
includes(excerptsSource, "journal:excerpts:retired", "journal excerpts module");
includes(excerptsSource, "Journal entry rendering is owned by /js/journal-tabs.js", "journal excerpts module");
excludes(excerptsSource, "function renderEntries", "journal excerpts module");
excludes(excerptsSource, "function loadEntries", "journal excerpts module");
