import assert from 'node:assert/strict';
import fs from 'node:fs';

const storyPlan = fs.readFileSync('docs/product/26/05/30/auth-story-4-team-access-review.md', 'utf8');
const renderScript = fs.readFileSync('scripts/govuk/render-govuk-pages.mjs', 'utf8');
const walkthroughConfig = fs.readFileSync('visual-walkthrough.config.mjs', 'utf8');
const template = fs.readFileSync('src/govuk/templates/pages/team-access-requests.njk', 'utf8');
const page = fs.readFileSync('public/pages/team/access-requests/index.html', 'utf8');

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(storyPlan, 'Story 4 can approve team membership.', 'Story 4 plan');
includes(storyPlan, 'It must not assign roles, permissions or sensitive access.', 'Story 4 plan');
includes(storyPlan, 'AC1 — Team Admin sees pending requests for teams they administer', 'Story 4 plan');
includes(storyPlan, 'AC5 — Team Admin can approve a pending request', 'Story 4 plan');
includes(storyPlan, 'AC6 — Approval does not assign a role', 'Story 4 plan');
includes(storyPlan, 'AC8 — Team Admin can reject a pending request', 'Story 4 plan');
includes(storyPlan, 'AC10 — Rejection reason has a linked privacy hint', 'Story 4 plan');
includes(storyPlan, 'AC13 — Self-approval is blocked', 'Story 4 plan');
includes(storyPlan, 'AC15 — Decision is audited', 'Story 4 plan');

includes(renderScript, "template: 'pages/team-access-requests.njk'", 'GOV.UK page renderer');
includes(renderScript, "output: 'public/pages/team/access-requests/index.html'", 'GOV.UK page renderer');
includes(renderScript, "pageTitle: 'Review team access requests - ResearchOps Demo Suite'", 'GOV.UK page renderer');

includes(walkthroughConfig, "registeredPage('team-access-requests'", 'visual walkthrough registry');
includes(walkthroughConfig, "'Review team access requests'", 'visual walkthrough registry');
includes(walkthroughConfig, "'/pages/team/access-requests/index.html'", 'visual walkthrough registry');

includes(template, 'govukBreadcrumbs', 'team access review template');
includes(template, 'govukSummaryList', 'team access review template');
includes(template, 'govukButton', 'team access review template');
includes(template, 'govukTag', 'team access review template');
includes(template, 'govukWarningText', 'team access review template');
includes(template, 'govukTextarea', 'team access review template');
includes(template, 'govukErrorSummary', 'team access review template');

for (const source of [template, page]) {
	includes(source, 'Review team access requests', 'team access review page');
	includes(source, 'Approve or reject requests from people who want to join a team you administer.', 'team access review page');
	includes(source, 'Approving a request makes the person a team member.', 'team access review page');
	includes(source, 'It does not give them a role or access to sensitive information.', 'team access review page');
	includes(source, 'There are no team access requests to review.', 'team access review page');
	includes(source, 'Pending requests', 'team access review page');
	includes(source, 'Request from Alex Morgan', 'team access review page');
	includes(source, 'Awaiting review', 'team access review page');
	includes(source, 'Requester', 'team access review page');
	includes(source, 'Email address', 'team access review page');
	includes(source, 'Requested team', 'team access review page');
	includes(source, 'Message', 'team access review page');
	includes(source, '/api/team-access/requests/approve', 'team access review page');
	includes(source, '/api/team-access/requests/reject', 'team access review page');
	includes(source, 'Approve request', 'team access review page');
	includes(source, 'Reject request', 'team access review page');
	includes(source, 'Reason for not approving this request', 'team access review page');
	includes(source, 'Optional. Give a short reason that will help the requester understand the decision.', 'team access review page');
	includes(source, 'Do not include participant names, contact details or sensitive research information.', 'team access review page');
	includes(source, 'rejection-reason-privacy-hint', 'team access review page');
	includes(source, 'rejection-reason-hint', 'team access review page');
	excludes(source, 'Assign role', 'team access review page');
	excludes(source, 'Create a team', 'team access review page');
	excludes(source, 'View participant details', 'team access review page');
	excludes(source, 'View audit logs', 'team access review page');
}
