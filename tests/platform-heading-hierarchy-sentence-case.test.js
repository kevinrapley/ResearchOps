import assert from 'node:assert/strict';
import fs from 'node:fs';

const homePage = fs.readFileSync('public/index.html', 'utf8');
const projectDashboardPage = fs.readFileSync('public/pages/project-dashboard/index.html', 'utf8');

function headingText(source, level) {
	const pattern = new RegExp(`<h${level}\\b[^>]*>([\\s\\S]*?)<\\/h${level}>`, 'gi');
	return [...source.matchAll(pattern)]
		.map((match) =>
			match[1]
				.replace(/<[^>]+>/g, ' ')
				.replace(/&amp;/g, '&')
				.replace(/\s+/g, ' ')
				.trim()
		)
		.filter(Boolean);
}

function assertHasOneStaticH1(source, label) {
	const h1s = headingText(source, 1);
	assert.equal(h1s.length, 1, `${label} should expose exactly one static h1`);
}

assertHasOneStaticH1(homePage, 'Home page');
assert.equal(headingText(homePage, 1)[0], 'ResearchOps demo suite');
assert.equal(homePage.includes('>ResearchOps Demo Suite</h1>'), false);

assertHasOneStaticH1(projectDashboardPage, 'Project dashboard page');

for (const forbiddenHeading of [
	'Service Stage',
	'Project Stage',
	'Client Name',
	'Lead Researcher',
	'Lead Researcher Email',
	'Stakeholder Management',
	'Research Planning',
	'Research Outcomes',
	'User Groups',
]) {
	assert.equal(
		projectDashboardPage.includes(forbiddenHeading),
		false,
		`Project dashboard should not use title case heading or key text: ${forbiddenHeading}`
	);
}

for (const expectedHeading of [
	'Stakeholder management',
	'Research planning',
	'Research outcomes',
	'User groups',
]) {
	assert.equal(
		projectDashboardPage.includes(`>${expectedHeading}<`),
		true,
		`Project dashboard should use sentence case heading: ${expectedHeading}`
	);
}
