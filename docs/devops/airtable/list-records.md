# List Records — Airtable API

Paginate through records with optional filtering, sorting, and view scoping.

## API overview

Use `pageSize` and `offset` for pagination; `filterByFormula` for server‑side filtering.

- **Endpoint base**: `https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}`
- **Auth**: `Authorization: Bearer $AIRTABLE_TOKEN`
- **Content-Type**: `application/json` for writes


## cURL
```bash
curl -sS "https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}?pageSize=50&view=Grid%20view"   -H "Authorization: Bearer $AIRTABLE_TOKEN"
```

## JS (fetch) with pagination
```js
const all = [];
let url = new URL(`https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}`);
url.searchParams.set("pageSize", "100");

while (url) {
  const r = await fetch(url, { headers: { Authorization: `Bearer $AIRTABLE_TOKEN` } });
  const js = await r.json();
  all.push(...(js.records || []));
  const offset = js.offset;
  if (offset) {
    url = new URL(`https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}`);
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("offset", offset);
  } else url = null;
}
```

---

## Integration in ResearchOps (Cloudflare Worker)

Our Worker centralizes Airtable access in `infra/cloudflare/src/service/internals/airtable.js`.

**Pattern**

```js
import * as at from "../internals/airtable.js";

// Example usage inside a service route handler
await at.updateRecord(env, "{TABLE_ID}", recordId, // at.listRecords(env, table, params));
```




---

## Frontend impact

Use progressive loading (infinite scroll) and show total when available.
