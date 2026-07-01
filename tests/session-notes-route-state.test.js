import assert from "node:assert/strict";
import fs from "node:fs";

const serviceSource = fs.readFileSync("infra/cloudflare/src/service/session-notes.js", "utf8");
const routerSource = fs.readFileSync("infra/cloudflare/src/core/router.js", "utf8");
const migrationSource = fs.readFileSync("infra/cloudflare/migrations/0023_session_consent_and_notes.sql", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

includes(serviceSource, "rops_session_notes", "session notes service");
includes(serviceSource, "ensureSessionNotesTable", "session notes service");
includes(serviceSource, "listD1SessionNotes", "session notes service");
includes(serviceSource, "createD1SessionNote", "session notes service");
includes(serviceSource, "updateD1SessionNote", "session notes service");
includes(serviceSource, "listAirtableSessionNotes", "session notes service");
includes(serviceSource, "createAirtableSessionNote", "session notes service");
includes(serviceSource, "updateAirtableSessionNote", "session notes service");
includes(serviceSource, "session_notes_store_unavailable", "session notes service");

includes(routerSource, "service.listSessionNotes", "core router");
includes(routerSource, "service.createSessionNote", "core router");
includes(routerSource, "service.updateSessionNote", "core router");

includes(migrationSource, "CREATE TABLE IF NOT EXISTS rops_session_notes", "session notes D1 migration");
includes(migrationSource, "idx_rops_session_notes_session", "session notes D1 migration");
includes(migrationSource, "idx_rops_session_notes_participant", "session notes D1 migration");
