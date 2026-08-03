---
name: e2e-tests
description: Run Playwright end-to-end tests for Mula ERP — use for e2e, playwright, end-to-end tests, or run tests in docker.
---

# E2E Tests

Playwright specs for the frontend live in `frontend/tests/e2e`, with shared helpers in `frontend/tests/helpers`. Config is `frontend/playwright.config.ts`. 47 spec files: 36 at the top level (includes `pos.spec.ts`, `pos-display.spec.ts`, `pos-members-vouchers.spec.ts`, `shop-auth.spec.ts`, `shop-orders.spec.ts`, `shop-quotes.spec.ts`, `shop-storefront.spec.ts`, `storefront.spec.ts`, `warranty-tiers.spec.ts`) plus 11 persona scenarios under `frontend/tests/e2e/personas/` (`seller`, `buyer`, `accountant`, `inventory`, `branch-manager`, `repair-journey`, plus five WEBSHOP scenarios — `shop-guest-buyer`, `shop-member-buyer`, `shop-trade-in-accepted`, `shop-trade-in-declined`, `shop-reservation-expiry` — see the `personas` and `webshop` skills). 345 tests on chromium alone as of this pass (`npx playwright test --list --project=chromium`). Test count is per-Chromium-project; multiply by however many browser projects are enabled (see `PLAYWRIGHT_ALL_BROWSERS` below) — get a current count from a fresh run rather than a number recorded here, since it drifts as specs are added.

## Rate limiter — restart backend before a full run

`/api/v1/auth/**` is rate-limited to 300 requests/15min per source IP, tracked in-memory (`RateLimitConfig`, resets only on backend restart). The suite logs in once per test, all sharing one source IP in Docker — comfortably under 300, but if the backend has been up a while and already served other login traffic (manual testing, a previous partial run), restart it first (`docker compose build backend && docker compose up -d backend` in `compose.yaml`, or just `docker compose restart backend`) so the full suite doesn't risk tripping 429s.

## Running in Docker (preferred for CI parity)

Scripted:
```
scripts/run-e2e-docker.sh
```

Or manually:
```
docker compose -f compose.yaml -f docker-compose.e2e.yml run --rm playwright
```

This runs the full stack plus a Playwright container against it — no local Node install needed.

## Running locally

```
cd frontend
npm run test:e2e          # headless, all configured browsers
npm run test:e2e:ui       # interactive UI mode
npm run test:e2e:headed   # headed browser windows
```

Requires the stack already running (see the `run-stack` skill) unless `PLAYWRIGHT_BASE_URL` is unset, in which case Playwright's built-in `webServer` starts the frontend dev server itself.

## Environment knobs

- `PLAYWRIGHT_BASE_URL` — point tests at an already-running stack (e.g. Docker). Setting this switches the config to external-stack mode and disables the built-in `webServer`, so Playwright won't try to spawn its own dev server.
- `PLAYWRIGHT_ALL_BROWSERS=1` — also run the firefox and webkit projects, not just chromium.

## Auth in tests

New specs should log in via the shared helper, not by hand:
```ts
import { login } from '../helpers/auth';

await login(page); // defaults to admin@mulaerp.com / admin123
```

`login()` lives in `frontend/tests/helpers/auth.ts` and handles the full login flow including waiting for redirect to `/dashboard`.

## Routes

Target routes/paths for specs come from `frontend/src/App.tsx` — check the `<Route>` definitions there rather than guessing a URL.

## Reports

HTML report output: `frontend/playwright-report`. Open the last run's report with:
```
npx playwright show-report
```
