import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("public/components/mural-integration.js", "utf8");

function includes(text) {
  assert.equal(
    source.includes(text),
    true,
    `Expected mural-integration.js to include: ${text}`,
  );
}

function excludes(text) {
  assert.equal(
    source.includes(text),
    false,
    `Expected mural-integration.js not to include: ${text}`,
  );
}

includes("function projectDashboardPath(projectId)");
includes("/pages/project-dashboard/?id=");
includes("const backPath = projectDashboardPath(effectiveId);");
includes("return=${encodeURIComponent(backPath)}");
includes("function hideConnectButton()");
includes("els.btnConnect.hidden = true;");
includes("els.btnConnect.disabled = true;");
includes("hideConnectButton();");

excludes("const backAbs = absolutePagesUrl");
excludes("return=${encodeURIComponent(backAbs)}");
excludes("function absolutePagesUrl(pathAndQuery)");
