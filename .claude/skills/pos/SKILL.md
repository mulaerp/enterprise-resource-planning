---
name: pos
description: Mula ERP thrift-store point of sale — register, offline sales, customer display, item intake, members, and vouchers. Use for pos, point of sale, register, checkout, offline sales, customer display, member, voucher, thrift.
---

# Point of Sale

Backend: `com.mulaerp.pos` (`PosSaleService`/`PosSaleController`, `PosTradeInService`/`PosTradeInController`), `com.mulaerp.member`, `com.mulaerp.voucher`. Frontend: `frontend/src/pages/pos/*`, routes under `/pos/*` in `App.tsx`. `PosTradeInController` carries no `@PreAuthorize` — open to any authenticated staff role. `PosSaleController` is the same for every endpoint **except** void (`V34`, see below), which is method-level `RoleRules.MANAGER_UP`.

## Register (`/pos`, `RegisterPage.tsx`)

Product search hits `GET /products?search=`, debounced 250ms, falls back to the offline cache on a network error. Cart line price is directly editable (`updateLinePrice`) — that's the "price override", there's no separate override dialog/permission check. Member and voucher are attached via their own search/apply widgets; a cart-level `cartDiscount` field exists in the payload type but the Register UI never sets it.

Checkout POSTs `CreatePosSaleRequest` to `POST /pos/sales` via `submitSale()` (`lib/pos-offline.ts`). `PosSaleService.createSale`:
- Is idempotent on `clientSaleId` (repeat POST with the same id short-circuits to the existing sale, no side effects repeated) — returns HTTP 200 for a replay, 201 for new.
- Applies discounts/credits sequentially: member % off subtotal → voucher (validated + usedCount incremented atomically via `VoucherService.applyVoucher`) → cart discount → **store credit redemption** (clamped to the member's balance, debited synchronously — not a non-blocking hook, since it must fail loudly on an over-redemption attempt) → **trade-in value applied** (nets against what's left) → tender. What's left after all of that is `netCashAmount`/`netCashDirection` (`CUSTOMER_PAYS`/`SHOP_PAYS`/`EVEN`, computed server-side — a large trade-in can leave the shop owing the customer).
- Decrements `Product.stockQuantity` **and** `warehouse_stock` for the MAIN warehouse, evicts the Redis product cache (mutates `Product` directly, bypassing `ProductService`), and records a `StockMovement` (`POS_SALE`, in the same transaction). This same stock check is what makes a unit **reserved by an online order** unsellable in-store: `ShopOrderService#placeOrder` (see the `webshop` skill) decrements this exact `Product.stockQuantity` at reservation time, so this line's own oversell guard rejects a PoS sale attempt against it (400, "Insufficient stock... available 0") with no cross-module code needed — verified live during the WEBSHOP verification gate.
- Accrues member points (`points = floor(total)`) and recomputes tier.
- Fires non-blocking system journal entries via `AccountingService#createSystemEntry` (`NonBlockingHookExecutor.runInNewTransaction` + try/catch, logged on failure, never blocks the sale) — auto-posted immediately by default, see the `accounting` skill's auto-posting policy: `Dr <cash/clearing account resolved from the sale's paymentMethod via CashAccountResolver — see the accounting skill's "Cash/clearing account split" section> / Cr Sales Revenue 4100` for the net amount; COGS 5100 / Inventory 1130 for Σ(line.acquisitionCostSnapshot × qty) if any line has one (note: this needs the product's `acquisitionCost` field set, not `costPrice` — a product with only `costPrice` set produces no COGS leg); a Store Credit Liability 2140 line when `storeCreditRedeemed` > 0.
- `createdBy` (from `BaseEntity` auditing) is now surfaced on `PosSaleDto`.
- Non-blocking auto-issue of an in-house warranty per unit sold (`issueLineWarranties` →
  `WarrantyService#autoIssueForPosSaleLine`, same `NonBlockingHookExecutor` pattern as the journal
  hooks above) — **WARRANTY-TIERS (V44, see the `repair-warranty` skill)**: every line now issues a
  warranty regardless of the product's own `warrantyMonths`. A member attached to the sale
  (`request.getMemberId() != null`) gets the longer `warranty.member-base-days` floor; a walk-in
  gets the shorter `warranty.guest-base-days` floor — but a product's own longer `warrantyMonths`
  always wins over either (never shortened). Both figures are runtime-editable via the "Commercial
  Terms" manager page, not `application.yml`.

Payment methods: `CASH | CARD | EWALLET | STORE_CREDIT`. CASH requires `amountTendered >= total` (400 if not); only a positive `netCashAmount` requires anything from the customer's chosen payment method. **Each method posts to its own account, not one shared Cash account** (`V35`, `CashAccountResolver` — see the `accounting` skill): `CASH` → 1111 Cash on Hand, `CARD` → 1112 Card Clearing, `EWALLET` → 1113 E-Wallet Clearing, `STORE_CREDIT` → 2140 Store Credit Liability. A void reverses whichever of these the original sale actually used (never hardcoded), so a CARD sale's void reverses 1112, an EWALLET sale's reverses 1113, etc. — see Void & refund below.

## Trade-in & part-exchange (`PosTradeInService`/`PosTradeInController`, `V29`)

`POST /api/v1/pos/trade-ins` takes in a used item standalone, for a payout: `payoutType: CASH | STORE_CREDIT` (`payoutTotal` computed from the request's line `offeredCashValue`/`offeredCreditValue`). A `CASH` payout has no dedicated ledger effect beyond the trade-in record itself; a `STORE_CREDIT` payout credits `members.store_credit_balance`. Each line writes a `TRADE_IN_RECEIPT` stock movement (+qty) once the traded-in item is received into inventory.

**Part-exchange** (trading an item in *as part of* a new sale, not standalone) goes through `CreatePosSaleRequest.tradeIn` — a `TradeInRequest` sub-object with its own `clientTradeInId` and lines, created internally as a `PosTradeIn` with `payoutType: APPLIED_TO_SALE` (only ever set this way, never client-chosen) and linked back via `pos_sales.trade_in_id`. The trade-in's value nets against the sale's total — see the discount/credit chain above.

### Trade-in product matching: AI-assisted, pricing: always deterministic

`GET /api/v1/pos/trade-ins/suggest` (`TradeInSuggestionService`, `V38`) matches the cashier's typed description against the product catalogue via Postgres trigram similarity (or an ILIKE/word-overlap fallback) and computes `suggestedCashOffer`/`suggestedCreditOffer` from `product.buyPrice x conditionMultiplier x (1 + boxBonus)` — **this pricing formula is always deterministic and always the source of truth**, regardless of the flag below.

An **optional, disabled-by-default** local LLM reranker (`mulaerp.tradein.ai-match.enabled`, `com.mulaerp.ai.OllamaTradeInMatcher`) can additionally rerank which of those already-retrieved candidates best matches a brand-synonym/misspelling/full-sentence query ("playstation five", "ps5 slm") and parse condition/hasBox/accessories hints out of it — **matching only, it can never influence price**, and it can never introduce a product it wasn't already handed as a candidate (validated server-side; an off-list SKU is discarded and logged, never surfaced). Talks to a local Ollama instance (`docker compose --profile ai up -d ollama`, see the `run-stack` skill) — disabled by default means no HTTP client is even constructed, so a box without the `ai` profile running behaves exactly as before. Response stays a bare JSON array (unchanged for backward compatibility); the AI's metadata rides on the one candidate row it chose (`aiSuggested: true`, `aiMatch: {...}`) rather than a top-level sibling of the array.

Real measured latency and an honest enable/disable recommendation are in the README's "AI trade-in matching (optional)" section — short version: in testing, the two query types this was meant to fix (synonyms, full sentences) were usually let down by the deterministic candidate *retrieval* stage itself (the right product never made the top-8 list), not by the reranker's judgement, so the added ~0.7-2s latency didn't reliably pay off. Left disabled by default for that reason.

## Void & refund (`POST /pos/sales/{id}/void`, `V34__pos_sale_void_refund.sql`, part-exchange void `V36__part_exchange_void.sql`)

`RoleRules.MANAGER_UP` only (a cashier must not be able to erase their own mistakes silently) — every other endpoint on this controller stays open to any staff role. Body is `{reason}` (mandatory — surfaced verbatim on the sale and in the oversight `exceptions` "voided sales" section, see the `oversight` skill). Rejects (409, `IllegalStateException`) an already-voided sale, and rejects a sale older than the void window (`mulaerp.pos.void-window-days`, env `POS_VOID_WINDOW_DAYS`, default 7) — **there is a time-window restriction**, checked against `createdAt`. All validation runs before any mutation, so a rejected void changes nothing (a double-void can't partially apply either — the already-voided check is the very first one).

**Part-exchange sales are fully voidable too (`V36`), not refused outright.** A sale with `tradeInId` set reverses in the same transaction as a third leg alongside the two below: the traded-in item's stock is removed again (`TRADE_IN_VOID`, -1 — the trade-in itself flips to `VOIDED`; for a line linked to a pre-existing product, `acquisitionCost` is restored to its exact pre-trade-in snapshot rather than trying to back it out of the weighted average), the trade-in's own Inventory journal leg reverses, and any trade-in over-valuation store-credit grant is clawed back from the member. This is refused (409) only in two specific unsafe cases, each checked before any mutation: **(a)** the traded-in item has already "left the building" — resold, consumed as a repair part, transferred away, or adjusted down since receipt (message suggests reversing that downstream transaction first, or handling this one as a manual stock adjustment instead); or **(b)** the store-credit clawback amount exceeds what the member has left (they've since spent it — message says reverse whatever spent it first). Neither condition is "any part-exchange sale, full stop" — most part-exchange voids succeed cleanly.

Effects, all in the same transaction:
- Stock is returned: `Product.stockQuantity`/`warehouse_stock` incremented back, and a new `SALE_VOID` (+qty) stock movement is written — the original `POS_SALE` (-qty) row is **never touched**, so the ledger stays append-only and both events remain visible on an item trace (see the `oversight` skill).
- For a part-exchange sale (see above): the traded-in item's stock is decremented again via `TRADE_IN_VOID` (-1), and the linked `PosTradeIn` is marked `VOIDED`.
- The sale's journal entries are reversed via a system entry with debit/credit swapped from the original (cash/clearing leg per `CashAccountResolver`/Sales-Revenue leg, plus the COGS/Inventory leg if the original sale had one, plus the trade-in's own Inventory leg and any store-credit clawback for a part-exchange) — auto-posted immediately under the same `mulaerp.accounting.auto-post-system-entries` policy as every other system hook (see the `accounting` skill), wrapped in the same non-blocking-hook pattern so a reversal failure can never block the void itself.
- `pos_sales.status` becomes `VOIDED`, with `voidedAt`/`voidedBy`/`voidReason` stamped (`voidedBy` from the authenticated principal, not client input).
- The response (`VoidPosSaleResponseDto`) carries `refundMethod`/`refundAmount` — the sale's own `paymentMethod`/`netCashAmount`, i.e. only the physical cash/card/e-wallet the cashier must hand back, plus (for a part-exchange) the traded-in item removed and its trade-in number. Store-credit, points, and voucher-usage reversal all happen automatically as part of the void and are **not** part of the refund pair.
- A voided sale is excluded from the oversight money-flow day book's revenue/COGS/takings totals (computed off `sale.status`), but still appears in the exceptions "voided sales" list and in the item trace (as both the original `POS_SALE` event and the `SALE_VOID` event) — see the `oversight` skill.

## Member store credit (`com.mulaerp.member`)

`members.store_credit_balance` (`V29`). Credited by a `STORE_CREDIT`-payout trade-in; debited by `storeCreditRedeemed` on a sale, via `MemberService#debitStoreCredit` — the authoritative overdraft guard, throws rather than letting a redemption take the balance negative (the sale-side clamp to the balance is a courtesy, not the real guard).

## Offline mode (`lib/pos-offline.ts`)

localStorage-only, no IndexedDB. Keys: `pos_product_cache_v1` (best-effort product search cache, seeded from every successful `/products` search response), `pos_sale_queue_v1` (durable sale queue). `submitSale()` catches only network errors (`axios.isAxiosError(err) && !err.response`) and queues; anything with a server response (4xx/5xx) throws through. `useSalesQueue()` hook auto-flushes the queue on the browser `online` event and on mount if already online; `flushQueue()` stops at the first network error again but drops (and reports as failed) any sale the server rejects outright, so a bad queued sale can't jam the queue forever. Idempotency of the retry relies entirely on `clientSaleId` (client-generated UUID via `crypto.randomUUID()`, `sale-<ts>-<rand>` fallback).

`CreateSalePayload`'s types include `tradeIn`/`storeCreditRedeemed` fields, so a **part-exchange sale queues and replays offline exactly like a normal sale**. A **standalone trade-in intake** (`POST /pos/trade-ins`, no sale attached) is a different endpoint entirely and is **not** wrapped by this queue — it has no offline fallback; a network error there throws straight through to the caller.

## Customer display (`/pos/display`, `pos-broadcast.ts`)

`BroadcastChannel('pos-display')` is the primary transport; a `localStorage` write (`pos_display_last_message`) + the `storage` event is the fallback, and also gives a freshly opened Display tab the last-known state. Message shapes: `cart-update` (lines/subtotal/discounts/total, fired on every cart change), `checkout` (total/amountTendered/change), `reset` (new sale started). `RegisterPage` broadcasts on every relevant state change via a `useEffect`.

## Item intake (`/pos/intake`, `IntakePage.tsx`)

There is **no dedicated `/pos/intake` backend endpoint** — this is a frontend-only route that POSTs straight to `POST /products` (the regular product module) with extra fields: `condition` (`NEW|LIKE_NEW|GOOD|FAIR|POOR`), `tags`, `acquisitionCost`, `hasBox`, `accessories`. Margin (`price - acquisitionCost`) is computed client-side for display only, never sent to the backend.

## Members (`com.mulaerp.member`)

Tiers recompute on every `accruePoints` call: `points >= 2000` → GOLD (10% discount), `>= 500` → SILVER (5%), else BASIC (0%). No decay — points only go up.

## Vouchers (`com.mulaerp.voucher`)

`POST /vouchers/validate` is a read-only check (always HTTP 200, `{valid:false, message}` for any ineligible code — not found/inactive/expired/usage-limit/min-spend) — used by the Register UI. `applyVoucher` (called only from `PosSaleService`, not directly exposed) does the same eligibility check but throws `IllegalArgumentException` (→400) on failure, and atomically increments `usedCount`. Creating a voucher (`POST /vouchers`) is `RoleRules.MANAGER_UP` (MANAGER/ADMIN — not ADMIN-only); `/vouchers` (list) and `/vouchers/validate` have no role restriction.
