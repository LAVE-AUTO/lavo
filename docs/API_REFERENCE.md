# API Reference (Code-Derived)

Last verified from code on 2026-05-30.

## Overview

- Base business API: `/api/v1/*`
- Operational API surfaces: `/api/cron/*`, `/api/docs`, `/api/v1/webhooks/stripe`
- Auth model: Bearer JWT access token + httpOnly refresh cookie (route dependent)
- Roles: `client`, `station`, `admin`
- Standard error envelope: `{ message, code?, errors? }`
- Pagination styles in use: page-based (`page`, `per_page`) and cursor-based (`limit`, `cursor`)

## Endpoint Inventory

Every row below is derived from a concrete `route.ts` handler exporting HTTP methods.

### API Documentation

| Method(s) | Path | Auth Requirement | Description | Source File |
|---|---|---|---|---|
| `GET` | `/docs` | Public in development; production requires `ENABLE_API_DOCS=true` | Serve generated OpenAPI specification JSON. | `src/app/api/docs/route.ts` |

### Admin

| Method(s) | Path | Auth Requirement | Description | Source File |
|---|---|---|---|---|
| `GET` | `/v1/admin/analytics/{metric}` | Bearer JWT (`admin`) | Return admin analytics dataset by metric. | `src/app/api/v1/admin/analytics/[metric]/route.ts` |
| `GET`, `PUT` | `/v1/admin/commission` | Bearer JWT (`admin`) | Read/update commission configuration and history. | `src/app/api/v1/admin/commission/route.ts` |
| `GET` | `/v1/admin/commission/history` | Bearer JWT (`admin`) | Read/update commission configuration and history. | `src/app/api/v1/admin/commission/history/route.ts` |
| `GET` | `/v1/admin/dashboard` | Bearer JWT (`admin`) | Return admin global KPI dashboard payload. | `src/app/api/v1/admin/dashboard/route.ts` |
| `GET` | `/v1/admin/disputes` | Bearer JWT (`admin`) | Admin dispute triage actions and refund/close commands. | `src/app/api/v1/admin/disputes/route.ts` |
| `GET` | `/v1/admin/disputes/{id}` | Bearer JWT (`admin`) | Admin dispute triage actions and refund/close commands. | `src/app/api/v1/admin/disputes/[id]/route.ts` |
| `POST` | `/v1/admin/disputes/{id}/close` | Bearer JWT (`admin`) | Admin dispute triage actions and refund/close commands. | `src/app/api/v1/admin/disputes/[id]/close/route.ts` |
| `POST` | `/v1/admin/disputes/{id}/refund` | Bearer JWT (`admin`) | Admin dispute triage actions and refund/close commands. | `src/app/api/v1/admin/disputes/[id]/refund/route.ts` |
| `GET`, `PATCH` | `/v1/admin/legal/{key}` | Bearer JWT (`admin`) | Read or edit legal-content pages managed by admin. | `src/app/api/v1/admin/legal/[key]/route.ts` |
| `GET` | `/v1/admin/logs` | Bearer JWT (`admin`) | Admin activity audit log retrieval endpoint. | `src/app/api/v1/admin/logs/route.ts` |
| `GET`, `PATCH` | `/v1/admin/me` | Bearer JWT (`admin`) | Documented from route handler path and method. | `src/app/api/v1/admin/me/route.ts` |
| `POST` | `/v1/admin/me/email` | Bearer JWT (`admin`) | Documented from route handler path and method. | `src/app/api/v1/admin/me/email/route.ts` |
| `POST` | `/v1/admin/me/otp` | Bearer JWT (`admin`) | Documented from route handler path and method. | `src/app/api/v1/admin/me/otp/route.ts` |
| `POST` | `/v1/admin/me/password` | Bearer JWT (`admin`) | Documented from route handler path and method. | `src/app/api/v1/admin/me/password/route.ts` |
| `GET` | `/v1/admin/ratings` | Bearer JWT (`admin`) | Admin ratings moderation endpoints. | `src/app/api/v1/admin/ratings/route.ts` |
| `PATCH` | `/v1/admin/ratings/{id}` | Bearer JWT (`admin`) | Admin ratings moderation endpoints. | `src/app/api/v1/admin/ratings/[id]/route.ts` |
| `GET`, `PATCH` | `/v1/admin/settings` | Bearer JWT (`admin`) | Read/update platform settings key-value store. | `src/app/api/v1/admin/settings/route.ts` |
| `GET`, `POST` | `/v1/admin/stations` | Bearer JWT (`admin`) | Admin station lifecycle actions (list/create/read/update/delete/approve/reject/documents/promo QR). | `src/app/api/v1/admin/stations/route.ts` |
| `GET`, `PUT`, `DELETE` | `/v1/admin/stations/{id}` | Bearer JWT (`admin`) | Admin station lifecycle actions (list/create/read/update/delete/approve/reject/documents/promo QR). | `src/app/api/v1/admin/stations/[id]/route.ts` |
| `POST` | `/v1/admin/stations/{id}/approve` | Bearer JWT (`admin`) | Admin station lifecycle actions (list/create/read/update/delete/approve/reject/documents/promo QR). | `src/app/api/v1/admin/stations/[id]/approve/route.ts` |
| `PATCH` | `/v1/admin/stations/{id}/documents/{docId}` | Bearer JWT (`admin`) | Admin station lifecycle actions (list/create/read/update/delete/approve/reject/documents/promo QR). | `src/app/api/v1/admin/stations/[id]/documents/[docId]/route.ts` |
| `GET` | `/v1/admin/stations/{id}/documents/{docId}/download` | Bearer JWT (`admin`) | Admin station lifecycle actions (list/create/read/update/delete/approve/reject/documents/promo QR). | `src/app/api/v1/admin/stations/[id]/documents/[docId]/download/route.ts` |
| `GET`, `POST` | `/v1/admin/stations/{id}/promo-qr` | Bearer JWT (`admin`) | Admin station lifecycle actions (list/create/read/update/delete/approve/reject/documents/promo QR). | `src/app/api/v1/admin/stations/[id]/promo-qr/route.ts` |
| `POST` | `/v1/admin/stations/{id}/reject` | Bearer JWT (`admin`) | Admin station lifecycle actions (list/create/read/update/delete/approve/reject/documents/promo QR). | `src/app/api/v1/admin/stations/[id]/reject/route.ts` |
| `PATCH` | `/v1/admin/support/{id}/assign` | Bearer JWT (`admin`) | Admin support settings and assignment actions. | `src/app/api/v1/admin/support/[id]/assign/route.ts` |
| `GET`, `PATCH` | `/v1/admin/support/settings` | Bearer JWT (`admin`) | Admin support settings and assignment actions. | `src/app/api/v1/admin/support/settings/route.ts` |
| `GET` | `/v1/admin/transactions/logs` | Bearer JWT (`admin`) | Documented from route handler path and method. | `src/app/api/v1/admin/transactions/logs/route.ts` |
| `GET`, `POST` | `/v1/admin/users` | Bearer JWT (`admin`) | Admin CRUD and unblock workflows for user accounts. | `src/app/api/v1/admin/users/route.ts` |
| `GET`, `PUT`, `DELETE` | `/v1/admin/users/{id}` | Bearer JWT (`admin`) | Admin CRUD and unblock workflows for user accounts. | `src/app/api/v1/admin/users/[id]/route.ts` |
| `POST` | `/v1/admin/users/{id}/unblock` | Bearer JWT (`admin`) | Admin CRUD and unblock workflows for user accounts. | `src/app/api/v1/admin/users/[id]/unblock/route.ts` |

### Authentication

| Method(s) | Path | Auth Requirement | Description | Source File |
|---|---|---|---|---|
| `POST` | `/v1/auth/change-password` | Authenticated session | Change current user password with identity checks. | `src/app/api/v1/auth/change-password/route.ts` |
| `POST` | `/v1/auth/forgot-password` | Public | Create password-reset token and send reset instructions. | `src/app/api/v1/auth/forgot-password/route.ts` |
| `POST` | `/v1/auth/login` | Public | Authenticate user and issue access token + refresh cookie. | `src/app/api/v1/auth/login/route.ts` |
| `POST` | `/v1/auth/logout` | Session cookie and/or Bearer token (handler-managed) | Terminate current session cookies/tokens. | `src/app/api/v1/auth/logout/route.ts` |
| `GET`, `PATCH`, `DELETE` | `/v1/auth/me` | Authenticated session | Read/update/delete authenticated profile/session-linked user data. | `src/app/api/v1/auth/me/route.ts` |
| `GET` | `/v1/auth/oauth/finalize` | Public | Finalize OAuth callback/session bootstrap. | `src/app/api/v1/auth/oauth/finalize/route.ts` |
| `POST` | `/v1/auth/refresh` | Session cookie and/or Bearer token (handler-managed) | Rotate refresh session and issue a new access token. | `src/app/api/v1/auth/refresh/route.ts` |
| `POST` | `/v1/auth/register` | Public | Register a new account and bootstrap verification workflow. | `src/app/api/v1/auth/register/route.ts` |
| `POST` | `/v1/auth/resend-verification-email` | Public | Re-send verification email to pending account. | `src/app/api/v1/auth/resend-verification-email/route.ts` |
| `POST` | `/v1/auth/reset-password` | Public | Apply a new password from a valid reset token. | `src/app/api/v1/auth/reset-password/route.ts` |
| `POST` | `/v1/auth/verify-email` | Public | Verify email token and activate account. | `src/app/api/v1/auth/verify-email/route.ts` |

### Client Self-Service

| Method(s) | Path | Auth Requirement | Description | Source File |
|---|---|---|---|---|
| `POST` | `/v1/me/device-token` | Bearer JWT (`client` or role-scoped by handler) | Register or refresh client push device token. | `src/app/api/v1/me/device-token/route.ts` |
| `GET` | `/v1/me/entries` | Bearer JWT (`client` or role-scoped by handler) | Client entry listing/detail/cancel/upgrade actions. | `src/app/api/v1/me/entries/route.ts` |
| `GET` | `/v1/me/entries/{entryId}` | Bearer JWT (`client` or role-scoped by handler) | Client entry listing/detail/cancel/upgrade actions. | `src/app/api/v1/me/entries/[entryId]/route.ts` |
| `PATCH` | `/v1/me/entries/{entryId}/cancel` | Bearer JWT (`client` or role-scoped by handler) | Client entry listing/detail/cancel/upgrade actions. | `src/app/api/v1/me/entries/[entryId]/cancel/route.ts` |
| `POST` | `/v1/me/entries/{entryId}/upgrade-to-reservation` | Bearer JWT (`client` or role-scoped by handler) | Client entry listing/detail/cancel/upgrade actions. | `src/app/api/v1/me/entries/[entryId]/upgrade-to-reservation/route.ts` |
| `GET`, `POST` | `/v1/me/favorites` | Bearer JWT (`client` or role-scoped by handler) | Client favorite stations list/add/remove endpoints. | `src/app/api/v1/me/favorites/route.ts` |
| `DELETE` | `/v1/me/favorites/{stationId}` | Bearer JWT (`client` or role-scoped by handler) | Client favorite stations list/add/remove endpoints. | `src/app/api/v1/me/favorites/[stationId]/route.ts` |
| `GET`, `PATCH` | `/v1/me/notification-prefs` | Bearer JWT (`client` or role-scoped by handler) | Read/update client notification preference settings. | `src/app/api/v1/me/notification-prefs/route.ts` |
| `GET` | `/v1/me/notifications` | Bearer JWT (`client` or role-scoped by handler) | Client in-app notifications list/read/delete/read-all/unread-count endpoints. | `src/app/api/v1/me/notifications/route.ts` |
| `DELETE` | `/v1/me/notifications/{id}` | Bearer JWT (`client` or role-scoped by handler) | Client in-app notifications list/read/delete/read-all/unread-count endpoints. | `src/app/api/v1/me/notifications/[id]/route.ts` |
| `PATCH` | `/v1/me/notifications/{id}/read` | Bearer JWT (`client` or role-scoped by handler) | Client in-app notifications list/read/delete/read-all/unread-count endpoints. | `src/app/api/v1/me/notifications/[id]/read/route.ts` |
| `PATCH` | `/v1/me/notifications/read-all` | Bearer JWT (`client` or role-scoped by handler) | Client in-app notifications list/read/delete/read-all/unread-count endpoints. | `src/app/api/v1/me/notifications/read-all/route.ts` |
| `GET` | `/v1/me/notifications/unread-count` | Bearer JWT (`client` or role-scoped by handler) | Client in-app notifications list/read/delete/read-all/unread-count endpoints. | `src/app/api/v1/me/notifications/unread-count/route.ts` |
| `PATCH` | `/v1/me/profile` | Bearer JWT (`client` or role-scoped by handler) | Update authenticated client profile fields. | `src/app/api/v1/me/profile/route.ts` |

### Cron Jobs

| Method(s) | Path | Auth Requirement | Description | Source File |
|---|---|---|---|---|
| `GET` | `/cron/cleanup-orphaned-payments` | CRON secret (header `x-cron-secret` or Bearer) | Scheduled task trigger endpoint (operational automation). | `src/app/api/cron/cleanup-orphaned-payments/route.ts` |
| `GET` | `/cron/downgrade-late-reservations` | CRON secret (header `x-cron-secret` or Bearer) | Scheduled task trigger endpoint (operational automation). | `src/app/api/cron/downgrade-late-reservations/route.ts` |
| `GET` | `/cron/mark-queue-no-shows` | CRON secret (header `x-cron-secret` or Bearer) | Scheduled task trigger endpoint (operational automation). | `src/app/api/cron/mark-queue-no-shows/route.ts` |
| `GET` | `/cron/purge-admin-logs` | CRON secret (header `x-cron-secret` or Bearer) | Scheduled task trigger endpoint (operational automation). | `src/app/api/cron/purge-admin-logs/route.ts` |
| `GET` | `/cron/recover-stalled-payments` | CRON secret (header `x-cron-secret` or Bearer) | Scheduled task trigger endpoint (operational automation). | `src/app/api/cron/recover-stalled-payments/route.ts` |
| `GET` | `/cron/send-escrow-weekly-transactions-report` | CRON secret (header `x-cron-secret` or Bearer) | Scheduled task trigger endpoint (operational automation). | `src/app/api/cron/send-escrow-weekly-transactions-report/route.ts` |
| `GET` | `/cron/send-kyc-expiry-reminders` | CRON secret (header `x-cron-secret` or Bearer) | Scheduled task trigger endpoint (operational automation). | `src/app/api/cron/send-kyc-expiry-reminders/route.ts` |
| `GET` | `/cron/send-reservation-reminders` | CRON secret (header `x-cron-secret` or Bearer) | Scheduled task trigger endpoint (operational automation). | `src/app/api/cron/send-reservation-reminders/route.ts` |
| `GET` | `/cron/stripe-reconciliation` | CRON secret (header `x-cron-secret` or Bearer) | Scheduled task trigger endpoint (operational automation). | `src/app/api/cron/stripe-reconciliation/route.ts` |
| `GET` | `/cron/sync-pending-uploads` | CRON secret (header `x-cron-secret` or Bearer) | Scheduled task trigger endpoint (operational automation). | `src/app/api/cron/sync-pending-uploads/route.ts` |

### Developer Utilities

| Method(s) | Path | Auth Requirement | Description | Source File |
|---|---|---|---|---|
| `POST` | `/v1/dev/reservations` | Bearer JWT (development utility endpoint) | Documented from route handler path and method. | `src/app/api/v1/dev/reservations/route.ts` |

### Disputes

| Method(s) | Path | Auth Requirement | Description | Source File |
|---|---|---|---|---|
| `POST` | `/v1/disputes` | Bearer JWT (`client` or role-scoped by handler) | Open dispute from eligible reservation/payment context. | `src/app/api/v1/disputes/route.ts` |

### Formats Catalog

| Method(s) | Path | Auth Requirement | Description | Source File |
|---|---|---|---|---|
| `GET` | `/v1/formats` | Public | Public/global vehicle formats endpoint. | `src/app/api/v1/formats/route.ts` |

### Health

| Method(s) | Path | Auth Requirement | Description | Source File |
|---|---|---|---|---|
| `GET` | `/v1/health` | Public | Application health check endpoint. | `src/app/api/v1/health/route.ts` |

### History and Receipts

| Method(s) | Path | Auth Requirement | Description | Source File |
|---|---|---|---|---|
| `GET` | `/v1/history/client` | Bearer JWT (`client` or role-scoped by handler) | Client history and receipt retrieval endpoints (JSON/PDF). | `src/app/api/v1/history/client/route.ts` |
| `GET` | `/v1/history/client/{entryId}/receipt.pdf` | Bearer JWT (`client` or role-scoped by handler) | Client history and receipt retrieval endpoints (JSON/PDF). | `src/app/api/v1/history/client/[entryId]/receipt.pdf/route.ts` |
| `GET` | `/v1/history/client/receipt/{entryId}` | Bearer JWT (`client` or role-scoped by handler) | Client history and receipt retrieval endpoints (JSON/PDF). | `src/app/api/v1/history/client/receipt/[entryId]/route.ts` |
| `GET` | `/v1/history/station` | Bearer JWT (`station`) | Station-side operational history endpoint. | `src/app/api/v1/history/station/route.ts` |

### Legal Content

| Method(s) | Path | Auth Requirement | Description | Source File |
|---|---|---|---|---|
| `GET` | `/v1/legal/{key}` | Public | Documented from route handler path and method. | `src/app/api/v1/legal/[key]/route.ts` |

### Other

| Method(s) | Path | Auth Requirement | Description | Source File |
|---|---|---|---|---|
| `GET`, `POST` | `/v1/reservations` | Check route handler | Create reservation and list reservations with filters. | `src/app/api/v1/reservations/route.ts` |
| `GET` | `/v1/stations` | Check route handler | Public station listing/search endpoint. | `src/app/api/v1/stations/route.ts` |

### Promotions

| Method(s) | Path | Auth Requirement | Description | Source File |
|---|---|---|---|---|
| `GET` | `/v1/promo/referrals/{refCode}` | Public | Resolve referral code metadata for promo flow. | `src/app/api/v1/promo/referrals/[refCode]/route.ts` |

### Ratings

| Method(s) | Path | Auth Requirement | Description | Source File |
|---|---|---|---|---|
| `POST` | `/v1/ratings` | Bearer JWT (`client` or role-scoped by handler) | Create rating for completed reservation. | `src/app/api/v1/ratings/route.ts` |
| `GET` | `/v1/ratings/me` | Bearer JWT (`client` or role-scoped by handler) | Return ratings associated with authenticated user. | `src/app/api/v1/ratings/me/route.ts` |

### Reservations

| Method(s) | Path | Auth Requirement | Description | Source File |
|---|---|---|---|---|
| `POST` | `/v1/reservations/{id}/accept-delay` | Bearer JWT (role-scoped by action) | Execute reservation lifecycle action on a specific reservation. | `src/app/api/v1/reservations/[id]/accept-delay/route.ts` |
| `POST` | `/v1/reservations/{id}/confirm-presence` | Bearer JWT (role-scoped by action) | Execute reservation lifecycle action on a specific reservation. | `src/app/api/v1/reservations/[id]/confirm-presence/route.ts` |
| `POST` | `/v1/reservations/{id}/refuse-delay` | Bearer JWT (role-scoped by action) | Execute reservation lifecycle action on a specific reservation. | `src/app/api/v1/reservations/[id]/refuse-delay/route.ts` |
| `POST` | `/v1/reservations/{id}/reschedule` | Bearer JWT (role-scoped by action) | Execute reservation lifecycle action on a specific reservation. | `src/app/api/v1/reservations/[id]/reschedule/route.ts` |
| `POST` | `/v1/reservations/{id}/signal-delay` | Bearer JWT (role-scoped by action) | Execute reservation lifecycle action on a specific reservation. | `src/app/api/v1/reservations/[id]/signal-delay/route.ts` |
| `POST` | `/v1/reservations/{id}/tip` | Bearer JWT (role-scoped by action) | Execute reservation lifecycle action on a specific reservation. | `src/app/api/v1/reservations/[id]/tip/route.ts` |

### Station Operations

| Method(s) | Path | Auth Requirement | Description | Source File |
|---|---|---|---|---|
| `GET` | `/v1/station/analytics/{metric}` | Bearer JWT (`station`) | Return station analytics series for a selected metric. | `src/app/api/v1/station/analytics/[metric]/route.ts` |
| `GET` | `/v1/station/clients/lookup` | Bearer JWT (`station`) | Documented from route handler path and method. | `src/app/api/v1/station/clients/lookup/route.ts` |
| `GET`, `PATCH` | `/v1/station/config` | Bearer JWT (`station`) | Read or update station operational configuration. | `src/app/api/v1/station/config/route.ts` |
| `GET` | `/v1/station/dashboard` | Bearer JWT (`station`) | Return station dashboard operational aggregates. | `src/app/api/v1/station/dashboard/route.ts` |
| `GET` | `/v1/station/delays` | Bearer JWT (`station`) | List delay requests related to station reservations. | `src/app/api/v1/station/delays/route.ts` |
| `GET`, `POST` | `/v1/station/entries` | Bearer JWT (`station`) | Station queue/reservation entry operations (list, create, start, move, patch). | `src/app/api/v1/station/entries/route.ts` |
| `PATCH` | `/v1/station/entries/{entryId}` | Bearer JWT (`station`) | Station queue/reservation entry operations (list, create, start, move, patch). | `src/app/api/v1/station/entries/[entryId]/route.ts` |
| `PATCH` | `/v1/station/entries/{entryId}/position` | Bearer JWT (`station`) | Station queue/reservation entry operations (list, create, start, move, patch). | `src/app/api/v1/station/entries/[entryId]/position/route.ts` |
| `PATCH` | `/v1/station/entries/{entryId}/priority` | Bearer JWT (`station`) | Station queue/reservation entry operations (list, create, start, move, patch). | `src/app/api/v1/station/entries/[entryId]/priority/route.ts` |
| `POST` | `/v1/station/entries/{entryId}/start` | Bearer JWT (`station`) | Station queue/reservation entry operations (list, create, start, move, patch). | `src/app/api/v1/station/entries/[entryId]/start/route.ts` |
| `POST` | `/v1/station/extra-time` | Bearer JWT (`station`) | Documented from route handler path and method. | `src/app/api/v1/station/extra-time/route.ts` |
| `GET`, `POST` | `/v1/station/extras` | Bearer JWT (`station`) | Create/list/update/delete station extras and compatibilities. | `src/app/api/v1/station/extras/route.ts` |
| `PATCH`, `DELETE` | `/v1/station/extras/{id}` | Bearer JWT (`station`) | Create/list/update/delete station extras and compatibilities. | `src/app/api/v1/station/extras/[id]/route.ts` |
| `POST` | `/v1/station/formats` | Bearer JWT (`station`) | Documented from route handler path and method. | `src/app/api/v1/station/formats/route.ts` |
| `PUT`, `PATCH`, `DELETE` | `/v1/station/formats/{id}` | Bearer JWT (`station`) | Documented from route handler path and method. | `src/app/api/v1/station/formats/[id]/route.ts` |
| `GET`, `POST` | `/v1/station/hour-exceptions` | Bearer JWT (`station`) | Documented from route handler path and method. | `src/app/api/v1/station/hour-exceptions/route.ts` |
| `DELETE` | `/v1/station/hour-exceptions/{id}` | Bearer JWT (`station`) | Documented from route handler path and method. | `src/app/api/v1/station/hour-exceptions/[id]/route.ts` |
| `GET`, `PATCH` | `/v1/station/hours` | Bearer JWT (`station`) | Documented from route handler path and method. | `src/app/api/v1/station/hours/route.ts` |
| `GET`, `PATCH` | `/v1/station/me` | Bearer JWT (`station`) | Documented from route handler path and method. | `src/app/api/v1/station/me/route.ts` |
| `GET`, `PATCH` | `/v1/station/notification-prefs` | Bearer JWT (`station`) | Documented from route handler path and method. | `src/app/api/v1/station/notification-prefs/route.ts` |
| `PATCH` | `/v1/station/photos` | Bearer JWT (`station`) | Documented from route handler path and method. | `src/app/api/v1/station/photos/route.ts` |
| `GET` | `/v1/station/qr-token` | Bearer JWT (`station`) | Documented from route handler path and method. | `src/app/api/v1/station/qr-token/route.ts` |
| `POST` | `/v1/station/queue/next` | Bearer JWT (`station`) | Pick next queue entry for service progression. | `src/app/api/v1/station/queue/next/route.ts` |
| `POST` | `/v1/station/reapply` | Bearer JWT (`station`) | Documented from route handler path and method. | `src/app/api/v1/station/reapply/route.ts` |
| `GET`, `POST` | `/v1/station/services` | Bearer JWT (`station`) | Create/list/update/delete station service offerings. | `src/app/api/v1/station/services/route.ts` |
| `PATCH`, `DELETE` | `/v1/station/services/{id}` | Bearer JWT (`station`) | Create/list/update/delete station service offerings. | `src/app/api/v1/station/services/[id]/route.ts` |
| `GET`, `POST`, `DELETE` | `/v1/station/slots` | Bearer JWT (`station`) | Documented from route handler path and method. | `src/app/api/v1/station/slots/route.ts` |
| `DELETE` | `/v1/station/slots/{id}` | Bearer JWT (`station`) | Documented from route handler path and method. | `src/app/api/v1/station/slots/[id]/route.ts` |
| `POST` | `/v1/station/slots/{id}/block` | Bearer JWT (`station`) | Block a specific slot from future booking. | `src/app/api/v1/station/slots/[id]/block/route.ts` |
| `POST` | `/v1/station/slots/bulk` | Bearer JWT (`station`) | Create/update multiple station slots in one request. | `src/app/api/v1/station/slots/bulk/route.ts` |
| `POST` | `/v1/station/slots/generate` | Bearer JWT (`station`) | Generate station slots over a period based on business rules. | `src/app/api/v1/station/slots/generate/route.ts` |
| `GET` | `/v1/station/status` | Bearer JWT (`station`) | Documented from route handler path and method. | `src/app/api/v1/station/status/route.ts` |
| `POST` | `/v1/station/stripe/onboarding` | Bearer JWT (`station`) | Start or resume Stripe Connect onboarding for station. | `src/app/api/v1/station/stripe/onboarding/route.ts` |
| `GET` | `/v1/station/stripe/status` | Bearer JWT (`station`) | Read station Stripe connectivity/capability status. | `src/app/api/v1/station/stripe/status/route.ts` |

### Stations Public and Onboarding

| Method(s) | Path | Auth Requirement | Description | Source File |
|---|---|---|---|---|
| `GET` | `/v1/stations/{id}` | Public | Public station detail endpoint. | `src/app/api/v1/stations/[id]/route.ts` |
| `GET` | `/v1/stations/{id}/availability` | Public | Read station availability slots for booking. | `src/app/api/v1/stations/[id]/availability/route.ts` |
| `GET` | `/v1/stations/{id}/formats` | Public | Read station formats visible to clients. | `src/app/api/v1/stations/[id]/formats/route.ts` |
| `POST` | `/v1/stations/{id}/join` | Public | Client join action for station (map/join flow). | `src/app/api/v1/stations/[id]/join/route.ts` |
| `GET` | `/v1/stations/{id}/queue` | Public | Read station queue state. | `src/app/api/v1/stations/[id]/queue/route.ts` |
| `POST` | `/v1/stations/{id}/queue/join` | Public | Join queue for station. | `src/app/api/v1/stations/[id]/queue/join/route.ts` |
| `GET` | `/v1/stations/{id}/ratings` | Public | Read station ratings list. | `src/app/api/v1/stations/[id]/ratings/route.ts` |
| `POST` | `/v1/stations/{id}/reservations` | Public | Create station reservation from station context. | `src/app/api/v1/stations/[id]/reservations/route.ts` |
| `POST` | `/v1/stations/onboarding/submit` | Public | Submit complete station onboarding application. | `src/app/api/v1/stations/onboarding/submit/route.ts` |
| `POST` | `/v1/stations/onboarding/upload` | Public | Upload onboarding document file (multipart). | `src/app/api/v1/stations/onboarding/upload/route.ts` |
| `POST` | `/v1/stations/onboarding/validate/step1` | Public | Validate onboarding step 1 payload before submission. | `src/app/api/v1/stations/onboarding/validate/step1/route.ts` |
| `POST` | `/v1/stations/onboarding/validate/step2` | Public | Validate onboarding step 2 payload before submission. | `src/app/api/v1/stations/onboarding/validate/step2/route.ts` |
| `POST` | `/v1/stations/queue/{queueId}/pick` | Public | Documented from route handler path and method. | `src/app/api/v1/stations/queue/[queueId]/pick/route.ts` |

### Support

| Method(s) | Path | Auth Requirement | Description | Source File |
|---|---|---|---|---|
| `GET`, `POST` | `/v1/support` | Bearer JWT (`client` or role-scoped by handler) | Create support ticket and list role-scoped tickets. | `src/app/api/v1/support/route.ts` |
| `GET`, `PATCH` | `/v1/support/{id}` | Bearer JWT (`client` or role-scoped by handler) | Read/update support ticket details and status. | `src/app/api/v1/support/[id]/route.ts` |
| `POST` | `/v1/support/{id}/messages` | Bearer JWT (`client` or role-scoped by handler) | Create support message in a specific ticket thread. | `src/app/api/v1/support/[id]/messages/route.ts` |

### Uploads

| Method(s) | Path | Auth Requirement | Description | Source File |
|---|---|---|---|---|
| `POST` | `/v1/upload` | Bearer JWT (`station`/`admin` depending on flow) | Authenticated upload endpoint for station/admin documents. | `src/app/api/v1/upload/route.ts` |

### Webhooks

| Method(s) | Path | Auth Requirement | Description | Source File |
|---|---|---|---|---|
| `POST` | `/v1/webhooks/stripe` | Public endpoint with Stripe signature verification | Stripe event callback endpoint with signature verification. | `src/app/api/v1/webhooks/stripe/route.ts` |

## Coverage Notes

- Route paths with handlers in code: **138**
- Current `/api/docs` OpenAPI paths: **138** (annotated + inferred merge)
- Handwritten `@swagger` entries remain authoritative and override inferred operations.
- Inferred operations provide complete coverage for non-annotated routes with explicit auth, path params, summary, description, and standard response envelopes.

## Changelog

- 2026-05-30: Rebuilt full endpoint inventory from code; module grouping/auth requirement normalized; source-file traceability added.

## Detailed Contract (Annotated OpenAPI Endpoints)

This section is generated from `/api/docs` and reflects endpoints with explicit `@swagger` annotations.

### GET /api/v1/admin/disputes

- Summary: List disputes (admin)
- Description: Returns a paginated, filterable list of all disputes across the platform. Admin role required.
- OperationId: N/A
- Tags: Disputes
- Security: [{"BearerAuth":[]}]
- Parameters:
  - status (query, optional)
  - station_id (query, optional)
  - client_id (query, optional)
  - date_from (query, optional)
  - date_to (query, optional)
  - page (query, optional)
  - per_page (query, optional)
- Responses:
  - 200: Paginated list of disputes
  - 400: Validation failed
  - 401: Unauthorized
  - 403: Forbidden - admin role required
  - 500: Internal server error

### POST /api/v1/admin/disputes/{id}/close

- Summary: Close a dispute without refund (admin)
- Description: Closes an open dispute as resolved or rejected without issuing a refund. Admin role required. Rate-limited to 20 requests per minute per admin.
- OperationId: N/A
- Tags: Disputes
- Security: [{"BearerAuth":[]}]
- Parameters:
  - id (path, required)
- Request Body:
  - application/json
- Responses:
  - 200: Dispute closed successfully
  - 400: Validation failed
  - 401: Unauthorized
  - 403: Forbidden - admin role required
  - 404: Dispute not found
  - 409: Dispute is already closed
  - 429: Too many requests
  - 500: Internal server error

### POST /api/v1/admin/disputes/{id}/refund

- Summary: Issue a Stripe refund for a dispute (admin)
- Description: Issues a Stripe refund for the reservation attached to an open dispute. Blocked if a Stripe transfer to the station already occurred. Omit amount for a full refund. Admin role required. Rate-limited to 10 requests per minute per admin.
- OperationId: N/A
- Tags: Disputes
- Security: [{"BearerAuth":[]}]
- Parameters:
  - id (path, required)
- Request Body:
  - application/json
- Responses:
  - 200: Refund issued successfully
  - 400: Validation failed or refund not eligible
  - 401: Unauthorized
  - 403: Forbidden - admin role required
  - 404: Dispute or reservation not found
  - 409: Dispute is already closed
  - 429: Too many requests
  - 500: Internal server error

### GET /api/v1/admin/legal/{key}

- Summary: Retrieve a legal document (admin)
- Description: Returns the stored HTML content for the given legal document key. Returns content as null if the document has never been written.
- OperationId: N/A
- Tags: Legal Content
- Security: [{"BearerAuth":[]}]
- Parameters:
  - key (path, required)
- Responses:
  - 200: Legal document content
  - 400: Invalid legal document key
  - 401: Unauthorized - admin auth required
  - 500: Internal server error

### PATCH /api/v1/admin/legal/{key}

- Summary: Create or overwrite a legal document (admin)
- Description: Upserts the legal document for the given key. Content is sanitized server-side with DOMPurify before persistence. Rate-limited to 20 requests per minute per admin.
- OperationId: N/A
- Tags: Legal Content
- Security: [{"BearerAuth":[]}]
- Parameters:
  - key (path, required)
- Request Body:
  - application/json
- Responses:
  - 200: Legal document updated with sanitized content
  - 400: Validation failed - invalid key or body
  - 401: Unauthorized - admin auth required
  - 429: Too many requests
  - 500: Internal server error

### GET /api/v1/admin/settings

- Summary: Retrieve all platform settings (admin)
- Description: Returns all whitelisted platform settings with their values, last update timestamps, and the admin user who last changed each setting.
- OperationId: N/A
- Tags: Admin Settings
- Security: [{"BearerAuth":[]}]
- Responses:
  - 200: All platform settings
  - 401: Unauthorized - admin auth required
  - 500: Internal server error

### PATCH /api/v1/admin/settings

- Summary: Bulk-update platform settings (admin)
- Description: Upserts one or more platform settings. Each key must be in the platform allowlist. Per-key semantic validation is applied (ranges, types, cross-key constraints). Rate-limited to 20 requests per minute per admin.
- OperationId: N/A
- Tags: Admin Settings
- Security: [{"BearerAuth":[]}]
- Request Body:
  - application/json
- Responses:
  - 200: Platform settings updated
  - 400: Validation failed - invalid keys, ranges, or cross-key constraints
  - 401: Unauthorized - admin auth required
  - 429: Too many requests
  - 500: Internal server error

### POST /api/v1/auth/forgot-password

- Summary: Request a password reset email
- Description: Sends a password reset email when the account exists and is active. Always returns 200 to prevent email enumeration - the caller cannot determine whether an account with the given email exists.
- OperationId: N/A
- Tags: Auth
- Security: Public
- Request Body:
  - application/json
- Responses:
  - 200: Reset email sent (if account exists). Always returned to prevent enumeration.
  - 400: Invalid email format
  - 429: Too many requests
  - 500: Internal server error

### POST /api/v1/auth/login

- Summary: Authenticate a user
- Description: Validates credentials and returns a short-lived access token plus an httpOnly refresh token cookie. Rate-limited to prevent brute force attacks.
- OperationId: N/A
- Tags: Auth
- Security: Public
- Request Body:
  - application/json
- Responses:
  - 200: Authentication successful
  - 400: Validation failed
  - 401: Invalid credentials
  - 403: Account not active or suspended
  - 429: Too many requests
  - 500: Internal server error

### POST /api/v1/auth/logout

- Summary: Log out and revoke all refresh tokens
- Description: Clears the httpOnly refresh token cookie and revokes all refresh tokens for the user identified by the Bearer access token. The cookie is cleared unconditionally regardless of DB revocation outcome.
- OperationId: N/A
- Tags: Auth
- Security: [{"BearerAuth":[]}]
- Responses:
  - 200: Logged out successfully

### POST /api/v1/auth/register

- Summary: Register a new client account
- Description: Creates a new client account with email and password. Returns access and refresh tokens on success. A verification email is sent automatically.
- OperationId: N/A
- Tags: Auth
- Security: Public
- Request Body:
  - application/json
- Responses:
  - 201: Account created successfully
  - 400: Validation failed
  - 409: Email already in use
  - 429: Too many requests
  - 500: Internal server error

### POST /api/v1/auth/reset-password

- Summary: Reset password using a one-time token
- Description: Resets the user's password using the token received via the forgot-password email. Returns the same error for both invalid and expired tokens to prevent enumeration.
- OperationId: N/A
- Tags: Auth
- Security: Public
- Request Body:
  - application/json
- Responses:
  - 200: Password updated successfully
  - 400: Validation failed or invalid/expired token
  - 429: Too many requests
  - 500: Internal server error

### POST /api/v1/auth/verify-email

- Summary: Verify email address
- Description: Verifies a user's email address using the one-time token sent by email. Returns the same error shape for both invalid and expired tokens to prevent token enumeration.
- OperationId: N/A
- Tags: Auth
- Security: Public
- Request Body:
  - application/json
- Responses:
  - 200: Email verified successfully
  - 400: Invalid or expired verification token
  - 429: Too many requests
  - 500: Internal server error

### POST /api/v1/disputes

- Summary: Open a dispute for a completed reservation
- Description: Opens a dispute on behalf of the authenticated client for a reservation that has been completed and paid. Only one dispute per reservation is allowed. Rate-limited to 5 requests per minute per user.
- OperationId: N/A
- Tags: Disputes
- Security: [{"BearerAuth":[]}]
- Request Body:
  - application/json
- Responses:
  - 201: Dispute created successfully
  - 400: Validation failed
  - 401: Unauthorized
  - 403: Reservation does not belong to client
  - 404: Reservation not found
  - 409: A dispute already exists for this reservation
  - 429: Too many requests
  - 500: Internal server error

### POST /api/v1/me/device-token

- Summary: Register or update the FCM push notification token
- Description: Upserts the Firebase Cloud Messaging (FCM) device token for the authenticated client. If the token already exists for this user it is kept as-is; a new token is inserted. Rate-limited to 10 requests per minute per user.
- OperationId: N/A
- Tags: Notifications
- Security: [{"BearerAuth":[]}]
- Request Body:
  - application/json
- Responses:
  - 200: Device token registered or confirmed
  - 400: Validation failed
  - 401: Unauthorized
  - 429: Too many requests
  - 500: Internal server error

### POST /api/v1/me/entries/{entryId}/upgrade-to-reservation

- Summary: Upgrade a queue entry to a paid reservation
- Description: Upgrades a walk-in queue entry to a time-slot reservation. Returns a Stripe client secret for frontend payment confirmation. The reservation is confirmed when the Stripe webhook reports payment success.
- OperationId: N/A
- Tags: Queue, Reservations
- Security: [{"BearerAuth":[]}]
- Parameters:
  - entryId (path, required)
- Request Body:
  - application/json
- Responses:
  - 201: Entry upgraded, Stripe client secret returned
  - 400: Validation failed
  - 401: Unauthorized
  - 404: Entry or station not found
  - 409: Slot full or entry not eligible for upgrade
  - 500: Internal server error

### GET /api/v1/station/analytics/{metric}

- Summary: Get a daily analytics time series for the station
- Description: Returns a daily time series for the authenticated station for the given metric. Defaults to the past 30 days when no date range is specified. Both from and to must be provided together when using a custom range.
- OperationId: N/A
- Tags: Station
- Security: [{"BearerAuth":[]}]
- Parameters:
  - metric (path, required)
  - from (query, optional)
  - to (query, optional)
- Responses:
  - 200: Daily time series for the requested metric
  - 400: Unknown metric or invalid query params
  - 401: Unauthorized
  - 403: Forbidden - station role required or not approved
  - 404: No station associated with this account
  - 429: Too many requests
  - 500: Internal server error

### GET /api/v1/station/dashboard

- Summary: Get the station KPI dashboard for the current month
- Description: Returns key performance indicators for the authenticated station for the current calendar month: total revenue, client count, completed services, average rating, and pending entry count.
- OperationId: N/A
- Tags: Station
- Security: [{"BearerAuth":[]}]
- Responses:
  - 200: Station KPI dashboard
  - 401: Unauthorized
  - 403: Forbidden - station role required or not approved
  - 404: No station associated with this account
  - 429: Too many requests
  - 500: Internal server error

### GET /api/v1/station/delays

- Summary: List delay requests for the authenticated station
- Description: Returns paginated delay requests submitted by clients for reservations at the authenticated station. Filter by status for workflow views.
- OperationId: N/A
- Tags: Station
- Security: [{"BearerAuth":[]}]
- Parameters:
  - status (query, optional)
  - page (query, optional)
  - per_page (query, optional)
- Responses:
  - 200: Paginated list of delay requests
  - 400: Validation failed
  - 401: Unauthorized
  - 403: Forbidden - station role required
  - 404: No station associated with this account
  - 500: Internal server error

### POST /api/v1/stations/queue/{queueId}/pick

- Summary: Pick a walk-in client from the queue
- Description: Station operator selects a queue entry to serve immediately. The entry moves from pending/late to in_progress and queue positions shift up. Typically used when a reserved slot becomes available.
- OperationId: N/A
- Tags: Queue
- Security: [{"BearerAuth":[]}]
- Parameters:
  - queueId (path, required)
- Responses:
  - 200: Entry picked and moved to in_progress
  - 400: Invalid queue entry ID
  - 401: Unauthorized
  - 403: No station associated with this account
  - 404: Queue entry not found
  - 409: Entry is not in a pickable state
  - 500: Internal server error

### POST /api/v1/stations/{id}/queue/join

- Summary: Join the walk-in queue at a station
- Description: Adds the authenticated client to the walk-in queue at the given station. No payment is required. The client is served when the station picks their entry via POST /stations/queue/:queueId/pick.
- OperationId: N/A
- Tags: Queue
- Security: [{"BearerAuth":[]}]
- Parameters:
  - id (path, required)
- Request Body:
  - application/json
- Responses:
  - 201: Successfully joined the queue
  - 400: Validation failed
  - 401: Unauthorized
  - 404: Station not found or not active
  - 409: Station is closed for walk-ins or client already in queue
  - 500: Internal server error

### POST /api/v1/stations/{id}/reservations

- Summary: Create a reservation at a station
- Description: Books a specific time slot at the given station. Returns a Stripe client secret for payment confirmation on the frontend. The reservation status becomes "confirmed" after the Stripe webhook confirms payment.
- OperationId: N/A
- Tags: Reservations
- Security: [{"BearerAuth":[]}]
- Parameters:
  - id (path, required)
- Request Body:
  - application/json
- Responses:
  - 201: Reservation created, awaiting payment
  - 400: Validation failed
  - 401: Unauthorized
  - 404: Station not found or not active
  - 409: Slot full or an active reservation already exists
  - 500: Internal server error
