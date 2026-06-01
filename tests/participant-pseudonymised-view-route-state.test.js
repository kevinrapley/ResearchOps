import assert from 'node:assert/strict';
import fs from 'node:fs';

const participantService = fs.readFileSync('infra/cloudflare/src/service/participants.js', 'utf8');
const serviceIndex = fs.readFileSync('infra/cloudflare/src/service/index.js', 'utf8');
const router = fs.readFileSync('infra/cloudflare/src/core/router.js', 'utf8');
const migration = fs.readFileSync('infra/cloudflare/migrations/0007_participant_pseudonymised_view.sql', 'utf8');
const d1SeedMigration = fs.readFileSync('infra/cloudflare/migrations/0008_seed_test_project_1_participants.sql', 'utf8');
const workflow = fs.readFileSync('.github/workflows/apply-d1-participant-pseudonymised-view.yml', 'utf8');
const component = fs.readFileSync('public/components/participants/participants-page.js', 'utf8');
const scheduler = fs.readFileSync('public/pages/study/participants/scheduler.js', 'utf8');
const page = fs.readFileSync('public/pages/study/participants/index.html', 'utf8');
const projectParticipantSource = fs.readFileSync('src/govuk/templates/pages/project-dashboard-participants.njk', 'utf8');
const projectParticipantPage = fs.readFileSync('public/pages/project-dashboard/participants/index.html', 'utf8');
const projectParticipantController = fs.readFileSync('public/pages/project-dashboard/participants/participants-project.js', 'utf8');

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

function functionBody(source, functionName) {
	const start = source.indexOf(`function ${functionName}`);
	assert.notEqual(start, -1, `Expected to find function ${functionName}`);
	const nextFunction = source.indexOf('\nfunction ', start + 1);
	const nextExport = source.indexOf('\nexport ', start + 1);
	const endCandidates = [nextFunction, nextExport].filter((index) => index !== -1);
	const end = endCandidates.length ? Math.min(...endCandidates) : source.length;
	return source.slice(start, end);
}

includes(participantService, 'D1 is the runtime source of truth', 'participant service');
includes(participantService, 'resolveAuthenticatedContext(request, svc.env)', 'participant service');
includes(participantService, 'await assertRoutePermission(request, svc.env, context)', 'participant service');
includes(participantService, 'readD1ParticipantsForStudy(svc, origin, studyId, context)', 'participant service');
includes(participantService, 'FROM rops_participants_cache', 'participant service');
includes(participantService, 'participant_airtable_id', 'participant service');
includes(participantService, 'session_participant_id: sessionParticipantId', 'participant service');
includes(participantService, 'can_schedule: Boolean(sessionParticipantId)', 'participant service');
includes(participantService, 'WHERE study_id = ?', 'participant service');
includes(participantService, 'readD1ParticipantContact(svc, origin, participantId)', 'participant service');
includes(participantService, 'sensitive_contact_json', 'participant service');
includes(participantService, 'access_needs', 'participant service');
includes(participantService, 'accessNeeds', 'participant service');
includes(participantService, 'function participantIdentityFor', 'participant service');
includes(participantService, 'body.display_name || body.displayName || participantRef', 'participant service');
includes(participantService, 'first_name: firstName', 'participant service');
includes(participantService, 'family_name: familyName', 'participant service');
includes(participantService, 'full_name: fullName', 'participant service');
excludes(participantService, 'first_name_required', 'participant service legacy compatibility');
excludes(participantService, 'family_name_required', 'participant service legacy compatibility');
includes(participantService, 'participant.contact.revealed', 'participant service');
includes(participantService, 'participant.contact.reveal.denied', 'participant service');
includes(participantService, 'participant.created', 'participant service');
includes(participantService, 'CONTACT_RESTRICTED_MESSAGE', 'participant service');
includes(participantService, 'preferFallbackMessage ? fallbackMessage', 'participant service');

excludes(participantService, 'fetchWithTimeout', 'participant service');
excludes(participantService, 'airtableTryWrite', 'participant service');
excludes(participantService, 'AIRTABLE_', 'participant service');

const pseudonymisedMapper = functionBody(participantService, 'mapD1Participant');
excludes(pseudonymisedMapper, 'email:', 'D1 pseudonymised participant mapper');
excludes(pseudonymisedMapper, 'phone:', 'D1 pseudonymised participant mapper');
excludes(pseudonymisedMapper, 'first_name:', 'D1 pseudonymised participant mapper');
excludes(pseudonymisedMapper, 'family_name:', 'D1 pseudonymised participant mapper');
excludes(pseudonymisedMapper, 'full_name:', 'D1 pseudonymised participant mapper');
includes(pseudonymisedMapper, 'display_name: row.participant_ref || row.id', 'D1 pseudonymised participant mapper');
includes(pseudonymisedMapper, 'contact_restricted: true', 'D1 pseudonymised participant mapper');
includes(pseudonymisedMapper, 'access_needs: row.access_needs || ""', 'D1 pseudonymised participant mapper');

const contactReader = functionBody(participantService, 'readD1ParticipantContact');
includes(contactReader, 'first_name: cleanText(contact.first_name)', 'D1 contact reveal reader');
includes(contactReader, 'family_name: cleanText(contact.family_name)', 'D1 contact reveal reader');
includes(contactReader, 'full_name: cleanText(contact.full_name)', 'D1 contact reveal reader');
includes(contactReader, 'email: cleanText(contact.email)', 'D1 contact reveal reader');
includes(contactReader, 'phone: cleanText(contact.phone)', 'D1 contact reveal reader');

includes(serviceIndex, 'listParticipants = (req, origin, url) => Participants.listParticipants(this, req, origin, url)', 'service index');
includes(serviceIndex, 'revealParticipantContact = (req, origin, url) => Participants.revealParticipantContact(this, req, origin, url)', 'service index');
includes(serviceIndex, 'createParticipant = (req, origin) => Participants.createParticipant(this, req, origin)', 'service index');

includes(router, 'url.pathname === "/api/participants/contact"', 'router');
includes(router, 'service.revealParticipantContact(request, origin, url)', 'router');
includes(router, 'service.listParticipants(request, origin, url)', 'router');
includes(router, 'service.createParticipant(request, origin)', 'router');

includes(migration, "'participant.record.view'", 'participant pseudonymised view migration');
includes(migration, "'GET', '/api/participants', '[\"participant.record.view\"]'", 'participant pseudonymised view migration');
includes(migration, "'GET', '/api/participants/contact', '[\"participant.pii.reveal\"]'", 'participant pseudonymised view migration');
includes(migration, "('role_researcher', 'participant.record.view')", 'participant pseudonymised view migration');

includes(d1SeedMigration, "'participant.record.create'", 'D1 participant canonical seed migration');
includes(d1SeedMigration, "'POST', '/api/participants', '[\"participant.record.create\"]'", 'D1 participant canonical seed migration');
includes(d1SeedMigration, 'CREATE TABLE IF NOT EXISTS rops_participants_cache', 'D1 participant canonical seed migration');
includes(d1SeedMigration, 'participant_airtable_id TEXT', 'D1 participant canonical seed migration');
includes(d1SeedMigration, 'access_needs TEXT', 'D1 participant canonical seed migration');
includes(d1SeedMigration, 'sensitive_contact_json TEXT', 'D1 participant canonical seed migration');

includes(workflow, 'Apply D1 Participant Pseudonymised View', 'participant D1 apply workflow');
includes(workflow, 'infra/cloudflare/migrations/0007_participant_pseudonymised_view.sql', 'participant D1 apply workflow');
includes(workflow, 'APPLY_PARTICIPANT_PSEUDONYMISED_VIEW', 'participant D1 apply workflow');
includes(workflow, "SELECT code, label FROM auth_permissions WHERE code IN ('participant.record.view', 'participant.pii.reveal')", 'participant D1 apply workflow');
includes(workflow, "route_pattern IN ('/api/participants', '/api/participants/contact')", 'participant D1 apply workflow');

for (const source of [component, scheduler]) {
	includes(source, 'Contact details are restricted. Ask a Team Admin or authorised role if you need access.', 'participant UI');
	includes(source, 'data-contact-state="restricted"', 'participant UI');
	includes(source, 'Reveal contact details', 'participant UI');
	excludes(source, 'mailto:${encodeURIComponent(p.email)}', 'participant UI default state');
	excludes(source, 'tel:${encodeURIComponent(p.phone)}', 'participant UI default state');
}

includes(scheduler, 'project_id: context.projectId', 'participant scheduler');
includes(scheduler, 'study_id: context.studyId', 'participant scheduler');
includes(scheduler, 'handleAddParticipant(e, context', 'participant scheduler');
includes(scheduler, 'scheduleableParticipants(participants)', 'participant scheduler');
includes(scheduler, 'session_participant_id', 'participant scheduler');
includes(scheduler, 'data-session-participant-id', 'participant scheduler');
includes(scheduler, 'Scheduling is not available until this participant has a session-compatible record.', 'participant scheduler');
includes(scheduler, 'participant_airtable_id: participantId', 'participant scheduler');
includes(scheduler, 'revealParticipantContact(participantId)', 'participant scheduler');
includes(scheduler, '/api/participants/contact?participant=', 'participant scheduler');
includes(scheduler, 'data-contact-state="revealed"', 'participant scheduler');
includes(scheduler, 'Sensitive', 'participant scheduler');
includes(scheduler, 'Handle this information as sensitive.', 'participant scheduler');

includes(projectParticipantSource, 'from "govuk/components/breadcrumbs/macro.njk" import govukBreadcrumbs', 'project participant source');
includes(projectParticipantSource, 'from "govuk/components/error-summary/macro.njk" import govukErrorSummary', 'project participant source');
includes(projectParticipantSource, 'from "govuk/components/input/macro.njk" import govukInput', 'project participant source');
includes(projectParticipantSource, 'from "govuk/components/select/macro.njk" import govukSelect', 'project participant source');
includes(projectParticipantSource, 'from "govuk/components/textarea/macro.njk" import govukTextarea', 'project participant source');
includes(projectParticipantSource, 'from "govuk/components/inset-text/macro.njk" import govukInsetText', 'project participant source');
includes(projectParticipantSource, 'typeof: "schema:BreadcrumbList"', 'project participant breadcrumb source');

includes(projectParticipantPage, 'id="participant-first-name"', 'project participant page');
includes(projectParticipantPage, 'id="participant-family-name"', 'project participant page');
includes(projectParticipantPage, 'name="project_id"', 'project participant page');
excludes(projectParticipantPage, 'name="project_airtable_id"', 'project participant page');
includes(projectParticipantController, 'project_id: projectId', 'project participant controller');
includes(projectParticipantController, 'study_id: fieldValue("#study-select")', 'project participant controller');
includes(projectParticipantController, 'first_name: fieldValue("#participant-first-name")', 'project participant controller');
includes(projectParticipantController, 'family_name: fieldValue("#participant-family-name")', 'project participant controller');
includes(projectParticipantController, 'function enhanceBreadcrumbSchema', 'project participant controller');
includes(projectParticipantController, 'property", "schema:itemListElement"', 'project participant controller');
includes(projectParticipantController, 'property", "schema:item"', 'project participant controller');
includes(projectParticipantController, 'property", "schema:name"', 'project participant controller');
includes(projectParticipantController, 'property", "schema:position"', 'project participant controller');

includes(page, 'Participants', 'participants page');
includes(page, 'Contact', 'participants page');
