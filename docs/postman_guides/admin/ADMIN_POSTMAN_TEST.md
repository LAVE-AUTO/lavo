## LAVO - Admin API (Postman Test Guide)

This guide complements the importable Postman collection:
- `lavo/docs/postman_guides/admin/lavo-admin.postman_collection.json`

### Base URL

- `{{base_url}}` (example: `http://localhost:3000`)

### Environment variables

Import: `lavo/docs/postman_guides/lavo.local.postman_environment.json`

Required:
- **`base_url`**
- **`access_token`** (must be an **admin** JWT)
- **`station_id`** (UUID of the station you want to approve/reject)

### Recommended test flow

1. **List pending stations** (`GET /api/v1/admin/stations`)
   - Identify one station with status `pending_admin_validation`.
2. Set `station_id` in the environment (copy/paste).
3. **Get station detail** (`GET /api/v1/admin/stations/{{station_id}}`)
4. **Approve** (`POST /api/v1/admin/stations/{{station_id}}/approve`)
   - Station becomes `active`.
5. Or **Reject** (`POST /api/v1/admin/stations/{{station_id}}/reject`)
   - Station becomes `rejected` and stores a reason.

### Notes

- These endpoints require admin authorization on the backend (expect `403` if the token role is not admin).
- Stations created via **onboarding** (`POST /api/v1/stations/onboarding/submit`) show up here as pending when status is `pending_admin_validation`.

