# Upload Attachment — Airtable API

Two approaches:
1) **By URL (simplest):** Provide a public URL; Airtable fetches and hosts it (see `attachment-field.md`).
2) **Binary upload via proxy/presigned URL:** Upload file to your own storage (S3/R2), then write the resulting URL to Airtable.

## API overview

Direct binary upload to Airtable is not part of the REST API. Use URL ingestion.

- **Endpoint base**: `https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}`
- **Auth**: `Authorization: Bearer $AIRTABLE_TOKEN`
- **Content-Type**: `application/json` for writes


## cURL — By URL
```bash
curl -sS -X PATCH "https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}"   -H "Authorization: Bearer $AIRTABLE_TOKEN" -H "Content-Type: application/json"   -d '{"records":[{"id":"recXXXXXXXXXXXXXX","fields":{"Files":[{"url":"https://files.example.com/u/123/report.pdf","filename":"report.pdf"}]}}]}'
```

## JS — Upload to R2 (example) then link
```js
// 1) Upload to your storage → get a HTTPS URL
const fileUrl = "https://files.example.com/u/123/report.pdf";

// 2) Write URL to Airtable field
await fetch(`https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}`, {
  method: "PATCH",
  headers: { Authorization: `Bearer $AIRTABLE_TOKEN`, "Content-Type": "application/json" },
  body: JSON.stringify({
    records: [{ id: "recXXXXXXXXXXXXXX", fields: { Files: [{ url: fileUrl, filename: "report.pdf" }] } }]
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
await at.updateRecord(env, "{TABLE_ID}", recordId, {"Files": [{ url: "https://...", filename: "x.pdf" }]});
```

Validate MIME type/size in the Worker; optionally virus‑scan before linking.


---

## Frontend impact

Show upload progress, then write the hosted URL via API.
