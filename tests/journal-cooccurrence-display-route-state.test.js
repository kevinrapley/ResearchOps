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
includes(caqdas, "function renderOnsCooccurrenceHeatmap(rows)", "CAQDAS co-occurrence renderer");
includes(caqdas, 'data-ons-chart="heatmap"', "CAQDAS co-occurrence renderer");
includes(caqdas, "Code co-occurrence matrix", "CAQDAS co-occurrence renderer");
includes(caqdas, "cooccurrenceCodeTotals(rows).slice(0, 5)", "CAQDAS co-occurrence renderer");
includes(caqdas, "Showing weights between the 5 most connected codes.", "CAQDAS co-occurrence renderer");
includes(caqdas, "function renderOnsCooccurrenceSmallMultiples(rows)", "CAQDAS co-occurrence renderer");
includes(caqdas, 'data-ons-chart="bar-chart-sm"', "CAQDAS co-occurrence renderer");
includes(caqdas, "Small multiple bar charts", "CAQDAS co-occurrence renderer");
includes(caqdas, "function renderOnsCooccurrenceStackedBarSummary(rows)", "CAQDAS co-occurrence renderer");
includes(caqdas, 'data-ons-chart="bar-chart-stacked"', "CAQDAS co-occurrence renderer");
includes(caqdas, "Stacked bar summary", "CAQDAS co-occurrence renderer");
includes(caqdas, "function renderOnsCooccurrenceClusteredBarSummary(rows)", "CAQDAS co-occurrence renderer");
includes(caqdas, 'data-ons-chart="bar-chart-grouped"', "CAQDAS co-occurrence renderer");
includes(caqdas, "Clustered bar comparison", "CAQDAS co-occurrence renderer");
includes(caqdas, 'name="cooccurrence-view"', "CAQDAS co-occurrence renderer");
includes(caqdas, 'value="table"', "CAQDAS co-occurrence renderer");
includes(caqdas, 'value="chart"', "CAQDAS co-occurrence renderer");
includes(caqdas, 'value="heatmap"', "CAQDAS co-occurrence renderer");
includes(caqdas, 'value="small-multiples"', "CAQDAS co-occurrence renderer");
includes(caqdas, 'value="stacked"', "CAQDAS co-occurrence renderer");
includes(caqdas, 'value="clustered"', "CAQDAS co-occurrence renderer");
includes(caqdas, 'data-cooccurrence-panel="table"', "CAQDAS co-occurrence renderer");
includes(caqdas, 'data-cooccurrence-panel="heatmap"', "CAQDAS co-occurrence renderer");
includes(caqdas, "wrap.querySelectorAll('[data-cooccurrence-panel]')", "CAQDAS co-occurrence renderer");
includes(caqdas, "setupCooccurrenceDisplaySwitch(wrap)", "CAQDAS co-occurrence renderer");
excludes(caqdas, '<table class="table">', "CAQDAS co-occurrence renderer");
excludes(caqdas, '<span class="tag">${esc(nodeLabel(nodes, link.source))}</span>', "CAQDAS co-occurrence renderer");

const chartsGitlink = execFileSync("git", ["ls-tree", "HEAD", "charts"], {
	encoding: "utf8",
}).trim();

includes(chartsGitlink, "160000 commit 758806bcfd61d7c00f18c0c357294e746f1974d6", "Charts submodule gitlink");
