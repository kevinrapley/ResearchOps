# Airtable Public API Developer Contract Bundle

Version: 1.0.1

This bundle directs Airtable integration development. It is contract-rich rather than merely architectural.

## What it covers

- Publicly documented Airtable Web API record operations
- Record comments operations
- Public metadata and schema operations for bases, tables, fields, and views
- Public webhook lifecycle and payload-consumption operations
- Pagination, batching, performUpsert, rate limits, and implementation patterns
- Node, Ruby, PHP, and Python examples for every included endpoint contract

## What it does not pretend to cover

- Enterprise API detailed admin surface
- eDiscovery APIs
- Undocumented or plan-gated endpoints that are not fully public

## Contract posture

Each endpoint contract includes:

- exact method and path template
- minimum scopes
- path and query params
- request body shape when relevant
- success and error response shapes
- multilingual request examples
- provenance status

## Evaluation posture

The bundle now has explicit evaluation pipelines for:

- endpoint-contract response quality
- operational safety and boundary handling
- schema and webhook behaviour

Regression and red-team cases cover endpoint resolution, source grounding, narrowest viable scope selection, pagination, batching, performUpsert, rate-limit handling, webhook MAC verification, schema-write safety, and boundary handling for Enterprise API and eDiscovery requests.

## Schema posture

`grade.schema.json` and `output.schema.json` are the authoritative schemas.

The earlier CommonJS shim files have been removed:

- `grade.schema.js`
- `output.schema.js`

## Integrity stance

This bundle is explicit about source confidence. Some Airtable endpoint pages are directly discoverable through public search. Others are included through official URL patterns plus secondary public confirmations from official support guidance or public ecosystem references. Those distinctions are preserved in the source catalog and endpoint contracts.
