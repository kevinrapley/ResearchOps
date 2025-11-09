# Delete Multiple Records — Airtable API

Delete up to 10 records per request.

## API overview

Endpoint: `DELETE /v0/{BASE}/{TABLE}?records[]=recA&records[]=recB`

- **Endpoint base**: `https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}`
- **Auth**: `Authorization: Bearer $AIRTABLE_TOKEN`
- **Content-Type**: `application/json` for writes


## cURL
```bash
curl -sS -X DELETE "https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}?records[]=recAAA&records[]=recBBB"   -H "Authorization: Bearer $AIRTABLE_TOKEN"
```

## JS
```js
const ids = ["recAAA","recBBB"];
const url = new URL(`https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}`);
ids.forEach(id => url.searchParams.append("records[]", id));
await fetch(url, { method: "DELETE", headers: { Authorization: `Bearer $AIRTABLE_TOKEN` } });
```

---

## Integration in ResearchOps (Cloudflare Worker)

Our Worker centralizes Airtable access in `infra/cloudflare/src/service/internals/airtable.js`.

**Pattern**

```js
import * as at from "../internals/airtable.js";

// Example usage inside a service route handler
await at.updateRecord(env, "{TABLE_ID}", recordId, // at.deleteRecords(env, table, ids));
```




---

## Frontend impact

Show destructive confirmation and support undo (soft delete) when feasible.
