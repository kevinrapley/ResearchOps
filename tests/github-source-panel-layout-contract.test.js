import assert from "node:assert/strict";
import fs from "node:fs";

const normaliserSource = fs.readFileSync(
  "scripts/agent-operating-model/normalise-source-panel-layout.mjs",
  "utf8"
);
const buildScript = fs.readFileSync("build.sh", "utf8");

function includes(source, text, label) {
  assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
  assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(normaliserSource, "const CODE_PANEL_MAX_HEIGHT = 1400;", "source panel normaliser");
includes(normaliserSource, "max-height: ${CODE_PANEL_MAX_HEIGHT}px !important;", "source panel normaliser");
includes(normaliserSource, "overflow-y: auto !important;", "source panel normaliser");
includes(normaliserSource, "var SOURCE_PANEL_CODE_MAX_HEIGHT = ${CODE_PANEL_MAX_HEIGHT};", "source panel normaliser");
includes(normaliserSource, "notes.getBoundingClientRect().height", "source panel normaliser");
includes(normaliserSource, "Math.min(Math.ceil(notes.getBoundingClientRect().height), SOURCE_PANEL_CODE_MAX_HEIGHT)", "source panel normaliser");
includes(normaliserSource, "code.style.height = height + 'px';", "source panel normaliser");
includes(normaliserSource, "code.style.maxHeight = SOURCE_PANEL_CODE_MAX_HEIGHT + 'px';", "source panel normaliser");
includes(normaliserSource, "code.style.overflowY = 'auto';", "source panel normaliser");
includes(normaliserSource, "source-panel-height-cap-v3", "source panel normaliser");

excludes(normaliserSource, ".source-panel.example .source-grid pre", "source panel normaliser");
excludes(normaliserSource, "panel.classList.contains('example')", "source panel normaliser");
excludes(normaliserSource, "max-height: none !important", "source panel normaliser");
excludes(normaliserSource, "overflow-y: visible !important", "source panel normaliser");
excludes(normaliserSource, "code.style.maxHeight = 'none';", "source panel normaliser");
excludes(normaliserSource, "code.style.overflowY = 'visible';", "source panel normaliser");

includes(buildScript, "grep -n 'max-height: 1400px !important'", "agent docs build script");
includes(buildScript, "grep -n 'overflow-y: auto !important'", "agent docs build script");
includes(buildScript, "grep -n 'SOURCE_PANEL_CODE_MAX_HEIGHT = 1400'", "agent docs build script");
includes(buildScript, "source-panel-layout.css?v=source-panel-height-cap-v3", "agent docs build script");
includes(buildScript, "source-panel-layout.js?v=source-panel-height-cap-v3", "agent docs build script");
excludes(buildScript, "source-panel-examples-full-source-v1", "agent docs build script");
excludes(buildScript, "max-height: none !important", "agent docs build script");
