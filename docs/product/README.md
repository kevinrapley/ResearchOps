# Product documentation

Product records must be stored in dated folders using this path pattern:

```text
docs/product/YY/MM/DD/
```

Use the date the record was created or approved for repository storage. For example, a product record created on 8 May 2026 belongs in:

```text
docs/product/26/05/08/
```

## Rules

- Store new product records inside the dated folder pattern.
- Use `YY`, `MM` and `DD` as two-digit values.
- Keep filenames descriptive and stable.
- Add or update a dated folder `README.md` when adding records.
- Keep root-level product documents out of this directory except this `README.md` once legacy files have been safely migrated.

## Migration note

Most existing flat product records have been moved into dated folders. If a legacy flat product record remains, treat the dated copy as canonical and remove the flat copy only when the exact blob metadata is available for a safe content-preserving deletion.

## Current dated indexes

- [`26/05/07/`](26/05/07/)
- [`26/05/08/`](26/05/08/)
