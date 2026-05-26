import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("public/components/mural-integration.js", "utf8");
const previewConfig = fs.readFileSync("infra/cloudflare/wrangler.passwordless-preview.toml", "utf8");

function includes(text) {
	assert.equal(source.includes(text), true, `Expected mural-integration.js to include: ${text}`);
}

function excludes(text) {
	assert.equal(source.includes(text), false, `Expected mural-integration.js not to include: ${text}`);
}

function configIncludes(text) {
	assert.equal(previewConfig.includes(text), true, `Expected preview config to include: ${text}`);
}

includes("User-initiated Project Dashboard");
includes("const API_ORIGIN = String(document.documentElement?.dataset?.apiOrigin || window.API_ORIGIN || \"\")");
includes("function apiUrl(path)");
includes("function projectDashboardPath(projectId)");
includes("/pages/project-dashboard/?id=");
includes("function wireConnectButton()");
includes("function createBoard()");
includes("function openBoard(event)");
includes("apiUrl(`/api/mural/auth?uid=${encodeURIComponent(uid())}&return=${encodeURIComponent(backPath)}`)");
includes("apiUrl(\"/api/mural/setup\")");
includes("apiUrl(`/api/mural/resolve?projectId=${encodeURIComponent(canonicalId)}&uid=${encodeURIComponent(uid())}`)");
includes("Mural is optional for visual journaling");
includes("Mural optional");
includes("Connect if needed");
includes("Create or open manually");
includes("hasMuralConnectedReturn()");
includes("function fetchWithTimeout");
includes("AbortController");
includes("wireConnectButton();");
includes("wireCreateButton();");
includes("wireOpenButton();");

excludes("/api/health");
excludes("updateSetupState();");
excludes("observeProjectMeta();");
excludes("hideConnectButton();");
excludes("els.btnConnect.hidden = true;");
excludes("https://rops-api.digikev-kevin-rapley.workers.dev");
excludes("location.hostname.endsWith(\"pages.dev\")");
excludes("Mural has not been checked yet");
excludes("Mural not checked");
excludes("const backAbs = absolutePagesUrl");
excludes("return=${encodeURIComponent(backAbs)}");
excludes("function absolutePagesUrl(pathAndQuery)");

configIncludes('PAGES_ORIGIN       = "https://chore-govuk-frontend-integra.researchops.pages.dev"');
configIncludes("https://chore-govuk-frontend-integra.researchops.pages.dev");
configIncludes('MURAL_REDIRECT_URI = "https://rops-api-passwordless-preview.digikev-kevin-rapley.workers.dev/api/mural/callback"');
