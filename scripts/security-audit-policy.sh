#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

OUTPUT_DIR="${SECURITY_AUDIT_OUTPUT_DIR:-artifacts/release-gate}"
RAW_REPORT="$OUTPUT_DIR/security-audit-raw.json"
POLICY_REPORT="$OUTPUT_DIR/security-audit-policy-report.json"
POLICY_STDOUT="$OUTPUT_DIR/security-audit-policy-stdout.json"

mkdir -p "$OUTPUT_DIR"

set +e
npm audit --audit-level=low --json > "$RAW_REPORT"
NPM_AUDIT_EXIT="$?"
node scripts/security-audit-policy.mjs \
	--audit "$RAW_REPORT" \
	--output "$POLICY_REPORT" > "$POLICY_STDOUT"
POLICY_EXIT="$?"
set -e

cat "$POLICY_STDOUT"

if [ "$POLICY_EXIT" -ne 0 ]; then
	exit "$POLICY_EXIT"
fi

if [ "$NPM_AUDIT_EXIT" -ne 0 ]; then
	printf 'npm audit found issues, but the repository policy did not classify them as release-blocking.\n'
fi
