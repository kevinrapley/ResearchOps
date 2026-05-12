#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

fail() {
	printf 'validate: %s\n' "$1" >&2
	exit 1
}

info() {
	printf 'validate: %s\n' "$1"
}

require_file() {
	local path="$1"
	[[ -f "$path" ]] || fail "missing required file: $path"
}

require_dir() {
	local path="$1"
	[[ -d "$path" ]] || fail "missing required directory: $path"
}

info "checking repository contract"
require_file "package.json"
require_file "eslint.config.js"
require_file "AGENTS.md"
require_file ".agent-operating-model/README.md"
require_file ".agent-operating-model/orchestration.xml"
require_file ".agent-operating-model/bundle-registry.json"
require_file ".agent-operating-model/bundle-registry.schema.json"
require_file ".agent-operating-model/bootstrap-checklist.md"
require_file ".agent-operating-model/precedence-policy.md"
require_file ".agent-operating-model/trace-policy.md"
require_file ".agent-operating-model/trace-layers.md"
require_file ".agent-operating-model/task-signal-catalog.json"
require_file ".agent-operating-model/selection-rules.json"
require_file ".agent-operating-model/behavioural-evals.json"
require_dir ".agent-operating-model/bundles"
require_dir ".agent-operating-model/bundles/github"
require_dir ".agent-operating-model/bundles/researchops-developer-control"
require_dir ".agent-operating-model/bundles/multi-functional-team"
require_dir ".agent-operating-model/bundles/govuk-design-system"
require_dir ".agent-operating-model/bundles/cloudflare"
require_dir ".agent-operating-model/bundles/openai"
require_dir ".agent-operating-model/bundles/airtable-public-api"
require_dir ".agent-operating-model/bundles/mural-public-api"
require_file ".agent-operating-model/bundles/github/prompt.spec.yaml"
require_file ".agent-operating-model/bundles/github/prompt.body.xml"
require_file ".agent-operating-model/bundles/researchops-developer-control/prompt.spec.yaml"
require_file ".agent-operating-model/bundles/researchops-developer-control/prompt.body.xml"
require_file ".agent-operating-model/bundles/multi-functional-team/prompt.spec.yaml"
require_file ".agent-operating-model/bundles/multi-functional-team/prompt.body.xml"
require_file ".agent-operating-model/bundles/govuk-design-system/prompt.spec.yaml"
require_file ".agent-operating-model/bundles/govuk-design-system/prompt.body.xml"
require_file ".agent-operating-model/bundles/cloudflare/prompt.spec.yaml"
require_file ".agent-operating-model/bundles/cloudflare/prompt.body.xml"
require_file ".agent-operating-model/bundles/cloudflare/references/source-catalog.yaml"
require_file ".agent-operating-model/bundles/cloudflare/references/workers-runtime.xml"
require_file ".agent-operating-model/bundles/cloudflare/references/wrangler-configuration.xml"
require_file ".agent-operating-model/bundles/cloudflare/references/bindings-and-secrets.xml"
require_file ".agent-operating-model/bundles/cloudflare/references/storage-and-state.xml"
require_file ".agent-operating-model/bundles/cloudflare/references/pages-and-deployment.xml"
require_file ".agent-operating-model/bundles/cloudflare/references/queues-workflows-ai.xml"
require_file ".agent-operating-model/bundles/openai/prompt.spec.yaml"
require_file ".agent-operating-model/bundles/openai/prompt.body.xml"
require_file ".agent-operating-model/bundles/openai/references/source-catalog.yaml"
require_file ".agent-operating-model/bundles/openai/references/openai-platform-context.xml"
require_file ".agent-operating-model/bundles/openai/references/responses-api.xml"
require_file ".agent-operating-model/bundles/openai/references/tools-function-calling-structured-outputs.xml"
require_file ".agent-operating-model/bundles/openai/references/retrieval-files-vector-stores.xml"
require_file ".agent-operating-model/bundles/openai/references/embeddings.xml"
require_file ".agent-operating-model/bundles/openai/references/batch-webhooks-realtime.xml"
require_file ".agent-operating-model/bundles/openai/references/evals-rate-limits-safety.xml"
require_file ".agent-operating-model/bundles/airtable-public-api/prompt.spec.yaml"
require_file ".agent-operating-model/bundles/airtable-public-api/prompt.body.xml"
require_file ".agent-operating-model/bundles/mural-public-api/prompt.spec.yaml"
require_file ".agent-operating-model/bundles/mural-public-api/prompt.body.xml"
require_file "scripts/agent-operating-model/load-operating-model.mjs"
require_file "scripts/agent-operating-model/run-behavioural-evals.mjs"
require_file "scripts/agent-operating-model/validate-bundle-registry.mjs"
require_file "scripts/agent-operating-model/validate-operating-model.mjs"
require_file "scripts/agent-trace/validate-traces.mjs"
require_file "scripts/agent-trace/assert-trace-coverage.mjs"
require_file "scripts/validate-reports-site.mjs"
require_file "scripts/validate-sourcebook-links.mjs"
require_file "public/_headers"
require_file "public/css/govuk/govuk-buttons.css"
require_file "public/css/govuk/govuk-forms.css"
require_file "public/css/govuk/govuk-tables.css"
require_file "public/css/govuk/govuk-page-chrome.css"
require_file "public/css/auth-role-assignments.css"
require_file "public/js/auth-role-assignment-page.js"
require_file "public/js/auth-sign-in-page.js"
require_file "public/pages/account/sign-in/index.html"
require_file "public/pages/team/role-assignments/index.html"
require_file "docs/performance/initial-load-audit.md"
require_file "docs/performance/performance-inventory-tooling.md"
require_file "docs/design-system/govuk-compliance-audit.md"
require_file "docs/design-system/govuk-button-migration.md"
require_file "docs/design-system/govuk-form-migration.md"
require_file "docs/design-system/govuk-table-summary-list-migration.md"
require_file "docs/design-system/govuk-page-chrome-navigation-migration.md"
require_file "docs/design-system/govuk-breadcrumb-back-link-migration.md"
require_file "docs/design-system/researchops-component-inventory.md"
require_file "scripts/performance-audit.sh"
require_file "infra/cloudflare/wrangler.toml"
require_file "infra/cloudflare/src/worker.js"
require_file "infra/cloudflare/src/core/router.js"
require_file "infra/cloudflare/src/core/service.js"
require_file "infra/cloudflare/src/service/index.js"
require_file "infra/cloudflare/src/core/auth/access.js"
require_file "infra/cloudflare/src/core/auth/passwordless.js"
require_file "infra/cloudflare/src/core/auth/role-assignments.js"
require_file "infra/cloudflare/migrations/0002_auth_role_assignment_route.sql"
require_file "infra/cloudflare/migrations/0003_auth_passwordless_sessions.sql"
require_file ".github/workflows/apply-d1-auth-role-assignment-route.yml"
require_file "tests/govuk-design-system-baseline-route-state.test.js"
require_file "tests/govuk-forms-application-route-state.test.js"
require_file "tests/govuk-tables-summary-lists-application-route-state.test.js"
require_file "tests/govuk-page-chrome-navigation-route-state.test.js"
require_file "tests/govuk-breadcrumb-back-link-route-state.test.js"
require_file "tests/projects-route-contract.test.js"
require_file "tests/projects-page-route-state.test.js"
require_file "tests/project-dashboard-route-state.test.js"
require_file "tests/outcomes-page-route-state.test.js"
require_file "tests/mural-ui-route-state.test.js"
require_file "tests/journals-project-route-contract.test.js"
require_file "tests/journals-route-state.test.js"
require_file "tests/journal-tabs-api-origin-route-state.test.js"
require_file "tests/journal-tabs-filter-state-route-state.test.js"
require_file "tests/journal-tabs-resilience-route-state.test.js"
require_file "tests/journal-secondary-actions-route-state.test.js"
require_file "tests/mural-journal-sync-route-state.test.js"
require_file "tests/study-page-route-state.test.js"
require_file "tests/study-guides-route-state.test.js"
require_file "tests/study-session-route-state.test.js"
require_file "tests/search-page-route-state.test.js"
require_file "tests/notes-page-route-state.test.js"
require_file "tests/synthesize-page-route-state.test.js"
require_file "tests/start-page-route-state.test.js"
require_file "tests/participants-page-route-state.test.js"
require_file "tests/consent-forms-route-state.test.js"
require_file "tests/participant-consent-route-state.test.js"
require_file "tests/auth-foundation-route-state.test.js"
require_file "tests/auth-route-permissions.test.js"
require_file "tests/auth-runtime-bootstrap-route-state.test.js"
require_file "tests/auth-role-assignment-api-route-state.test.js"
require_file "tests/auth-role-assignment-ui-route-state.test.js"
require_file "tests/auth-sign-in-route-state.test.js"
require_file "scripts/auth-runtime-bootstrap.mjs"
require_file ".github/workflows/bootstrap-d1-auth-runtime.yml"
require_file "docs/product/26/05/09/auth-runtime-bootstrap-2026-05-09.md"
require_file "docs/product/26/05/09/auth-role-assignment-api-2026-05-09.md"
require_file "docs/product/26/05/09/auth-role-assignment-ui-2026-05-09.md"
require_file "reports-site/index.html"
require_file "reports-site/manifest.json"
require_file "docs/agent-audit/reasoning/2026/05/09/auth-runtime-bootstrap-implementation-trace.md"
require_file "docs/agent-audit/reasoning/2026/05/09/auth-runtime-bootstrap-implementation-trace.json"
require_file "docs/agent-audit/reasoning/2026/05/09/auth-role-assignment-api-implementation-trace.md"
require_file "docs/agent-audit/reasoning/2026/05/09/auth-role-assignment-api-implementation-trace.json"
require_file "docs/agent-audit/reasoning/2026/05/09/auth-role-assignment-ui-implementation-trace.md"
require_file "docs/agent-audit/reasoning/2026/05/09/auth-role-assignment-ui-implementation-trace.json"
require_dir "infra/cloudflare/src/service"

info "checking package.json scripts"
node --input-type=module <<'NODE'
import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const scripts = pkg.scripts || {};
const required = ['lint', 'format', 'validate', 'audit:performance', 'audit:performance:write', 'agent:model', 'agent:model:validate', 'agent:bundles:validate', 'agent:evals', 'trace:validate', 'trace:coverage', 'reports:validate', 'sourcebook:validate', 'test:e2e', 'qa:browsers', 'qa:cucumber'];
const missing = required.filter((name) => !scripts[name]);

if (missing.length) {
	console.error(`missing package scripts: ${missing.join(', ')}`);
	process.exit(1);
}

if (scripts.validate !== 'bash ./scripts/validate.sh') {
	console.error(`unexpected validate script: ${scripts.validate}`);
	process.exit(1);
}

if (scripts['audit:performance'] !== 'bash ./scripts/performance-audit.sh') {
	console.error(`unexpected audit:performance script: ${scripts['audit:performance']}`);
	process.exit(1);
}
NODE

info "checking repository operating model"
node scripts/agent-operating-model/validate-operating-model.mjs

info "checking behavioural operating-model evals"
node scripts/agent-operating-model/run-behavioural-evals.mjs >/dev/null

info "checking agent traces"
node scripts/agent-trace/validate-traces.mjs

info "checking trace coverage"
node scripts/agent-trace/assert-trace-coverage.mjs

info "checking reports site integrity"
node scripts/validate-reports-site.mjs

info "checking sourcebook link integrity"
node scripts/validate-sourcebook-links.mjs

info "checking Wrangler assets directory"
node --input-type=module <<'NODE'
import fs from 'node:fs';
import path from 'node:path';

const wranglerPath = 'infra/cloudflare/wrangler.toml';
const wrangler = fs.readFileSync(wranglerPath, 'utf8');
const match = wrangler.match(/\[assets\][\s\S]*?^directory\s*=\s*"([^"]+)"/m);

if (!match) {
	console.error('wrangler.toml must define [assets].directory');
	process.exit(1);
}

const configDir = path.dirname(wranglerPath);
const assetsDirectory = path.resolve(configDir, match[1]);

if (!fs.existsSync(assetsDirectory) || !fs.statSync(assetsDirectory).isDirectory()) {
	console.error(`wrangler.toml assets.directory does not exist: ${match[1]} -> ${assetsDirectory}`);
	process.exit(1);
}
NODE

info "checking JSON files"
while IFS= read -r -d '' file; do
	if ! node -e "JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8'))" "$file"; then
		fail "invalid JSON: $file"
	fi
done < <(find . \
	-path './node_modules' -prune -o \
	-path './.git' -prune -o \
	-path './playwright-report' -prune -o \
	-path './test-results' -prune -o \
	-name '*.json' -print0)

info "checking JavaScript syntax"
while IFS= read -r -d '' file; do
	if ! node --check "$file" >/dev/null; then
		fail "invalid JavaScript syntax: $file"
	fi
done < <(find . \
	-path './node_modules' -prune -o \
	-path './.git' -prune -o \
	-path './playwright-report' -prune -o \
	-path './test-results' -prune -o \
	\( -name '*.js' -o -name '*.mjs' \) -print0)

info "checking shell script syntax"
bash -n ./scripts/performance-audit.sh

info "checking performance audit command"
bash ./scripts/performance-audit.sh --json >/dev/null

info "checking Worker module import"
node --input-type=module <<'NODE'
const worker = await import('./infra/cloudflare/src/worker.js');

if (!worker.default || typeof worker.default.fetch !== 'function') {
	console.error('Worker default export must expose fetch(request, env, ctx)');
	process.exit(1);
}
NODE

info "checking router module import"
node --input-type=module <<'NODE'
const router = await import('./infra/cloudflare/src/core/router.js');

if (typeof router.handleRequest !== 'function') {
	console.error('router module must export handleRequest(request, env, ctx)');
	process.exit(1);
}
NODE

info "checking service module import"
node --input-type=module <<'NODE'
const service = await import('./infra/cloudflare/src/service/index.js');

if (typeof service.ResearchOpsService !== 'function') {
	console.error('service module must export ResearchOpsService');
	process.exit(1);
}
NODE

info "checking GOV.UK design system baseline"
node tests/govuk-design-system-baseline-route-state.test.js

info "checking application GOV.UK forms route-state contract"
node tests/govuk-forms-application-route-state.test.js

info "checking application GOV.UK tables and summary lists route-state contract"
node tests/govuk-tables-summary-lists-application-route-state.test.js

info "checking GOV.UK page chrome and navigation route-state contract"
node tests/govuk-page-chrome-navigation-route-state.test.js

info "checking GOV.UK breadcrumb and back-link route-state contract"
node tests/govuk-breadcrumb-back-link-route-state.test.js

info "checking authentication foundation route-state contract"
node tests/auth-foundation-route-state.test.js

info "checking authentication route-permission contract"
node tests/auth-route-permissions.test.js

info "checking authentication runtime bootstrap contract"
node tests/auth-runtime-bootstrap-route-state.test.js

info "checking authentication role assignment API contract"
node tests/auth-role-assignment-api-route-state.test.js

info "checking authentication role assignment UI contract"
node tests/auth-role-assignment-ui-route-state.test.js

info "checking authentication sign-in route-state contract"
node tests/auth-sign-in-route-state.test.js

info "checking Projects API route contract"
node tests/projects-route-contract.test.js

info "checking Projects page route-state contract"
node tests/projects-page-route-state.test.js

info "checking Project Dashboard route-state contract"
node tests/project-dashboard-route-state.test.js

info "checking Outcomes page route-state contract"
node tests/outcomes-page-route-state.test.js

info "checking Mural UI route-state contract"
node tests/mural-ui-route-state.test.js

info "checking Journals project route contract"
node tests/journals-project-route-contract.test.js

info "checking Journals route-state contract"
node tests/journals-route-state.test.js

info "checking Journal tabs API origin route-state contract"
node tests/journal-tabs-api-origin-route-state.test.js

info "checking Journal tabs filter-state route-state contract"
node tests/journal-tabs-filter-state-route-state.test.js

info "checking Journal tabs resilience route-state contract"
node tests/journal-tabs-resilience-route-state.test.js

info "checking Journal secondary actions route-state contract"
node tests/journal-secondary-actions-route-state.test.js

info "checking Mural journal sync route-state contract"
node tests/mural-journal-sync-route-state.test.js

info "checking Study page route-state contract"
node tests/study-page-route-state.test.js

info "checking Study guides route-state contract"
node tests/study-guides-route-state.test.js

info "checking Study session route-state contract"
node tests/study-session-route-state.test.js

info "checking Search page route-state contract"
node tests/search-page-route-state.test.js

info "checking Notes page route-state contract"
node tests/notes-page-route-state.test.js

info "checking Synthesize page route-state contract"
node tests/synthesize-page-route-state.test.js

info "checking Start page route-state contract"
node tests/start-page-route-state.test.js

info "checking Participants page route-state contract"
node tests/participants-page-route-state.test.js

info "checking Consent Forms route-state contract"
node tests/consent-forms-route-state.test.js

info "checking Participant Consent route-state contract"
node tests/participant-consent-route-state.test.js

info "validation passed"
