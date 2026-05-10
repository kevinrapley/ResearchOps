# Mural Public API Developer Contract Bundle

This bundle extends the previous full-surface endpoint inventory with a contract layer intended to direct implementation.

## What is new

- Per-endpoint contracts in `contracts/endpoints/`
- Full path templates
- Minimum scopes
- Path and query parameters
- Request body contracts where known
- Response status maps
- JSON body shapes
- Node, Ruby, PHP, and Python request examples

## Provenance model

The bundle distinguishes between:
- reference-verified method/path/source URLs
- reference-verified status codes where directly observed
- family-derived success shapes when the rendered docs snapshot did not expose the full example object
- docs-verified common error format with code/message, plus optional details arrays tolerated for malformed-request diagnostics
- legacy-or-unlisted status for endpoints that were previously documented but are no longer surfaced in the current public reference sidebar

## 3.4.0 highlights (current)

- **Code-example generator repaired** — duplicate path-parameter declarations removed across all languages; Node template interpolation corrected from `$${var}` to `${var}`; snippets normalized to one declaration per path parameter.
- **Provenance reconciled from contract files outward** — `endpoint-source.catalog.yaml` and `endpoint-coverage.matrix.yaml` now mirror the per-contract `reference.source_status` values exactly; no residual `user-supplied-reference-page` or `official-or-inferred-reference-page` values remain in live inventory files.
- **Legacy note normalized** — `sendrequestaccesstomural` retains `legacy-or-unlisted` status, but historical audit wording has been removed in favor of version-neutral guidance.
- **Release stamp advanced** — all contracts stamped `contract_version: 3.4.0`; manifest and control files regenerated for the patched release.
- **201-inline expansion** — all 17 create operations now carry `body_shape_inline` on their `201` success block (previously only `200` responses were expanded).
- **contract_version field** — all 90 contracts stamped with `contract_version: 3.4.0`; schema updated to declare the field.
- **Development notes enriched** — 86 contracts had only boilerplate; now all carry endpoint-specific guidance (asset two-step upload, voting state machine, timer workarounds, widget coordinate system, delete irreversibility, etc.).
- **Voting session results shape corrected** — `getmuralvotingsessionresults` now carries the correct per-widget vote tally array rather than the session metadata model.

- **Single-source identity** — bundle name normalised to `mural-public-api-developer-contract-bundle` everywhere: `prompt.body.xml` XML tag, `topology.plan.xml`, `endpoint-coverage.matrix.yaml`, `endpoint-source.catalog.yaml`, `scopes.matrix.yaml`, and both test suites. `topology.plan.xml` version brought forward from `2.0.0`.
- **Registry manifest regenerated** — `registry-manifest.yaml` reflects v3.4.0, `endpoint_count: 90`, `contract_file_count: 90`, with fresh SHA-256 file hashes.
- **Provenance reconciled** — endpoint contracts remain the source of truth; the catalog and coverage matrix now mirror those statuses exactly, including `canonicalized-from-user-supplied-typo` and `legacy-or-unlisted` where applicable.
- **contract_strength fully upgraded** — `params`, `status_codes`, and `success_shape` are now `reference-verified` or endpoint-specific across all 90 contracts.
- **Inline contract view** — every contract carries `body_shape_inline` (fully dereferenced 200 response) and `inline_error_envelope` so the full request/response contract is readable in one file.
- **Near-runnable examples** — all four languages declare path-parameter variables from env vars with `YOUR_X` fallbacks; Ruby paths use double-quoted strings for correct `#{}` interpolation.

- Three Users-family endpoints that were missing from 3.0.0 are now inventoried
  as first-class contracts (`inviteuserstoworkspace`,
  `updatemuralmemberpermissions`, `removemuralusers`). All three were promoted
  out of preview in the 2022-08-29 Mural changelog.
- New `workspaces:write` scope entry.
- PHP code examples fixed: the broken `$payload = {...};` JS-style literal
  across 46 body-carrying contracts is now a proper PHP associative array,
  verified with the PHP 8.3 parser.
- JSON-Schema hygiene: 39 nested `required: true` flags inside `properties`
  blocks removed across 28 contracts; root-level `required:` arrays preserved
  and augmented where needed so semantics are unchanged.
- `sendrequestaccesstomural` marked `legacy-or-unlisted` pending re-verification.
- 3 new regression tests.
