# Mula ERP — CLAUDE.md

## Project overview
Mula ERP: a full-stack ERP + B2C storefront/webshop (products, customers,
suppliers, sales/purchase orders, invoicing, payments, accounting, inventory,
notifications, point of sale, repairs & warranty, trade-in/store credit,
oversight, an online shop with its own customer accounts, and a runtime
commercial-terms settings store). **Local-only — no remote/deployed
environment.** Re-verify against live code before repeating a specific number
(migration count, test count) if time has passed since this pass (2026-08-02).

## Stack
- **Frontend**: React 19, Vite 7, TypeScript 5.9, Tailwind CSS 4, React Router 7,
  React Hook Form, Axios, Recharts, SockJS + STOMP (WebSocket client).
- **Backend**: Spring Boot 3.4, Java 21, Maven. Spring Security + JWT, Spring Data
  JPA/Hibernate, Spring Data Redis, Flyway, springdoc-openapi, Actuator, Lombok.
- **Data**: PostgreSQL 16 (`postgres:16-alpine`), Valkey 7.2 (`valkey/valkey:7.2-alpine`).
- **Orchestration**: Docker Compose (`compose.yaml`) — frontend, backend,
  postgres, valkey; `ollama` behind the `ai` profile, `db-backup` behind
  `backup` (neither starts with a plain `docker compose up`).

## How to run
No local Java/Maven — the backend builds and runs only inside Docker.
```bash
docker compose up --build      # frontend + backend + postgres + valkey
```
Frontend-only local dev: `cd frontend && npm run dev`.

- **Storefront/webshop** (anonymous or shop-customer): http://localhost:5173/
  — same Vite app, routed outside `ProtectedRoute` (`frontend/src/App.tsx`).
  Anonymous browsing → `/api/v1/public/**`; signed-in shop-customer actions
  (cart/checkout/account/trade-in quotes) → `/api/v1/shop/**`.
- **Staff app**: http://localhost:5173/login → `/dashboard` onward, wrapped
  in `ProtectedRoute`.
- Backend API http://localhost:8080 (`/api/v1`); Swagger UI at
  `/swagger-ui.html`; Actuator at `/actuator`.
- Dev login (local only): `admin@mulaerp.com` / `admin123` (ADMIN), plus
  `manager@`/`accountant@`/`inventory@`/`cashier@mulaerp.com`, one per role
  (`V27__expand_role_model.sql`). A shop-customer account is separate,
  self-registered via `/shop/register` — not one of these.

## Two auth systems — never confuse them
Staff and shop-customer identity are **completely separate**, both directions:

| | Staff | Shop customer |
|---|---|---|
| Cookie | `MULAERP_AUTH` (httpOnly) | `MULAERP_SHOP` (httpOnly) |
| Filter | `JwtAuthenticationFilter` | `ShopCustomerAuthenticationFilter` (scoped to `/api/v1/shop/**` only — a shop cookie is never parsed for a staff endpoint) |
| Authority | `ROLE_ADMIN/MANAGER/ACCOUNTANT/INVENTORY/CASHIER` | exactly `ROLE_SHOP_CUSTOMER` |
| Login | `POST /api/v1/auth/login` | `POST /api/v1/shop/auth/register` then `/login` |

`SecurityConfig` requires `hasRole('SHOP_CUSTOMER')` on the blanket
`/api/v1/shop/**` matcher, so a staff-authenticated request is rejected there
too. **Gotcha**: `/api/v1/shop/admin/**` is only `authenticated()` at the
matcher level — the boundary is enforced per-controller via `@PreAuthorize`
(a `RoleRules` staff constant), not the path matcher. A new controller there
**must** carry its own `@PreAuthorize` or a shop customer can reach it (a
real, now-fixed gap — see the `webshop` skill). Web accounts auto-link to an
existing loyalty `Member` by matching email at registration.

## E2E testing
- Local (backend already reachable on `:8080`): `cd frontend && npm run
  test:e2e` (also `test:e2e:ui`, `test:e2e:headed`, `test:e2e:debug`);
  `scripts/run-e2e-tests.sh` wraps this with a health check + mode selection.
- Docker: `scripts/run-e2e-docker.sh` (chromium only; `PLAYWRIGHT_ALL_BROWSERS=1`
  for firefox/webkit, `KEEP_STACK=1` to keep the container). 47 spec files
  (36 top-level + 11 persona scenarios, `frontend/tests/e2e/**` — see the
  `personas` skill), 345 tests on chromium alone (measured via `npx
  playwright test --list --project=chromium`) — get a fresh count rather
  than trusting a number recorded here.
- `PLAYWRIGHT_BASE_URL` switches `playwright.config.ts` to external-stack
  mode (disables its built-in `webServer`).

## Key layout
- `frontend/src/pages/<domain>` — one folder per feature area (accounting,
  auth, customers, dashboard, inventory, invoice, payment, products,
  purchase, reports, sales, settings (incl. `CommercialTermsPage.tsx`),
  suppliers, users, pos, repair, warranty, public, shop, oversight).
- `frontend/src/lib/api.ts` — staff Axios client (`MULAERP_AUTH`); a separate
  `frontend/src/lib/shop-api.ts` backs the webshop (`MULAERP_SHOP`) — don't
  mix the two up.
- `frontend/src/contexts/` — `AuthContext.tsx` (staff), `ShopAuthContext.tsx`
  (shop customer, `GET /api/v1/shop/auth/me`), `WebSocketContext.tsx`,
  `CurrencyContext.tsx`.
- `backend/src/main/java/com/mulaerp/<module>` — one package per domain:
  accounting, auth, customer, inventory, invoice, payment, product, purchase,
  sales, supplier, notifications, email, reports, analytics, company, audit,
  websocket, common, util, seed, `publicapi` (anonymous storefront +
  repair-status endpoints), `repair`, `warranty`, `pos` (incl. trade-ins),
  `member` (incl. store credit), `voucher`, `currency`, `banking`,
  `oversight` (item trace/money-flow/exceptions/cash-up — MANAGER/ADMIN),
  `shop` (customer accounts, orders/reservations, postal trade-in quotes,
  dormant payment-gateway scaffold — see `webshop` skill), `settings`
  (runtime commercial-terms key/value store).
- `backend/src/main/resources/db/migration/` — Flyway migrations, currently
  up to **V44** (gaps at V4–V9, V28, V33 — verify with `ls db/migration`
  before numbering a new one). **Never edit an already-applied migration**;
  add `V<next>__description.sql` after the current highest version on disk.
- `backend/src/test/java/com/mulaerp/it/` — 13 integration tests across 6 IT
  classes (auth, context boot, inventory, optimistic locking, PoS, sales)
  plus 9 unit tests elsewhere (22 total) — see Checks below.

## Roles
Five roles: `ADMIN`, `MANAGER`, `ACCOUNTANT`, `INVENTORY`, `CASHIER` (old
`USER` data-migrated to `CASHIER`, `V27`), plus the webshop-only
`ROLE_SHOP_CUSTOMER` (never mix with the five staff roles — see auth systems
above). `RoleRules.java` (`com.mulaerp.auth.security`) is the single source
of truth for the `@PreAuthorize` matrix (full capability table in its class
javadoc) — controllers reference its constants (`ADMIN_ONLY`, `MANAGER_UP`,
`ACCOUNTANT_WRITERS`, `STOCK_WRITERS`, `PRODUCT_CREATE`,
`CUSTOMER_MEMBER_CREATE`, `SHOP_ORDER_STAFF`, `ANY_STAFF_ROLE`), not ad-hoc
`hasRole`/`hasAnyRole` literals. Journal posting is an ACCOUNTANT function
(not ADMIN-only); audit-log read/vouchers/currency rates/warranty
void/web-order cancel+void/runtime settings are MANAGER-and-up; product
CREATE is open to CASHIER, product UPDATE/DELETE/CSV-import needs
INVENTORY-and-up.

## Conventions
- Backend env: `DATABASE_HOST/PORT/NAME/USER/PASSWORD`, `REDIS_HOST/PORT/PASSWORD`,
  `jwt.secret` (env `JWT_SECRET`)/`jwt.expiration` (`application.yml`).
  Frontend `VITE_API_BASE_URL` **must include `/api/v1`** — falls back to
  `http://localhost:8080/api/v1` if unset (`frontend/src/lib/api.ts`).
- `SecurityConfig` requires auth on everything except `/api/v1/auth/**`,
  `/api/v1/health`, `/api/v1/public/**` (with `/api/v1/public/shop/quotes/**`
  carved out `denyAll()` — members-only trade-in quotes, see `webshop`
  skill), actuator health, swagger, `/ws/**`. Check `@PreAuthorize` (via
  `RoleRules`) before assuming an endpoint is open. **Public API rule**:
  `com.mulaerp.publicapi` must never leak cost price, raw stock counts, or
  internal IDs beyond SKU (`PublicProductDto`, `PublicCatalogService#toPublicDto`).
- **Stock mutations**: any path changing stock quantity must write a
  `StockMovement` row in the same transaction; `Product.stockQuantity` isn't
  directly editable via the product update endpoint. 14 movement types (Java
  enum + `chk_stock_movements_type` kept in sync): `ADJUSTMENT, TRANSFER_OUT,
  TRANSFER_IN, POS_SALE, SO_DELIVERY, PO_RECEIPT, RECOUNT, TRADE_IN_RECEIPT,
  REPAIR_PART_CONSUMED, SALE_VOID, TRADE_IN_VOID, SHOP_RESERVE,
  SHOP_RELEASE, SHOP_VOID`. Negative-result adjustments are rejected (400).
- **Draft journal gotcha**: P&L/balance sheet/trial balance only count
  `POSTED` entries. PoS/invoice/payment/repair/web-order hooks
  **auto-post immediately by default** (`AUTO_POST_SYSTEM_ENTRIES`, default
  `true`) — the one remaining `DRAFT` source is a **manually created** entry,
  which always needs an explicit post or the bulk drafts-preview/post-batch
  flow (`ACCOUNTANT_WRITERS`).
- **Warranty floor rule**: a PoS sale and a web-order fulfilment both issue
  AT LEAST a guest/member channel-base-days warranty (`warranty.guest-base-days`
  default 3, `warranty.member-base-days` default 10 — by whether a loyalty
  member is attached), even for a product with no `warrantyMonths`. It's a
  **floor, never a replacement**: cover = `MAX(product warrantyMonths as a
  date, channel base days)`. One shared helper,
  `WarrantyService#resolveDuration`, backs both call sites.
- **Runtime settings vs `application.yml`**: `app_settings` (V44,
  `com.mulaerp.settings`, `GET`/`PUT /api/v1/settings`, `MANAGER_UP`) is a
  small, cached, audit-logged key/value store for branch-manager-editable
  values needing no redeploy — today the two warranty base-days keys, via
  "Commercial Terms" (`/oversight/settings`,
  `frontend/src/pages/settings/CommercialTermsPage.tsx`). Everything else
  (Flyway ordering, cookie security, CORS, rate limits, webshop/AI/payment
  knobs) stays a compile-time `application.yml` property. Extend
  `app_settings`, not `application.yml`, for anything manager-editable.
- **Flyway ordering**: `spring.flyway.out-of-order` is
  `${FLYWAY_OUT_OF_ORDER:false}` — safe by default, so prod/test fails loudly
  on an out-of-order migration unless explicitly opted in. `compose.yaml`'s
  `backend` service sets it `true` for local dev only (V42/V43 landed out of
  numeric order across parallel sessions) — don't copy that dev default into
  a non-Docker deploy path.
- Brand accent colour: `brand-*` Tailwind classes only for action/accent
  elements; leave `slate-*`/status colours literal `blue-*` (see
  `.claude/skills/branding/SKILL.md`). Error responses share one shape:
  `{timestamp, status, error, message, path, fieldErrors?}` (`GlobalExceptionHandler`).

## Known constraints
- Currency rates auto-refresh from a free public FX API, not a paid/authoritative
  source — a manual override wins for the rest of the day it was set.
- A part-exchange PoS sale void (`V36`) refuses (409) only in two narrow cases:
  the traded-in item already moved on (resold/consumed/transferred/adjusted),
  or the member already spent the store credit being clawed back — not a
  blanket "part-exchanges can't be voided" limitation. Reverse the affected
  leg manually first, then void normally.
- The oversight money-flow day book's headline revenue/COGS/payment-method
  figures still don't attribute anything to fulfilled web orders (only its
  posted-journal cross-check counts them) — see the `webshop` skill.
- The payment-gateway scaffold is dormant (`payment.gateway.enabled=false`)
  — every webhook call 501s; no real Stripe/Fiuu/Billplz integration exists.

## Checks
- `make check` — backend tests + frontend lint/typecheck; the pre-push gate.
  Does **not** include the Playwright e2e suite.
- `make backend-test` — 22 tests total against a throwaway Postgres + Valkey
  in Docker (`scripts/run-backend-tests.sh`); never touches the live stack.
- `make e2e` — Playwright suite, dockerized (`scripts/run-e2e-docker.sh`);
  not in `make check` (needs the full stack up, noticeably slower).
- `./scripts/install-hooks.sh` points git at `.githooks/` so `make check`
  runs pre-push. Opt-in — run once per clone.
- **Gotcha**: restart the backend before a full Playwright run — the auth
  rate limiter (300 req/15min/IP, in-memory) resets only on restart and can
  trip 429s if the backend already served other login traffic.
- **Gotcha**: avoid running `make backend-test` at the same time as a
  Playwright run — not code-enforced, just practical: both are Docker/CPU-heavy
  and can starve each other on a typical dev machine.
