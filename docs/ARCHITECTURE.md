# LAVO Architecture Overview (Initialization Skeletons Only)

This document describes the initial folder and file structure for the LAVO app.  
It focuses on domains, routes, API prefixes, server services, and shared components.  
Business logic is intentionally omitted at this stage.

---

## 1. Domains and responsibilities

Each domain has a backend + API surface. Frontend is provided for end‑user / admin flows.

| Domain | Purpose (short) | Backend | Frontend | API prefix / notes |
|--------|-----------------|---------|----------|--------------------|
| **auth** | Registration, login, email verification, password reset, roles | ✓ | ✓ | `/api/v1/auth/*` |
| **stations** | Public station listing/detail, apply, configs derived later | ✓ | ✓ | `/api/v1/stations/*`, `/api/v1/station/*` |
| **reservations** | Booking lifecycle, queue, delays, no‑show | ✓ | ✓ | `/api/v1/reservations/*` |
| **payments** | Stripe Connect, redistribution, tips, refunds | ✓ | ✓ | Implemented via `reservations` + Stripe webhooks |
| **admin** | KPIs, KYC, merchants/clients, disputes, platform settings | ✓ | ✓ | `/api/v1/admin/*` |
| **notifications** | Email + push notifications, cron events | ✓ | — | Used by other domains (no public prefix) |
| **ratings** | 1–5 ratings + comments, moderation | ✓ | ✓ | `/api/v1/ratings/*`, `/api/v1/stations/:id/ratings`, `/api/v1/admin/ratings/*` |
| **history** | Client + station history and receipts | ✓ | ✓ | `/api/v1/history/client`, `/api/v1/history/station` |
| **support** | Support tickets and threads | ✓ | ✓ | `/api/v1/admin/support/*`, `/api/v1/support` (public creation) |

---

## 2. i18n (next-intl)

- **Locales:** `fr` (default), `en`. URLs are prefixed: `/fr`, `/en`.
- **Messages:** `messages/fr.json`, `messages/en.json`.
- **Config:** `src/i18n/routing.ts`, `src/i18n/request.ts`, `src/i18n/navigation.ts`.
- **Middleware:** `src/middleware.ts` handles locale detection and redirects.
- **Usage:** `useTranslations('namespace')` in client components; `getTranslations` in server components.

---

## 3. `src/app` — Route groups and pages

Base: Next.js App Router. All pages live under `src/app/[locale]/` for i18n.  
Route groups `(public)`, `(client)`, `(station)`, `(admin)` do **not** change URLs; they only organize code.

- **Root layout**
  - `src/app/layout.tsx` — Global HTML `<html>`/`<body>` wrapper, fonts, and metadata.

- **Locale layout**
  - `src/app/[locale]/layout.tsx` — NextIntlClientProvider, Providers. Wraps all route groups.

- **Public group `(public)`**
  - `src/app/[locale]/(public)/layout.tsx` — Wrapper for all public pages.
  - `src/app/[locale]/(public)/page.tsx` → `/fr` or `/en` (home / welcome + API health check).
  - `src/app/[locale]/(public)/login/page.tsx` → `/fr/login` or `/en/login`
  - `src/app/[locale]/(public)/register/page.tsx` → `/fr/register` or `/en/register`
  - `src/app/(public)/register/confirmation/page.tsx` → `/register/confirmation`
  - `src/app/(public)/forgot-password/page.tsx` → `/forgot-password`
  - `src/app/(public)/reset-password/page.tsx` → `/reset-password`
  - `src/app/(public)/verify-email/page.tsx` → `/verify-email`
  - `src/app/(public)/stations/page.tsx` → `/stations`
  - `src/app/(public)/stations/[id]/page.tsx` → `/stations/[id]`
  - `src/app/(public)/stations/apply/page.tsx` → `/stations/apply`

- **Client group `(client)`**
  - `src/app/(client)/layout.tsx` — Wrapper for client dashboard area.
  - `src/app/(client)/client/dashboard/page.tsx` → `/client/dashboard`
  - `src/app/(client)/client/reservations/page.tsx` → `/client/reservations`
  - `src/app/(client)/client/reservations/[id]/page.tsx` → `/client/reservations/[id]`
  - `src/app/(client)/client/reservations/new/page.tsx` → `/client/reservations/new`
  - `src/app/(client)/client/reservations/[id]/confirm/page.tsx` → `/client/reservations/[id]/confirm`
  - `src/app/(client)/client/history/page.tsx` → `/client/history`
  - `src/app/(client)/client/support/page.tsx` → `/client/support`

- **Station group `(station)`**
  - `src/app/(station)/layout.tsx` — Wrapper for station space.
  - `src/app/(station)/station/dashboard/page.tsx` → `/station/dashboard`
  - `src/app/(station)/station/queue/page.tsx` → `/station/queue`
  - `src/app/(station)/station/reservations/page.tsx` → `/station/reservations`
  - `src/app/(station)/station/config/page.tsx` → `/station/config`
  - `src/app/(station)/station/formats/page.tsx` → `/station/formats`
  - `src/app/(station)/station/history/page.tsx` → `/station/history`
  - `src/app/(station)/station/qr/page.tsx` → `/station/qr`
  - `src/app/(station)/station/support/page.tsx` → `/station/support`

- **Admin group `(admin)`**
  - `src/app/(admin)/layout.tsx` — Wrapper for super‑admin area.
  - `src/app/(admin)/admin/page.tsx` → `/admin`
  - `src/app/(admin)/admin/dashboard/page.tsx` → `/admin/dashboard`
  - `src/app/(admin)/admin/stations/page.tsx` → `/admin/stations`
  - `src/app/(admin)/admin/stations/pending/page.tsx` → `/admin/stations/pending`
  - `src/app/(admin)/admin/stations/[id]/page.tsx` → `/admin/stations/[id]`
  - `src/app/(admin)/admin/clients/page.tsx` → `/admin/clients`
  - `src/app/(admin)/admin/clients/[id]/page.tsx` → `/admin/clients/[id]`
  - `src/app/(admin)/admin/disputes/page.tsx` → `/admin/disputes`
  - `src/app/(admin)/admin/disputes/[id]/page.tsx` → `/admin/disputes/[id]`
  - `src/app/(admin)/admin/commission/page.tsx` → `/admin/commission`
  - `src/app/(admin)/admin/transactions/page.tsx` → `/admin/transactions`
  - `src/app/(admin)/admin/platform-settings/page.tsx` → `/admin/platform-settings`
  - `src/app/(admin)/admin/support/page.tsx` → `/admin/support`
  - `src/app/(admin)/admin/support/[id]/page.tsx` → `/admin/support/[id]`
  - `src/app/(admin)/admin/ratings/page.tsx` → `/admin/ratings`
  - `src/app/(admin)/admin/logs/page.tsx` → `/admin/logs`

All pages are currently thin placeholders (headings and simple text) to establish the full navigation surface.

---

## 3. `src/app/api/v1` — API prefixes

API routes use the Next.js App Router convention (`route.ts` per endpoint).
For initialization, a minimal JSON response with HTTP 501 is returned for each domain.

- **Health**
  - `src/app/api/v1/health/route.ts` → `/api/v1/health` (already implemented; used by the home page).

- **Auth**
  - `src/app/api/v1/auth/register/route.ts` → `/api/v1/auth/register` (placeholder).

- **Stations (public)**
  - `src/app/api/v1/stations/route.ts` → `/api/v1/stations` (listing placeholder).

- **Station (authenticated station space)**
  - `src/app/api/v1/station/config/route.ts` → `/api/v1/station/config` (config placeholder).

- **Reservations**
  - `src/app/api/v1/reservations/route.ts` → `/api/v1/reservations` (creation/list placeholder).

- **Webhooks**
  - `src/app/api/v1/webhooks/stripe/route.ts` → `/api/v1/webhooks/stripe` (Stripe webhook placeholder).

- **Ratings**
  - `src/app/api/v1/ratings/route.ts` → `/api/v1/ratings` (ratings placeholder).

- **History**
  - `src/app/api/v1/history/client/route.ts` → `/api/v1/history/client` (client history placeholder).
  - `src/app/api/v1/history/station/route.ts` → `/api/v1/history/station` (station history placeholder).

- **Admin**
  - `src/app/api/v1/admin/dashboard/route.ts` → `/api/v1/admin/dashboard` (dashboard metrics placeholder).

- **Support**
  - `src/app/api/v1/support/route.ts` → `/api/v1/support` (ticket creation placeholder).

Each file currently returns `NextResponse.json(...)` with a `501 Not Implemented` status so that the paths are reachable without business logic.

---

## 4. `src/server` — Domain services

Server code follows a domain‑first, service‑oriented layout. API routes should call these services instead of embedding complex logic in `route.ts` files.

- **Auth**
  - `src/server/auth/auth-service.ts`

- **Stations**
  - `src/server/stations/station-service.ts`
  - `src/server/stations/slot-service.ts`
  - `src/server/stations/format-service.ts`

- **Reservations**
  - `src/server/reservations/reservation-service.ts`
  - `src/server/reservations/queue-service.ts`

- **Payments**
  - `src/server/payments/payment-service.ts`
  - `src/server/payments/tip-service.ts`

- **Admin**
  - `src/server/admin/admin-dashboard-service.ts`
  - `src/server/admin/kyc-service.ts`
  - `src/server/admin/dispute-service.ts`
  - `src/server/admin/platform-settings-service.ts`

- **Notifications**
  - `src/server/notifications/notification-service.ts`

- **Ratings**
  - `src/server/ratings/rating-service.ts`

- **History**
  - `src/server/history/client-history-service.ts`
  - `src/server/history/station-history-service.ts`

- **Support**
  - `src/server/support/support-ticket-service.ts`

Each service file currently exports a single placeholder function; real domain logic will be implemented here later.

---

## 5. `src/components` — Shared and domain components

The component tree separates low‑level UI primitives, layout scaffolding, and domain‑specific building blocks.

### 5.1 `src/components/ui` — Shared UI primitives

All of these are minimal, unstyled (or very lightly structured) React components that can be wrapped with Tailwind classes later:

- `Button.tsx` — `Button` component (HTML `<button>` wrapper).
- `Input.tsx` — `Input` component (HTML `<input>` wrapper).
- `Card.tsx` — Simple container for grouped content.
- `Modal.tsx` — Basic open/closed container with optional title/content/footer.
- `Badge.tsx` — Inline label container.
- `Spinner.tsx` — Simple loading indicator.
- `Alert.tsx` — Container for status messages.
- `Select.tsx` — Wrapper around `<select>`.
- `Textarea.tsx` — Wrapper around `<textarea>`.
- `Checkbox.tsx` — Wrapper around `<input type="checkbox">`.
- `Tabs.tsx` — Minimal tabs control with items and active tab id.

### 5.2 `src/components/layout` — Layout and navigation

These components provide layout scaffolding for the different app areas:

- `MainLayout.tsx` — Generic layout wrapper for public pages.
- `ClientLayout.tsx` — Wrapper for client dashboard layouts.
- `StationLayout.tsx` — Wrapper for station dashboards.
- `AdminLayout.tsx` — Wrapper for admin dashboards.
- `Header.tsx` — Simple top header with the LAVO title.
- `Sidebar.tsx` — Generic sidebar container.
- `Footer.tsx` — Simple footer with project name and year.

Route‑group layouts in `src/app/(public|client|station|admin)/layout.tsx` can compose these layout components as the UI grows.

### 5.3 Domain components

Per‑domain folders contain 1–2 key placeholders each:

- `src/components/auth/`
  - `LoginForm.tsx`
  - `RegisterForm.tsx`

- `src/components/stations/`
  - `StationCard.tsx`
  - `StationDetail.tsx`
  - `SearchBar.tsx`

- `src/components/reservations/`
  - `ReservationCard.tsx`
  - `SlotPicker.tsx`

- `src/components/admin/`
  - `DashboardKpiCards.tsx`
  - `PendingKycList.tsx`

- `src/components/ratings/`
  - `StarRating.tsx`
  - `RatingForm.tsx`

- `src/components/history/`
  - `ClientHistoryTable.tsx`

All of these components currently render simple headings or containers; they exist primarily to establish naming and file locations for future implementation.

---

## 6. Testing

- **Framework:** Jest + React Testing Library + @testing-library/jest-dom.
- **Config:** `jest.config.ts`, `jest.setup.ts`.
- **Structure:**
  - `tests/unit/` — Unit tests (helpers, lib, services).
  - `tests/integration/` — API integration tests (placeholder).
  - `tests/e2e/` — End-to-end tests (placeholder).
- **Scripts:** `npm test`, `npm run test:watch`, `npm run test:coverage`.

---

## 7. Styling and theming

Visual theming (colors, typography, spacing) is handled by the existing Tailwind configuration and `src/app/globals.css`.  
This initialization step **does not** modify Tailwind config or global styles. All new components and pages are intentionally minimal so that design can be iterated later without changing the architecture.

