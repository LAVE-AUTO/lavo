# LAVO Charts Provider

## System Architecture
**Purpose**: High-level components and external integrations

```mermaid
flowchart TD
    ClientUser[Client User] -->|Browse and book| WebUI[Next.js Web UI]
    StationUser[Station User] -->|Manage slots and validate| WebUI
    AdminUser[Super Admin] -->|Govern platform| WebUI

    WebUI -->|Calls| ApiRoutes[Next.js API Routes /api/v1]
    ApiRoutes -->|Delegates| DomainServices[Domain Services src/server]
    DomainServices -->|Reads/Writes| DataLayer[Data Access Layer (Drizzle planned)]
    DataLayer -->|SQL| Postgres[(PostgreSQL)]

    DomainServices -->|Payments| Stripe[Stripe Connect]
    DomainServices -->|Email| Resend[Resend]
    DomainServices -->|Push| Fcm[Firebase FCM]
    WebUI -->|Navigation link| Maps[Google Maps]
    WebUI -->|Tracking via metas| Analytics[Google Analytics / PageSense]

    CronJobs[Cron / Scheduled Tasks] -->|Reminders, queue switch| DomainServices
    Stripe -->|Webhooks| ApiRoutes
```

**Usage**: Reference in `docs/ARCHITECTURE.md`

## Domain Interaction Map
**Purpose**: How business domains coordinate

```mermaid
flowchart TD
    Stations[Stations] --> Reservations[Reservations]
    Reservations --> Payments[Payments]
    Payments --> Notifications[Notifications]

    Reservations --> Queue[Queue/Late handling]
    Queue --> NoShow[No-show fees]
    Queue --> Notifications

    Reservations --> History[History]
    Payments --> History

    Reservations --> Ratings[Ratings]
    Ratings --> Stations

    Admin[Admin] --> Kyc[KYC approvals]
    Admin --> Disputes[Disputes/Refunds]
    Admin --> Commission[Commission settings]
    Admin --> Support[Support tickets]
    Admin --> Logs[Admin logs]

    Kyc --> Stations
    Disputes --> Payments
    Commission --> Payments
    Support --> Notifications
```

**Usage**: Reference in `docs/ARCHITECTURE.md` and `docs/FEATURES.md`

## Main User Journey
**Purpose**: Client booking flow end-to-end

```mermaid
flowchart TD
    Visitor[Visitor] --> AuthRegister[Create account]
    AuthRegister --> AuthVerify[Email verification]
    AuthVerify --> AuthLogin[Session established]

    AuthLogin --> StationList[Stations listing]
    StationList --> StationDetail[Station details]
    StationDetail --> VehicleFormat[Vehicle format]
    VehicleFormat --> SlotSelect[Time slot selection]
    SlotSelect --> StripeCheckout[Stripe payment]
    StripeCheckout --> BookingConfirmed[Reservation confirmed]

    BookingConfirmed --> Reminder5h[Push reminder (5h)]
    BookingConfirmed --> Reminder30m[Push reminder (30m)]
    Reminder30m --> Presence[Presence confirmation]
    Reminder30m --> LateFlow[Late tolerance]
    LateFlow --> Queue[Queue switch]

    Presence --> Completed[Service completed]
    Completed --> Rating[Rating]
    Completed --> Tip[Tip (optional)]
    Completed --> History[History and receipts]
```

**Usage**: Reference in `docs/FEATURES.md`

## Booking Sequence (API interactions)
**Purpose**: Typical request/response interactions during booking

```mermaid
sequenceDiagram
    participant Client as Client UI
    participant API as API (/api/v1)
    participant DB as PostgreSQL
    participant Stripe as Stripe Connect

    Client->>API: GET /stations (search/filter)
    API->>DB: Query active stations + availability
    DB-->>API: Stations list
    API-->>Client: 200 OK

    Client->>API: POST /reservations (slot + format)
    API->>DB: Lock slot row and validate capacity
    DB-->>API: Slot reserved (pending_payment)
    API->>Stripe: Create PaymentIntent
    Stripe-->>API: PaymentIntent created
    API-->>Client: Client secret

    Stripe-->>API: Webhook payment_succeeded
    API->>DB: Mark reservation confirmed + increment booked_count
    API-->>Client: Push/email triggered asynchronously
```

**Usage**: Reference in `docs/FEATURES.md`

## Reservation State Model
**Purpose**: Reservation lifecycle states described in the technical spec

```mermaid
stateDiagram-v2
    [*] --> pending_payment
    pending_payment --> confirmed
    confirmed --> client_confirmed
    confirmed --> cancelled
    client_confirmed --> completed
    confirmed --> late
    late --> completed
    late --> no_show
    cancelled --> [*]
    completed --> [*]
    no_show --> [*]
```

**Usage**: Reference in `docs/FEATURES.md`

## ER Diagram
**Purpose**: Core entities and relationships

```mermaid
erDiagram
    USERS ||--o{ EMAIL_VERIFICATION_TOKENS : has
    USERS ||--o{ RESERVATIONS : makes
    USERS ||--o{ RATINGS : writes
    USERS ||--o{ SUPPORT_TICKETS : opens

    ADMINS ||--o{ COMMISSION_SETTINGS : sets
    ADMINS ||--o{ ADMIN_LOGS : writes
    ADMINS ||--o{ SUPPORT_TICKETS : assigned_to
    ADMINS ||--o{ STATIONS : approves

    STATIONS ||--|| STATION_CONFIGS : has
    STATIONS ||--o{ VEHICLE_FORMATS : defines
    STATIONS ||--o{ TIME_SLOTS : owns
    STATIONS ||--o{ RESERVATIONS : receives
    STATIONS ||--o{ RATINGS : receives
    STATIONS ||--o{ NOTIFICATIONS : receives

    TIME_SLOTS ||--o{ RESERVATIONS : contains
    VEHICLE_FORMATS ||--o{ RESERVATIONS : priced_by
    RESERVATIONS ||--o{ NOTIFICATIONS : emits
    RESERVATIONS ||--|| RATINGS : rated_by
    RESERVATIONS ||--o| NO_SHOW_FEES : may_create
```

**Usage**: Reference in `docs/DATABASE.md`

## Site Navigation Map
**Purpose**: Page hierarchy and protected areas

```mermaid
flowchart TD
    Home[Home] --> Stations[Stations]
    Stations --> StationDetail[Station details]
    StationDetail --> Booking[Booking entry]

    Home --> Login[Login]
    Home --> Register[Register]

    Login --> ClientDash[Client dashboard]
    Login --> StationDash[Station dashboard]
    Login --> AdminDash[Admin dashboard]

    ClientDash --> ClientRes[Client reservations]
    ClientRes --> ResDetail[Reservation details]
    ClientDash --> ClientHist[Client history]
    ClientDash --> ClientSupport[Client support]

    StationDash --> StationRes[Station reservations]
    StationDash --> StationQueue[Station queue]
    StationDash --> StationCfg[Station config]
    StationDash --> StationFormats[Station formats]
    StationDash --> StationQr[Station QR]

    AdminDash --> AdminStations[Admin stations]
    AdminDash --> AdminClients[Admin clients]
    AdminDash --> AdminDisputes[Admin disputes]
    AdminDash --> AdminSupport[Admin support]
    AdminDash --> AdminFin[Admin commission/transactions]
    AdminDash --> AdminLogs[Admin logs]
```

**Usage**: Reference in `docs/PAGE_LISTING.md`

