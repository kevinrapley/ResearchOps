# Select Field (Single/Multi) — Airtable API

Represents a controlled vocabulary. Single select stores one option, multi‑select stores an array of options.

## API overview

Types: `singleSelect`, `multipleSelects`. On write, send the **option name(s)** as strings.

- **Endpoint base**: `https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}`
- **Auth**: `Authorization: Bearer $AIRTABLE_TOKEN`
- **Content-Type**: `application/json` for writes


## cURL — Set single select
```bash
curl -sS -X PATCH "https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}"   -H "Authorization: Bearer $AIRTABLE_TOKEN" -H "Content-Type: application/json"   -d '{"records":[{"id":"recXXXXXXXXXXXXXX","fields":{"Status":"Planned"}}]}'
```

## cURL — Set multi‑select
```bash
curl -sS -X PATCH "https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}"   -H "Authorization: Bearer $AIRTABLE_TOKEN" -H "Content-Type: application/json"   -d '{"records":[{"id":"recXXXXXXXXXXXXXX","fields":{"Tags":["urgent","ux"]}}]}'
```

## JS — Replace all options
```js
await fetch(`https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}`, {
  method: "PATCH",
  headers: { Authorization: `Bearer $AIRTABLE_TOKEN`, "Content-Type": "application/json" },
  body: JSON.stringify({
    records: [{ id: "recXXXXXXXXXXXXXX", fields: { Tags: ["research","priority"] } }]
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
await at.updateRecord(env, "{TABLE_ID}", recordId, {"Status": "Planned", "Tags": ["ux","ops"]});
```

Ensure options exist in field configuration; otherwise Airtable will create them (if permitted).


---

## Frontend impact

Use known option lists for UI pickers; avoid free‑typing to keep taxonomy clean.
