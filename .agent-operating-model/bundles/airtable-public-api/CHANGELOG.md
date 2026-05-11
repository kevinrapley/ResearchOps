# Changelog

## 1.1.0 - 2026-05-11

- added `behaviouralEvals` section to `evals.yaml` with 7 named evaluations covering all `required_behaviours`
- each eval carries `expectedEvidence` (`matched-rule`, `matched-signal`, `selected-bundle`, `canonical-directory`) and typed `forbiddenFailureModes`, matching the quality standard introduced in the openai-platform and mcp-agent-tooling bundles
- evals cover: endpoint resolution, narrowest scope selection, pagination and batching safety, webhook MAC verification, schema-write safety, enterprise boundary enforcement, and PAT token safety
- corrected `coverage_expectations` counts to match committed test suite: `minimum_regression_cases` 18→20, `minimum_redteam_cases` 12→14

## 1.0.1 - 2026-05-11

- expanded `evals.yaml` from a suite pointer into a structured evaluation orchestration file
- added endpoint-contract, operational-safety, schema and webhook evaluation pipelines
- expanded regression coverage for reads, writes, comments, webhooks, schema operations, batching, pagination and formula filtering
- expanded red-team coverage for over-scoping, destructive imports, missing pagination, missing batching, missing webhook payload retrieval, unsafe formula construction and schema writes without schema reads
- consolidated schema posture to JSON schemas only
- removed legacy CommonJS schema shim files: `grade.schema.js` and `output.schema.js`

## 1.0.0 - 2026-04-23

- initial Airtable public API developer contract bundle
- added endpoint contracts for records, comments, metadata, schema mutation, views, and webhooks
- added public-support-grounded operational guidance for pagination, batching, performUpsert, and rate limits
- added multilingual request examples for Node, Ruby, PHP, and Python
- added explicit boundary posture for Enterprise API and eDiscovery
