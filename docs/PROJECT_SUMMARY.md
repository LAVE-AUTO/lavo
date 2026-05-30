# Hurryline Project Summary (Updated)

## Project purpose

Hurryline is a full-stack booking and payments platform for car wash stations. Clients discover stations, reserve time slots, and pay through Stripe; station operators manage scheduling and service execution; administrators supervise governance, disputes, compliance content, and platform settings.

## Architecture type

- **Type**: Hybrid (Full-stack) web application
- **Style**: Layered + domain-first organization
  - **Presentation**: Next.js App Router pages/components
  - **Application/API**: Next.js route handlers (`/api/v1`, `/api/cron`)
  - **Business logic**: domain services in `src/server/*`
  - **Persistence**: Drizzle ORM schemas + SQL migrations for PostgreSQL

## Main modules / components

- **Auth**: register/login/logout, refresh tokens, email verification, password reset/change, OAuth finalize, admin OTP
- **Stations**: listing/details, onboarding submit/upload/validate, station profile/config/hours/slots/formats/services/extras
- **Reservations**: booking lifecycle, presence confirmation, delays, rescheduling, queue operations, no-show handling
- **Payments**: Stripe Connect flows, tips, reconciliation, refunds through disputes, weekly escrow reporting
- **Notifications**: push (FCM), email (Resend), user notification feed and preferences
- **History**: client and station history with receipt endpoints
- **Support**: ticket creation, messaging, assignment and settings
- **Admin**: dashboard KPIs, station/client/user management, disputes, ratings moderation, legal content, logs, platform settings
- **Docs/Observability**: OpenAPI docs endpoint (`/api/docs`), health endpoint (`/api/v1/health`)

## Key features (high-level)

- Locale-first web app (`/fr`, `/en`) with separated public/client/station/admin experiences
- Reservation and queue coexistence (join, pick, priority, start, delay/refuse/accept, extra time)
- Station operations workspace (availability, dashboard, analytics, formats, configuration)
- Stripe webhook and reconciliation-oriented financial lifecycle
- Admin control plane with governance and moderation capabilities
- Scheduled jobs for reminders, cleanup, compliance, and sync operations

## Technology inventory

### Languages and runtime

- **TypeScript**
- **Node.js** (>= 20.9.0)

### Frameworks and libraries

- **Next.js 16** (App Router), **React 19**
- **Tailwind CSS v4**, **next-intl**
- **Zod**, **Axios**, **NextAuth** (route present + integration points)

### Database and ORM

- **Database**: PostgreSQL (Neon for dev, Railway PostgreSQL for production target)
- **ORM**: Drizzle ORM with schema modules in `src/lib/db/schema`
- **Migrations**: 53 SQL migrations currently in repository

### External integrations and APIs

- **Stripe / Stripe Connect**
- **Resend**
- **Firebase FCM**
- **Cloudinary**
- **Upstash Redis**
- **Google Analytics / PageSense**

## Frontend / backend status

- **Frontend status**: **Yes** (extensive pages/routes across all roles)
- **Backend/API status**: **Yes** (`/api/v1` domain APIs + `/api/cron` jobs + `/api/docs`)
- **Project type classification**: **Hybrid (Full-stack)**

## Current implementation snapshot

- **API routes (`/api/v1`)**: 127
- **Cron routes (`/api/cron`)**: 10
- **Unit tests**: 101
- **Integration tests**: 5
- **E2E tests**: 5

