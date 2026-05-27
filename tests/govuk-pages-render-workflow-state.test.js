import assert from "node:assert/strict";
import fs from "node:fs";

const workflow = fs.readFileSync(".github/workflows/render-govuk-pages.yml", "utf8");
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const renderer = fs.readFileSync("scripts/govuk/render-govuk-pages.mjs", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

includes(workflow, "name: Render GOV.UK pages", "GOV.UK pages render workflow");
includes(workflow, "pull_request:", "GOV.UK pages render workflow");
includes(workflow, "workflow_dispatch: {}", "GOV.UK pages render workflow");
includes(workflow, "contents: write", "GOV.UK pages render workflow");
includes(workflow, "src/govuk/templates/**", "GOV.UK pages render workflow");
includes(workflow, "scripts/govuk/render-govuk-pages.mjs", "GOV.UK pages render workflow");
includes(workflow, "scripts/govuk/normalise-service-pages.mjs", "GOV.UK pages render workflow");
includes(workflow, "public/index.html public/pages", "GOV.UK pages render workflow");
includes(workflow, "npm run build:govuk-pages", "GOV.UK pages render workflow");
includes(workflow, "git add public/index.html public/pages", "GOV.UK pages render workflow");
includes(workflow, "git pull --rebase origin", "GOV.UK pages render workflow");
includes(workflow, "git push origin \"HEAD:$branch_name\"", "GOV.UK pages render workflow");
includes(workflow, "Render GOV.UK page templates", "GOV.UK pages render workflow");
includes(workflow, "github.event.pull_request.head.repo.full_name == github.repository", "GOV.UK pages render workflow");

assert.equal(
	packageJson.scripts["build:govuk-pages"],
	"node scripts/govuk/render-govuk-pages.mjs",
	"build:govuk-pages should keep rendering GOV.UK Nunjucks templates through the canonical renderer"
);

includes(renderer, "output: 'public/pages/projects/journals/index.html'", "GOV.UK pages renderer");
includes(renderer, "template: 'pages/projects-journals.njk'", "GOV.UK pages renderer");
