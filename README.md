# Hurryline

Car wash station booking and payments platform.

[![Build](https://img.shields.io/badge/build-planned-lightgrey)](#) [![Version](https://img.shields.io/badge/version-0.1.0-blue)](#) [![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

## Quick Start

Requirement: Node.js **>= 20.9.0**

```bash
npm install
cp .env.example .env
npm run dev
```

- App: `http://localhost:3000/fr` or `http://localhost:3000/en`
- Health check: `http://localhost:3000/api/v1/health`

## Key Features

- Station discovery (listing, search, detail)
- Slot-based reservations with capacity handling
- Stripe Connect payments (commission split, payouts, refunds, tips)
- Notifications (email via Resend, push via Firebase FCM)
- Late handling with queue switch and no-show fees (planned)
- Admin governance (KYC, disputes, commission settings, audit logs)

## Tech Stack

- Next.js 16.1.6 (App Router), React 19.2.3, TypeScript 5
- Tailwind CSS v4, next-intl (fr/en)
- PostgreSQL (Neon for development; Railway PostgreSQL for production)
- Drizzle ORM, Zod, Axios

## Deployment Status

[Standalone Application]

- Installation: see `docs/INSTALLATION.md`
- Deployment: see `docs/DEPLOYMENT.md`

## Documentation

- `docs/PROJECT_SUMMARY.md`
- `docs/ARCHITECTURE.md`
- `docs/FEATURES.md`
- `docs/DATABASE.md`
- `docs/TESTING_STRATEGY.md`
- `docs/PAGE_LISTING.md`
- `docs/CHARTS_PROVIDER.md`

## License & Contributing

- License: `LICENSE`
- Contributing: `CONTRIBUTING.md`

## Developed By

### Leroi Kakatsi - Fullstack & Mobile developer

- Email: [leroi.kakatsi@epitech.eu](mailto:leroi.kakatsi@epitech.eu)
- WhatsApp: [+233 53 561 0908](https://wa.me/233535610908)
- Portfolio: [king-kakatsi.netlify.app](https://king-kakatsi.netlify.app)

### Valence Odounbourou
- **Email**: valence.odounbourou@epitech.eu
- **WhatsApp**: [+229 01 61 40 50 56](https://wa.me/22961405056)
- **Portfolio**: [valenceod61.vercel.app](https://personnal-project-bice.vercel.app/)

### Lauret Chacha - Fullstack developer
- **Email:** lauret.chacha@epitech.eu
- **WhatsApp:** [+229 01 62 16 66 38](https://wa.me/22961405056)
- **Portfolio:** [lauret-chacha.vercel.app](https://lauret-chacha.vercel.app)
