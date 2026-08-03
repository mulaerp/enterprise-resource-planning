---
name: personas
description: Mula ERP staff/customer personas for role-play end-to-end scenario testing. Use for personas, role-play, scenario testing, seller, buyer, accountant, inventory staff, branch manager, online shop customer, webshop buyer, end-to-end scenario.
---

# Personas

Five **staff** business personas the owner uses for role-play end-to-end testing, each mapped to a real login role (`User.UserRole`: `ADMIN`/`MANAGER`/`ACCOUNTANT`/`INVENTORY`/`CASHIER`, the five-role model — old `USER` was data-migrated to `CASHIER` in `V27__expand_role_model.sql`) and to the app surfaces they'd actually touch, plus one **customer-side** persona (6, below) added once the webshop layer landed. `ADMIN` is the IT/superadmin persona — user management, company/system settings, branding, full audit — and is deliberately **not** one of the five staff business personas below. The whole `@PreAuthorize` matrix lives in `RoleRules.java`; verify any route/role claim below against it and against `frontend/src/App.tsx` before relying on it in a new session.

## 1. Seller — shop staff / cashier (`CASHIER` role)

Lives at the PoS register, `/pos` (`RegisterPage.tsx`). Sells by cash (with change via `amountTendered`), card, e-wallet; applies member discount + voucher stacking (see `pos` skill for the sequential-discount order); sells offline and syncs (`lib/pos-offline.ts`, `pos_sale_queue_v1`); thrift intake at `/pos/intake` (`ProductController POST /products` is `RoleRules.PRODUCT_CREATE` — the one product-master action CASHIER may perform; update/delete/CSV import are stock-writer level, see persona 4); books repair jobs at `/repairs` and advances the lifecycle via `PATCH /repairs/{id}/status`; runs the customer display at `/pos/display` on a second screen (`BroadcastChannel('pos-display')`).

`PosTradeInController` and `RepairJobController` carry **no `@PreAuthorize`** at all; `PosSaleController` is the same for every endpoint **except** void, which is `RoleRules.MANAGER_UP` (see below) — PoS sale creation, trade-ins, repair job create/update/status, and warranty claims (`WarrantyController POST /{id}/claim`) are open to any authenticated staff role, not just CASHIER.

**Now built** (`V29__trade_in_store_credit_repair_parts_payments.sql`): trade-in payout (`POST /api/v1/pos/trade-ins`, `payoutType: CASH | STORE_CREDIT`) and part-exchange (a `tradeIn` sub-object on `CreatePosSaleRequest`, netting against the sale — `netCashDirection`/`netCashAmount`, the shop can end up owing the customer). Member store credit (`members.store_credit_balance`) can be redeemed on a later sale (`storeCreditRedeemed`, clamped/overdraft-guarded). See the `pos` skill for the full discount/credit chain order. **Also built**: PoS sale void/refund (`V34`, `RoleRules.MANAGER_UP` — a cashier can't void their own sale), including a full part-exchange reversal (`V36`) refused only in two narrow unsafe cases — see the `pos` skill's Void & refund section, not "no endpoint" as an older pass here claimed.

## 2. Buyer — customer (anonymous, no login)

The public storefront at `/` and `/shop/item/:sku` (`StorefrontPage.tsx`/`StorefrontItemPage.tsx`, backed by `PublicCatalogController`, `permitAll`) — browses live stock with literal **"WE SELL"** / **"WE BUY"** price labels. Checks a warranty at `/shop/warranty` (`WarrantyCheckPage.tsx` → `PublicWarrantyController`, anonymous lookup by warranty number or serial). At the counter they hand over items to trade in, bring devices for repair, pay by their chosen method, and return later under warranty.

**Repair-status lookup exists at the API level only**: `GET /api/v1/public/repairs/{jobNumber}` (`PublicRepairController`, anonymous) is built, but there is **no storefront page wired to it** yet (only `/shop/warranty` exists as an anonymous lookup page under `/shop/*`) — don't write a UI scenario against a repair-status page until one exists; an API-level check is fine.

## 3. Accountant (`ACCOUNTANT` role)

Owns the books end-to-end, not just a read-only cross-check: journal entries create/update **and post** (`AccountingController POST .../journal-entries/{id}/post` is `RoleRules.ACCOUNTANT_WRITERS` — journal-entry posting is an ACCOUNTANT function now, no longer ADMIN-only), chart of accounts CRUD, invoices, payments, bank import/match (`BankController`, also `ACCOUNTANT_WRITERS`), and financial statements + exports (`FinancialStatementController`, class-level `ACCOUNTANT_WRITERS`, including its GETs).

**Bulk posting**: PoS/invoice/payment/repair hooks fire non-blocking `DRAFT` journal entries automatically (see `accounting` skill) — the ~180-drafts-at-once problem is handled by `GET /accounting/journal-entries/drafts/preview` (grouped preview) and `POST /accounting/journal-entries/post-batch` (all-or-nothing batch post by id list or date range), both `ACCOUNTANT_WRITERS`, so this persona isn't stuck confirming one dialog per entry.

**Reports are real once posted**: `FinancialStatementService` builds P&L and balance sheet directly from `POSTED` journal entries — assert in a scenario that draft-only figures understate the true position until this persona (or MANAGER/ADMIN) actually runs a post/post-batch, not that reports are always current.

Audit-trail attribution is **not** this persona's surface: `AuditController` (`/settings/audit-logs`) is `RoleRules.MANAGER_UP` (MANAGER and up), so ACCOUNTANT cannot view it — that belongs to persona 5.

## 4. Inventory staff (`INVENTORY` role)

Every stock event must have a `StockMovement` row (type, signed delta, reference document, quantity-after — see `inventory` skill). Product UPDATE/DELETE/CSV-import, warehouses CRUD, stock adjustments/transfers/batches/serials, and purchase orders + suppliers are all `RoleRules.STOCK_WRITERS` (INVENTORY/MANAGER/ADMIN). **Stock quantity can no longer be edited directly on the product form** — `ProductFormPage.tsx` disables/`readOnly`s the Stock Quantity field once a product exists; all stock changes must go through `POST /inventory/adjustments` (or transfers/receiving) so a `StockMovement` row is always written. Reconstruct an item's whole life via `GET /inventory/movements/reconcile/{productId}` (`StockMovementsPage.tsx` at `/inventory/movements`). Serial and batch chain of custody through sale → warranty → repair. Stock-take/RECOUNT trail via the `RECOUNT` adjustment type — still just one adjustment-type option, not a dedicated guided stock-take session; verify before assuming a standalone stock-take workflow exists. Exception hunting: negative stock, movement-less stock changes, sold-without-intake, low-stock alerts (`GET /products/low-stock`).

## 5. Branch manager (`MANAGER` role)

The union of every staff role's write powers, plus the oversight-only actions no staff role has on its own: vouchers (`VoucherController POST /vouchers`), currency rate updates (`CurrencyController PUT /{code}`), warranty void (`WarrantyController POST /{id}/void`), audit-log read (`/settings/audit-logs`, now filterable by `entityId`), and customer/member UPDATE+DELETE+CSV-import — all `RoleRules.MANAGER_UP`.

**Oversight is now built** (`/oversight`, `RoleRules.MANAGER_UP`, `OversightController`/`V30__oversight_cash_ups.sql`): a purpose-built hub (`OversightPage.tsx`) links sub-pages — **item trace** (`/oversight/item-trace`, acquisition through to sale/repair/warranty), **money-flow day book** (`/oversight/money-flow`, takings by payment method, cross-checked against POSTED journal entries and flagged on mismatch), **exceptions** (`/oversight/exceptions`: deep discounts, near-price-floor sales, unposted drafts, unreconciled bank lines, stuck repairs, per-cashier totals, voided sales), **cash-up/Z-report** (`/oversight/cash-up`: expected-vs-counted variance per date+payment-method, with a stamped approver), **web orders** (`/oversight/web-orders`, ready/fulfil/cancel/void for online orders — see the `webshop` skill), and **Commercial Terms** (`/oversight/settings`, the runtime warranty-floor settings — see the `repair-warranty` skill's WARRANTY-TIERS section). One oversight-adjacent page is **not** MANAGER-only: **My Day** (`/oversight/my-day`, any authenticated role) is a cashier's own shift-reconciliation report — see the `oversight` skill. Verify against `OversightController`/`OversightMyDayController` before assuming a specific field/endpoint shape, since this module is newer than the rest.

## 6. Online shop customer — webshop buyer (`ROLE_SHOP_CUSTOMER`, no staff login)

Distinct from persona 2 (the anonymous walk-in/counter buyer): this persona **registers an account** (`/shop/register` → `/shop/login`, `MULAERP_SHOP` cookie, `ROLE_SHOP_CUSTOMER` — completely separate from every staff role above, see the `webshop` skill's "Two separate identities" section) and transacts through the online shop specifically — cart (`/shop/cart`), checkout (`/shop/checkout`, guest or signed-in, COLLECT or POST fulfilment), order history (`/shop/account`), postal trade-in quotes (`/shop/trade-in`, **members-only** since 2026-08), and a guest order lookup (`/shop/orders/lookup`) for a buyer who checked out without an account. Registration auto-links an existing loyalty `Member` by matching email, carrying points/store credit over into the new web account from day one.

Five dedicated persona specs cover this journey (`frontend/tests/e2e/personas/`, see "How to run" below and the `webshop` skill for what each proves): `shop-guest-buyer.spec.ts` (no account at all — browse, buy, staff fulfils, guest order lookup), `shop-member-buyer.spec.ts` (register/login, postage checkout, points on fulfilment, warranty check), `shop-trade-in-accepted.spec.ts` and `shop-trade-in-declined.spec.ts` (the postal trade-in quote lifecycle from both outcomes), and `shop-reservation-expiry.spec.ts` (an unpaid reservation releasing stock automatically). A scenario for this persona should assert the same things staff-side scenarios do — stock/ledger/journal effects, not just UI text — plus the cross-boundary check that this persona's cookie/session can never reach a staff endpoint (see the `webshop` skill for the one sub-path, `/api/v1/shop/admin/**`, that depends on per-controller `@PreAuthorize` rather than the path matcher for that boundary).

## How to run a persona scenario

Personas map onto Playwright specs under `frontend/tests/e2e` (47 files: 36 top-level plus 11 dedicated persona scenarios in `frontend/tests/e2e/personas/`). The original six, one per staff persona above minus ADMIN, plus a dedicated repair-journey scenario: `seller.spec.ts`, `buyer.spec.ts`, `accountant.spec.ts`, `inventory.spec.ts`, `branch-manager.spec.ts`, `repair-journey.spec.ts`. Five more cover persona 6, the WEBSHOP online-shop layer, end-to-end (see the `webshop` skill for the module itself): `shop-guest-buyer.spec.ts` (browse → cart → COLLECT checkout → staff fulfils at the counter → revenue+COGS posted and balanced, plus the cross-feature proof that a reserved unit blocks a PoS in-store sale of the same item), `shop-member-buyer.spec.ts` (register/login → postage checkout → account order history → points earned on fulfilment → warranty check), `shop-trade-in-accepted.spec.ts` (quote → staff receive/inspect → customer accepts → staff complete → real trade-in with stock/weighted-average cost/store credit, and the oversight item-trace/money-flow cross-check), `shop-trade-in-declined.spec.ts` (customer declines the final offer → staff return it → no stock/journal effect at all — note this spec's own former "guest quote has no accept/decline path" gap-demonstration test was rewritten once postal trade-in became members-only, since a guest can no longer reach `OFFER_MADE` at all; see the `webshop` skill), and `shop-reservation-expiry.spec.ts` (an unpaid reservation releases stock and the item becomes purchasable again — proves the mechanism via the shared `releaseReservation` code path since the real hours-scale scheduler trigger isn't practical to force in a black-box e2e run; see that spec's header for what was instead verified live). Top-level specs also covering pieces of this skill: `pos.spec.ts`, `pos-display.spec.ts`, `pos-members-vouchers.spec.ts`, `repairs.spec.ts`, `warranties.spec.ts`, `storefront.spec.ts`, `shop-auth.spec.ts`, `shop-orders.spec.ts`, `shop-quotes.spec.ts`, `shop-storefront.spec.ts`, `bank-reconciliation.spec.ts`, `audit-and-admin.spec.ts`, `reports-and-exports.spec.ts`, `accounting.spec.ts`, `inventory.spec.ts`, `users.spec.ts`. Run the suite in Docker (see the `e2e-tests` skill):

```
scripts/run-e2e-docker.sh
```

or manually:

```
docker compose -f compose.yaml -f docker-compose.e2e.yml run --rm playwright
```

Dev seed accounts, all password `admin123`: `admin@mulaerp.com` (ADMIN), `manager@mulaerp.com` (MANAGER), `accountant@mulaerp.com` (ACCOUNTANT), `inventory@mulaerp.com` (INVENTORY), `cashier@mulaerp.com` (CASHIER) — seeded in `V27__expand_role_model.sql`. Create any additional accounts a scenario needs via `POST /api/v1/users` (`UserController`, `ADMIN`-only, `role` field is one of `ADMIN`/`MANAGER`/`ACCOUNTANT`/`INVENTORY`/`CASHIER`) logged in as `admin@mulaerp.com` — don't hand-create users through the UI in a spec when the API call is one request.

Scenarios must assert money, stock, ledger **and** audit effects, not just UI text — e.g. a persona "sells an item" scenario should check the resulting `StockMovement` row, the draft journal entry lines, and the `AuditLog` entry, not just that a success toast appeared.

## Worked figures convention

Use simple round MYR numbers so the accountant persona can verify by hand: bought in RM100 → sold RM250; a repair of part RM40 + labour RM120 → total RM160. Avoid cents/decimals that make manual cross-footing tedious.
