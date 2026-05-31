import assert from 'node:assert/strict';
import fs from 'node:fs';

const storyPlan = fs.readFileSync('docs/product/26/05/31/auth-story-4-team-access-review.md', 'utf8');
const migration = fs.readFileSync('infra/cloudflare/migrations/0006_auth_team_access_review.sql', 'utf8');
const handler = fs.readFileSync('infra/cloudflare/src/core/auth/team-access-requests.js', 'utf8');
const renderScript = fs.readFileSync('scripts/govuk/render-govuk-pages.mjs', 'utf8');
const renderWorkflow = fs.readFileSync('.github/workflows/render-govuk-pages.yml', 'utf8');
const walkthroughConfig = fs.readFileSync('visual-walkthrough.config.mjs', 'utf8');
const template = fs.readFileSync('src/govuk/templates/pages/team-access-requests.njk', 'utf8');
const page = fs.readFileSync('public/pages/team/access-requests/index.html', 'utf8');
const pageScript = fs.readFileSync('public/js/auth-team-access-review-page.js', 'utf8');

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

includes(migration, 'ALTER TABLE auth_team_access_requests ADD COLUMN decision_reason TEXT', 'team access review migration');
includes(migration, "'GET', '/api/team-access/requests/review'", 'team access review migration');
includes(migration, "'POST', '/api/team-access/requests/approve'", 'team access review migration');
includes(migration, "'POST', '/api/team-access/requests/reject'", 'team access review migration');

includes(handler, 'function assertAuthenticatedRouteContext(context)', 'team access review handler');
includes(handler, 'async function listTeamAccessReviewRequests(env, context)', 'team access review handler');
includes(handler, "apiPath === '/api/team-access/requests/review'", 'team access review handler');
includes(handler, "apiPath === '/api/team-access/requests/approve'", 'team access review handler');
includes(handler, "apiPath === '/api/team-access/requests/reject'", 'team access review handler');
includes(handler, 'listTeamAccessReviewRequests(env, context)', 'team access review handler');
includes(handler, 'assertAuthenticatedRouteContext(context)', 'team access review handler');
includes(handler, "r.request_status = 'pending'", 'team access review handler');
includes(handler, 'canManageTeam(context, existing.team_id)', 'team access review handler');
includes(handler, 'self_approval_blocked', 'team access review handler');
includes(handler, "request_status = 'approved'", 'team access review handler');
includes(handler, "INSERT INTO auth_team_memberships", 'team access review handler');
includes(handler, "ON CONFLICT(user_id, team_id) DO UPDATE SET membership_status = 'active'", 'team access review handler');
includes(handler, "team.access.approved", 'team access review handler');
includes(handler, "request_status = 'rejected'", 'team access review handler');
includes(handler, 'decision_reason = ?', 'team access review handler');
includes(handler, "team.access.rejected", 'team access review handler');
excludes(handler, 'INSERT INTO auth_role_assignments', 'team access review handler');
excludes(handler, 'INSERT INTO auth_permission_exceptions', 'team access review handler');

includes(renderScript, "template: 'pages/team-access-requests.njk'", 'GOV.UK page renderer');
includes(renderScript, "output: 'public/pages/team/access-requests/index.html'", 'GOV.UK page renderer');
includes(renderScript, "pageTitle: 'Review team access requests - ResearchOps Demo Suite'", 'GOV.UK page renderer');

includes(renderWorkflow, 'Determine changed GOV.UK page outputs', 'GOV.UK render workflow');
includes(renderWorkflow, "git diff --name-only \"origin/${base_ref}\"...HEAD -- 'src/govuk/templates/pages/*.njk'", 'GOV.UK render workflow');
includes(renderWorkflow, 'No changed GOV.UK page templates to render.', 'GOV.UK render workflow');
includes(renderWorkflow, 'No GOV.UK renderer page registration found for:', 'GOV.UK render workflow');
includes(renderWorkflow, 'output_paths < "$changed_outputs_path"', 'GOV.UK render workflow');
excludes(renderWorkflow, 'git add -A public/index.html public/pages', 'GOV.UK render workflow');

includes(walkthroughConfig, "registeredPage('team-access-requests'", 'visual walkthrough registry');
includes(walkthroughConfig, "'Review team access requests'", 'visual walkthrough registry');
includes(walkthroughConfig, "'/pages/team/access-requests/index.html'", 'visual walkthrough registry');

for (const source of [template, page]) {
	includes(source, 'Review team access requests', 'team access review page');
	includes(source, 'Approve or reject requests from people who want to join a team you administer.', 'team access review page');
	includes(source, 'Approving a request makes the person a team member.', 'team access review page');
	includes(source, 'It does not give them a role or access to sensitive information.', 'team access review page');
	includes(source, 'Checking team access requests', 'team access review page');
	includes(source, 'There are no team access requests to review.', 'team access review page');
	includes(source, 'Pending requests', 'team access review page');
	includes(source, 'team-access-review-list', 'team access review page');
	includes(source, '/js/auth-team-access-review-page.js?v=team-access-review-20260531', 'team access review page');
	excludes(source, 'request-alex-morgan', 'team access review page');
	excludes(source, 'alex.morgan@example.gov.uk', 'team access review page');
	excludes(source, 'request-sam-patel', 'team access review page');
	excludes(source, '<form class="team-access-review-form" action="/api/team-access/requests/approve"', 'team access review page');
}

includes(template, 'govukBreadcrumbs', 'team access review template');
includes(template, 'govukWarningText', 'team access review template');
includes(template, 'govukErrorSummary', 'team access review template');
includes(page, '<title>Review team access requests - ResearchOps Demo Suite</title>', 'generated team access review page');
includes(page, '<x-include src="/partials/header.html"', 'generated team access review page');
includes(page, '<x-include src="/partials/footer.html"></x-include>', 'generated team access review page');

includes(pageScript, "fetchJson('/api/team-access/requests/review')", 'team access review page controller');
includes(pageScript, "'/api/team-access/requests/approve'", 'team access review page controller');
includes(pageScript, "'/api/team-access/requests/reject'", 'team access review page controller');
includes(pageScript, 'requestCard(request)', 'team access review page controller');
includes(pageScript, 'data-approve-request', 'team access review page controller');
includes(pageScript, 'data-reject-request', 'team access review page controller');
includes(pageScript, 'aria-describedby="${reasonHintId} ${reasonPrivacyId}"', 'team access review page controller');
includes(pageScript, 'Do not include participant names, contact details or sensitive research information.', 'team access review page controller');
excludes(pageScript, 'request-alex-morgan', 'team access review page controller');
excludes(pageScript, 'alex.morgan@example.gov.uk', 'team access review page controller');
