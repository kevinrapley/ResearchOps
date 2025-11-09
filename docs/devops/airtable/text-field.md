# Text Field (Airtable API)

Use for short/long text. Values are plain strings when reading and writing.

## API overview

Field type: `singleLineText` or `multilineText`. If you only write strings, Airtable coerces appropriately.

- **Endpoint base**: `https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}`
- **Auth**: `Authorization: Bearer $AIRTABLE_TOKEN`
- **Content-Type**: `application/json` for writes


## cURL — Create a record with text
```bash
curl -sS -X POST "https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}"   -H "Authorization: Bearer $AIRTABLE_TOKEN"   -H "Content-Type: application/json"   -d '{"records":[{"fields":{"Name":"Project Alpha","Notes":"Kickoff next week"}}]}'
```

## JS (fetch) — Update a text field
```js
await fetch(`https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}`, {
  method: "PATCH",
  headers: { Authorization: `Bearer $AIRTABLE_TOKEN`, "Content-Type": "application/json" },
  body: JSON.stringify({
    records: [{ id: "recXXXXXXXXXXXXXX", fields: { Notes: "Rescheduled to Friday" } }]
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
await at.updateRecord(env, "{TABLE_ID}", recordId, {"Notes": "Updated via Worker"});
```




---

## Frontend impact

No special handling; render as plain text. Sanitize if injecting into HTML.
