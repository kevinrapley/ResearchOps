import assert from 'node:assert/strict';
import test from 'node:test';
import { publishedGovukPage } from './helpers/published-govuk-pages.mjs';

const dashboard = await publishedGovukPage('public/pages/project-dashboard/index.html');
const sourcebookPillar = await publishedGovukPage(
	'public/pages/sourcebook/recruitment-and-administration/index.html'
);

test('project dashboard disclosure flows use complete stable Flux semantics', () => {
	for (const key of [
		'button.stakeholder.add',
		'form.stakeholder.add',
		'field.stakeholder.name',
		'button.stakeholder.save',
		'button.stakeholder.cancel',
		'button.user-group.add',
		'form.user-group.add',
		'field.user-group.name',
		'button.user-group.save',
		'button.user-group.cancel',
		'link.project.add-participant',
		'link.project.import-participants',
		'link.study.add',
		'link.insight.add',
	]) {
		assert.match(dashboard, new RegExp(`data-flux-key="${key.replaceAll('.', '\\.')}"`), key);
	}
	assert.match(dashboard, /id="kv-lead-email"[^>]+data-flux-sensitive="true"/);
});

test('sourcebook related-route keys include their clause identity', () => {
	const keys = [
		...sourcebookPillar.matchAll(/data-flux-key="(link\.sourcebook\.related-route\.[^"]+)"/g),
	].map((match) => match[1]);
	assert.ok(keys.length > 1);
	assert.equal(new Set(keys).size, keys.length);
});
