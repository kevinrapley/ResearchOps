# Get Record — Airtable API

Fetch a single record by ID.

## API overview

Endpoint: `/v0/{BASE}/{TABLE}/:id`

- **Endpoint base**: `https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}`
- **Auth**: `Authorization: Bearer $AIRTABLE_TOKEN`
- **Content-Type**: `application/json` for writes


## cURL
```bash
curl -sS "https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}/recXXXXXXXXXXXXXX"   -H "Authorization: Bearer $AIRTABLE_TOKEN"
```

## JS
```js
const r = await fetch(`https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}/recXXXXXXXXXXXXXX`, {
  headers: { Authorization: `Bearer $AIRTABLE_TOKEN` }
});
const rec = await r.json();
```

---

## Integration in ResearchOps (Cloudflare Worker)

Our Worker centralizes Airtable access in `infra/cloudflare/src/service/internals/airtable.js`.

**Pattern**

```js
import * as at from "../internals/airtable.js";

// Example usage inside a service route handler
await at.updateRecord(env, "{TABLE_ID}", recordId, // at.getRecord(env, table, id));
```




---

## Frontend impact

Use record fetch when opening detail views or modals.
