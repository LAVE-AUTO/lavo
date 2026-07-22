# Hurryline


Car-wash booking, queue, and payment platform for clients, stations, and admins.

[![Build](https://img.shields.io/badge/build-jest%20%2B%20playwright-blue)](#) [![Version](https://img.shields.io/badge/version-0.1.0-blue)](#) [![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

## Quick Start

Requirement: Node.js **>= 20.9.0**

```bash
npm install
cp .env.example .env
npm run dev
```

- App: `http://localhost:3000/fr` or `http://localhost:3000/en`
- Health check: `http://localhost:3000/api/v1/health`
- API docs: `http://localhost:3000/api/docs`

## Key Features

- Full auth lifecycle (register, login, refresh, verify email, reset password, role checks)
- Station discovery, onboarding, KYC review, profile/config/formats/extras management
- Reservation + queue lifecycle (delays, reschedule, no-show, confirm presence, upgrades)
- Stripe Connect payments, tips, reconciliation, disputes/refunds, commission history
- Notifications (email, push, in-app feed, user notification preferences)
- Admin operations (dashboard analytics, ratings moderation, legal content, support, logs)
- Scheduled jobs for reminders, reconciliations, cleanup, and compliance notifications

## Tech Stack

- Next.js `16.2.4` (App Router), React `19.2.3`, TypeScript `5`
- Tailwind CSS `4`, next-intl `4.8.3`
- PostgreSQL + Drizzle ORM (`53` SQL migrations in repository)
- Stripe, Resend, Firebase Admin/FCM, Cloudinary, Upstash Redis
- Jest + Testing Library + Playwright (`101` unit, `5` integration, `5` e2e tests)

## Deployment Status

[Standalone Application]

- Installation: `docs/INSTALLATION.md`
- Deployment: `docs/DEPLOYMENT.md`

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
