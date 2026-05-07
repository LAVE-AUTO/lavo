## LAVO - Auth API (Postman Test Guide)

This guide complements the importable Postman collection:
- `lavo/docs/postman_guides/auth/lavo-auth.postman_collection.json`

### Base URL

- `{{base_url}}` (example: `http://localhost:3000`)

### Environment variables

Import: `lavo/docs/postman_guides/lavo.local.postman_environment.json`

Required:
- **`base_url`**

Auto-populated by the collection (on success):
- **`access_token`**

### Token model (hybrid)

- **Access token:** returned in JSON response body, used as `Authorization: Bearer {{access_token}}`
- **Refresh token:** stored in an **httpOnly cookie**. Postman will keep and send cookies automatically for the same host.

### Recommended test flow

1. **Register - success** (`POST /api/v1/auth/register`)
   - Saves `access_token` in collection variables.
   - Sets refresh cookie.
2. **Verify email** (`POST /api/v1/auth/verify-email`)
3. **Login** (`POST /api/v1/auth/login`)
   - Updates `access_token` and refresh cookie.
4. **Me** (`GET /api/v1/auth/me`)
   - Uses `Authorization: Bearer {{access_token}}`
5. **Refresh** (`POST /api/v1/auth/refresh`)
   - Uses refresh cookie; rotates refresh token; returns new access token.
6. **Forgot password** (`POST /api/v1/auth/forgot-password`)
7. **Reset password** (`POST /api/v1/auth/reset-password`)
8. **Logout** (`POST /api/v1/auth/logout`)

### Notes

- Auth endpoints are rate-limited (expect `429` when sending too many attempts quickly).
- For `GET /api/v1/auth/me`, the backend accepts either:
  - `Authorization: Bearer <token>` (preferred) **or**
  - `access_token` cookie (fallback).

