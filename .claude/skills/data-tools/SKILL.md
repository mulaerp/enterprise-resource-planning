---
name: data-tools
description: Mula ERP demo seed data, CSV imports, and database reset/backup. Use for seed, demo data, import csv, reset database, sample data.
---

# Data Tools

## Demo seed (`com.mulaerp.seed.DemoDataSeeder`)

Disabled by default. Enable with `SEED_DEMO_DATA=true` (env var on the `backend` service in `compose.yaml`, maps to `mulaerp.seed.demo-data` in `application.yml`, gated via `@ConditionalOnProperty`). Runs once on backend startup as an `ApplicationRunner`.

- **Idempotent**: the very first check is whether product SKU `DEMO-0001` already exists — if so the whole run is skipped, so leaving the flag on across restarts never duplicates data.
- Seeds **entirely through the normal service layer** (`ProductService`, `CustomerService`, `SalesOrderService`, `PosSaleService`, etc.) — never raw SQL/repository saves — specifically so the audit listener, the stock movement ledger, and the auto-journal hooks all populate exactly as if a human clicked through the UI.
- Seeds (roughly): 2 categories, 15 products (8 thrift with condition/tags/acquisitionCost/hasBox, 7 regular), 8 customers, 3 suppliers, 5 members spread across BASIC/SILVER/GOLD tiers, 3 vouchers (one already expired), 4 sales orders across DRAFT/CONFIRMED/DELIVERED/CANCELLED, 2 purchase orders (one received with a batch, one still SENT), 3 invoices (DRAFT/SENT/paid), 2 PoS sales (one with a member discount, one with a voucher). Verified as of this pass: `DemoDataSeeder` does **not** seed trade-ins, store credit, repair jobs, or cash-ups — those tables start empty even with `SEED_DEMO_DATA=true`; the five per-role dev login accounts (`.claude/skills/run-stack/SKILL.md`) come from `V27__expand_role_model.sql`, not this seeder.
- A seeding failure is caught and logged, never crashes backend startup — an incomplete demo dataset is possible if something upstream breaks, check the backend logs for `[DemoDataSeeder]`.
- All synthetic — `*.example.test` emails, no real names/data.

## CSV imports

Both are tolerant parsers: header row is detected within the first 10 lines (case/whitespace-insensitive column names, any order), unparseable rows are skipped and counted separately from duplicates.

- `POST /products/import` (multipart, `RoleRules.STOCK_WRITERS` — INVENTORY/MANAGER/ADMIN, per `ProductController`) — `ProductCsvParser` expects `sku, name, category, costPrice, unitPrice, stockQuantity` plus optional thrift columns `condition, tags` (semicolon- or pipe-separated, e.g. `jacket;denim`), `acquisitionCost`. Existing SKU → counted as a duplicate and skipped (no update-in-place). Note: `stockQuantity` here seeds *opening* stock via the normal service path — it is not the same thing as the (now-removed) direct-edit path on the product update endpoint, see the `inventory` skill.
- `POST /customers/import` (multipart, `RoleRules.MANAGER_UP` — MANAGER/ADMIN only, per `CustomerController`) — `CustomerCsvParser`. Dedupe checks both within the batch (`emailsSeenThisBatch`) and against existing rows (`findByEmailIgnoreCaseAndDeletedFalse`); either counts as a duplicate and skips the row.
- Both return `{imported, skipped, duplicates, errors[]}` — `skipped` = rows the parser couldn't read at all, `duplicates` = rows that parsed fine but matched an existing/in-batch record.

## Database reset

`docker compose down -v` removes the `postgres-data`/`valkey-data` volumes — full reset. On the next `docker compose up`, Flyway reapplies every migration from scratch, and `DemoDataSeeder` reseeds if `SEED_DEMO_DATA=true` is still set. See the `run-stack` skill for the full command sequence.

## DB backup

`db-backup` service in `compose.yaml` is **not started by default** — it's behind `profiles: ["backup"]`. Activate with:
```
docker compose --profile backup up -d
```
It runs `pg_dump` every 24h into `./postgres_backups/`, pruning anything older than 7 days.
