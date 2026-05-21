#!/usr/bin/env bash
set -euo pipefail

printf '%s\n' '--- ResearchOps agent documentation build ---'
printf 'Branch: %s\n' "${CF_PAGES_BRANCH:-local}"
printf 'Commit: %s\n' "${CF_PAGES_COMMIT_SHA:-unknown}"

node scripts/agent-operating-model/generate-bundle-source-docs.mjs --bundle github
node scripts/agent-operating-model/apply-source-annotations.mjs
node scripts/agent-operating-model/normalise-source-panel-layout.mjs
node scripts/agent-operating-model/verify-github-source-panel-docs.mjs

printf '%s\n' '--- Verify generated GitHub bundle documentation ---'

grep -n 'Source panels' docs/agent-operating-model/bundles/github/index.html

if grep -n 'Source browser' docs/agent-operating-model/bundles/github/index.html; then
	printf '%s\n' 'Unexpected old Source browser copy found in GitHub bundle overview.' >&2
	exit 1
fi

test -f docs/agent-operating-model/bundles/github/source/modes/index.html
test -f docs/agent-operating-model/bundles/github/source/contracts/index.html
test -f docs/agent-operating-model/bundles/github/source/templates/index.html
test -f docs/agent-operating-model/bundles/github/source/scripts/index.html
test -f docs/agent-operating-model/bundles/github/assets/source-panel-layout.css
test -f docs/agent-operating-model/bundles/github/assets/source-panel-layout.js

grep -n 'max-height: 1400px !important' docs/agent-operating-model/bundles/github/assets/source-panel-layout.css
grep -n 'SOURCE_PANEL_CODE_MAX_HEIGHT = 1400' docs/agent-operating-model/bundles/github/assets/source-panel-layout.js
grep -n 'overflow-y: auto !important' docs/agent-operating-model/bundles/github/assets/source-panel-layout.css
grep -n 'source-panel-layout.css?v=source-panel-height-cap-v2' docs/agent-operating-model/bundles/github/source/modes/index.html
grep -n 'source-panel-layout.js?v=source-panel-height-cap-v2' docs/agent-operating-model/bundles/github/source/modes/index.html

if grep -R '<aside class="notes">[[:space:]]*<ul>' docs/agent-operating-model/bundles/github/source; then
	printf '%s\n' 'Unexpected list markup found at the start of a source-panel notes column.' >&2
	exit 1
fi

if [ -d docs/agent-operating-model/bundles/github/source/bundle-root ]; then
	printf '%s\n' 'Unexpected generated source/bundle-root directory found.' >&2
	exit 1
fi

printf '%s\n' 'Cloudflare Pages build completed successfully.'
