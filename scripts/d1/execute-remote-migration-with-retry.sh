#!/usr/bin/env bash

set -euo pipefail

database_name="${1:?Usage: execute-remote-migration-with-retry.sh DATABASE CONFIG MIGRATION}"
wrangler_config="${2:?Usage: execute-remote-migration-with-retry.sh DATABASE CONFIG MIGRATION}"
migration_file="${3:?Usage: execute-remote-migration-with-retry.sh DATABASE CONFIG MIGRATION}"
max_attempts="${D1_MIGRATION_MAX_ATTEMPTS:-4}"
base_delay_seconds="${D1_MIGRATION_RETRY_DELAY_SECONDS:-3}"

if ! [[ "${max_attempts}" =~ ^[1-9][0-9]*$ ]]; then
	echo "D1_MIGRATION_MAX_ATTEMPTS must be a positive integer" >&2
	exit 2
fi

if ! [[ "${base_delay_seconds}" =~ ^[1-9][0-9]*$ ]]; then
	echo "D1_MIGRATION_RETRY_DELAY_SECONDS must be a positive integer" >&2
	exit 2
fi

attempt_log=""
cleanup() {
	if [[ -n "${attempt_log}" && -f "${attempt_log}" ]]; then
		rm -f -- "${attempt_log}"
	fi
}
trap cleanup EXIT

for ((attempt = 1; attempt <= max_attempts; attempt += 1)); do
	attempt_log="$(mktemp)"
	echo "Applying ${migration_file} to remote D1 (attempt ${attempt}/${max_attempts})"

	if npx --no-install wrangler d1 execute "${database_name}" \
		--remote \
		--config "${wrangler_config}" \
		--file "${migration_file}" 2>&1 | tee "${attempt_log}"; then
		exit 0
	else
		exit_code="${PIPESTATUS[0]}"
	fi

	if ((attempt == max_attempts)) || ! grep -Eqi \
		'Currently processing a long-running import|fetch failed' "${attempt_log}"; then
		exit "${exit_code}"
	fi

	retry_delay_seconds=$((base_delay_seconds * attempt))
	echo "Remote D1 returned a retryable error; retrying in ${retry_delay_seconds} seconds"
	rm -f -- "${attempt_log}"
	attempt_log=""
	sleep "${retry_delay_seconds}"
done
