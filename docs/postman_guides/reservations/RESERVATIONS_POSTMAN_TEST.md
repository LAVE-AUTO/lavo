## LAVO — Reservations API (Postman Test Guide)

This guide complements the importable Postman collection:
- `lavo/docs/postman_guides/reservations/lavo-reservations.postman_collection.json`

It covers the full reservation lifecycle:

- **Creation:** create a reservation with Stripe payment intent
- **Consultation (user):** list and filter the authenticated client's entries
- **Consultation (station):** list and filter the authenticated station's entries
- **Cancellation (confirmed reservation):** cancel with Stripe refund and optional penalty
- **Cancellation (queue / pending entry):** cancel without Stripe refund
- **Station management:** transition entries through `in_progress` and `completed`
- **Presence confirmation:** client confirms arrival before the service window expires
- **Delay signalling:** client signals a delay; station accepts or refuses
- **Rescheduling:** client moves the reservation to a new slot, with late-penalty logic
- **Stripe webhook:** handle `payment_intent` events in development

---

### Base URL

- `{{base_url}}` (example: `http://localhost:3000`)

### Environment variables

Import: `lavo/docs/postman_guides/lavo.local.postman_environment.json`

Required before running any request:

| Variable | Type | Where to get it |
|---|---|---|
| `base_url` | default | `http://localhost:3000` for local dev |
| `access_token` | secret | JWT returned by `POST /api/v1/auth/login` (client or station depending on the group) |
| `station_id` | default | UUID from `GET /api/v1/stations` or from the station onboarding response |
| `time_slot_id` | default | UUID from `GET /api/v1/stations/{{station_id}}` (slot with available capacity) |
| `vehicle_format_id` | default | UUID from `GET /api/v1/stations/{{station_id}}/formats` |
| `new_time_slot_id` | default | UUID of a different available slot (required for rescheduling only) |

Auto-saved by the collection's test scripts (do not set manually):

| Variable | Set by |
|---|---|
| `reservation_id` | "Creer reservation — succes (201)" and "Replanifier reservation — succes (201)" |
| `stripe_client_secret` | "Creer reservation — succes (201)" |

The `entry_id` variable (already present in the shared environment) must be set manually from a `GET /api/v1/me/entries` response when testing the queue-cancellation and station-management groups.

---

### Import instructions

1. Open Postman and select **Import** from the top-left menu.
2. Drop `lavo-reservations.postman_collection.json` into the import dialog and confirm.
3. Select **Environments** in the left sidebar, then import `lavo.local.postman_environment.json`.
4. Select the **LAVO — Local** environment from the environment dropdown (top-right of Postman).
5. Fill in `access_token`, `station_id`, `time_slot_id`, and `vehicle_format_id` before running the first group.

---

## Testing workflow

Run the groups in the order listed below. Several groups depend on `reservation_id` being set by the creation step.

---

### 1) Creation de reservation

**Auth:** client JWT (`access_token`)

**Endpoint:** `POST /api/v1/stations/{{station_id}}/reservations`

**Body:**
```json
{
  "time_slot_id": "{{time_slot_id}}",
  "vehicle_format_id": "{{vehicle_format_id}}"
}
```

**What to run first — the happy path:**

- **Creer reservation — succes (201):** creates the reservation. The test script automatically saves `reservation_id` and `stripe_client_secret` to the environment. The returned status is `pending_payment`; the reservation becomes `confirmed` only after the Stripe webhook fires (see section 10).

Run the error cases after the happy path (they reuse the same variables but do not modify `reservation_id`):

| Request | Expected | Condition to reproduce |
|---|---|---|
| Creneau plein (409 SLOT_FULL) | `409` `SLOT_FULL` | Use a `time_slot_id` that is already at full capacity |
| Doublon actif (409 ACTIVE_RESERVATION_EXISTS) | `409` `ACTIVE_RESERVATION_EXISTS` | Re-run with the same user while a reservation is already active at this station |
| Station inexistante (404) | `404` | Hard-coded nil UUID in the URL — no setup needed |
| Body invalide (400) | `400` `VALIDATION_FAILED` | Body sends `"not-a-uuid"` for `time_slot_id` |
| Non authentifie (401) | `401` | Request uses `noauth` — no token sent |

> **Stripe note:** the reservation remains in `pending_payment` until the client confirms the payment on the frontend (or until you forward the webhook event with the Stripe CLI). To progress through later groups, trigger the `payment_intent.amount_capturable_updated` webhook first so the reservation moves to `confirmed`.

---

### 2) Consultation Utilisateur

**Auth:** client JWT

**Endpoint:** `GET /api/v1/me/entries`

Lists all entries (reservations and queue) for the authenticated client, ordered by date descending. Supports pagination and filtering.

| Request | Query params | What to verify |
|---|---|---|
| Sans filtre (200) | none | Response has `entries`, `total`, `page`, `per_page` fields |
| Filtre par statut (200) | `?status=confirmed` | Every entry in the response has `status: "confirmed"` |
| Pagination (200) | `?page=2&per_page=5` | Response has `page: 2` and `per_page: 5` |
| Filtre par periode (200) | `?from=2026-03-01T00:00:00Z&to=2026-03-31T23:59:59Z` | Entries fall within the given range |
| Non authentifie (401) | — | `401` returned, request uses `noauth` |

**Available filter params:**

- `status` — one of: `pending_payment`, `confirmed`, `in_progress`, `completed`, `cancelled`
- `from` / `to` — ISO 8601 datetime strings
- `page` — default `1`
- `per_page` — default `20`, max `100`

> **Tip:** copy an `entry_id` from this list response and paste it into the `entry_id` environment variable before running the "Annulation entree" or "Gestion station" groups.

---

### 3) Consultation Station

**Auth:** station JWT (`access_token` must belong to a station account)

**Endpoint:** `GET /api/v1/station/entries`

Lists all entries for the authenticated station, ordered: reservations by slot time, then queue by position.

| Request | Query params | What to verify |
|---|---|---|
| Sans filtre (200) | none | Response has `entries`, `total`, `page`, `per_page` fields |
| Filtre par statut (200) | `?status=confirmed` | Every entry has `status: "confirmed"` |
| Pagination (200) | `?page=1&per_page=10` | Response reflects the requested page and page size |
| Non authentifie (401) | — | `401` returned |
| Pas de station associee (404) | — | Token is valid but the user has no station linked — `404` with a message matching `/no station associated/i` |

The same filter params as section 2 apply here (`status`, `from`, `to`, `page`, `per_page`).

---

### 4) Annulation reservation (remboursement Stripe)

**Auth:** client JWT

**Endpoint:** `POST /api/v1/reservations/{{reservation_id}}/cancel`

**Prerequisite:** `reservation_id` must reference a `confirmed` reservation. Run the creation group first and trigger the Stripe webhook to confirm the reservation.

**Cancellation policy (configurable in DB — `settings` table, type `admin`):**

| Setting key | Default |
|---|---|
| `cancellation_free_window_minutes` | `60` |
| `cancellation_penalty_percent` | `20` |
| `cancellation_penalty_platform_rate` | `70` |
| `cancellation_penalty_station_rate` | `30` |

**Penalty distribution example (reservation at EUR 10.00, commission 10%):**

| Recipient | Amount |
|---|---|
| Client refunded | EUR 8.00 |
| Platform keeps | EUR 2.40 (EUR 1.00 commission + EUR 1.40 = 70% of 20% penalty) |
| Station keeps | EUR 0.60 (30% of 20% penalty) |

| Request | Body | When it fires | What to verify |
|---|---|---|---|
| Sans penalite (200) | `{ "reason": "Plans changed" }` | Slot is more than 60 min away | `penalty_amount: 0`, `is_late_cancellation: false`, `refunded_amount > 0`, `entry.status: "cancelled"` |
| Avec penalite 20% (200) | `{ "reason": "Emergency" }` | Slot is less than 60 min away | `is_late_cancellation: true`, `penalty_amount > 0`, `refunded_amount < entry.amount_paid` |
| Sans raison (200) | `{}` | Any cancellable reservation | `entry.status: "cancelled"` — `reason` field is optional |
| Deja annulee (409) | `{}` | Run cancel a second time on the same reservation | `409` `CONFLICT` |
| Inexistante (404) | `{}` | Hard-coded nil UUID in the URL | `404` |
| Non authentifie (401) | `{}` | `noauth` | `401` |

> **Stripe note:** the collection sends a raw cancellation to the API. Stripe refund processing happens asynchronously. In local testing, verify the refund in your Stripe dashboard or by checking the Stripe CLI event stream.

---

### 5) Annulation entree (file / pending_payment)

**Auth:** client JWT

**Endpoint:** `PATCH /api/v1/me/entries/{{entry_id}}/cancel`

Use this endpoint for queue entries or reservations still in `pending_payment` status. For `confirmed` reservations, use section 4 above instead.

**No Stripe refund is issued.** If the entry is in `pending_payment`, the PaymentIntent is cancelled server-side. If it is a queue entry, the queue positions are reordered automatically.

| Request | Expected | Condition |
|---|---|---|
| Succes (200) | `{ data: { status: "cancelled" } }` | `entry_id` is a queue entry or `pending_payment` reservation |
| Deja annulee (409) | `409` `CONFLICT` | Run cancel a second time on the same entry |
| Inexistante (404) | `404` | Hard-coded nil UUID in the URL |

> Set `entry_id` from the `GET /api/v1/me/entries` response (section 2) before running this group.

---

### 6) Gestion station

**Auth:** station JWT

**Endpoint:** `PATCH /api/v1/station/entries/{{entry_id}}`

The station drives the service lifecycle. Valid transitions:

```
confirmed → in_progress → completed
confirmed → cancelled
```

| Request | Body | What to verify |
|---|---|---|
| Marquer in_progress (200) | `{ "status": "in_progress" }` | `data.status: "in_progress"` |
| Marquer completed (200) | `{ "status": "completed" }` | `data.status: "completed"` — triggers `invitation_to_rate` notification to the client and Stripe capture |

> Run "Marquer in_progress" before "Marquer completed". The `entry_id` must reference an entry belonging to the authenticated station. Set it from `GET /api/v1/station/entries` (section 3) or from the client flow.

> Marking an entry `completed` triggers Stripe's manual capture: the blocked funds are captured and the payout is distributed to the station's connected Stripe account.

---

### 7) Confirmation de presence

**Auth:** client JWT

**Endpoint:** `POST /api/v1/reservations/{{reservation_id}}/confirm-presence`

The client calls this endpoint to signal arrival before the service window expires (`slot_time + late_tolerance_minutes`). After this point the cron job may downgrade the reservation to a queue entry.

| Request | Expected | Condition |
|---|---|---|
| Succes (200) | `data.entry.client_confirmed: true` | Reservation is `confirmed` and window has not expired |
| Deja confirme (409) | `409` | Call the same endpoint a second time |
| Non autorise (403 ou 404) | `403` or `404` | Hard-coded nil UUID — reservation not found or does not belong to the client |

---

### 8) Signalisation de retard

The delay flow involves two roles: the client signals first, the station then accepts or refuses.

#### 8.1 Client signals a delay

**Auth:** client JWT

**Endpoint:** `POST /api/v1/reservations/{{reservation_id}}/signal-delay`

**Prerequisite:** reservation must be in `confirmed` status.

| Request | Body | Expected | Notes |
|---|---|---|---|
| Succes (201) | `{ "message": "Je serai en retard d'environ 15 minutes." }` | `delay_request.status: "pending"` | Creates the delay request and notifies the station |
| Sans message (201) | `{}` | `delay_request.status: "pending"` | `message` field is optional |
| Demande deja active (409) | `{ "message": "..." }` | `409` `CONFLICT` | A pending request already exists — only one pending request per reservation |
| Body invalide (400) | `{ "message": 12345 }` | `400` `VALIDATION_FAILED` | `message` must be a string |
| Reservation introuvable (404) | `{}` | `404` | Hard-coded nil UUID |
| Non authentifie (401) | `{}` | `401` | `noauth` |

#### 8.2 Station accepts or refuses

**Auth:** station JWT

**Prerequisite:** a pending delay request must exist on the reservation (run section 8.1 first).

**Accept — `POST /api/v1/reservations/{{reservation_id}}/accept-delay`:**

| Request | Expected | Notes |
|---|---|---|
| Succes (200) | `delay_request.status: "accepted"` | Station agrees to the delay |
| Aucune demande en attente (409) | `409` `CONFLICT` | No pending request exists |
| Reservation introuvable (404) | `404` | Hard-coded nil UUID |
| Non authentifie (401) | `401` | `noauth` |

**Refuse — `POST /api/v1/reservations/{{reservation_id}}/refuse-delay`:**

| Request | Body | Expected | Notes |
|---|---|---|---|
| Succes (200) | `{ "refusal_reason": "Nous ne pouvons pas accommoder ce retard." }` | `delay_request.status: "refused"`, `refusal_reason` present | Station refuses and optionally gives a reason |
| Sans raison (200) | `{}` | `delay_request.status: "refused"` | `refusal_reason` is optional, max 500 chars |
| Aucune demande en attente (409) | — | `409` `CONFLICT` | No pending request exists |
| Reservation introuvable (404) | — | `404` | Hard-coded nil UUID |
| Non authentifie (401) | — | `401` | `noauth` |

> You can only accept or refuse once per pending request. Run accept first; then to test the 409 case for accept, simply call accept again on the same (now resolved) request.

---

### 9) Replanification de reservation

**Auth:** client JWT

**Endpoint:** `POST /api/v1/reservations/{{reservation_id}}/reschedule`

**Body:**
```json
{
  "new_time_slot_id": "{{new_time_slot_id}}"
}
```

**Prerequisite:** `reservation_id` must reference a `confirmed` reservation. `new_time_slot_id` must be a different, available slot (set it in the environment before running this group).

The old reservation is cancelled and a new one is created. The test script on the success case updates `reservation_id` to the new reservation's ID.

**Late-penalty scenario:** if the original slot is less than 60 minutes away, the same cancellation penalty applies (20% by default). When a penalty is charged, the response includes a `stripe_client_secret` for an additional payment intent that the frontend must confirm.

| Request | Body | Expected | Notes |
|---|---|---|---|
| Succes (201) | `{ "new_time_slot_id": "{{new_time_slot_id}}" }` | `status: "confirmed"` or `"pending_payment"`, `is_late_cancellation`, `penalty_amount`, `refunded_amount` present | `reservation_id` auto-updated in environment |
| Avec penalite tardive (201) | `{ "new_time_slot_id": "{{new_time_slot_id}}" }` | `is_late_cancellation: true`, `penalty_amount > 0`, `stripe_client_secret` present | Slot must be < 60 min away |
| Meme creneau (409) | `{ "new_time_slot_id": "{{time_slot_id}}" }` | `409` `CONFLICT` | `new_time_slot_id` is the same as the current slot |
| Creneau plein (409 SLOT_FULL) | `{ "new_time_slot_id": "{{new_time_slot_id}}" }` | `409` `SLOT_FULL` | Target slot is at full capacity |
| Body invalide (400) | `{ "new_time_slot_id": "not-a-uuid" }` | `400` `VALIDATION_FAILED` | Invalid UUID format |
| Reservation introuvable (404) | `{ "new_time_slot_id": "{{new_time_slot_id}}" }` | `404` | Hard-coded nil UUID in the URL |
| Non authentifie (401) | `{ "new_time_slot_id": "{{new_time_slot_id}}" }` | `401` | `noauth` |
| Erreur serveur (500) | `{ "new_time_slot_id": "{{new_time_slot_id}}" }` | `500` `INTERNAL_ERROR` | Simulate by misconfiguring Stripe credentials |

---

### 10) Webhook Stripe

**Auth:** none (Stripe signs the request with `stripe-signature`)

**Endpoint:** `POST /api/v1/webhooks/stripe`

**Prerequisite:** `STRIPE_WEBHOOK_SECRET` must be set in `.env`.

The collection includes two event types and one negative test:

| Request | Event type | Expected | Effect |
|---|---|---|---|
| payment_intent.amount_capturable_updated | `payment_intent.amount_capturable_updated` | `200` if signature valid, `400` if not | Reservation moves from `pending_payment` to `confirmed` |
| payment_intent.succeeded (no-op) | `payment_intent.succeeded` | `200` if signature valid, `400` if not | Informational only — funds distributed by Stripe, no action on our side |
| Signature manquante (400) | any | `400` — error message matches `/signature/i` | `stripe-signature` header absent |

**Payment flow with `capture_method: manual`:**

```
1. Client confirms payment on frontend  →  card authorized (funds blocked, not charged)
2. Stripe fires payment_intent.amount_capturable_updated
   →  reservation status: pending_payment → confirmed
3. Station marks entry as completed (section 6)
   →  our code calls Stripe capture()
4. Stripe fires payment_intent.succeeded
   →  funds distributed; no action from our side
```

**Testing webhooks locally:**

The `stripe-signature` header in the collection is a static fake value. Sending these requests directly from Postman will return `400` (invalid signature). To get a valid signature and test the full flow:

```bash
stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe
```

Copy the webhook signing secret printed by the CLI and set it as `STRIPE_WEBHOOK_SECRET` in `.env`. The Stripe CLI will then forward real test events with valid signatures. Trigger events manually with:

```bash
stripe trigger payment_intent.amount_capturable_updated
```

---

### Testing order dependencies

The table below summarises which groups depend on a previous step.

| Group | Depends on |
|---|---|
| Consultation Utilisateur | None — works independently |
| Consultation Station | None — requires station JWT |
| Annulation reservation | Reservation must be `confirmed` (creation + Stripe webhook) |
| Annulation entree | An existing queue entry or `pending_payment` reservation; `entry_id` set manually |
| Gestion station | Entry must exist for the station; `entry_id` set from station entries list |
| Confirmation de presence | Reservation must be `confirmed` |
| Signalisation de retard — client | Reservation must be `confirmed` |
| Gestion retard — station | Client must have signalled first (pending delay request exists) |
| Replanification | Reservation must be `confirmed`; `new_time_slot_id` set manually |
| Webhook Stripe | Stripe CLI must be running with a valid `STRIPE_WEBHOOK_SECRET` |

---

### Rate limiting

The creation endpoint (`POST /api/v1/stations/:station_id/reservations`) is rate-limited. Sending too many requests in a short window will return `429 Too Many Requests`. Space out creation requests during testing or restart the server between test runs to reset counters.

---

### Notes

- **Client vs station JWT:** several groups require different roles. Use a client token for all `me/` routes and reservation actions (cancel, confirm-presence, signal-delay, reschedule). Use a station token for `station/entries` and delay management (accept-delay, refuse-delay).
- **Nil UUID sentinel:** error cases that test "not found" use `00000000-0000-0000-0000-000000000000` as a predictable non-existent ID. No setup is needed for these requests.
- **`reservation_id` is overwritten on reschedule:** after a successful reschedule the test script replaces `reservation_id` with the newly created reservation's ID. If you need to keep the original ID, note it down before running that group.
- **Amounts are in cents in Stripe, euros in the API response:** the API normalises amounts to the currency unit (e.g. `10.00` for EUR 10). Stripe stores them in the smallest unit (e.g. `1000` for EUR 10). The response fields `refunded_amount`, `penalty_amount`, and `amount_paid` follow the API convention.
