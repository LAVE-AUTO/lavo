## Postman guides (LAVO)

This folder contains **importable Postman collections (.json)** and **step-by-step testing guides (.md)**.

### Quick start

1. Import the environment:
   - `lavo/docs/postman_guides/lavo.local.postman_environment.json`
2. Import collections:
   - Auth: `auth/lavo-auth.postman_collection.json`
   - Stations onboarding / station profile: `stations/lavo-stations.postman_collection.json`
   - Admin stations: `admin/lavo-admin.postman_collection.json`
   - **Card 1 + Card 2 (public stations + apply + cron):** `stations/lavo-stations-public-apply-cron.postman_collection.json`
3. Set environment variables (at minimum):
   - `base_url` (example: `http://localhost:3000`)
   - `cron_secret` (must match `CRON_SECRET` in `.env`)
4. Follow the corresponding `.md` guide for a full test flow:
   - `auth/AUTH_POSTMAN_TEST.md`
   - `stations/STATIONS_PUBLIC_APPLY_CRON_POSTMAN_TEST.md`
   - `admin/ADMIN_POSTMAN_TEST.md`

### Notes

- **Bearer + cookies:** this project intentionally supports **Authorization: Bearer** and **httpOnly cookies** (refresh token). Postman will automatically store and send cookies for the same `base_url`.
- **File uploads:** the apply endpoint uses `multipart/form-data` with file field names like `document_<type>` (example: `document_kbis`). In the collection, the `src` value is a placeholder: update it to a real file path on your machine.

