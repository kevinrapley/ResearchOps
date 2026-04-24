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
require_file "infra/cloudflare/wrangler.toml"
require_file "infra/cloudflare/src/worker.js"
require_file "infra/cloudflare/src/core/router.js"
require_file "infra/cloudflare/src/core/service.js"
require_file "infra/cloudflare/src/service/index.js"
require_dir "infra/cloudflare/src/service"

info "checking package.json scripts"
node --input-type=module <<'NODE'
import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const scripts = pkg.scripts || {};
const required = ['lint', 'format', 'validate', 'test:e2e', 'qa:browsers', 'qa:cucumber'];
const missing = required.filter((name) => !scripts[name]);

if (missing.length) {
	console.error(`missing package scripts: ${missing.join(', ')}`);
	process.exit(1);
}

if (scripts.validate !== 'bash ./scripts/validate.sh') {
	console.error(`unexpected validate script: ${scripts.validate}`);
	process.exit(1);
}
NODE

info "checking JSON files"
while IFS= read -r -d '' file; do
	node -e "JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8'))" "$file"
done < <(find . \
	-path './node_modules' -prune -o \
	-path './.git' -prune -o \
	-path './playwright-report' -prune -o \
	-path './test-results' -prune -o \
	-name '*.json' -print0)

info "checking JavaScript syntax"
while IFS= read -r -d '' file; do
	node --check "$file" >/dev/null
done < <(find . \
	-path './node_modules' -prune -o \
	-path './.git' -prune -o \
	-path './playwright-report' -prune -o \
	-path './test-results' -prune -o \
	-name '*.js' -print0)

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

info "validation passed"
