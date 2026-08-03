---
name: repair-warranty
description: Mula ERP repair jobs and warranty — status lifecycle, parts consumption/COGS, payments, and in-house warranty issue/claim/void. Use for repair, repair job, warranty, warranty claim, warranty void, repair parts, repair payment, workmanship warranty.
---

# Repair & Warranty

Backend: `com.mulaerp.repair` (`RepairJobController`/`RepairJobService`), `com.mulaerp.warranty` (`WarrantyController`/`WarrantyService`), plus `PublicRepairController`/`PublicWarrantyController` under `com.mulaerp.publicapi` for anonymous lookups. Frontend: `frontend/src/pages/repair/*`, `frontend/src/pages/warranty/*`, routes under `/repairs/*` and `/warranties/*` in `App.tsx`.

## Repair job lifecycle (`RepairJob.RepairStatus`)

`RECEIVED → DIAGNOSED → AWAITING_APPROVAL → APPROVED → IN_REPAIR → COMPLETED → COLLECTED`, with `CANCELLED` reachable from `DIAGNOSED`/`APPROVED`/`IN_REPAIR`. Forward-only — `RepairJobService` enforces the transition map, an invalid transition is a 409. `promised_date` and `approved_at` (`V29`) are stamped along the way. `RepairJobController` (`/api/v1/repairs`) carries **no `@PreAuthorize`** — create/update/status-advance/parts/payments are open to any authenticated staff role, not gated to a specific one.

## Parts (`repair_parts`, `V29`)

`POST /repairs/{id}/parts` adds a part (product + quantity + unit cost snapshot) — only allowed before the job enters `IN_REPAIR` (`RepairJobService`'s guard, 409 otherwise). Stock is **not** decremented when a part is added; it's decremented exactly once, at the `IN_REPAIR` transition (`#consumePartsForRepair`), writing a `REPAIR_PART_CONSUMED` stock movement per line. If the job is later cancelled back out of `IN_REPAIR`, the same movement type reverses with a positive delta (`#reverseConsumedParts`) — `current == IN_REPAIR` at cancel time is what tells the code consumption already happened, since `IN_REPAIR` is only ever entered once.

Parts post a non-blocking `Dr COGS 5100 / Cr Inventory 1130` journal for the total **unconditionally — even for a warranty claim** (the shop bears the parts cost either way); a cancellation posts the reversing entry. Both use `NonBlockingHookExecutor` — a failure here never blocks the parts/status operation.

## Payments (`repair_payments`, `V29`)

`POST /repairs/{id}/payments` — `amountType` (deposit/balance/full) × `paymentMethod` (`CASH | CARD | EWALLET | STORE_CREDIT`), accumulating towards `totalCost`. Transitioning to `COLLECTED` is rejected (409) until payments cover the total — **except** for a warranty claim, whose `totalCost` is always 0, so it's never payment-blocked. At `COLLECTED`, a non-blocking Service Revenue journal posts for a paid job (never for a warranty claim), debiting the cash/clearing account resolved from the payment's own method via `CashAccountResolver` (1111/1112/1113/2140 — see the `accounting` skill's "Cash/clearing account split" section), not a hardcoded account. A refund against a payment credits back the same resolved account.

## Warranty auto-issue at collection

`mulaerp.repair.warranty-months` (default `1`; `0`/unset disables it) — at `COLLECTED`, a workmanship warranty is auto-issued non-blocking via `WarrantyService` (injected through `ObjectProvider` to break a circular dependency between the two services), linked back via `warranties.repair_job_id` (`V29`) — distinct from `repair_jobs.warranty_id`, which points the other way (the in-house warranty that was *claimed* to spawn a repair job in the first place, via `WarrantyController POST /{id}/claim`).

## Warranty (`com.mulaerp.warranty`)

In-house warranty is also auto-issued from a product's `warrantyMonths` on PoS sale, on sales-order delivery of serialised items, and (V42, WEBSHOP Gap B) on a web order's fulfilment (`ShopOrderService#fulfilOrder` → `WarrantyService#autoIssueForShopOrderLine`, one per unit, reusing this same service rather than duplicating the logic — see the `webshop` skill for the online-purchase attribution rules, including how a GUEST's warranty is attributed via `warranties.shop_order_id`) (unrelated to the workmanship-warranty path above). `WarrantyController`: claim/void/list/detail are open to any authenticated user **except** `POST /{id}/void`, which is `MANAGER`+ (`RoleRules.MANAGER_UP`). Public, anonymous lookup by warranty number or serial: `GET /api/v1/public/warranties/**` (`PublicWarrantyController`), consumed by `WarrantyCheckPage.tsx` at `/shop/warranty`.

## WARRANTY-TIERS (V44): guest/member floor + runtime Commercial Terms

**OWNER DECISIONS (both confirmed):** guest (non-member) buyers get a SHORT base warranty
(`warranty.guest-base-days`, default 3 days); members get a LONGER one
(`warranty.member-base-days`, default 10 days) as a loyalty incentive to register. Applies
UNIFORMLY to PoS and web-order fulfilment. **The channel base is a FLOOR, never a replacement**:
effective cover = `MAX(product warrantyMonths converted to a date, channel base days)` — a 6-month
product warranty is never shortened to 10 days. **Deliberate behaviour change**: a product with no
`warrantyMonths` at all — previously issued no warranty at all — now always gets the channel
base-days floor.

`com.mulaerp.settings` (V44, `app_settings` table) is a runtime-editable key/value store —
`GET`/`PUT /api/v1/settings` (`RoleRules.MANAGER_UP`), typed (`STRING|INT|DECIMAL|BOOLEAN`),
`SettingsService`'s small in-memory cache (invalidated on write, never re-read from the DB on a
warranty issue) with a safe compile-time-default fallback (logged as a warning, never a 500) if a
row is missing or malformed. Extends `BaseEntity`, so every change is captured automatically by the
site-wide audit listener — no extra wiring. Editable via the "Commercial Terms" page
(`/oversight/settings`, `frontend/src/pages/settings/CommercialTermsPage.tsx`) — MANAGER/ADMIN
only, deliberately separate from the ADMIN-only Company Settings page (commercial terms are
branch-manager territory, ADMIN is IT).

`Warranty` (V44): `months` is now nullable (a channel-base warranty is day-granularity, not
months); two new columns, `duration_days` and `duration_source`
(`PRODUCT_MONTHS|GUEST_BASE|MEMBER_BASE`), record WHICH rule produced `expiry_date` — still the
single authoritative field for every warranty computation (claims, void, display). Every
pre-existing row backfills to `PRODUCT_MONTHS` (the column default) — accurate, since every
warranty before V44 came from an explicit months figure (product/workmanship/manual/sales-order).
`WarrantyService#resolveDuration` is the ONE shared floor-rule helper, called from both
`#autoIssueForPosSaleLine` and `#autoIssueForShopOrderLine` — no duplicated max() logic, and
neither `PosSaleService` nor `ShopOrderService` needed to change: both already passed `memberId`
(non-null exactly when a loyalty member is attached), which is all `resolveDuration` needs to pick
guest vs member. `autoIssueForSalesOrderSerial`/`issueWorkmanshipWarranty`/manual `createWarranty`
are unaffected — out of scope (the owner decision names PoS + the web shop, not back-office
sales-order delivery or repair).

`WarrantyDto`/`PublicWarrantyDto` both carry a `coverageLabel` (e.g. `"10 days (member)"` / `"6
months (product)"`, computed once by `WarrantyDto.coverageLabel` and reused by the staff warranty
detail page and the anonymous public warranty checker alike) so a buyer/claims-handler can always
see WHY a warranty's cover is what it is, without reading raw `duration_source` values.

## Public repair-status lookup

`GET /api/v1/public/repairs/{jobNumber}` (`PublicRepairController`, anonymous, `PublicRepairDto`) exists at the API level — **there is no storefront page wired to it yet** (only `/shop/warranty` exists as an anonymous lookup page under `/shop/*`). Don't assume a UI page exists for this; verify `frontend/src/pages/public/` before writing a scenario against one.

## Testing

See the `personas` skill's persona 1 (seller, books/advances repair jobs) and the dedicated `frontend/tests/e2e/personas/repair-journey.spec.ts` scenario, plus `frontend/tests/e2e/repairs.spec.ts` and `warranties.spec.ts`. `frontend/tests/e2e/warranty-tiers.spec.ts` (V44) covers the Commercial Terms page (list/validate/save/revert, hidden from non-manager roles) and the PoS floor rule at the API level (no-warrantyMonths product → GUEST_BASE/MEMBER_BASE, warrantyMonths product → PRODUCT_MONTHS never shortened). `warranties.spec.ts`'s and `shop-orders.spec.ts`'s pre-existing "no warrantyMonths issues no warranty" tests were updated to the new "issues the channel-base floor instead" contract.
