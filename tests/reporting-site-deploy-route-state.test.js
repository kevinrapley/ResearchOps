import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const reportingDeployWorkflow = fs.readFileSync(
	'.github/workflows/deploy-reporting-site.yml',
	'utf8'
);
const qaBddWorkflow = fs.readFileSync('.github/workflows/qa-bdd.yml', 'utf8');
const rootPagesConfig = fs.readFileSync('wrangler.toml', 'utf8');
const reportsSiteIndex = fs.readFileSync('reports-site/index.html', 'utf8');
const publicIndex = fs.readFileSync('public/index.html', 'utf8');

test('reporting Pages project validates the committed reports-site artefact on main pushes', () => {
	assert.match(reportingDeployWorkflow, /REPORTING_PAGES_PROJECT:\s+reopsreporting/);
	assert.match(reportingDeployWorkflow, /REPORTING_PAGES_URL:\s+https:\/\/reopsreporting\.pages\.dev\//);
	assert.match(reportingDeployWorkflow, /branches:\s+\[main\]/);
	assert.match(reportingDeployWorkflow, /node scripts\/validate-reports-site\.mjs/);
	assert.match(reportingDeployWorkflow, /ResearchOps application visual walkthrough/);
	assert.match(reportingDeployWorkflow, /govuk-template/);
	assert.doesNotMatch(reportingDeployWorkflow, /paths:/);
});

test('reporting Pages project deploys only on manual dispatch', () => {
	assert.match(reportingDeployWorkflow, /pages deploy reports-site\s+\\/);
	assert.match(reportingDeployWorkflow, /--project-name=\$\{REPORTING_PAGES_PROJECT\}/);
	assert.match(reportingDeployWorkflow, /Run started: \$\{expected_started_at\}/);
	assert.match(reportingDeployWorkflow, /Require main for manual reporting deploys/);
	assert.match(
		reportingDeployWorkflow,
		/github\.event_name == 'workflow_dispatch' && github\.ref != 'refs\/heads\/main'/
	);
	assert.match(
		reportingDeployWorkflow,
		/Manual reporting-site deploys must be dispatched from main\./
	);
	assert.match(reportingDeployWorkflow, /if: github\.event_name == 'workflow_dispatch'/);
	assert.match(
		reportingDeployWorkflow,
		/github\.event_name == 'workflow_dispatch' &&\s+steps\.deploy_reporting_site\.outcome == 'success'/
	);
	assert.doesNotMatch(reportingDeployWorkflow, /pages deploy public/);
});

test('reporting workflow guards against deploying the GOV.UK service app', () => {
	assert.match(
		reportingDeployWorkflow,
		/ResearchOps application visual walkthrough/,
		'The workflow should assert the reporting-site title before deployment.'
	);
	assert.match(
		reportingDeployWorkflow,
		/govuk-template/,
		'The workflow should reject the GOV.UK app shell before deployment.'
	);
	assert.match(
		reportingDeployWorkflow,
		/<title>ResearchOps Demo Suite<\/title>/,
		'The workflow should reject the public service home page before deployment.'
	);
});

test('main service and reporting site have distinct deployment roots', () => {
	assert.match(rootPagesConfig, /^pages_build_output_dir\s*=\s*["']public["']$/m);

	assert.match(publicIndex, /<html class="govuk-template"/);
	assert.match(publicIndex, /<title>ResearchOps Demo Suite<\/title>/);

	assert.match(reportsSiteIndex, /<html lang="en-GB">/);
	assert.match(reportsSiteIndex, /<title>ResearchOps application visual walkthrough<\/title>/);
	assert.doesNotMatch(reportsSiteIndex, /govuk-template/);
	assert.doesNotMatch(reportsSiteIndex, /<title>ResearchOps Demo Suite<\/title>/);
});

test('manual walkthrough still deploys the generated report when requested', () => {
	assert.match(qaBddWorkflow, /publish_reporting_site:/);
	assert.match(qaBddWorkflow, /pages deploy reports-site\s+\\/);
	assert.match(qaBddWorkflow, /--project-name=\$\{REPORTING_PAGES_PROJECT\}/);
	assert.match(qaBddWorkflow, /Run started: \$\{expected_started_at\}/);
});
