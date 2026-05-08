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
- Keep README guidance at the `docs/product/` root only.
- Do not add `README.md` files inside individual `DD` folders.
- Keep root-level product documents out of this directory except this `README.md` once legacy files have been migrated.

## Migration note

Most existing flat product records have been moved into dated folders. If a legacy flat product record remains, treat the dated copy as canonical and remove the flat copy only when exact blob metadata is available.

## Current dated folders

- [`26/05/07/`](26/05/07/)
- [`26/05/08/`](26/05/08/)
