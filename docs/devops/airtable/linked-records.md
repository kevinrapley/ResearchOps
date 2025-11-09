# Linking to Another Record in Airtable (API)

This page explains how to **read and write linked record fields** with Airtable’s REST API, including the legacy “V1” write format and the richer “V2” webhook/read shape. It also includes ready‑to‑use examples for creating, updating, appending, and clearing links.

---

## Field Type

- **Type:** `multipleRecordLinks` — a field that links records in one table to records in another.

### Cell Formats

**V1 (REST write & read):**
- Represented as an **array** of linked record IDs, either as strings or objects.
  - Strings: `["recXXXXXXXXXXXXXX", "recYYYYYYYYYYYYY"]`
  - Objects: `[{"id":"recXXXXXXXXXXXXXX"}, {"id":"recYYYYYYYYYYYYY"}]`  
  - **Tip:** Objects `{ id }` are explicit and future‑proof; strings also work for writes.

**V2 (webhooks / some reads):**
Array of objects with the shape:
```json
[
  { "id": "recXXXXXXXXXXXXXX", "name": "Display Name" }
]
```
> When **writing**, send **IDs only** (string or `{ id }`). Do not send `name`.

---

## Field Options (Metadata)

- **`type`**: `"multipleRecordLinks"`  
- **`options`**: object with:
  - **`isReversed`**: `boolean`  
    Whether the UI renders linked records in reverse order (most recent first). You generally don’t need to rely on this.
  - **`linkedTableId`**: `string`  
    The ID of the linked table.
  - **`prefersSingleRecordLink`**: `boolean`  
    UI preference to keep only one link. (Not enforced by API; multiple links can still be set programmatically.)
  - **`inverseLinkFieldId`**: `optional<string>`  
    Field ID in the linked table that links back to this one.
  - **`viewIdForRecordSelection`**: `optional<string>`  
    View ID in the linked table to use when showing a list for selection in the UI.

---

## Writing Linked Records (V1 payloads)

You can send either strings (record IDs) or objects with an `id`. Both examples below are equivalent:

```json
{ "fields": { "Project": ["recAAA111...", "recBBB222..."] } }
```
```json
{ "fields": { "Project": [{ "id": "recAAA111..." }, { "id": "recBBB222..." }] } }
```

> **Important:** A `PATCH` to a record **replaces** the entire array for that field with what you send. If you want to **append** without losing existing links, read the record first, merge arrays in your code, then send the merged list.

---

## Examples: Create/Update Linked Records

Below, `{BASE_ID}`, `{TABLE_ID}`, `{LINK_FIELD_NAME}`, and `{LINKED_RECORD_ID}` are placeholders. Use your **Airtable API key/PAT** in `Authorization: Bearer …`.

### 1) Create a record that links to existing records

**cURL**
```bash
curl -sS -X POST \
  "https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}" \
  -H "Authorization: Bearer $AIRTABLE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "records": [
      {
        "fields": {
          "Name": "New child",
          "{LINK_FIELD_NAME}": [
            { "id": "{LINKED_RECORD_ID}" },
            { "id": "{ANOTHER_LINKED_RECORD_ID}" }
          ]
        }
      }
    ]
  }'
```

**JavaScript (fetch)**
```js
const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${AIRTABLE_TOKEN}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    records: [{
      fields: {
        Name: "New child",
        [LINK_FIELD_NAME]: [{ id: LINKED_RECORD_ID }]
      }
    }]
  })
});
const data = await res.json();
```

---

### 2) Update an existing record’s links (replace all links)

**cURL**
```bash
curl -sS -X PATCH \
  "https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}" \
  -H "Authorization: Bearer $AIRTABLE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "records": [
      {
        "id": "recXXXXXXXXXXXXXX",
        "fields": {
          "{LINK_FIELD_NAME}": [
            { "id": "{NEW_LINKED_RECORD_ID}" }
          ]
        }
      }
    ]
  }'
```

**JavaScript (fetch)**
```js
await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${AIRTABLE_TOKEN}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    records: [{
      id: "recXXXXXXXXXXXXXX",
      fields: {
        [LINK_FIELD_NAME]: [{ id: NEW_LINKED_RECORD_ID }]
      }
    }]
  })
});
```

> ⚠️ `PATCH` replaces the array. To **append**, read → merge → patch.

---

### 3) Append a link without overwriting existing links

```js
// 1) Read current links
const getRes = await fetch(
  `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/recXXXXXXXXXXXXXX`,
  { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } }
);
const rec = await getRes.json();
const current = rec.fields[LINK_FIELD_NAME] || []; // can be [{id}] or ["rec..."]

// 2) Normalize to {id} objects
const toObj = (v) => (typeof v === "string" ? { id: v } : v);
const merged = [...current.map(toObj), { id: NEW_LINKED_RECORD_ID }];

// 3) Write back
await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${AIRTABLE_TOKEN}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    records: [{ id: "recXXXXXXXXXXXXXX", fields: { [LINK_FIELD_NAME]: merged } }]
  })
});
```

---

### 4) Unlink all records (clear the field)

```bash
curl -sS -X PATCH \
  "https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}" \
  -H "Authorization: Bearer $AIRTABLE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "records": [
      {
        "id": "recXXXXXXXXXXXXXX",
        "fields": { "{LINK_FIELD_NAME}": [] }
      }
    ]
  }'
```

---

### 5) “Upsert by name” helper (resolve by primary field, then link)

```js
async function findByPrimary(baseId, tableId, name) {
  const url = new URL(`https://api.airtable.com/v0/${baseId}/${tableId}`);
  // WARNING: escape double quotes in name for filterByFormula in real code
  url.searchParams.set("filterByFormula", `{Name} = "${name}"`);
  url.searchParams.set("maxRecords", "1");
  const r = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }});
  const js = await r.json();
  return js.records?.[0]?.id || null;
}

const linkedId = await findByPrimary(BASE_ID, LINKED_TABLE_ID, "Project Alpha");
if (!linkedId) throw new Error("No such linked record");

await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`, {
  method: "POST",
  headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    records: [{ fields: { Name: "Child A", [LINK_FIELD_NAME]: [{ id: linkedId }] } }]
  })
});
```

---

## Tips & Gotchas

- **Batching:** Create/update supports batches of up to 10 records per request (check current limits).
- **Order:** Airtable UI may render links reversed; API order is the array order you send (see `isReversed`).
- **Objects vs strings:** When writing, `{ id: "rec..." }` is robust. Strings also work today.
- **Webhooks V2:** Webhooks deliver link cells as `{ id, name }`; **do not** send `name` on write—send IDs only.

---

## 🧠 How This Works in Our Codebase

Our backend integration with Airtable (inside the Cloudflare Worker) uses a lightweight abstraction layer defined in:

```
infra/cloudflare/src/service/internals/airtable.js
```

That module handles:
- API authentication (`Authorization: Bearer …`)
- Base and table routing
- Common CRUD helpers (`getRecords`, `createRecord`, `updateRecord`)
- Error normalization for Worker-friendly JSON responses

When linking records:
- We use the **V1 REST format** (`[{ id: "<recordId>" }]`) exclusively.
- The Worker serializes `fields` exactly as in the API examples above.
- All link writes go through the internal helper:
  ```js
  await airtable.updateRecord(env, tableName, recordId, {
    [linkFieldName]: [{ id: linkedId }]
  });
  ```
- If multiple records are linked, the helper merges arrays before sending them to the Airtable REST endpoint.

**Example (inside `infra/cloudflare/src/service/journals.js`):**
```js
import * as airtable from "../internals/airtable.js";

export async function linkJournalToProject(env, journalId, projectId) {
  const TABLE_JOURNALS = env.AIRTABLE_TABLE_JOURNAL;
  const FIELD_PROJECT_LINK = "Project";

  await airtable.updateRecord(env, TABLE_JOURNALS, journalId, {
    [FIELD_PROJECT_LINK]: [{ id: projectId }]
  });

  return { ok: true, journalId, projectId };
}
```

### ⚙️ Internal Behavior

| Step | Function | Description |
|------|-----------|-------------|
| 1 | `getRecord()` | Fetches a record by ID. |
| 2 | `updateRecord()` | Writes the merged `[{ id }]` array. |
| 3 | `createRecord()` | Accepts linked record arrays on insert. |
| 4 | Error handling | Normalized so Airtable API errors (422, 400) are readable. |

---

### 🧩 Frontend Notes (Project Dashboard → Reflexive Journal)

In the **Mural + Airtable integration**, when a new Mural board is created for a Reflexive Journal:

1. The Worker creates the Mural board via the Mural API.  
2. Once a valid `viewerLink` is available, it updates Airtable:  
   ```js
   await airtable.updateRecord(env, env.AIRTABLE_TABLE_MURAL_BOARDS, muralRecordId, {
     Project: [{ id: projectRecordId }]
   });
   ```
3. The frontend opens the Mural board in a new tab using the confirmed Airtable-stored URL.

> ✅ **We do not rely on synthetic URLs.**  
> The Worker waits until the Mural API returns a stable `viewerLink`, then commits the Airtable association.
