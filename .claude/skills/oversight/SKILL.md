---
name: oversight
description: Mula ERP oversight — item trace, money-flow day book, exceptions, cash-up/Z-report, and the cashier My Day shift report. Use for oversight, item trace, money flow, day book, exceptions, cash-up, z-report, variance, cross-check, my day, shift report, till reconciliation.
---

# Oversight

Backend: `com.mulaerp.oversight` (`OversightController`, `ItemTraceService`, `MoneyFlowService`, `ExceptionsService`, `CashUpService`, plus a separate `OversightMyDayController`/`MyDayService` — see below), migration `V30__oversight_cash_ups.sql`. Frontend: `frontend/src/pages/oversight/*`, hub page `OversightPage.tsx` at `/oversight`. `OversightController` (`/api/v1/oversight`) is **class-level `@PreAuthorize(RoleRules.MANAGER_UP)`** — every endpoint, MANAGER and up only; no staff role below MANAGER can reach this module. **Exception**: My Day (below) is a separate controller open to any authenticated user.

This is the newest module in the codebase — verify field/endpoint shapes against the actual controllers/DTOs before relying on a specific one, more so than for the rest of this repo.

## Item trace (`GET /oversight/trace/item`, `ItemTraceService`)

Query by `sku`, `serial`, or `productId` (all optional `@RequestParam`s — pass whichever identifier you have). Returns an item's history from acquisition through sale/repair/warranty as a timeline of events (`ItemTraceEventDto`), sourced from the `stock_movements` ledger — so a voided PoS sale (`V34`) shows up as **two** events, not one: the original `POS_SALE` (the historical fact that it happened) and a later `SALE_VOID` (the reversal), both left in place since the ledger is append-only. Contrast with the money-flow day book above, which excludes a voided sale from its totals entirely rather than showing both sides.

## Money-flow day book (`GET /oversight/money-flow?from&to`, `MoneyFlowService`)

Takings broken out **by payment method** (`PaymentMethodTakingsDto`, sourced from PoS sales + repair payments), plus trade-in cash payouts, store credit issued/redeemed, service revenue, PoS goods revenue, and COGS (goods + repair parts) — each as an `AmountWithDocumentsDto` (amount + the document references that make it up, for drill-down). All of this is computed from the **operational tables directly** (PoS sales, repair payments/parts, trade-ins), not from the ledger. A **voided PoS sale (`V34`) is excluded** from every one of these totals and document lists (filtered on `sale.status`) — it still shows up in Exceptions and the item trace, see below.

**Cross-check** (`PostedJournalCrossCheckDto`, `#buildCrossCheck`): the same period's total revenue is independently summed from **`POSTED` journal entries** (Sales Revenue 4100 + Service Revenue 4200) and compared against an operational total; a mismatch is flagged rather than silently trusted — this is the mechanism that catches drafts that were never posted, or a manual journal that doesn't match what actually happened at the till. See the `accounting` skill's auto-posting policy for why this should rarely disagree now that system entries auto-post by default (a manual DRAFT entry is still the main way the two can diverge).

**Fix (option (a) chosen): the operational side now includes invoice revenue.** The operational total compared against posted-journal revenue is **PoS goods + repair service revenue + invoice revenue for the period** — not just PoS + repair (which is all `MoneyFlowResponseDto#totalRevenue` itself covers, unchanged). Every invoice posts a Sales Revenue (4100) credit at creation time (`InvoiceService#createInvoiceJournalEntry`) regardless of the invoice's own business status (DRAFT/SENT/PAID/OVERDUE/CANCELLED all post it) — before this fix the operational side never counted that, so on any environment with real invoice activity (this dev DB carries ~RM88k of it) the cross-check permanently reported `matchesOperational: false` for a reason unrelated to unposted drafts, a false positive worse than no check at all. `OversightInvoiceRepository#findByInvoiceDateBetweenAndDeletedFalse` sums each period's invoice totals into the comparison; the headline `totalRevenue` figure (drives gross margin, which has no invoice-side COGS to net against) is deliberately left untouched.

The banner also independently looks up **unposted DRAFT entries touching 4100/4200 for the period** (`OversightJournalEntryRepository#findByStatusAndEntryDateBetweenAndDeletedFalse`) and treats their existence as a mismatch in its own right — named explicitly in `PostedJournalCrossCheckDto.unpostedDraftRevenueEntryNumbers`/`unpostedDraftRevenueCount` — rather than relying solely on the two raw sums disagreeing (a manual DRAFT entry doesn't move either sum until it's posted, so without this check it would sit invisible). `matchesOperational` is `true` only when both the raw figures agree **and** no such draft exists; the banner is silent in that case and fires in either failure mode, with `note` explaining which.

## Exceptions (`GET /oversight/exceptions?from&to`, `ExceptionsService`)

Returns, for the period: deep discounts (`DeepDiscountSaleDto`, threshold `mulaerp.oversight.deep-discount-percent`, default `30`), near-price-floor sales (`PriceFloorSaleLineDto` — see the `pos` skill's price-floor rule, `mulaerp.pos.max-discount-percent`, default `50`), unposted draft journal entry count + ids, unreconciled bank transaction count + references (`bankTransactionRepository`), stale/stuck repair jobs older than `mulaerp.oversight.stale-repair-days` (default `14`), per-cashier totals (`CashierTotalsDto`: sale count, gross, average, discount rate — keyed off `PosSale#getCreatedBy`, so a sale with no attributable staff user groups under `"unknown"`), and **voided sales** (`voidedSaleCount` + `voidedSales`: id, sale number, `voidedAt`/`voidedBy`/`voidReason`, total — see the `pos` skill's void/refund section; this is the "it happened, here's why" record for a sale the money-flow day book above has already excluded from its totals).

## Cash-up / Z-report (`cash_ups` table, `V30`, `CashUpService`)

One row per `(cash_up_date, payment_method)` — unique constraint enforces it. `GET /oversight/cashup?date=` returns the **expected** figure (recomputed server-side from operational tables every time, never trusted from the client) alongside whatever was last **counted**. `POST /oversight/cashup` (`SaveCashUpRequest`) persists `counted`/`notes` and stamps the **approver** (`approvedBy`/`approvedAt`, from the authenticated principal) — `variance = counted - expected`.

## My Day (`GET /oversight/my-day?date&username`, `MyDayService`/`MyDayResponseDto`, own controller `OversightMyDayController`)

**Not** part of `OversightController`'s class-level `MANAGER_UP` gate — deliberately its own
controller with **no `@PreAuthorize`** (any authenticated user), since this is a cashier's own
shift/till-reconciliation report, not a manager surface. Scoping is enforced inside
`MyDayService#getMyDay`, never trusted to the client: a non-MANAGER/ADMIN caller passing any
`username` other than their own gets a 403 (`OwnDayOnlyException`, own controller-local
`@ExceptionHandler`, same error shape as everywhere else); MANAGER/ADMIN may pass `username` to
view any real staff user's day, defaulting to their own if omitted. Sourced from the same
operational tables as money-flow/cash-up (PoS sales, trade-ins, repair payments), never journal
entries. **Deliberately excludes COGS/margin/cost price** — a cashier reconciling their own drawer
has no legitimate reason to see what the shop paid for what it sold; nothing in the response is or
is derivable from `acquisitionCostSnapshot`/`costPrice`. Reports `saleCount`/`itemsSold`/
`grossTakings`/`takingsByPaymentMethod`/`averageBasket`, an approximated member/voucher/cart
discount breakdown, trade-ins processed (cash payout vs. store-credit issued), store credit
redeemed, voided-sales count+value, repair payments collected, and `expectedCashInDrawer` (cash
sales − cash trade-in payouts − cash refunds, all scoped to that cashier/day — a same-day void
pulls this down immediately since the voided sale drops out of "cash sales" entirely). Frontend:
`MyDayPage.tsx` at `/oversight/my-day`, the one oversight-adjacent nav item every role sees
(`Layout.tsx` — no `roles` filter, unlike the MANAGER/ADMIN-only "Oversight" and
"Commercial Terms" entries).

## Testing

See the `personas` skill's persona 5 (branch manager) and `frontend/tests/e2e/personas/branch-manager.spec.ts`; My Day above is covered by `frontend/tests/e2e/cashier-day.spec.ts`. No top-level (non-persona) spec file is dedicated to the rest of this module yet.
