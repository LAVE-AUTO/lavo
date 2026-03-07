## LAVO — Stations (Public + Onboarding + Cron) — Postman Test Guide

This guide complements the importable Postman collection:
- `lavo/docs/postman_guides/stations/lavo-stations-public-onboarding-cron.postman_collection.json`

It covers:

- **Public:** stations API (list, detail, join)
- **Onboarding:** upload documents and submit (create station + user)
- **Formats:** vehicle formats and pricing (GET by station, POST/PUT/PATCH/DELETE for connected station)
- **Cron:** sync pending uploads (local files from onboarding)

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
- **`station_id`** (for detail/join/formats — set manually or from onboarding submit response)
- **`format_id`** (for PUT/PATCH/DELETE format — set from GET formats or POST format response)
- **`access_token`** (station JWT for POST/PUT/PATCH/DELETE formats and other station-scoped endpoints)

---

## 1) Public stations API

### 1.1 List stations

- **Request:** `GET /api/v1/stations`
- **Query params:** `q`, `city`, `sort` where `sort` is one of: `name`, `slots_asc`, `slots_desc`
- **Expected:** `200` with `{ data: Array<Station & { available: boolean; available_slots: number }> }`. Each station includes `available` (true iff at least one future slot has capacity) and `available_slots` (sum of capacity − booked_count for start_time > NOW()).
- **Negative tests:** invalid `sort` → `400 VALIDATION_FAILED`

### 1.2 Station detail

- **Request:** `GET /api/v1/stations/{{station_id}}`
- **Expected:** `200` with `{ data: StationWithDetail & { available: boolean; available_slots: number } }`. Unavailability is derived only from slot availability; there is no API toggle for `is_open`. (Figma shows Station ouverte/fermée toggles—backend does not expose them; front should use `available` and `available_slots`.)
- **Negative tests:** invalid UUID → `400`; missing or inactive → `404`

### 1.3 Join station

- **Request:** `POST /api/v1/stations/{{station_id}}/join`
- **Expected:** `200` with `{ data: { mapsUrl } }`
- **Negative tests:** invalid UUID → `400`; missing or inactive → `404`

---

## 2) Onboarding

### 2.1 Upload document

- **Request:** `POST /api/v1/stations/onboarding/upload`
- **Body:** multipart/form-data, field `file` (image or PDF, max 10 MB)
- **Expected:** `201` with `{ data: { url, storage } }` (`storage` is `cloudinary` or `local`)
- **Negative tests:** missing file → `400`; invalid type/size → `400`/`413`; rate limit → `429`

### 2.2 Submit onboarding

- **Request:** `POST /api/v1/stations/onboarding/submit`
- **Body:** JSON with step 1 (email, phone, password, confirm_password), step 2 (station_name, address, city, wash_post_count, wash_type, ...), step 3 (documents: [{ document_type, file_url, storage? }], terms_accepted: true)
- **Expected:** `201` with `{ data: { user, station } }`
- **Negative tests:** validation → `400`; email already exists → `409`; rate limit → `429`

---

## 3) Formats (vehicle formats and pricing)

### 3.1 Get formats by station (public)

- **Request:** `GET /api/v1/stations/{{station_id}}/formats`
- **Auth:** None
- **Expected:** `200` with `{ data: Array<Format> }` (id, station_id, label, price, is_active, created_at, updated_at)
- **Negative tests:** invalid UUID → `400`; station not found or not active → `404`

### 3.2 Create format (auth STATION)

- **Request:** `POST /api/v1/station/formats`
- **Auth:** `Authorization: Bearer {{access_token}}` (station JWT)
- **Body:** `{ "label": "Petit", "price": 15.5, "is_active": true }` (label 1–100 chars, price > 0, is_active optional)
- **Expected:** `201` with created format
- **Negative tests:** validation → `400`; unauthorized → `401`; no station for user → `404`

### 3.3 Update format — PUT (full) and PATCH (partial)

- **Request:** `PUT /api/v1/station/formats/{{format_id}}` or `PATCH /api/v1/station/formats/{{format_id}}`
- **Auth:** Bearer (station)
- **Body (PUT):** full `{ label, price, is_active }`. **Body (PATCH):** at least one of `{ label?, price?, is_active? }`
- **Expected:** `200` with updated format
- **Negative tests:** invalid body → `400`; format not found or not owned by station → `404`/`403`

### 3.4 Delete format

- **Request:** `DELETE /api/v1/station/formats/{{format_id}}`
- **Auth:** Bearer (station)
- **Expected:** `200` with `{ data: { deleted: true } }`
- **Negative tests:** format has reservations → `409 Conflict`; not found / wrong station → `404`/`403`

---

## 4) Cron: sync pending uploads

### 4.1 Sync local → Cloudinary

- **Request:** `GET /api/cron/sync-pending-uploads`
- **Auth:** header `x-cron-secret: {{cron_secret}}` (or `Authorization: Bearer {{cron_secret}}`)
- **Expected:** `200` with `{ data: { processed, succeeded, failed } }`
- **Negative tests:** missing/wrong secret → `401`

---

## Suggested end-to-end check (local fallback path)

1. Leave Cloudinary env vars empty (or invalid) so onboarding upload falls back to local disk.
2. Call **POST /api/v1/stations/onboarding/upload** with a file (field `file`) → should return `201` with `{ data: { url, storage } }` (storage `local` when Cloudinary unavailable).
3. Complete **POST /api/v1/stations/onboarding/submit** with that URL and `storage: 'local'` in documents → creates station and pending_uploads row.
4. Call **Cron sync** with the correct secret → should attempt to upload and update documents.
