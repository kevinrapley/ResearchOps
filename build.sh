#!/usr/bin/env bash
set -euo pipefail

printf '%s\n' '--- ResearchOps agent documentation build ---'
printf 'Branch: %s\n' "${CF_PAGES_BRANCH:-local}"
printf 'Commit: %s\n' "${CF_PAGES_COMMIT_SHA:-unknown}"

npm run agent:docs:source

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

if [ -d docs/agent-operating-model/bundles/github/source/bundle-root ]; then
	printf '%s\n' 'Unexpected generated source/bundle-root directory found.' >&2
	exit 1
fi

printf '%s\n' 'Cloudflare Pages build completed successfully.'
