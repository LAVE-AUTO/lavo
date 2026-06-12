# Hurryline Architecture

## Project Tree Structure

```text
Hurryline/
├── docs/                            #  Architecture, features, data, testing, pages, charts
├── messages/                        # i18n message catalogs (fr/en)
├── public/                          # Static assets, icons, logos, PWA files
├── scripts/                         # Migration and seed scripts
├── src/
│   ├── app/
│   │   ├── [locale]/                # UI routes grouped by role (public/client/station/admin)
│   │   ├── api/
│   │   │   ├── v1/                  # Main versioned business API
│   │   │   ├── cron/                # Protected scheduled job endpoints
│   │   │   ├── docs/                # OpenAPI/Swagger endpoint
│   │   │   └── auth/[...nextauth]/  # NextAuth route
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── manifest.ts
│   ├── components/                  # UI components by domain/role
│   ├── context/                     # React providers (auth, theme, toast, commission)
│   ├── helpers/                     # Shared helpers/constants/concurrency/date
│   ├── i18n/                        # next-intl routing/navigation/request
│   ├── jobs/                        # Job implementations (reminders, cleanup, reports)
│   ├── lib/
│   │   ├── db/
│   │   │   ├── schema/              # Drizzle schemas and relations
│   │   │   └── migrations/          # SQL migrations
│   │   ├── openapi/                 # OpenAPI assembly
│   │   ├── stripe.ts
│   │   ├── jwt.ts
│   │   └── redis*.ts
│   ├── server/                      # Domain services and repositories
│   ├── services/                    # Client-side service adapters
│   ├── types/                       # Shared API/domain types
│   └── validators/                  # Zod validation schemas
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── middleware.ts
├── package.json
└── README.md
```

Route groups `(public)`, `(client)`, `(station)`, `(admin)` do not appear in URLs; only `[locale]` and page path are visible (for example `/fr/stations`, `/en/admin/dashboard`).

## System Overview

Hurryline is a full-stack Next.js application that combines multilingual web UI and a large API surface in one codebase. It follows a layered architecture: route handlers receive and validate requests, domain services orchestrate business logic, repositories interact with PostgreSQL through Drizzle, and provider adapters connect to Stripe, Resend, Firebase, Redis, and Cloudinary.

## Architecture Diagram

```mermaid
flowchart TD
    ClientUser[Client User] -->|Browse and reserve| WebUI[Next.js Web UI]
    StationUser[Station Operator] -->|Operate queue/services| WebUI
    AdminUser[Admin] -->|Govern platform| WebUI

    WebUI -->|HTTP| ApiRoutes[Next.js API Routes /api/v1]
    ApiRoutes -->|Validate + orchestrate| DomainServices[src/server domain services]
    DomainServices -->|Persistence| Drizzle[Drizzle ORM layer]
    Drizzle -->|SQL| Postgres[(PostgreSQL)]

    ApiRoutes --> CronRoutes[/api/cron route handlers]
    CronRoutes --> Jobs[src/jobs]
    Jobs --> DomainServices

    DomainServices --> Stripe[Stripe Connect]
    DomainServices --> Resend[Resend Email]
    DomainServices --> Fcm[Firebase FCM]
    DomainServices --> Redis[Upstash Redis]
    DomainServices --> Cloudinary[Cloudinary]

    Stripe -->|Webhook events| ApiRoutes
```

## Component Breakdown

### Web UI (App Router)

The frontend is locale-prefixed (`/fr`, `/en`) and split into role route groups. Public pages handle discovery and authentication, while protected client/station/admin areas expose operational workflows. Context providers centralize session, toast, theme, and commission state.

### API Routes (`/api/v1`, `/api/cron`)

The platform currently exposes broad API coverage (`/api/v1`) plus protected cron endpoints for background automation. Domain slicing includes auth, stations, station ops, reservations, ratings, support, admin governance, history, and legal content. OpenAPI docs are generated and served at `/api/docs`.

### Domain Services (`src/server/*`)

Business rules are concentrated in service modules (auth, reservations, queue, payments, notifications, admin). Repositories encapsulate data access and reduce route-level coupling. This structure supports both synchronous request flows and asynchronous cron execution.

### Data Access Layer (`src/lib/db/*`)

Persistence is implemented with Drizzle schemas and explicit relations, backed by SQL migrations tracked in source control. Reservation, queue, dispute, and commission-oriented tables are already represented in schema modules.

### External Integrations

- Stripe Connect handles payment intents, webhooks, reimbursements/refunds, and payout-related logic.
- Resend powers transactional email workflows.
- Firebase FCM powers push notifications.
- Upstash Redis supports caching/rate-limiting resilience.
- Cloudinary supports upload storage workflows.

## Technology Decisions

| Decision | Choice | Why | Alternatives considered |
|---|---|---|---|
| Web framework | Next.js (App Router) | Single runtime for UI, API, cron endpoints | Split frontend/backend stack |
| Localization | next-intl | Locale-prefixed routes with predictable i18n setup | next-i18next |
| ORM | Drizzle ORM | Strong SQL control with typed schema | Prisma |
| Validation | Zod | Runtime input guards + TS inference | Yup, Joi |
| Payments | Stripe Connect | Native platform split/payout model | PayPal, Adyen |
| Notifications | Resend + FCM | Email + push coverage | SendGrid + OneSignal |
| Caching/rate-limits | Upstash Redis | Shared distributed store for protection logic | Self-hosted Redis |

## Design Patterns

- **Layered architecture**: UI/routes delegate to services, services delegate to repositories.
- **Domain-first structure**: folders map to product/business boundaries.
- **Boundary validation**: Zod validators at request boundaries.
- **Service/repository split**: business logic isolated from persistence details.
- **Job orchestration**: cron route handlers trigger isolated job modules.

