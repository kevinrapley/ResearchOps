# Airtable Public API Developer Contract Bundle

Version: 1.0.0

This bundle is designed to direct Airtable integration development. It is contract-rich rather than merely architectural.

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

## Integrity stance

This bundle is explicit about source confidence. Some Airtable endpoint pages are directly discoverable through public search. Others are included through official URL patterns plus secondary public confirmations from official support guidance or public ecosystem references. Those distinctions are preserved in the source catalog and endpoint contracts.
