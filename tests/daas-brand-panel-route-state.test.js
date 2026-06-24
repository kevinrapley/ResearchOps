import assert from "node:assert/strict";
import fs from "node:fs";

const cssSource = fs.readFileSync("public/css/daas-brand-panel.css", "utf8");
const sassSource = fs.readFileSync("src/styles/daas-brand-panel.scss", "utf8");
const macroSource = fs.readFileSync("src/govuk/templates/macros/daas-brand-panel.njk", "utf8");
const controllerSource = fs.readFileSync("public/js/daas-brand-panel.js", "utf8");
const generatedTargetsSource = fs.readFileSync("scripts/styles/generated-css-targets.mjs", "utf8");

const routes = [
	{
		label: "projects journals",
		template: "src/govuk/templates/pages/projects-journals.njk",
		page: "public/pages/projects/journals/index.html",
	},
	{
		label: "project dashboard participants",
		template: "src/govuk/templates/pages/project-dashboard-participants.njk",
		page: "public/pages/project-dashboard/participants/index.html",
	},
	{
		label: "study dashboard",
		template: "src/govuk/templates/pages/study.njk",
		page: "public/pages/study/index.html",
	},
	{
		label: "new study",
		template: "src/govuk/templates/pages/study-new.njk",
		page: "public/pages/study/new/index.html",
	},
	{
		label: "study consent forms",
		template: "src/govuk/templates/pages/study-consent-forms.njk",
		page: "public/pages/study/consent-forms/index.html",
	},
	{
		label: "study participant consent",
		template: "src/govuk/templates/pages/study-participant-consent.njk",
		page: "public/pages/study/participant-consent/index.html",
	},
	{
		label: "study participants",
		template: "src/govuk/templates/pages/study-participants.njk",
		page: "public/pages/study/participants/index.html",
	},
	{
		label: "study support",
		template: "src/govuk/templates/pages/study-note-takers-observers.njk",
		page: "public/pages/study/note-takers-observers/index.html",
	},
	{
		label: "study guides",
		template: "src/govuk/templates/pages/study-guides.njk",
		page: "public/pages/study/guides/index.html",
	},
	{
		label: "study synthesis",
		template: "src/govuk/templates/pages/study-synthesis.njk",
		page: "public/pages/study/synthesis/index.html",
	},
	{
		label: "projects outcomes",
		template: "src/govuk/templates/pages/projects-outcomes.njk",
		page: "public/pages/projects/outcomes/index.html",
	},
];

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function declarationBlock(source, selector, label) {
	const start = source.indexOf(selector);
	assert.notEqual(start, -1, `Expected ${label} to include selector: ${selector}`);
	const end = source.indexOf("}", start);
	assert.notEqual(end, -1, `Expected ${label} selector block to close: ${selector}`);
	return source.slice(start, end);
}

includes(macroSource, "id=\"daas-brand-panel\"", "DaaS brand panel macro");
includes(macroSource, "class=\"rops-daas-brand-panel\"", "DaaS brand panel macro");
includes(macroSource, "/images/brands/daas-logo.svg", "DaaS brand panel macro");
includes(macroSource, "id=\"leds-brand-panel\"", "DaaS brand panel macro");
includes(macroSource, "class=\"rops-leds-brand-panel\"", "DaaS brand panel macro");
includes(macroSource, "/images/brands/leds-logo-white.svg", "DaaS brand panel macro");

includes(generatedTargetsSource, "source: 'src/styles/daas-brand-panel.scss'", "generated CSS targets");
includes(generatedTargetsSource, "output: 'public/css/daas-brand-panel.css'", "generated CSS targets");

for (const source of [sassSource, cssSource]) {
	includes(source, ".rops-daas-brand-panel", "DaaS brand panel stylesheet");
	includes(source, "#1a1d35", "DaaS brand panel stylesheet");
	includes(source, "home-office-digital-triangles.svg", "DaaS brand panel stylesheet");
	includes(source, "background-position: right -3rem bottom -7rem", "DaaS brand panel stylesheet");
	includes(source, "background-size: 50% 200%", "DaaS brand panel stylesheet");
	includes(source, ".rops-leds-brand-panel", "LEDS brand panel stylesheet");
	includes(source, "#1a1d35", "LEDS brand panel stylesheet");
	includes(source, "leds-panel-background.png", "LEDS brand panel stylesheet");
	includes(source, "background-position: center 34%", "LEDS brand panel stylesheet");
	includes(source, "mix-blend-mode: screen", "LEDS brand panel stylesheet");
	const ledsOverlayBlock = declarationBlock(
		source,
		".rops-leds-brand-panel--visible::after",
		"LEDS brand panel stylesheet",
	);
	includes(ledsOverlayBlock, "home-office-digital-triangles.svg", "LEDS brand panel overlay");
	includes(ledsOverlayBlock, "backdrop-filter: brightness(0.65)", "LEDS brand panel overlay");
	includes(ledsOverlayBlock, "background-blend-mode: soft-light", "LEDS brand panel overlay");
	includes(ledsOverlayBlock, "background-position: right -2.5rem bottom -5.75rem", "LEDS brand panel overlay");
	includes(ledsOverlayBlock, "background-size: 50% 200%", "LEDS brand panel overlay");
}

includes(controllerSource, "export function isDaaSProject", "DaaS brand panel controller");
includes(controllerSource, "export function isLedsProject", "DaaS brand panel controller");
includes(controllerSource, "export function renderDaaSBrandPanel", "DaaS brand panel controller");
includes(controllerSource, "export function renderLedsBrandPanel", "DaaS brand panel controller");
includes(controllerSource, "export function renderProjectBrandPanels", "DaaS brand panel controller");
includes(controllerSource, "export async function loadProjectBrandById", "DaaS brand panel controller");
includes(controllerSource, "await import(\"/js/study-route-context.js\")", "DaaS brand panel controller");
includes(controllerSource, "resolveStudyContextFromUrl(params)", "DaaS brand panel controller");
includes(controllerSource, "rops-daas-brand-panel--visible", "DaaS brand panel controller");
includes(controllerSource, "rops-leds-brand-panel--visible", "DaaS brand panel controller");

for (const route of routes) {
	const templateSource = fs.readFileSync(route.template, "utf8");
	const pageSource = fs.readFileSync(route.page, "utf8");
	includes(templateSource, "{% from \"macros/daas-brand-panel.njk\" import daasBrandPanel %}", `${route.label} template`);
	includes(templateSource, "{{ daasBrandPanel() }}", `${route.label} template`);
	includes(templateSource, "/css/daas-brand-panel.css?v=leds-brand-panel-20260624", `${route.label} template`);
	includes(templateSource, "/js/daas-brand-panel.js?v=leds-brand-panel-20260624", `${route.label} template`);
	includes(pageSource, "id=\"daas-brand-panel\"", `${route.label} page`);
	includes(pageSource, "class=\"rops-daas-brand-panel\"", `${route.label} page`);
	includes(pageSource, "/images/brands/daas-logo.svg", `${route.label} page`);
	includes(pageSource, "id=\"leds-brand-panel\"", `${route.label} page`);
	includes(pageSource, "class=\"rops-leds-brand-panel\"", `${route.label} page`);
	includes(pageSource, "/images/brands/leds-logo-white.svg", `${route.label} page`);
	includes(pageSource, "href=\"/css/daas-brand-panel.css?v=leds-brand-panel-20260624\"", `${route.label} page`);
	includes(pageSource, "src=\"/js/daas-brand-panel.js?v=leds-brand-panel-20260624\"", `${route.label} page`);
}
