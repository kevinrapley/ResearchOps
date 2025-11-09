# Collaborator Field — Airtable API

Represents one or more Airtable users (by ID).

## API overview

Types: `singleCollaborator`, `multipleCollaborators`. On write, send `{id}` objects.

- **Endpoint base**: `https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}`
- **Auth**: `Authorization: Bearer $AIRTABLE_TOKEN`
- **Content-Type**: `application/json` for writes


## cURL — Assign collaborator
```bash
curl -sS -X PATCH "https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}"   -H "Authorization: Bearer $AIRTABLE_TOKEN" -H "Content-Type: application/json"   -d '{"records":[{"id":"recXXXXXXXXXXXXXX","fields":{"Assignee":[{"id":"usrXXXXXXXXXXXXXX"}]}}]}'
```

## JS — Replace multiple collaborators
```js
await fetch(`https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}`, {
  method: "PATCH",
  headers: { Authorization: `Bearer $AIRTABLE_TOKEN`, "Content-Type": "application/json" },
  body: JSON.stringify({
    records: [{ id: "recXXXXXXXXXXXXXX", fields: { Reviewers: [{ id: "usrAAA..." }, { id: "usrBBB..." }] } }]
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
await at.updateRecord(env, "{TABLE_ID}", recordId, {"Assignee": [{ id: "usr..." }]});
```

User IDs can be discovered via the UI (field config) or the Metadata API.


---

## Frontend impact

Gate collaborator pickers behind permission checks; show avatars if available.
