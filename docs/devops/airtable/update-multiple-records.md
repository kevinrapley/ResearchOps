# Update Multiple Records — Airtable API

Batch update up to 10 records per request. `PATCH` replaces only the specified fields.

## API overview

Endpoint: `PATCH /v0/{BASE}/{TABLE}` with `records: [{{id, fields}}]`.

- **Endpoint base**: `https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}`
- **Auth**: `Authorization: Bearer $AIRTABLE_TOKEN`
- **Content-Type**: `application/json` for writes


## cURL
```bash
curl -sS -X PATCH "https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}"   -H "Authorization: Bearer $AIRTABLE_TOKEN" -H "Content-Type: application/json"   -d '{"records":[{"id":"recAAA","fields":{"Status":"Planned"}},{"id":"recBBB","fields":{"Status":"Complete"}}]}'
```

## JS
```js
await fetch(`https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}`, {
  method: "PATCH",
  headers: { Authorization: `Bearer $AIRTABLE_TOKEN`, "Content-Type": "application/json" },
  body: JSON.stringify({
    records: [
      { id: "recAAA", fields: { Status: "Planned" } },
      { id: "recBBB", fields: { Status: "Complete" } }
    ]
  })
});
```

---

## Integration in ResearchOps (Cloudflare Worker)

Our Worker centralizes Airtable access in `infra/cloudflare/src/service/internals/airtable.js`.

**Pattern**

```js
import * as at from "../internals/airtable.js";

// Example usage inside a service route handler
await at.updateRecord(env, "{TABLE_ID}", recordId, {"Status": "Planned"} // applied per record in a loop);
```




---

## Frontend impact

Batch apply edits from tables/grids, then refresh silently.
