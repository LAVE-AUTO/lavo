# Deployment

This project is designed to be deployed as a **standalone** Next.js application with PostgreSQL. The target production platform is **Railway**, using **Railway PostgreSQL** (Neon is for development only).

## Deployment Platforms

- Railway (application hosting)
- Railway PostgreSQL (production database)

## Pre-Deployment Checklist

- Environment variables defined (Stripe, email, push, database)
- Stripe Connect configured (test/live as appropriate)
- Webhook endpoint configured and verified
- Database migrations ready to run (Drizzle migrations planned)
- Analytics keys ready (Google Analytics / PageSense)

## Deployment Steps (Railway)

1. Create a Railway project and connect the Git repository.
2. Add a Railway PostgreSQL database and set `DATABASE_URL` to the Railway connection string.
3. Configure environment variables (see `.env.example`).
4. Set the build and start commands:
   - Build: `npm run build`
   - Start: `npm run start`
5. Run migrations during deploy (once Drizzle migrations exist).
6. Configure Stripe webhooks to point to the deployed `/api/v1/webhooks/stripe` endpoint.
7. Validate the deployment using the health endpoint.

## Post-Deployment

- Health check: `/api/v1/health`
- Verify locale routing: `/fr`, `/en`
- Smoke test booking flow (Stripe test mode)
- Monitor logs for webhook failures and notification errors

## Rollback Procedure

Rollback should be performed by redeploying the previous successful build and reverting database migrations when applicable (prefer forward-fix migrations when possible).

## Deployment Pipeline

```mermaid
flowchart TD
    Commit[Commit to main] --> Build[Railway build: npm run build]
    Build --> Start[Railway start: npm run start]
    Start --> Db[Connect Railway PostgreSQL]
    Db --> Migrate[Run migrations (Drizzle planned)]
    Migrate --> Webhook[Configure Stripe webhooks]
    Webhook --> Smoke[Run smoke checks]
    Smoke --> Health[GET /api/v1/health]
    Health --> Ok{Healthy?}
    Ok -->|Yes| Live[Production live]
    Ok -->|No| Rollback[Rollback to last good build]
```

