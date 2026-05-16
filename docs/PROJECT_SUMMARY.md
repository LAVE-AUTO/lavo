# Hurryline - Project Summary (Phase 1)

## Project purpose

Hurryline is a full-stack booking and payments platform for car wash stations. Clients can discover stations, book time slots, and pay online; stations manage slots and validate completed services; a Super Admin oversees KYC, disputes, commissions, and platform governance.

## Architecture type

- **Type**: Hybrid (Full-stack) web application
- **Style**: **Layered** + **domain-first** organization
  - **Presentation**: Next.js App Router pages and API routes
  - **Business logic**: `src/server/*` domain services (currently placeholders)
  - **Data access**: planned Drizzle ORM layer (schema/migrations are not yet implemented)

## Main modules / components

- **Auth**: registration, login, email verification, password reset; role-based access (CLIENT, STATION, SUPER_ADMIN)
- **Stations**: listing, details, application (KYC), formats/pricing, availability via manual slots
- **Reservations**: slot booking lifecycle, queue/late handling, cancellations, no-show fees (dedicated table planned)
- **Payments**: Stripe Connect payments, commission split, refunds, tips; Stripe webhooks
- **Notifications**: Resend emails + Firebase FCM push, triggered by business events
- **Ratings**: post-service ratings and moderation
- **History**: client/station history, receipts/transactions views
- **Support**: ticket creation and admin management
- **Admin**: KPIs dashboard, KYC validation, disputes/refunds, commission settings, platform logs
- **i18n**: `next-intl` with `fr` (default) and `en`

## Key features (high-level)

- Station discovery: search/filter stations, station detail view, “Join” via Google Maps
- Online booking: vehicle format selection, slot selection, capacity-based availability
- Payments: Stripe Connect with commission capture, station payout, client receipts
- Time management: reminders (5h and 30min), presence confirmation, late → queue switch
- Post-service: rating + optional tip
- Governance: KYC approval, disputes/refunds, commission rate settings, audit logs
- Growth: station QR code linking to station details; QR bookings with special commission rules
- Analytics: Google Analytics / PageSense tracked via app meta integration

## Technology inventory

### Languages and runtime

- **TypeScript**
- **Node.js**: Next.js 16 requires Node >= 20.9.0

### Frameworks and libraries

- **Next.js 16 (App Router)**
- **React 19**
- **Tailwind CSS v4** (via `@import "tailwindcss"`)
- **next-intl** for localization
- **Axios** (generic HTTP client helper)
- **Zod** for validation (planned for all endpoints)

### Database and ORM

- **Database**: PostgreSQL
  - **Development**: Neon (via `DATABASE_URL`)
  - **Production**: Railway PostgreSQL (Neon not used in production)
- **ORM**: **Drizzle ORM** (selected for implementation; schema not yet created)

### External integrations and APIs

- **Stripe Connect**: payments, transfers, refunds, tips, webhooks
- **Resend**: transactional emails (verification, confirmations, etc.)
- **Firebase FCM**: push notifications
- **Google Maps**: navigation “Join” link (`https://maps.google.com/?q=lat,lng`)
- **Google Analytics / PageSense**: tracking via app meta

## Frontend / backend status

- **Frontend status**: **Yes** (UI routes/pages exist as scaffolding under `src/app/[locale]/...`)
- **Backend/API status**: **Yes** (API routes exist under `/api/v1/*`; mostly placeholders except health)
- **Project type classification**: **Hybrid (Full-stack)**

## Current implementation status (codebase reality)

- **Implemented**:
  - Locale routing (`/fr`, `/en`) using `next-intl` middleware and message files
  - Navigation surface: route groups and page skeletons for public/client/station/admin areas
  - Health endpoint: `GET /api/v1/health`
  - Testing scaffolding: Jest + React Testing Library configuration
- **Not yet implemented**:
  - Drizzle schema, migrations, and persistence layer
  - Auth (JWT/NextAuth), role-based guards, and secured endpoints
  - Business logic for domains in `src/server/*`
  - Stripe/Resend/FCM production wiring

