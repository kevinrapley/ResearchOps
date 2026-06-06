import assert from "node:assert/strict";
import fs from "node:fs";

const serviceSource = fs.readFileSync("infra/cloudflare/src/service/internals/mural.js", "utf8");
const boardRegistrySource = fs.readFileSync("infra/cloudflare/src/service/internals/mural-board-registry.js", "utf8");
const journalStickySource = fs.readFileSync("infra/cloudflare/src/service/internals/mural-journal-sticky.js", "utf8");
const tokenSource = fs.readFileSync("infra/cloudflare/src/service/internals/mural-tokens.js", "utf8");
const viewerSource = fs.readFileSync("infra/cloudflare/src/service/internals/mural-viewer.js", "utf8");
const workspaceSource = fs.readFileSync("infra/cloudflare/src/service/internals/mural-workspace.js", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(serviceSource, "export class MuralServicePart", "Mural service");
includes(serviceSource, "resolveBoardForService(this", "Mural service");
includes(serviceSource, "registerBoardForService(this", "Mural service");
includes(serviceSource, "handleMuralJournalSync(this, request, origin)", "Mural service");
includes(serviceSource, "probeViewerUrl(this.root.env, accessToken, muralId)", "Mural service");
includes(serviceSource, "ensureWorkspace(this.root, accessToken, wsOverride)", "Mural service");
includes(serviceSource, "getValidAccessToken(this, uid)", "Mural service");

excludes(serviceSource, "async function d1ResolveMuralBoard", "Mural service");
excludes(serviceSource, "function _looksLikeMuralViewerUrl", "Mural service");
excludes(serviceSource, "async function _getValidAccessToken", "Mural service");
excludes(serviceSource, "const GRID_Y = 32", "Mural service");

includes(boardRegistrySource, "export const PURPOSE_REFLEXIVE", "Mural board registry");
includes(boardRegistrySource, "async function d1ResolveMuralBoard", "Mural board registry");
includes(boardRegistrySource, "export async function resolveBoardForService", "Mural board registry");
includes(boardRegistrySource, "export async function registerBoardForService", "Mural board registry");
includes(boardRegistrySource, "Airtable listBoards failed; will consider D1 fallback", "Mural board registry");

includes(journalStickySource, "export async function handleMuralJournalSync", "Mural journal sticky sync");
includes(journalStickySource, "const GRID_Y = 32", "Mural journal sticky sync");
includes(journalStickySource, "created-new-sticky", "Mural journal sticky sync");
includes(journalStickySource, "ensureTagsBlueberry", "Mural journal sticky sync");

includes(tokenSource, "export async function getValidAccessToken", "Mural token helper");
includes(tokenSource, "refreshAccessToken", "Mural token helper");
includes(viewerSource, "export async function probeViewerUrl", "Mural viewer helper");
includes(viewerSource, "createViewerLink", "Mural viewer helper");
includes(workspaceSource, "export async function ensureWorkspace", "Mural workspace helper");
includes(workspaceSource, "export async function resolveUserOwnedRoomForSetup", "Mural workspace helper");
