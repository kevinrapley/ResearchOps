# Date / DateTime Field — Airtable API

Stores ISO8601 date/time strings. Pay attention to timezones and field configuration (date only vs. date+time).

## API overview

Types: `date`, `dateTime`. On write, send ISO8601 strings (e.g., `2025-11-09` or `2025-11-09T14:30:00Z`).

- **Endpoint base**: `https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}`
- **Auth**: `Authorization: Bearer $AIRTABLE_TOKEN`
- **Content-Type**: `application/json` for writes


## cURL — Set date
```bash
curl -sS -X PATCH "https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}"   -H "Authorization: Bearer $AIRTABLE_TOKEN" -H "Content-Type: application/json"   -d '{"records":[{"id":"recXXXXXXXXXXXXXX","fields":{"Due":"2025-12-01"}}]}'
```

## JS — Set date‑time (UTC)
```js
await fetch(`https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}`, {
  method: "PATCH",
  headers: { Authorization: `Bearer $AIRTABLE_TOKEN`, "Content-Type": "application/json" },
  body: JSON.stringify({
    records: [{ id: "recXXXXXXXXXXXXXX", fields: { Meeting: "2025-12-01T10:00:00Z" } }]
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
await at.updateRecord(env, "{TABLE_ID}", recordId, {"Meeting": new Date().toISOString()});
```

Normalize to UTC in the Worker if sources vary.


---

## Frontend impact

Use local formatting for display; preserve ISO strings when writing back.
