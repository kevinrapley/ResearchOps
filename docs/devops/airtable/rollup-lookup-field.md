# Rollup / Lookup Field — Airtable API

Read‑only fields that derive values from linked records. You cannot write to them directly.

## API overview

Types: `lookup`, `rollup`. Values are computed by Airtable; treat them as read‑only in writes.

- **Endpoint base**: `https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}`
- **Auth**: `Authorization: Bearer $AIRTABLE_TOKEN`
- **Content-Type**: `application/json` for writes


## cURL — Read records (with rollups/lookups)
```bash
curl -sS -X GET "https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}?maxRecords=5"   -H "Authorization: Bearer $AIRTABLE_TOKEN"
```

## JS — Read and consume
```js
const res = await fetch(`https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}?maxRecords=5`, {
  headers: { Authorization: `Bearer $AIRTABLE_TOKEN` }
});
const data = await res.json();
const rows = data.records.map(r => ({ id: r.id, rollup: r.fields.Total || null }));
```

---

## Integration in ResearchOps (Cloudflare Worker)

Our Worker centralizes Airtable access in `infra/cloudflare/src/service/internals/airtable.js`.

**Pattern**

```js
import * as at from "../internals/airtable.js";

// Example usage inside a service route handler
await at.updateRecord(env, "{TABLE_ID}", recordId, // rollups/lookups are never written);
```

When exporting to CSV, include these as computed columns but do not attempt to PATCH them.


---

## Frontend impact

Display as derived values; mark with an info tooltip ‘computed from …’.
