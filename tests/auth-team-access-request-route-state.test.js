import assert from 'node:assert/strict';
import fs from 'node:fs';

const storyPlan = fs.readFileSync('docs/product/26/05/30/auth-story-3-team-access-request.md', 'utf8');
const migration = fs.readFileSync('infra/cloudflare/migrations/0005_auth_team_access_requests.sql', 'utf8');
const handler = fs.readFileSync('infra/cloudflare/src/core/auth/team-access-requests.js', 'utf8');
const worker = fs.readFileSync('infra/cloudflare/src/worker.js', 'utf8');
const renderScript = fs.readFileSync('scripts/govuk/render-govuk-pages.mjs', 'utf8');
const template = fs.readFileSync('src/govuk/templates/pages/account-team-access.njk', 'utf8');
const page = fs.readFileSync('public/pages/account/team-access/index.html', 'utf8');
const pageScript = fs.readFileSync('public/js/auth-team-access-page.js', 'utf8');

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(storyPlan, 'Story 3 should let users ask to enter a team.', 'Story 3 plan');
includes(storyPlan, 'It should not decide what they can do once they are inside.', 'Story 3 plan');
includes(storyPlan, 'cancel pending request', 'Story 3 plan');
includes(storyPlan, 'pending access does not grant access', 'Story 3 plan');

includes(migration, 'CREATE TABLE IF NOT EXISTS auth_team_access_requests', 'team access migration');
includes(migration, 'requester_user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE', 'team access migration');
includes(migration, 'submitted_team_reference TEXT NOT NULL', 'team access migration');
includes(migration, "request_status TEXT NOT NULL DEFAULT 'pending'", 'team access migration');
includes(migration, "WHERE request_status = 'pending'", 'team access migration');
includes(migration, "'GET', '/api/team-access/requests'", 'team access route declarations');
includes(migration, "'POST', '/api/team-access/requests'", 'team access route declarations');
includes(migration, "'POST', '/api/team-access/requests/cancel'", 'team access route declarations');

includes(worker, 'handleTeamAccessRequestsRoute', 'Worker');
includes(worker, './core/auth/team-access-requests.js', 'Worker');
includes(worker, 'apiPath.startsWith("/api/team-access/requests")', 'Worker');

includes(handler, 'resolveAuthenticatedContext', 'team access handler');
includes(handler, 'assertRoutePermission', 'team access handler');
includes(handler, 'function teamReferenceFor(value)', 'team access handler');
includes(handler, 'Enter a team name or invitation code.', 'team access handler');
includes(handler, 'We could not find a team you can request access to with those details.', 'team access handler');
includes(handler, 'readActiveMembership', 'team access handler');
includes(handler, 'You are already a member of this team.', 'team access handler');
includes(handler, 'readPendingRequest', 'team access handler');
includes(handler, 'You have already requested access to this team.', 'team access handler');
includes(handler, 'team.access.requested', 'team access handler');
includes(handler, 'team.access.cancelled', 'team access handler');
includes(handler, "request_status = 'cancelled'", 'team access handler');
includes(handler, 'Your request has been sent.', 'team access handler');
excludes(handler, 'team.access.approved', 'team access handler');
excludes(handler, 'INSERT INTO auth_team_memberships', 'team access handler');
excludes(handler, 'INSERT INTO auth_role_assignments', 'team access handler');

includes(renderScript, "template: 'pages/account-team-access.njk'", 'GOV.UK page renderer');
includes(renderScript, "output: 'public/pages/account/team-access/index.html'", 'GOV.UK page renderer');
includes(renderScript, "pageTitle: 'Request access to a team - ResearchOps Demo Suite'", 'GOV.UK page renderer');

for (const source of [template, page]) {
	includes(source, 'Request access to a team', 'team access page');
	includes(source, 'Ask to join a team before using team-scoped ResearchOps features.', 'team access page');
	includes(source, 'This request does not give you a role or sensitive access.', 'team access page');
	includes(source, 'team-access-error-summary', 'team access page');
	includes(source, 'team-access-error-list', 'team access page');
	includes(source, 'team-access-request-form', 'team access page');
	includes(source, 'data-submit-route="/api/team-access/requests"', 'team access page');
	includes(source, 'Team name or invitation code', 'team access page');
	includes(source, 'Message to the Team Admin', 'team access page');
	includes(source, 'Send request', 'team access page');
	includes(source, 'Cancel and return to your account', 'team access page');
	excludes(source, 'Create a new team', 'team access page');
	excludes(source, 'Approve request', 'team access page');
	excludes(source, 'Assign role', 'team access page');
}

includes(pageScript, 'team-access-request-form', 'team access page controller');
includes(pageScript, 'Enter a team name or invitation code.', 'team access page controller');
includes(pageScript, 'Message must be 500 characters or fewer.', 'team access page controller');
includes(pageScript, 'JSON.stringify({ teamReference, message })', 'team access page controller');
includes(pageScript, 'Your request has been sent.', 'team access page controller');
includes(pageScript, 'Return to your account', 'team access page controller');
includes(pageScript, "credentials: 'include'", 'team access page controller');
