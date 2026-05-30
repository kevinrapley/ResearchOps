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

function assertStoryScope() {
	includes(storyPlan, 'Story 3 should let users ask to enter a team.', 'Story 3 plan');
	includes(storyPlan, 'It should not decide what they can do once they are inside.', 'Story 3 plan');
	includes(storyPlan, 'submit access request', 'Story 3 plan');
	includes(storyPlan, 'cancel pending request', 'Story 3 plan');
	includes(storyPlan, 'pending access does not grant access', 'Story 3 plan');
	includes(storyPlan, 'approve or reject request', 'Story 3 plan');
	includes(storyPlan, 'role assignment', 'Story 3 plan');
	includes(storyPlan, 'team creation', 'Story 3 plan');
}

function assertMigrationDeclaresRequestModelAndRoutes() {
	includes(migration, 'CREATE TABLE IF NOT EXISTS auth_team_access_requests', 'team access migration');
	includes(migration, 'requester_user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE', 'team access migration');
	includes(migration, 'team_id TEXT REFERENCES auth_teams(id) ON DELETE SET NULL', 'team access migration');
	includes(migration, 'submitted_team_reference TEXT NOT NULL', 'team access migration');
	includes(migration, "request_status TEXT NOT NULL DEFAULT 'pending'", 'team access migration');
	includes(migration, "CHECK (request_status IN ('pending', 'cancelled', 'approved', 'rejected'))", 'team access migration');
	includes(migration, "WHERE request_status = 'pending'", 'team access migration');
	includes(migration, "'GET', '/api/team-access/requests'", 'team access route declarations');
	includes(migration, "'POST', '/api/team-access/requests'", 'team access route declarations');
	includes(migration, "'POST', '/api/team-access/requests/cancel'", 'team access route declarations');
}

function assertWorkerRoutesTeamAccessApi() {
	includes(worker, 'handleTeamAccessRequestsRoute', 'Worker');
	includes(worker, './core/auth/team-access-requests.js', 'Worker');
	includes(worker, 'apiPath.startsWith("/api/team-access/requests")', 'Worker');
	excludes(worker, '/api/team-access/approvals', 'Worker');
}

function assertHandlerImplementsRequestOnly() {
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
	includes(handler, 'This request does not give access', 'team access handler');
	excludes(handler, 'team.access.approved', 'team access handler');
	excludes(handler, 'role.assign', 'team access handler');
	excludes(handler, 'INSERT INTO auth_team_memberships', 'team access handler');
	excludes(handler, 'INSERT INTO auth_role_assignments', 'team access handler');
}

function assertRenderedPageIsRegistered() {
	includes(renderScript, "template: 'pages/account-team-access.njk'", 'GOV.UK page renderer');
	includes(renderScript, "output: 'public/pages/account/team-access/index.html'", 'GOV.UK page renderer');
	includes(renderScript, "pageTitle: 'Request access to a team - ResearchOps Demo Suite'", 'GOV.UK page renderer');
}

function assertTeamAccessPageStructure(source, label) {
	includes(source, 'Request access to a team', label);
	includes(source, 'Ask to join a team before using team-scoped ResearchOps features.', label);
	includes(source, 'This request does not give you a role or sensitive access.', label);
	includes(source, 'team-access-error-summary', label);
	includes(source, 'team-access-error-list', label);
	includes(source, 'team-access-status', label);
	includes(source, 'team-access-request-form', label);
	includes(source, 'data-submit-route="/api/team-access/requests"', label);
	includes(source, 'team-reference-group', label);
	includes(source, 'team-reference-error', label);
	includes(source, 'Team name or invitation code', label);
	includes(source, 'team-access-message-group', label);
	includes(source, 'team-access-message-error', label);
	includes(source, 'Message to the Team Admin', label);
	includes(source, 'Send request', label);
	includes(source, 'Cancel and return to your account', label);
	excludes(source, 'Create a new team', label);
	excludes(source, 'Approve request', label);
	excludes(source, 'Assign role', label);
}

function assertTeamAccessPageTemplateAndGeneratedOutput() {
	assertTeamAccessPageStructure(template, 'team access template');
	assertTeamAccessPageStructure(page, 'generated team access page');
	includes(page, '/js/auth-team-access-page.js?v=team-access-request-20260530', 'generated team access page');
}

function assertTeamAccessPageController() {
	includes(pageScript, 'team-access-request-form', 'team access page controller');
	includes(pageScript, 'team-reference', 'team access page controller');
	includes(pageScript, 'team-reference-error', 'team access page controller');
	includes(pageScript, 'team-access-message-error', 'team access page controller');
	includes(pageScript, 'Enter a team name or invitation code.', 'team access page controller');
	includes(pageScript, 'Message must be 500 characters or fewer.', 'team access page controller');
	includes(pageScript, "fetchJson(route, {", 'team access page controller');
	includes(pageScript, "method: 'POST'", 'team access page controller');
	includes(pageScript, 'JSON.stringify({ teamReference, message })', 'team access page controller');
	includes(pageScript, 'Your request has been sent.', 'team access page controller');
	includes(pageScript, 'Return to your account', 'team access page controller');
	includes(pageScript, 'credentials: \'include\'', 'team access page controller');
	excludes(pageScript, 'localStorage', 'team access page controller');
	excludes(pageScript, 'sessionStorage', 'team access page controller');
}

assertStoryScope();
assertMigrationDeclaresRequestModelAndRoutes();
assertWorkerRoutesTeamAccessApi();
assertHandlerImplementsRequestOnly();
assertRenderedPageIsRegistered();
assertTeamAccessPageTemplateAndGeneratedOutput();
assertTeamAccessPageController();
