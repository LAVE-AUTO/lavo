# Hurryline Charts Provider

## System Architecture
**Purpose**: High-level component structure and provider integrations

```mermaid
flowchart TD
    ClientUser[Client User] -->|Browse and reserve| WebUI[Next.js Web UI]
    StationUser[Station Operator] -->|Manage operations| WebUI
    AdminUser[Admin] -->|Govern platform| WebUI

    WebUI -->|HTTP| ApiRoutes[API routes /api/v1]
    ApiRoutes --> DomainServices[Domain services src/server]
    DomainServices --> Drizzle[Drizzle ORM]
    Drizzle --> Postgres[(PostgreSQL)]

    ApiRoutes --> CronRoutes["/api/cron routes"]
    CronRoutes --> Jobs[src/jobs]
    Jobs --> DomainServices

    DomainServices --> Stripe[Stripe Connect]
    DomainServices --> Resend[Resend]
    DomainServices --> Fcm[Firebase FCM]
    DomainServices --> Redis[Upstash Redis]
    DomainServices --> Cloudinary[Cloudinary]

    Stripe -->|Webhook events| ApiRoutes
```

**Usage**: Reference in `docs/ARCHITECTURE.md`

## Domain Interaction Map
**Purpose**: Major domain dependencies

```mermaid
flowchart TD
    Auth[Auth] --> Users[Users]
    Stations[Stations] --> Reservations[Reservations]
    Reservations --> Queue[Queue Operations]
    Reservations --> Payments[Stripe Payments]
    Payments --> Disputes[Disputes/Refunds]
    Reservations --> Ratings[Ratings]
    Reservations --> Notifications[Notifications]
    Admin[Admin Governance] --> Stations
    Admin --> Disputes
    Admin --> Commission[Commission Settings]
    Admin --> Support[Support]
    Support --> Notifications
```

**Usage**: Reference in `docs/ARCHITECTURE.md` and `docs/FEATURES.md`

## Main User Journey
**Purpose**: End-to-end client path

```mermaid
flowchart TD
    Visitor --> Register
    Register --> VerifyEmail
    VerifyEmail --> Login
    Login --> DiscoverStations
    DiscoverStations --> StationDetail
    StationDetail --> Booking
    Booking --> Payment
    Payment --> ReservationConfirmed
    ReservationConfirmed --> Reminder
    Reminder --> ConfirmPresence
    ConfirmPresence --> ServiceDone
    ServiceDone --> RateAndTip
```

**Usage**: Reference in `docs/FEATURES.md`

## Reservation State Model
**Purpose**: Reservation lifecycle

```mermaid
stateDiagram-v2
    [*] --> pending
    pending --> confirmed
    confirmed --> client_confirmed
    confirmed --> cancelled
    confirmed --> late
    late --> in_progress
    late --> no_show
    client_confirmed --> in_progress
    in_progress --> completed
    completed --> [*]
    no_show --> [*]
    cancelled --> [*]
```

**Usage**: Reference in `docs/FEATURES.md`

## Booking Sequence
**Purpose**: Typical API sequence for reservation creation

```mermaid
sequenceDiagram
    participant UI as Client UI
    participant API as API /api/v1
    participant DB as PostgreSQL
    participant Stripe as Stripe

    UI->>API: POST /reservations
    API->>DB: Validate slot/capacity
    DB-->>API: Slot available
    API->>Stripe: Create payment intent
    Stripe-->>API: Client secret
    API-->>UI: Reservation + payment data

    Stripe-->>API: webhook payment_succeeded
    API->>DB: Confirm reservation + store financial fields
    API->>API: Trigger notifications
```

**Usage**: Reference in `docs/FEATURES.md`

## Core ER Diagram
**Purpose**: Data relationships at a glance

```mermaid
erDiagram
    USERS ||--o{ RESERVATIONS : books
    STATIONS ||--o{ RESERVATIONS : receives
    TIME_SLOTS ||--o{ RESERVATIONS : schedules
    RESERVATIONS ||--o| RATINGS : has
    RESERVATIONS ||--o| RESERVATION_TIPS : has
    RESERVATIONS ||--o| NO_SHOW_FEES : has
    RESERVATIONS ||--o{ DISPUTES : may_raise
    USERS ||--o{ SUPPORT_TICKETS : opens
    USERS ||--o{ USER_NOTIFICATIONS : receives
```

**Usage**: Reference in `docs/DATABASE.md`

## Navigation Map
**Purpose**: Frontend route hierarchy by role

```mermaid
flowchart TD
    Home --> Public[Public pages]
    Home --> ClientArea[Client area]
    Home --> StationArea[Station area]
    Home --> AdminArea[Admin area]

    ClientArea --> ClientRes[Reservations]
    ClientArea --> ClientHist[History]

    StationArea --> StationQueue[Queue]
    StationArea --> StationCfg[Config]

    AdminArea --> AdminStations[Stations]
    AdminArea --> AdminDisputes[Disputes]
    AdminArea --> AdminLogs[Logs]
```

**Usage**: Reference in `docs/PAGE_LISTING.md`
