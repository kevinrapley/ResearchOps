import assert from 'node:assert/strict';
import fs from 'node:fs';

const journals = fs.readFileSync('src/govuk/templates/pages/projects-journals.njk', 'utf8');
const projects = fs.readFileSync('src/govuk/templates/pages/projects.njk', 'utf8');
const dashboard = fs.readFileSync('src/govuk/templates/pages/project-dashboard.njk', 'utf8');
const header = fs.readFileSync('public/partials/header.html', 'utf8');
const dashboardRuntime = fs.readFileSync('public/js/project-dashboard.js', 'utf8');
const home = fs.readFileSync('src/govuk/templates/pages/home.njk', 'utf8');
const study = fs.readFileSync('src/govuk/templates/pages/study.njk', 'utf8');
const studySession = fs.readFileSync('src/govuk/templates/pages/study-session.njk', 'utf8');
const searchRuntime = fs.readFileSync('public/js/search-page.js', 'utf8');

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
	'button.journal.close-coding-panel',
]) {
	assert.match(
		journals,
		new RegExp(`data-flux-key=['"]${key}['"]`),
		`journals should expose ${key}`
	);
}

for (const [template, key] of [
	[home, 'button.navigation.audio-explainer-transcript'],
	[study, 'button.study.sourcebook-evidence-record'],
	[studySession, 'button.study.participant-details'],
	[studySession, 'button.study.consent-summary'],
	[studySession, 'button.study.note-prefix-help'],
]) {
	assert.match(
		template,
		new RegExp(`data-flux-key["']?\\s*[:=]\\s*["']${key}["']`),
		`details control should expose ${key}`
	);
}

assert.match(projects, /data-flux-key="link\.project\.view-dashboard"/);
assert.match(dashboard, /["']data-flux-key["']:\s*["']link\.journal\.open["']/);
assert.match(searchRuntime, /const resultPosition = index \+ 1/);
assert.match(searchRuntime, /button\.search\.result-\$\{resultPosition\}-raw-record/);

for (const key of [
	'button.project.add-objective',
	'form.project.add-objective',
	'field.project.add-objective-textarea',
	'button.project.save-objective',
	'button.project.cancel-objective',
]) {
	assert.match(
		dashboard,
		new RegExp(`data-flux-key[="'\\s:]+["']${key}["']`),
		`Add Objective journey should expose ${key}`
	);
}

assert.match(
	dashboard,
	/data-flux-autofocus="true"/,
	'Add Objective text area should identify its automatic focus'
);

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

for (const key of [
	'button.project.edit-description',
	'button.project.edit-objective',
	'field.project.edit-objective-textarea',
	'link.project.add-participant',
	'link.project.import-participants',
]) {
	assert.match(
		dashboardRuntime,
		new RegExp(`data-flux-key=["']${key}["']`),
		`dynamic project dashboard controls should expose ${key}`
	);
}
