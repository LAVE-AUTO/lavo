## Hurryline - Stations (Public + Onboarding + Cron) - Postman Test Guide

This guide complements the importable Postman collection:
- `Hurryline/docs/postman_guides/stations/Hurryline-stations-public-onboarding-cron.postman_collection.json`

It covers:

- **Public:** stations API (list, detail, join)
- **Onboarding:** upload documents and submit (create station + user)
- **Formats:** vehicle formats and pricing (GET by station, POST/PUT/PATCH/DELETE for connected station)
- **Cron:** sync pending uploads (local files from onboarding)

---

### Base URL

- `{{base_url}}` (example: `http://localhost:3000`)

### Environment variables

Import: `Hurryline/docs/postman_guides/Hurryline.local.postman_environment.json`

Required:
- **`base_url`**

Required for cron:
- **`cron_secret`** (must match `CRON_SECRET` in `.env`)

Optional:
- **`station_id`** (for detail/join/formats/queue/reservations - set manually or from onboarding submit response)
- **`format_id`** (for PUT/PATCH/DELETE format and for queue/join / create reservation - set from GET formats or POST format response)
- **`access_token`** (client JWT for me/entries, queue/join, reservations; or station JWT for station/entries, station formats)
- **`entry_id`** (for cancel, upgrade-to-reservation, station PATCH entry/position - set from GET me/entries or GET station/entries)
- **`time_slot_id`** (for upgrade-to-reservation and create reservation - set from station detail slots)

---

## 1) Public stations API

### 1.1 List stations

- **Request:** `GET /api/v1/stations`
- **Response shape:** `200` with `{ data: { all, available_now?, most_appreciated?, most_visited? }, meta: { total, page, per_page, total_pages } }`. The list is always in `data.all`; optional groups (`data.available_now`, `data.most_appreciated`, `data.most_visited`) are present only when requested via `groups`.
- **Query params:**
  - `groups` - optional, comma-separated: `available_now`, `most_appreciated`, `most_visited` (adds the corresponding keys to `data`)
  - `q` - search (name, address, city, description)
  - `city` - filter by city
  - `sort` - one or more (comma-separated): `name_asc`, `name_desc`, `slots_asc`, `slots_desc`, `rating_asc`, `rating_desc`, `total_ratings_asc`, `total_ratings_desc`, `completed_count_asc`, `completed_count_desc`
  - `page` - default 1 (max 10000)
  - `per_page` - default 20, max 100
  - `limit_per_group` - optional, max 100 (limits each group size when `groups` is used)
  - `wash_type_ids` - optional, comma-separated UUIDs (stations with at least one of these wash types)
  - `service_scope` - optional: `exterior`, `interior`, or `both`
  - `format_id` - optional UUID (stations offering this vehicle format)
- Each station in `data.all` (and in groups) includes `available`, `available_slots`, and when applicable `average_score`, `total_ratings`, `completed_count`.
- **Negative tests:** invalid `sort` or `page`/`per_page`/`limit_per_group` out of bounds → `400 VALIDATION_FAILED`

### 1.2 Station detail

- **Request:** `GET /api/v1/stations/{{station_id}}`
- **Expected:** `200` with `{ data: StationWithDetail & { available, available_slots, completed_count } }`. `completed_count` = number of services terminés (reservations + queue with `completed_at` set). Unavailability is derived from slot availability only.
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
- **Body:** JSON with step 1 (email, phone, password, confirm_password), step 2 (station_name, address, city, wash_post_count, **wash_type_ids** - array of UUIDs from `wash_types`, min 1, max 50; **service_scope** - optional: `exterior` | `interior` | `both`; ...), step 3 (documents: [{ document_type, file_url, storage? }], terms_accepted: true)
- **Expected:** `201` with `{ data: { user, station } }`
- **Negative tests:** validation → `400`; invalid or inactive wash_type_ids → `400`; email already exists → `409`; rate limit → `429`

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

### 3.3 Update format - PUT (full) and PATCH (partial)

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

## 4) Client - Queue and entries (auth USER)

- **`POST /api/v1/stations/{{station_id}}/queue/join`** - Join the queue. Body: `{ "vehicle_format_id": "<uuid>" }`. Auth: Bearer (client). Creates an entry with `entry_type: "queue"`. Returns created entry. 400 if validation fails; 404 if station/format not found; 409 if slot/queue rules conflict.
- **`GET /api/v1/stations/{{station_id}}/queue`** - List queue entries for a station (public or auth). Returns `{ data: Array<Entry> }` ordered by `queue_position`.
- **`GET /api/v1/me/entries`** - My reservations and queue entries (client auth). Returns list with `entry_type` (`reservation` | `queue`), ordered: reservations first (by slot), then queue (by position).
- **`PATCH /api/v1/me/entries/{{entry_id}}/cancel`** - Cancel a reservation or leave the queue. Auth: Bearer (client). Body optional. 404 if not own entry or not found; 400 if already completed/cancelled.
- **`POST /api/v1/me/entries/{{entry_id}}/upgrade-to-reservation`** - Upgrade queue entry to reservation. Body: `{ "time_slot_id": "<uuid>" }`. Auth: Bearer (client). Pays reservation surcharge if configured. 404 if not own entry; 400/409 if slot invalid or full.

**Environment:** Set `entry_id` from a previous response (e.g. from GET me/entries or POST queue/join) for cancel/upgrade.

---

## 5) Client - Create reservation (auth USER)

- **`POST /api/v1/stations/{{station_id}}/reservations`** - Create a reservation (entry_type = reservation). Body: `{ "time_slot_id": "<uuid>", "vehicle_format_id": "<uuid>" }`. Auth: Bearer (client). Payment/Stripe flow applies. 201 with created entry; 400 validation; 404 station/slot/format; 409 slot full or conflict.

---

## 6) Station - Entries (auth STATION)

- **`GET /api/v1/station/entries`** - List all entries (reservations + queue) for the connected station, ordered for UI: reservations by slot, then queue by position. Auth: Bearer (station). Returns `{ data: Array<Entry> }`.
- **`PATCH /api/v1/station/entries/{{entry_id}}`** - Update entry status. Body: `{ "status": "in_progress" | "completed" | "cancelled" }`. Auth: Bearer (station). Marks in progress, completed (triggers payout, commission, rating notification), or cancelled. 404 if entry not for this station.
- **`PATCH /api/v1/station/entries/{{entry_id}}/position`** - Reorder queue. Body: `{ "queue_position": 1 }` (min 1). Auth: Bearer (station). Only applies to queue entries. 404 if not queue or not this station.

**Environment:** Set `entry_id` for PATCH requests (from GET station/entries or client flow).

---

## 7) Station - Reservations list by station (auth STATION)

- **`GET /api/v1/stations/{{station_id}}/reservations`** - List reservations (and optionally queue entries) for a given station. Auth: Bearer (station); station must be the connected one. Returns entries for that station. Use for station dashboard.

---

## 8) Cron: sync pending uploads + downgrade late reservations

### 8.1 Sync local → Cloudinary

- **Request:** `GET /api/cron/sync-pending-uploads`
- **Auth:** header `x-cron-secret: {{cron_secret}}` (or `Authorization: Bearer {{cron_secret}}`)
- **Expected:** `200` with `{ data: { processed, succeeded, failed } }`
- **Negative tests:** missing/wrong secret → `401`

### 8.2 Downgrade late reservations to queue

- **Request:** `GET /api/cron/downgrade-late-reservations` (or POST, same auth)
- **Auth:** header `x-cron-secret: {{cron_secret}}` or `Authorization: Bearer {{cron_secret}}`
- **Expected:** `200` with summary (e.g. processed count). Moves unconfirmed reservations past tolerance into the queue (entry_type = queue, queue_position set via helper).
- **Negative tests:** missing/wrong secret → `401`

---

## Suggested end-to-end check (local fallback path)

1. Leave Cloudinary env vars empty (or invalid) so onboarding upload falls back to local disk.
2. Call **POST /api/v1/stations/onboarding/upload** with a file (field `file`) → should return `201` with `{ data: { url, storage } }` (storage `local` when Cloudinary unavailable).
3. Complete **POST /api/v1/stations/onboarding/submit** with that URL and `storage: 'local'` in documents → creates station and pending_uploads row.
4. Call **Cron sync** with the correct secret → should attempt to upload and update documents.
