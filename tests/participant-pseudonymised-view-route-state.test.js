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
includes(participantService, 'WHERE study_id = ?', 'participant service');
includes(participantService, 'readD1ParticipantContact(svc, origin, participantId)', 'participant service');
includes(participantService, 'sensitive_contact_json', 'participant service');
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
includes(pseudonymisedMapper, 'display_name: row.participant_ref || row.id', 'D1 pseudonymised participant mapper');
includes(pseudonymisedMapper, 'contact_restricted: true', 'D1 pseudonymised participant mapper');

const contactReader = functionBody(participantService, 'readD1ParticipantContact');
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
includes(scheduler, 'revealParticipantContact(participantId)', 'participant scheduler');
includes(scheduler, '/api/participants/contact?participant=', 'participant scheduler');
includes(scheduler, 'data-contact-state="revealed"', 'participant scheduler');
includes(scheduler, 'Sensitive', 'participant scheduler');
includes(scheduler, 'Handle this information as sensitive.', 'participant scheduler');

includes(page, 'Participants', 'participants page');
includes(page, 'Contact', 'participants page');
