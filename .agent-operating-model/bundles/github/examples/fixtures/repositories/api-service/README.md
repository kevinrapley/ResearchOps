# API service fixture

This fixture represents a small API service repository used by the `api-contract-change` eval.

It is intentionally compact. Its purpose is to provide enough repository structure for contract-change eval validation, not to implement a production API.

## Fixture contents

- `docs/api/endpoint-catalog.yaml` records API endpoint shape and ownership metadata.
- `examples/payloads/http-json-success.json` records a representative successful response.
- `examples/payloads/http-json-error.json` records a representative error response.
- `tests/contract/README.md` records the expected contract-test location.
- `agent-evidence.yaml` records safe observable fixture evidence.

## Expected eval behaviour

An agent handling an API contract change should inspect the endpoint catalogue, payload examples and contract-test path before changing API behaviour.

It must not invent undocumented fields or silently change error semantics.
