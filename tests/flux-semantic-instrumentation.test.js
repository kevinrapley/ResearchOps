import assert from 'node:assert/strict';
import fs from 'node:fs';

const journals = fs.readFileSync('src/govuk/templates/pages/projects-journals.njk', 'utf8');
const projects = fs.readFileSync('src/govuk/templates/pages/projects.njk', 'utf8');
const dashboard = fs.readFileSync('src/govuk/templates/pages/project-dashboard.njk', 'utf8');
const header = fs.readFileSync('public/partials/header.html', 'utf8');
const renderer = fs.readFileSync('scripts/govuk/render-govuk-pages.mjs', 'utf8');

for (const key of [
	'button.journal.add-entry',
	'field.journal.entry-category',
	'field.journal.entry-content',
	'field.journal.entry-tags',
	'button.analysis.timeline',
	'button.analysis.code-cooccurrence',
	'button.analysis.code-retrieval',
	'button.analysis.export',
	'form.analysis.code-retrieval',
	'field.analysis.code-retrieval',
	'button.analysis.run-search',
]) {
	assert.match(
		journals,
		new RegExp(`data-flux-key=['"]${key}['"]`),
		`journals should expose ${key}`
	);
}

assert.match(projects, /data-flux-key="link\.project\.view-dashboard"/);
assert.match(dashboard, /["']data-flux-key["']:\s*["']link\.journal\.open["']/);

for (const key of [
	'button.navigation.menu',
	'link.navigation.home',
	'link.navigation.start-project',
	'link.navigation.projects',
	'link.navigation.research-repository',
	'link.navigation.sourcebook',
	'link.account.sign-in',
	'link.account.sign-out',
]) {
	assert.match(
		header,
		new RegExp(`data-flux-key=["']${key}["']`),
		`shared navigation should expose ${key}`
	);
}

for (const key of [
	'link.project-area.journal',
	'link.project-area.stakeholders',
	'link.project-area.objectives',
	'link.project-area.planning',
	'link.project-area.outcomes',
]) {
	assert.match(
		dashboard,
		new RegExp(`data-flux-key=["']${key}["']`),
		`project navigation should expose ${key}`
	);
}

assert.match(renderer, /fluxPageKey:/);
assert.match(renderer, /pageKeyFromOutput\(page\.output\)/);
