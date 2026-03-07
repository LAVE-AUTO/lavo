## Postman guides (LAVO)

This folder contains **importable Postman collections (.json)** and **step-by-step testing guides (.md)**.

### Quick start

1. Import the environment:
   - `lavo/docs/postman_guides/lavo.local.postman_environment.json`
2. Import collections:
   - Auth: `auth/lavo-auth.postman_collection.json`
   - Stations onboarding / station profile: `stations/lavo-stations.postman_collection.json`
   - Admin stations: `admin/lavo-admin.postman_collection.json`
   - **Public + Onboarding + Cron (stations list/detail/join, onboarding upload/submit, sync pending uploads):** `stations/lavo-stations-public-onboarding-cron.postman_collection.json`
3. Set environment variables (at minimum):
   - `base_url` (example: `http://localhost:3000`)
   - `cron_secret` (must match `CRON_SECRET` in `.env`)
4. Follow the corresponding `.md` guide for a full test flow:
   - `auth/AUTH_POSTMAN_TEST.md`
   - `stations/STATIONS_PUBLIC_ONBOARDING_CRON_POSTMAN_TEST.md`
   - `admin/ADMIN_POSTMAN_TEST.md`

### Notes

- **Bearer + cookies:** this project intentionally supports **Authorization: Bearer** and **httpOnly cookies** (refresh token). Postman will automatically store and send cookies for the same `base_url`.
- **File uploads:** onboarding upload uses `POST /api/v1/stations/onboarding/upload` with multipart field `file`. Authenticated upload uses `POST /api/v1/upload` with field `file`.

