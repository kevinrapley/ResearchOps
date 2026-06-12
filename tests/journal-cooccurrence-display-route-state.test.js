import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const caqdas = fs.readFileSync("public/js/caqdas-interface.js", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(caqdas, "function renderCooccurrenceTable(rows)", "CAQDAS co-occurrence renderer");
includes(caqdas, 'class="govuk-table"', "CAQDAS co-occurrence renderer");
includes(caqdas, 'class="govuk-table__caption govuk-table__caption--m"', "CAQDAS co-occurrence renderer");
includes(caqdas, 'class="govuk-table__header"', "CAQDAS co-occurrence renderer");
includes(caqdas, 'class="govuk-table__cell govuk-table__cell--numeric"', "CAQDAS co-occurrence renderer");
includes(caqdas, "function renderOnsCooccurrenceBarChart(rows)", "CAQDAS co-occurrence renderer");
includes(caqdas, 'data-ons-chart="bar-chart"', "CAQDAS co-occurrence renderer");
includes(caqdas, "Highest weighted code pairs", "CAQDAS co-occurrence renderer");
includes(caqdas, "topRows = rows.slice(0, 20)", "CAQDAS co-occurrence renderer");
includes(caqdas, "#206095", "CAQDAS co-occurrence renderer");
includes(caqdas, 'name="cooccurrence-view"', "CAQDAS co-occurrence renderer");
includes(caqdas, 'value="table"', "CAQDAS co-occurrence renderer");
includes(caqdas, 'value="chart"', "CAQDAS co-occurrence renderer");
includes(caqdas, "setupCooccurrenceDisplaySwitch(wrap)", "CAQDAS co-occurrence renderer");
excludes(caqdas, '<table class="table">', "CAQDAS co-occurrence renderer");
excludes(caqdas, '<span class="tag">${esc(nodeLabel(nodes, link.source))}</span>', "CAQDAS co-occurrence renderer");

const chartsGitlink = execFileSync("git", ["ls-tree", "HEAD", "charts"], {
	encoding: "utf8",
}).trim();

includes(chartsGitlink, "160000 commit 758806bcfd61d7c00f18c0c357294e746f1974d6", "Charts submodule gitlink");
