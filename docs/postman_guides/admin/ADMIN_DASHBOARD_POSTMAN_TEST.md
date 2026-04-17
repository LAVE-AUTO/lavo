## LAVO — Admin Dashboard & Analytics API (Postman Test Guide)

This guide complements the importable Postman collection:
- `lavo/docs/postman_guides/admin/lavo-admin-dashboard.postman_collection.json`

---

### Prerequisites

1. A running LAVO server (`npm run dev` or equivalent). Default base URL: `http://localhost:3000`.
2. A valid **admin** JWT. Obtain one by authenticating through `POST /api/v1/auth/login` with an account whose role is `admin`, then copy the returned `access_token`.
3. Postman desktop (v10+) or Postman web.

---

### Importing the collection

1. Open Postman.
2. Click **Import** (top-left).
3. Drag and drop `lavo-admin-dashboard.postman_collection.json`, or browse to the file.
4. The collection "LAVO — Admin Dashboard & Analytics API" will appear in your sidebar.

---

### Variables

The collection defines two collection-level variables. Set them before running any request.

| Variable | Type | Description |
|---|---|---|
| `base_url` | string | Root URL of the LAVO API server. Default: `http://localhost:3000`. Change this to match your environment (staging, production, etc.). |
| `access_token` | string | Bearer token of an **admin** user. Paste the JWT value here (without the `Bearer ` prefix). |

To edit collection variables:

1. Click the collection name in the sidebar.
2. Open the **Variables** tab.
3. Set the **Current Value** column for `base_url` and `access_token`.

Alternatively, use the shared environment file `lavo/docs/postman_guides/lavo.local.postman_environment.json` — it exposes the same `base_url` and `access_token` keys and will override the collection variables when selected.

---

### Testing order and workflow

Run the groups in this order for a coherent testing session:

#### 1. Admin — Dashboard

The dashboard endpoint aggregates all KPIs into a single call. Test it first to verify the server is up and the admin token is valid.

1. **Dashboard — defaut sans params (200)**
   Confirms the 30-day default window. If this fails with 401/403, stop and fix the token.

2. **Dashboard — periode 30j (200)**
   Explicitly passes `?period=30`. Verifies the query-param path through the validator.

3. **Dashboard — intervalle custom (200)**
   Passes `?from=2026-01-01&to=2026-03-26`. Verifies `data.period.from === '2026-01-01'` in the response.

4. **Dashboard — from sans to (400)**, **Dashboard — to sans from (400)**, **Dashboard — from > to (400)**
   Cross-field validation cases. All must return `400 VALIDATION_FAILED`.

5. **Dashboard — period invalide (400)**, **Dashboard — period trop grand (400)**
   Boundary validation on the `period` param (min 1, max 365). Both must return `400 VALIDATION_FAILED`.

6. **Dashboard — non admin (403)**
   Uses `noauth` auth override to send the request without a Bearer token. Must return `403 FORBIDDEN`. To test the role-mismatch case (token present but role != admin), paste a non-admin user token into the request's **Authorization** tab before sending.

#### 2. Admin — Analytics

Each metric has its own sub-path (`/api/v1/admin/analytics/[metric]`). Run the happy-path cases for all 9 metrics, then run the error cases.

1. **All 9 metric happy-path requests (200)**
   Run them in order: transactions, revenue, commissions, registrations, stations, reservations, cancellations, support-tickets, avg-rating. Each verifies that `data.series` is an array, `data.metric` matches the slug, `data.group_by` is present, and `data.period` has `from` and `to`.

2. **Analytics — metrique inconnue (400)**
   Sends `unknown-metric` as the slug. Must return `400 VALIDATION_FAILED`.

3. **Analytics — from sans to (400)**
   Omits `to` while providing `from`. Must return `400 VALIDATION_FAILED`.

4. **Analytics — group_by invalide (400)**
   Passes `group_by=year`, which is not an accepted value. Must return `400 VALIDATION_FAILED`. Accepted values are `day`, `week`, `month`.

5. **Analytics — non admin (403)**
   Same as the dashboard 403 case — uses `noauth` override. Must return `403 FORBIDDEN`.

---

### Group descriptions

#### Admin — Dashboard

`GET /api/v1/admin/dashboard`

Returns a point-in-time KPI snapshot for the admin. The response shape is always:

```json
{
  "data": {
    "period": {
      "from": "YYYY-MM-DD",
      "to": "YYYY-MM-DD",
      "days": 30
    },
    "totals": {
      "active_stations": 0,
      "total_clients": 0,
      "pending_kyc": 0,
      "open_support_tickets": 0
    },
    "metrics": {
      "total_transactions": 0,
      "total_revenue": "0.00",
      "total_commissions": "0.00"
    },
    "alerts": {
      "pending_kyc": [],
      "open_support_tickets": []
    }
  }
}
```

`totals` fields are all-time stock counts (independent of the date range). `metrics` fields cover only the requested period. `alerts` are the current live alert lists used to surface actionable items to the admin (stations pending KYC approval, open support tickets).

Query param combinations:

| Params | Behaviour |
|---|---|
| None | 30-day window ending now |
| `?period=N` | N-day window ending now (1 ≤ N ≤ 365) |
| `?from=YYYY-MM-DD&to=YYYY-MM-DD` | Exact range; both params required together |

#### Admin — Analytics

`GET /api/v1/admin/analytics/[metric]`

Returns a contiguous timeseries for the requested metric. Missing periods are gap-filled so the frontend always receives a complete series. The response shape is:

```json
{
  "data": {
    "metric": "transactions",
    "group_by": "day",
    "period": {
      "from": "YYYY-MM-DD",
      "to": "YYYY-MM-DD"
    },
    "series": [
      { "date": "YYYY-MM-DD", "value": 0 }
    ]
  }
}
```

`value` is a `number` for count metrics (`transactions`, `registrations`, `stations`, `reservations`, `cancellations`, `support-tickets`) and a decimal `string` (e.g. `"1234.56"`) for monetary and average metrics (`revenue`, `commissions`, `avg-rating`). Gap-filled points use `0` or `"0.00"` respectively.

Valid metric slugs:

| Slug | Value type | Description |
|---|---|---|
| `transactions` | number | Confirmed/paid reservations |
| `revenue` | string (decimal) | Total gross revenue |
| `commissions` | string (decimal) | LAVO platform commissions |
| `registrations` | number | New client accounts created |
| `stations` | number | New stations activated |
| `reservations` | number | All reservations (all statuses) |
| `cancellations` | number | Cancelled reservations |
| `support-tickets` | number | Support tickets opened |
| `avg-rating` | string (decimal) | Average station rating |

---

### Notes on Cache-Control

Both endpoints respond with:

```
Cache-Control: max-age=60, s-maxage=60
```

This means:
- The browser (or Postman's cache) may serve a stale response for up to 60 seconds.
- Edge/CDN nodes (s-maxage) also cache for 60 seconds.

If you run the same request twice within 60 seconds and the second call returns instantly with the same body, it may be a cached response. This is expected behaviour and still constitutes a valid 200. To bypass the cache during development, add a `Cache-Control: no-cache` request header or append a unique dummy query parameter (e.g. `&_t={{$timestamp}}`).
