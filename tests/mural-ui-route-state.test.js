import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("public/components/mural-integration.js", "utf8");

function includes(text) {
	assert.equal(source.includes(text), true, `Expected mural-integration.js to include: ${text}`);
}

function excludes(text) {
	assert.equal(source.includes(text), false, `Expected mural-integration.js not to include: ${text}`);
}

includes("User-initiated Project Dashboard");
includes("function projectDashboardPath(projectId)");
includes("/pages/project-dashboard/?id=");
includes("function wireConnectButton()");
includes("function createBoard()");
includes("function openBoard(event)");
includes("return=${encodeURIComponent(backPath)}");
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
excludes("const backAbs = absolutePagesUrl");
excludes("return=${encodeURIComponent(backAbs)}");
excludes("function absolutePagesUrl(pathAndQuery)");
