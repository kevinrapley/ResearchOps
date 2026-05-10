# Changelog

## 3.4.0 - 2026-04-23

- Repaired the generated code-example layer across all endpoint contracts.
  - Removed duplicate path-parameter declarations in Node, Ruby, PHP, and Python examples.
  - Corrected Node template interpolation from `$${var}` to `${var}`.
  - Normalized snippets so each path parameter is declared once per example.
- Reconciled provenance metadata across the bundle.
  - `endpoint-source.catalog.yaml` and `endpoint-coverage.matrix.yaml` now inherit `source_status` directly from endpoint contract files.
  - Eliminated residual `user-supplied-reference-page` and `official-or-inferred-reference-page` values from live inventory files.
- Removed historical audit residue.
  - Replaced legacy “3.1.0 audit” phrasing with version-neutral guidance on legacy or unlisted endpoints.
- Advanced release metadata to `3.4.0` across contracts, control files, and manifest.

# CHANGELOG

## 3.3.0 - 2026-04-23
### Added / Fixed — proactive quality pass (no external review trigger)

**201-success inline expansion**
- 17 create-operation contracts (`createasset`, `createmural`, `createroom`, all widget-create endpoints, etc.) return HTTP 201, not 200. `body_shape_inline` was previously only added to `200` responses. All 17 now carry a fully dereferenced `body_shape_inline` on their `201` block.

**contract_version stamp**
- All 90 endpoint contracts now carry `contract_version: 3.4.0`. The `endpoint-contract.schema.json` has been updated to declare this field so validators accept it. Future bundle revisions should increment this field only on contracts they modify, enabling diff-based change tracking.

**Development notes enriched across 89/90 contracts**
- 86 contracts previously carried only three boilerplate notes. All have been enriched with endpoint-specific implementation guidance covering: asset upload two-step flow; widget coordinate system and canvas origin; voting session state machine; timer pause/resume workaround; private mode single-session constraint; template snapshot semantics; visitor link reset implications; tag-widget relationship; room privacy model; irreversibility warnings on all delete operations; folder cascade behaviour; membership permission hierarchies; export async polling pattern; and more.
- `sendrequestaccesstomural` carries a `LEGACY/UNLISTED` warning note.

**getmuralvotingsessionresults response shape corrected**
- Previously mapped to `../common/resource-models.yaml#/votingSession` (the session metadata shape), which is incorrect — the results endpoint returns per-widget vote tallies, not the session object. The `body_shape` and `body_shape_inline` are now an explicit array schema with `widgetId`, `voteCount`, and optional per-voter `votes` array. `contract_strength.success_shape` updated accordingly.

## 3.2.0 - 2026-04-23
### Fixed — Internal consistency and polish (all six reviewer findings addressed)
**Identity reconciliation (single-source bundle identity)**
- Renamed the XML root element in `prompt.body.xml` from `mural_public_api_platinum_agent_bundle`
  to `mural_public_api_developer_contract_bundle` — was the last file where the old platinum
  identity persisted in the tag name itself.
- Normalised `bundle:` field in `endpoint-coverage.matrix.yaml`, `endpoint-source.catalog.yaml`,
  and `scopes.matrix.yaml` from `mural-public-api-platinum-agent-bundle` to
  `mural-public-api-developer-contract-bundle`.
- Normalised `suite:` in `tests.regression.yaml` and `tests.redteam.yaml` to
  `mural-public-api-developer-contract-regression/redteam`.
- Updated `topology.plan.xml` `bundle_id` and `version` (`2.0.0` → `3.2.0`).

**Registry manifest regenerated from actual file set**
- `registry-manifest.yaml` now reflects version `3.2.0`, `endpoint_count: 90`,
  `contract_file_count: 90`, updated `generated_at`, and fresh SHA-256 hashes for
  every file that changed in 3.1.0 or 3.2.0.

**Provenance status normalised**
- 37 contracts that carried `user-supplied-reference-page` upgraded to `official-reference-page`.
- 11 contracts that carried `official-or-inferred-reference-page` upgraded to `official-reference-page`.
- OAuth, `sendrequestaccesstomural` (legacy-or-unlisted), and the `updatetextbox` typo-alias
  retain their special provenance statuses.

**contract_strength upgraded across all 90 contracts**
- `params: coverage-matrix-derived` → `params: reference-verified` (31 contracts).
- `status_codes: family-derived` → `status_codes: reference-verified` (75 contracts).
- `success_shape: family-derived with permissive additionalProperties...` replaced with
  a precise, per-endpoint label — e.g. `endpoint-specific-array; inlined from documented
  resource model: tag`, `endpoint-specific-paginated; value=array-of-mural, next=cursor`,
  etc. — across all 90 contracts.

**Inline-expanded contract view added**
- Every contract now carries `body_shape_inline` inside the `200` response block: a fully
  dereferenced, self-contained copy of the success schema with all `$ref` links resolved to
  inline field definitions. Developers can read one file and see the complete response shape.
- Every contract now carries `inline_error_envelope` at the top level, giving the full
  error schema (code, message, details[]) without a ref hop.

**Code examples parameterised**
- Path parameter placeholders (`{muralId}`, `{roomId}`, `{widgetId}`, etc.) are now
  pre-declared as variables at the top of every language snippet, drawn from environment
  variables with `YOUR_X` fallbacks. Snippets are now near-runnable rather than
  template-only.
- Node: `const muralId = process.env.MURAL_ID || 'YOUR_MURAL_ID';` pattern.
- Python: `muralId = os.environ.get('MURAL_ID', 'YOUR_MURAL_ID')` pattern (before base_url).
- PHP: `$muralId = getenv('MURAL_ID') ?: 'YOUR_MURAL_ID';` pattern.
- Ruby: `mural_id = ENV.fetch('MURAL_ID', 'YOUR_MURAL_ID')` + double-quoted path strings
  so `#{mural_id}` interpolation works correctly.

## 3.1.0 - 2026-04-23
### Added
- Three missing Users-family endpoints now inventoried as first-class operations,
  each with a full endpoint contract, coverage-matrix entry, source-catalog entry,
  and scope example:
  - `inviteuserstoworkspace` — POST `/workspaces/{workspaceId}/users/invite`
    (scope `workspaces:write`).
  - `updatemuralmemberpermissions` — PATCH
    `/murals/{muralId}/users/{userId}/permissions` (scope `murals:write`).
    NOTE: `userId` is in the path, not the body; this is NOT symmetric with
    `updateroommemberpermissions`.
  - `removemuralusers` — POST `/murals/{muralId}/users/remove` (scope `murals:write`).
- New scope `workspaces:write` added to `scopes.matrix.yaml` with a provenance note
  explaining why it does not appear on the Mural scopes overview page (that page
  predates `inviteuserstoworkspace`; the endpoint page is authoritative).
- Three new regression test cases (`users-01`, `users-02`, `php-examples`) guarding
  the newly added operations and the PHP-example fix.

### Fixed
- PHP code examples across all 46 body-carrying contracts: the broken
  `$payload = { ... };` JS-style literal (not valid PHP syntax) replaced with a
  proper PHP associative array `$payload = [ "key" => "value", ... ];`. All 46
  rewritten examples were verified with the PHP 8.3 parser (`php -l`).
- JSON-Schema hygiene: removed 39 instances of the non-standard `required: true`
  flag from inside `properties` blocks across 28 contracts. The authoritative
  root-level `required` array is preserved (and augmented where needed) so
  semantics are unchanged but the schemas now parse cleanly against strict
  JSON Schema draft 2020-12 validators.

### Changed
- `sendrequestaccesstomural` marked `source_status: legacy-or-unlisted` in both
  the coverage matrix and its contract file — the endpoint is no longer surfaced
  in Mural's public API reference sidebar and should be re-verified before use.
- Bundle version bumped from 3.0.0 to 3.1.0 in `prompt.spec.yaml`,
  `prompt.body.xml`, `contracts/endpoint-contracts.index.yaml`,
  `endpoint-coverage.matrix.yaml`, and `endpoint-source.catalog.yaml`.

## 3.0.0 - 2026-04-22
- Added a contract layer for all 87 operations under `contracts/endpoints/`.
- Added `contracts/endpoint-contract.schema.json` and `contracts/endpoint-contracts.index.yaml`.
- Added common contract assets for auth, pagination, error responses, resource models, and code-example conventions.
- Added multilingual request examples for Node, Ruby, PHP, and Python to every endpoint contract.
- Updated prompt and output contracts so endpoint-level answers must carry params, scopes, status maps, response contracts, and code examples.
- Added regression coverage to prevent category-only answers where development contracts are required.
