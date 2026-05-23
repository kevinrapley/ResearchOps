# Contract tests

This directory is the expected contract-test location for the `api-contract-change` eval.

A real API service should place executable contract tests here.

The fixture keeps this file intentionally small because the eval validates repository shape and evidence paths rather than a production API implementation.

Required contract evidence for API changes:

- endpoint catalogue updated
- success payload example updated
- error payload example updated
- backwards compatibility risks recorded
- contract tests added or updated
