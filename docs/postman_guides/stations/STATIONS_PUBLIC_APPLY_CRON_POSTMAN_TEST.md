## LAVO — Stations Public + Apply + Cron (Postman Test Guide)

This guide complements the importable Postman collection:
- `lavo/docs/postman_guides/stations/lavo-stations-public-apply-cron.postman_collection.json`

It covers the two cards that were implemented:

- **Card 1:** public stations API (list/detail/join)
- **Card 2:** station application (apply) + pending uploads sync cron

---

### Base URL

- `{{base_url}}` (example: `http://localhost:3000`)

### Environment variables

Import: `lavo/docs/postman_guides/lavo.local.postman_environment.json`

Required:
- **`base_url`**

Required for cron:
- **`cron_secret`** (must match `CRON_SECRET` in `.env`)

Optional:
- **`station_id`** (for detail/join — can be set manually or from apply response)

---

## 1) Public stations API (Card 1)

### 1.1 List stations

- **Request:** `GET /api/v1/stations`
- **Query params:** `q`, `city`, `sort` where `sort` is one of: `name`, `slots_asc`, `slots_desc`
- **Expected:** `200` with `{ data: Station[] }`
- **Negative tests:** invalid `sort` → `400 VALIDATION_FAILED`

### 1.2 Station detail

- **Request:** `GET /api/v1/stations/{{station_id}}`
- **Expected:** `200` with `{ data: StationWithDetail }`
- **Negative tests:** invalid UUID → `400`; missing or inactive → `404`

### 1.3 Join station

- **Request:** `POST /api/v1/stations/{{station_id}}/join`
- **Expected:** `200` with `{ data: { mapsUrl } }`
- **Negative tests:** invalid UUID → `400`; missing or inactive → `404`

---

## 2) Station apply (Card 2)

### 2.1 Apply (multipart/form-data)

- **Request:** `POST /api/v1/stations/apply`
- **Fields (text):**
  - `name`, `address`, `city`, `wash_type`, `wash_post_count`, `terms_accepted`
  - Optional: `legal_name`, `registration_number`, `description`, `latitude`, `longitude`
- **Files:**
  - Use keys like `document_<type>`, example: `document_kbis`
  - Allowed types: images (JPEG/PNG/WebP/GIF) and PDF
  - Max size: 10MB per file
- **Expected:** `201` with `{ data: { station_id, message } }`

**Important:** in the collection JSON, the file `src` is a placeholder (example path). Replace it with a real local path in Postman after import.

---

## 3) Cron: sync pending uploads (Card 2)

### 3.1 Sync local → Cloudinary

- **Request:** `GET /api/cron/sync-pending-uploads`
- **Auth:** header `x-cron-secret: {{cron_secret}}` (or `Authorization: Bearer {{cron_secret}}`)
- **Expected:** `200` with `{ data: { processed, succeeded, failed } }`
- **Negative tests:** missing/wrong secret → `401`

---

## Suggested end-to-end check (local fallback path)

1. Leave Cloudinary env vars empty (or invalid) so apply falls back to local disk.
2. Call **Apply** with a PDF/image → it should succeed and create pending uploads.
3. Call **Cron sync** with the correct secret → it should attempt to upload and update documents.

