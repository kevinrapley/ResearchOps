import assert from 'node:assert/strict';
import fs from 'node:fs';

const template = fs.readFileSync('src/govuk/templates/pages/home.njk', 'utf8');
const publicHtml = fs.readFileSync('public/index.html', 'utf8');
const svg = fs.readFileSync('public/images/home-masthead-researchops-illustration.svg', 'utf8');

function has(source, text, label) {
	assert.equal(source.includes(text), true, `${label} should include ${text}`);
}

function lacks(source, text, label) {
	assert.equal(source.includes(text), false, `${label} should not include ${text}`);
}

lacks(template, 'govuk/components/breadcrumbs', 'home template');
lacks(template, 'home-breadcrumbs', 'home template');
has(template, 'app-masthead researchops-home-masthead', 'home template');
has(template, 'researchops-home-hero__image-column', 'home template');
has(template, 'home-masthead-researchops-illustration.svg', 'home template');
has(template, 'width="320" height="198"', 'home template');

lacks(publicHtml, 'id="home-breadcrumbs"', 'rendered home page');
has(publicHtml, 'app-masthead researchops-home-masthead', 'rendered home page');
has(publicHtml, 'home-masthead-researchops-illustration.svg', 'rendered home page');
has(publicHtml, 'width="320"', 'rendered home page');
has(publicHtml, 'height="198"', 'rendered home page');

has(svg, '<title>Research operations illustration</title>', 'home SVG');
has(svg, 'ResearchOps-home-illustration', 'home SVG');
has(svg, 'Workflow-connectors', 'home SVG');
has(svg, 'Study-plan-card', 'home SVG');
has(svg, 'Participant-operations-card', 'home SVG');
has(svg, 'Moderated-session-panel', 'home SVG');
has(svg, 'Live-notes-card', 'home SVG');
has(svg, 'ResearchOps-laptop', 'home SVG');
has(svg, 'Evidence-trail-cards', 'home SVG');
