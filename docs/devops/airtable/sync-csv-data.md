# Sync CSV Data — Airtable API (Pattern)

Airtable's REST API doesn't import CSV directly. The common pattern is: parse CSV → upsert rows via `create`/`update` in batches.

## API overview

Batch up to 10 records per request. Use a stable key to decide create vs update.

- **Endpoint base**: `https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}`
- **Auth**: `Authorization: Bearer $AIRTABLE_TOKEN`
- **Content-Type**: `application/json` for writes


## JS — Example upsert loop
```js
import Papa from "papaparse"; // or csv-parse

const rows = Papa.parse(csvString, { header: true }).data;
const chunks = (arr, n) => arr.reduce((a,_,i) => (i % n ? a : [...a, arr.slice(i,i+n)]), []);

for (const batch of chunks(rows, 10)) {
  const payload = {
    records: batch.map(r => ({ fields: r }))
  };
  const res = await fetch(`https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}`, {
    method: "POST",
    headers: { Authorization: `Bearer $AIRTABLE_TOKEN`, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const js = await res.json();
}
```

## cURL — Illustrative (single batch)
```bash
curl -sS -X POST "https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}"   -H "Authorization: Bearer $AIRTABLE_TOKEN" -H "Content-Type: application/json"   -d '{"records":[{"fields":{"Name":"Row 1"}},{"fields":{"Name":"Row 2"}}]}'
```

---

## Integration in ResearchOps (Cloudflare Worker)

Our Worker centralizes Airtable access in `infra/cloudflare/src/service/internals/airtable.js`.

**Pattern**

```js
import * as at from "../internals/airtable.js";

// Example usage inside a service route handler
await at.updateRecord(env, "{TABLE_ID}", recordId, // Provide a CSV upload endpoint that parses server‑side, validates, then writes to Airtable);
```

Consider idempotency keys and partial failure reporting.


---

## Frontend impact

Drag‑drop CSV → show preview grid → confirm → send to Worker for validation/import.
