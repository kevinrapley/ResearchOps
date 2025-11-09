# Attachment Field — Airtable API

Stores files as hosted attachments. For REST writes, you typically provide a publicly accessible URL; Airtable will fetch and host it.

## API overview

Type: `multipleAttachments`. Write an array of objects like `{{url, filename}}`.

- **Endpoint base**: `https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}`
- **Auth**: `Authorization: Bearer $AIRTABLE_TOKEN`
- **Content-Type**: `application/json` for writes


## cURL — Add attachment by URL
```bash
curl -sS -X PATCH "https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}"   -H "Authorization: Bearer $AIRTABLE_TOKEN" -H "Content-Type: application/json"   -d '{"records":[{"id":"recXXXXXXXXXXXXXX","fields":{"Files":[{"url":"https://example.com/file.pdf","filename":"Brief.pdf"}]}}]}'
```

## JS — Replace attachments
```js
await fetch(`https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}`, {
  method: "PATCH",
  headers: { Authorization: `Bearer $AIRTABLE_TOKEN`, "Content-Type": "application/json" },
  body: JSON.stringify({
    records: [{ id: "recXXXXXXXXXXXXXX", fields: { Files: [{ url: "https://example.com/a.png", filename: "a.png" }] } }]
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

For direct binary uploads, see `upload-attachment.md` for the presigned‑URL flow or proxy uploads.


---

## Frontend impact

Render thumbnails when available; include file size/type in UI.
