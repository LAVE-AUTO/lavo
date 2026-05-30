## Postman guides (Hurryline)

This folder contains **importable Postman collections (.json)** and **step-by-step testing guides (.md)**.

### Quick start

1. Import the environment:
   - `docs/postman_guides/lavo.local.postman_environment.json`
2. Import collections:
   - Auth: `auth/lavo-auth.postman_collection.json`
   - Stations onboarding / station profile: `stations/lavo-stations.postman_collection.json`
   - Admin stations: `admin/lavo-admin.postman_collection.json`
   - **Public + Onboarding + Formats + Cron (stations list/detail/join, onboarding, vehicle formats CRUD, sync pending uploads):** `stations/lavo-stations-public-onboarding-cron.postman_collection.json`
   - Reservations: `reservations/lavo-reservations.postman_collection.json`
   - Support: `support/lavo-support.postman_collection.json`
   - Admin dashboard: `admin/lavo-admin-dashboard.postman_collection.json`
3. Set environment variables (at minimum):
   - `base_url` (example: `http://localhost:3000`)
   - `cron_secret` (must match `CRON_SECRET` in `.env`)
4. Follow the corresponding `.md` guide for a full test flow:
   - `auth/AUTH_POSTMAN_TEST.md`
   - `stations/STATIONS_PUBLIC_ONBOARDING_CRON_POSTMAN_TEST.md`
   - `admin/ADMIN_POSTMAN_TEST.md`
   - `admin/ADMIN_DASHBOARD_POSTMAN_TEST.md`
   - `reservations/RESERVATIONS_POSTMAN_TEST.md`
   - `support/SUPPORT_POSTMAN_TEST.md`

### Notes

- **Bearer + cookies:** this project intentionally supports **Authorization: Bearer** and **httpOnly cookies** (refresh token). Postman will automatically store and send cookies for the same `base_url`.
- **File uploads:** onboarding upload uses `POST /api/v1/stations/onboarding/upload` with multipart field `file`. Authenticated upload uses `POST /api/v1/upload` with field `file`.
