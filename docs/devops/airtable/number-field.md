# Number Field (Airtable API)

Stores numeric values. Supports integer and decimal formats.

## API overview

Field type: `number`. On write, send raw numbers (not strings).

- **Endpoint base**: `https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}`
- **Auth**: `Authorization: Bearer $AIRTABLE_TOKEN`
- **Content-Type**: `application/json` for writes


## cURL — Create with number
```bash
curl -sS -X POST "https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}"   -H "Authorization: Bearer $AIRTABLE_TOKEN"   -H "Content-Type: application/json"   -d '{"records":[{"fields":{"Name":"Item A","Quantity":3,"Price":19.99}}]}'
```

## JS — Update number
```js
await fetch(`https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}`, {
  method: "PATCH",
  headers: { Authorization: `Bearer $AIRTABLE_TOKEN`, "Content-Type": "application/json" },
  body: JSON.stringify({
    records: [{ id: "recXXXXXXXXXXXXXX", fields: { Quantity: 4 } }]
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
await at.updateRecord(env, "{TABLE_ID}", recordId, {"Quantity": 1, "Price": 9.5});
```

Validate/coerce numbers server‑side to avoid stringly types.


---

## Frontend impact

Format numbers for display (e.g., Intl.NumberFormat).
