# Create Records — Airtable API

Create one or more records in a single request.

## API overview

Endpoint: `POST /v0/{BASE}/{TABLE}` with `records: [{{fields}}]`. Up to 10 per request.

- **Endpoint base**: `https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}`
- **Auth**: `Authorization: Bearer $AIRTABLE_TOKEN`
- **Content-Type**: `application/json` for writes


## cURL
```bash
curl -sS -X POST "https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}"   -H "Authorization: Bearer $AIRTABLE_TOKEN" -H "Content-Type: application/json"   -d '{"records":[{"fields":{"Name":"New item","Status":"Planned"}}]}'
```

## JS
```js
await fetch(`https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}`, {
  method: "POST",
  headers: { Authorization: `Bearer $AIRTABLE_TOKEN`, "Content-Type": "application/json" },
  body: JSON.stringify({
    records: [{ fields: { Name: "New item", Status: "Planned" } }]
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
await at.updateRecord(env, "{TABLE_ID}", recordId, {"Name": "New item"});
```




---

## Frontend impact

Use optimistic UI only if you can reconcile IDs when the server response returns.
