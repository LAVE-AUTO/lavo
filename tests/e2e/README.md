# E2E Tests — Playwright

End-to-end tests for the Lavo application. Tests run against a live Next.js
server and cover the critical user flows from browser interaction to visible
UI result.

## Running tests locally

1. Start the application server:

   ```bash
   npm run dev
   ```

2. Export the required environment variables (see section below).

3. Run the E2E suite:

   ```bash
   npm run test:e2e
   ```

4. Open the interactive Playwright UI (useful for debugging):

   ```bash
   npm run test:e2e:ui
   ```

To target a different server (e.g. a staging deployment):

```bash
PLAYWRIGHT_BASE_URL=https://staging.lavo.cm npm run test:e2e
```

## Required environment variables

| Variable              | Description                              |
|-----------------------|------------------------------------------|
| `PLAYWRIGHT_BASE_URL` | Base URL of the running app (default: `http://localhost:3000`) |
| `E2E_CLIENT_EMAIL`    | Email of the test client account         |
| `E2E_CLIENT_PASSWORD` | Password of the test client account      |
| `E2E_STATION_EMAIL`   | Email of the test station account        |
| `E2E_STATION_PASSWORD`| Password of the test station account     |
| `E2E_ADMIN_EMAIL`     | Email of the test admin account          |
| `E2E_ADMIN_PASSWORD`  | Password of the test admin account       |

Create a local `.env.e2e` file (never commit it) and load it before running:

```bash
export $(cat .env.e2e | xargs) && npm run test:e2e
```

## Activating the CI job

The `e2e` job in `.github/workflows/ci.yml` is disabled (`if: false`) until a
stable staging server is available. To enable it:

1. Provision a persistent staging environment reachable from GitHub Actions.
2. Set `PLAYWRIGHT_BASE_URL` in the workflow to the staging URL.
3. Add the six credential variables above as GitHub repository secrets
   (Settings > Secrets and variables > Actions).
4. Remove or change the `if: false` condition on the `e2e` job.

## Test structure

```
tests/e2e/
  helpers/
    auth.ts       -- loginAs(page, role) helper
    fixtures.ts   -- credential constants and route map
  auth.spec.ts              -- login flows and route guards
  stations.spec.ts          -- public station list and detail pages
  client-history.spec.ts    -- authenticated client history page
  admin-dashboard.spec.ts   -- authenticated admin dashboard page
  station-dashboard.spec.ts -- authenticated station dashboard page
  README.md                 -- this file
```
