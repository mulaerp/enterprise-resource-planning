---
name: webshop
description: Mula ERP online shop layer — customer accounts, cart/checkout, order reservations and fulfilment, postal trade-in quotes, and the dormant payment-gateway scaffold. Use for webshop, online order, shop customer, cart, checkout, reservation, trade-in quote, payment gateway.
---

# Webshop (online shop layer)

Backend: `com.mulaerp.shop` (`shop.order.**`, `shop.quote.**`, `shop.payment.**`, plus
`ShopAuthController`/`ShopAuthService`/`ShopCustomer`/`ShopJwtUtil` at the package root),
migrations `V39__shop_customers.sql` / `V40__shop_orders.sql` / `V41__shop_trade_in_quotes.sql` /
`V42__shop_order_warranty_and_void.sql` / `V43__close_legacy_guest_quotes.sql` (V44, the warranty
floor rule + `app_settings`, is shared with the `repair-warranty` skill's WARRANTY-TIERS section).
Frontend: `frontend/src/pages/shop/*` (buyer-facing: cart, checkout, account, trade-in), plus the
existing anonymous storefront under `frontend/src/pages/public/*` (browsing, warranty check — see
the `personas` skill's Buyer persona). Quote admin actions remain API-only. **Order** admin actions
now have a staff UI too (V42, Gap C): `frontend/src/pages/oversight/WebOrdersPage.tsx`
(`/oversight/web-orders`) — ready/fulfil/cancel/void with reason capture on the void action, home
for this since managing collected/dispatched web orders is branch-manager territory the same way
cash-up/exceptions are (see Oversight integration below).

This sits on top of three owner decisions, settled and implemented exactly:
1. Online orders are **PAY AT COLLECTION / ON DELIVERY** — a dormant, provider-agnostic payment
   gateway scaffold exists behind `payment.gateway.enabled=false` (default), no real gateway, no
   card data ever reaches this backend.
2. Placing an order **reserves stock immediately**, with a configurable expiry that releases it —
   most thrift stock is quantity 1, so overselling is unacceptable.
3. A postal/drop-off trade-in **quote is an indicative range**, valid a configurable number of
   days, settled by staff inspection on arrival, which the customer then accepts or declines.

## Registration & login (`ShopAuthService`)

Deliberately does **not** go through Spring's `AuthenticationManager`/`UserDetailsService` (that
stack is wired to `UserRepository`/staff only) — password checking is a direct
`PasswordEncoder.matches` call against `ShopCustomerRepository`, so there's no shared
authentication path a shop login could ride through the staff one, or vice versa. **Registration
auto-links an existing loyalty member**: if the registering email matches an existing, non-deleted
`Member`'s email, `ShopCustomer.memberId` is set immediately (first match — `Member` has no unique
constraint on email, phone is the unique loyalty key — existing seed/demo data never has two
members sharing one) so the new web account's points/store credit carry over from day one, with no
separate "link my account" step. A `SUSPENDED` shop customer is rejected at login
(`BadCredentialsException`) even with the right password.

## Two separate identities — never confuse them

| | Staff | Shop customer |
|---|---|---|
| Cookie | `MULAERP_AUTH` | `MULAERP_SHOP` |
| Filter | `JwtAuthenticationFilter` | `ShopCustomerAuthenticationFilter` |
| Authority granted | `ROLE_ADMIN`/`MANAGER`/`ACCOUNTANT`/`INVENTORY`/`CASHIER` | exactly one: `ROLE_SHOP_CUSTOMER` |
| Login | `POST /api/v1/auth/login` | `POST /api/v1/shop/auth/register` then `/login` |
| Scope | everything except `/api/v1/public/**`/`/shop/**` | `/api/v1/shop/**` only |

`ShopCustomerAuthenticationFilter` is scoped (`shouldNotFilter`) to run only for requests under
`/api/v1/shop/**` — a shop-customer cookie is **never even parsed** for a staff endpoint (e.g.
`GET /api/v1/products`), so `SecurityContextHolder` stays empty there and `anyRequest()
.authenticated()` correctly 401s it. The reverse direction is enforced by `SecurityConfig`
requiring `hasRole('SHOP_CUSTOMER')` (not just `authenticated()`) on the blanket `/api/v1/shop/**`
matcher — a staff-authenticated request has no `ROLE_SHOP_CUSTOMER` authority and is rejected too.

**⚠️ The one sub-path this general shape does NOT protect for free: `/api/v1/shop/admin/**`.**
`ShopCustomerAuthenticationFilter` authenticates a shop-customer cookie for *every* path under
`/api/v1/shop/**`, admin sub-paths included — and `SecurityConfig`'s matcher for
`/api/v1/shop/admin/**` is only `authenticated()`, satisfied just as well by a shop customer as by
staff. Every controller under that prefix **must** carry its own method- or class-level
`@PreAuthorize` (a staff-role constant from `RoleRules` — see `RoleRules.ANY_STAFF_ROLE`'s javadoc
for the full story). Verified live during the WEBSHOP verification gate: `ShopAdminQuoteController`
originally had none (mirroring the *unrelated* `PosTradeInController` "no restriction" precedent,
which is safe only because `/api/v1/pos/**` is never touched by the shop filter at all) — a
logged-in shop customer could list every customer's/guest's trade-in quotes and call every
mutating admin action on an arbitrary quote id. Fixed with a class-level
`@PreAuthorize(RoleRules.ANY_STAFF_ROLE)`; regression-guarded in `shop-quotes.spec.ts`. If you add
a new controller under `/api/v1/shop/admin/**`, give it an explicit staff-role `@PreAuthorize` —
never rely on the bare "no restriction" shape from a staff-only module as precedent.

## Orders (`shop.order.**`)

- **Placement** (`ShopOrderService#placeOrder`, member via `POST /shop/orders` or guest via
  `POST /public/shop/orders`): validates stock, decrements `Product.stockQuantity`/
  `warehouse_stock` immediately, writes one `SHOP_RESERVE` (negative delta) `StockMovement` per
  line, and creates the order straight into `RESERVED` (never persists `PENDING`, which exists in
  the schema for a future gateway-redirect flow only). Line pricing is always the product's
  current `unitPrice` at placement time, computed server-side. No revenue journal yet — nothing's
  been sold. `reservedUntil = now + mulaerp.shop.order.reservation-hours` (default 48).
- **Oversell prevention**: a second placement against a stockQuantity-0 item is **409**
  (`IllegalStateException`, "someone already has the last unit" — a business/availability
  conflict, not malformed input).
- **Cross-feature proof (verified live)**: because the reservation already decremented the
  *authoritative* `Product.stockQuantity`, a PoS in-store sale attempt against the same unit is
  independently rejected by `PosSaleService`'s own stock check (400, "Insufficient stock... available
  0") — no WEBSHOP-specific PoS change was needed; the two modules share one source of truth.
- **Cancel** (customer `POST /shop/orders/{id}/cancel`, own orders only — 403 otherwise; staff
  `POST /shop/admin/orders/{id}/cancel`, `RoleRules.MANAGER_UP` — same staff/manager split as PoS
  void) and **expiry** (`ShopOrderReservationScheduler`, every 15 min by default, or the manual
  `POST /shop/admin/orders/release-expired` trigger) both call the **same private**
  `ShopOrderService#releaseReservation` — returns stock, writes a positive-delta `SHOP_RELEASE`
  movement, sets `CANCELLED` or `EXPIRED` respectively. Only a `RESERVED`/`AWAITING_PAYMENT` order
  can be cancelled/expired.
- **Guest checkout**: `guestEmail`/`guestName`/`guestPhone` all required (400 otherwise). Guest
  status lookup, `GET /public/shop/orders/{orderNumber}?email=`, treats the order number + the
  email the guest themselves supplied as the "lookup token" — a wrong email 404s exactly like a
  non-existent order number (never distinguishes the two, so a guessed order number can't be used
  to probe for a valid one).
- **Staff actions** (`ShopOrderAdminController`, `/api/v1/shop/admin/orders`):
  `list`/`get`/`ready`/`fulfil` are `RoleRules.SHOP_ORDER_STAFF` (ADMIN/MANAGER/**CASHIER** —
  deliberately cashier-inclusive: a cashier handing over a collected order at the till must be
  able to close it out unsupervised, exactly like a PoS sale); `cancel`/`release-expired` are
  `RoleRules.MANAGER_UP` (same staff/manager split as PoS void — reversing a reservation is closer
  to "undoing" than "completing").
- **Fulfilment** (`fulfilOrder`, `RESERVED`/`READY` → `FULFILLED`): **writes no stock movement at
  all** — the original `SHOP_RESERVE` row already is the ledger's record of the unit leaving stock;
  a second movement would double-count. This is where revenue/COGS are posted for the first time
  (`Dr Cash 1111 / Cr Sales Revenue 4100`, `Dr COGS 5100 / Cr Inventory 1130` if the line has an
  `acquisitionCostSnapshot`) — `PAY_AT_COLLECTION` always resolves through `CashAccountResolver` to
  CASH (1111), since the cashier is assumed to take physical payment at handover. Loyalty points
  accrue and store credit may be redeemed **only** for a `ShopOrder` whose `shopCustomerId` links
  (via `ShopCustomer.memberId`) to a loyalty `Member` — a guest order or an unlinked customer gets
  neither, and a positive `storeCreditRedeemed` on such an order is rejected (400).
- **FIXED (V42, Gap B)**: `fulfilOrder` now auto-issues one warranty per unit for any line whose
  product has `warrantyMonths` set, via `WarrantyService#autoIssueForShopOrderLine` — the exact
  same service `PosSaleService#issueLineWarranties` calls, run through the same
  `NonBlockingHookExecutor` non-blocking pattern (a warranty-issue failure never fails fulfilment).
  **WARRANTY-TIERS (V44, see the `repair-warranty` skill)**: this call site now issues a warranty
  for EVERY line regardless of `warrantyMonths` — a product with none at all gets the guest/member
  channel-base-days floor instead of nothing, exactly like a PoS sale of the same product would.
  Member vs guest is decided by `memberId != null` (the same signal already used for attribution
  below), so this call site needed no change of its own to pick up the new rule — only
  `WarrantyService#resolveDuration` (the shared floor-rule helper) changed.
  Attribution: `memberId` when the buyer's `ShopCustomer` is linked to a loyalty `Member` (mirrors
  PoS exactly); a new `warranties.shop_customer_id` column when the buyer is a signed-in
  `ShopCustomer` with no loyalty link (there is no bridge from `ShopCustomer` to the back-office
  `com.mulaerp.customer.Customer` table, so `customerId` is deliberately left alone rather than
  overloaded with a different identity space); neither for a GUEST order — a new
  `warranties.shop_order_id` column is the sole attribution there, and it's enough: the guest's
  contact details already live on that order, findable the exact same way
  `ShopOrderService#guestLookup` already works (order number + the email the guest themselves
  supplied), and the warranty number is independently re-checkable at any time via the existing
  anonymous `GET /api/v1/public/warranty/{code}` lookup, which only ever matched on warranty/serial
  number, never a customer identity. `ShopOrderDto` now carries `warrantyNumbers` (populated by
  `ShopOrderService`, one extra query per read/page — `fromEntity` itself still never touches the
  database), surfaced on `/shop/account`'s Orders tab, the guest order-lookup page, and the staff
  `/oversight/web-orders` page.
- **FIXED (V42, Gap C)**: `POST /api/v1/shop/admin/orders/{id}/void` (`RoleRules.MANAGER_UP` —
  same cashier-excluded rationale as PoS void) reverses a `FULFILLED` order, mirroring
  `PosSaleService#voidSale` closely: idempotent (a second void 409s), a configurable window
  (`mulaerp.shop.void-window-days`, default 7, measured from the new `ShopOrder#fulfilledAt`
  column — not `createdAt`, since a reservation can sit for up to `reservation-hours` before ever
  being fulfilled). Stock is returned via a new **`SHOP_VOID`** movement type (deliberately not
  reused from `SHOP_RELEASE` — that type means "reservation released, no sale ever happened, no
  revenue/COGS to reverse"; `SHOP_VOID` means "a sale WAS posted and is now reversed", mirroring
  `SALE_VOID`'s distinct role on the PoS side); the original `SHOP_RESERVE` row is never touched.
  Revenue/COGS reverse as `SYSTEM` entries (auto-posted); points/store-credit snapshotted onto the
  order at fulfilment (`ShopOrder#pointsEarned`/`storeCreditRedeemed`, new columns — needed so the
  void can reverse exactly what was granted) are deducted/credited back; every warranty this order
  issued (Gap B) is VOIDed via the existing `WarrantyService#voidWarranty` path. Refuses (409) if
  any warranty issued by the order has already been **CLAIMED** (a repair job exists against it) —
  the same shape as PoS's "traded-in item already moved on" refusal, just via Gap B's warranty
  instead of a trade-in's product. No staff UI existed for web-order management before this pass;
  a new page (`/oversight/web-orders`) now covers ready/fulfil/cancel/void with reason capture.
- **Cross-customer isolation**: `getOwnOrder`/`cancelOwnOrder` compare the order's
  `shopCustomerId` against the caller's own id and throw `AccessDeniedException` (403) on a
  mismatch — verified live (customer B reading/cancelling customer A's order both 403).

## Postal/drop-off trade-in quotes (`shop.quote.**`, `V41`)

- **MEMBERS-ONLY (OWNER DECISION, 2026-08)**: online trade-in quote requests require a
  `ROLE_SHOP_CUSTOMER` session — the guest path (`PublicShopQuoteController`, `POST
  /public/shop/quotes` + `GET /public/shop/quotes/{quoteNumber}?email=`) has been **deleted**, not
  merely hidden. Rationale: staff need to contact the seller and pay them, and (see the
  now-resolved gap below) a guest quote had no way to ever accept/decline a staff final offer once
  inspected — a permanent dead end. `SecurityConfig` carves out `/api/v1/public/shop/quotes/**`
  with an explicit `denyAll()` *before* the general `/api/v1/public/**` permitAll rule, so this
  sub-path can never again be accidentally exposed as permitAll by a future change to that general
  rule — an anonymous request gets 401 (`ExceptionTranslationFilter` routes a denied anonymous
  principal to the entry point, not the access-denied handler), verified live. Guests can still
  browse and buy freely (`/public/shop/orders`, unaffected, owned by a separate task) — only
  selling to the shop requires an account. Pre-existing guest rows are historical data, not
  deleted — see **legacy row policy** below.
- **Request** (member `POST /shop/quotes` auto-attaches the caller): either `productId` (a
  real catalogue item) or `categoryId` + `freeTextDescription`. Pricing **mirrors** (does not call)
  `TradeInSuggestionService`'s exact deterministic formula — `quotedMax = pricingBase ×
  conditionMultiplier × (1 + boxBonus if hasBox)`, reading the *same* externalised
  `mulaerp.tradein.*` keys, not new magic numbers (kept a deliberate mirror rather than a direct
  call because `com.mulaerp.pos.**` was outside this module's owned-files boundary — one source of
  truth for the multipliers either way). `quotedMin = quotedMax × mulaerp.shop.quote.min-factor`
  (default 0.7). `expiresAt = quotedAt + mulaerp.shop.quote.valid-days` (default 7). No product?
  falls back to the average `buyPrice`/`unitPrice` of ACTIVE products in the declared category — no
  priced items in that category is a 400, never a fabricated number.
- **Lifecycle**: `QUOTED → RECEIVED` (staff, item physically arrived) `→ OFFER_MADE` (staff
  inspection, records `finalOffer`/`payoutType`; a `finalOffer` outside `[quotedMin, quotedMax]` is
  allowed but requires non-blank `notes`, 400 otherwise) `→ ACCEPTED`/`DECLINED` (customer
  decision) `→ COMPLETED` (staff, ACCEPTED only — creates a **real** trade-in via the existing
  `PosTradeInService#createTradeIn`, so stock +1/weighted-average acquisitionCost/store-credit
  crediting/inventory journal all happen exactly as an in-store trade-in would, never
  reimplemented) or `→ RETURNED` (staff, DECLINED only — **no** stock/journal effect, the item
  never entered inventory). `QUOTED` past `expiresAt` flips to `EXPIRED` on a schedule
  (`ShopTradeInQuoteExpiryScheduler`, every 15 min default) — an `EXPIRED` quote can't be
  received/inspected (409); there's no re-quote endpoint, the customer submits a fresh request.
- **Staff actions** (`ShopAdminQuoteController`, `/api/v1/shop/admin/quotes`): class-level
  `@PreAuthorize(RoleRules.ANY_STAFF_ROLE)` (see the security callout above) — any staff role.
  Tolerates a legacy `null shopCustomerId` row without crashing (`resolveMemberId` already treated
  that as "no loyalty member, CASH only" before this change) — see legacy row policy below.
- **Customer decisions** (`ShopQuoteController`, `/api/v1/shop/quotes/{id}/accept-offer` |
  `/decline-offer`): `SHOP_CUSTOMER`-scoped, ownership-checked (403 on someone else's quote).
- **RESOLVED gap** (previously disclosed here): a **guest** quote used to have no way at all to
  accept or decline the final offer once staff inspected it (no public accept/decline endpoint,
  and `TradeInQuoteLookupPage.tsx` was read-only) — a guest whose quote reached `OFFER_MADE` was
  stuck forever. Resolved by removing the guest path entirely rather than building the missing
  accept/decline endpoint (see "MEMBERS-ONLY" above) — there is no longer a guest quote that can
  reach `OFFER_MADE` in the first place.
- **Legacy row policy (`V43__close_legacy_guest_quotes.sql`)**: pre-existing guest rows
  (`shop_customer_id IS NULL`, mostly test data from earlier verification passes) are **never
  deleted** and **never retrofitted** with a `shopCustomerId` (no reliable way to attribute a
  historic guest submission to a real account after the fact). Any such row still sitting in an
  open/actionable status (`QUOTED`/`RECEIVED`/`OFFER_MADE`) was swept to `EXPIRED` by V43 — an
  existing status meaning exactly "no longer actionable", not a new enum value or schema change.
  A guest row already in a genuinely terminal status was never possible (guests could never reach
  `ACCEPTED`/`DECLINED`/`COMPLETED`/`RETURNED` — see the resolved gap above), so no other case
  needed handling. The identity `CHECK` constraint (`shop_customer_id IS NOT NULL OR guest_email IS
  NOT NULL`) is deliberately left unchanged rather than hardened to `NOT NULL`: a Postgres `CHECK`
  re-validates the *whole row* on every `UPDATE`, not just `INSERT`, so a hard `NOT NULL` would
  also reject staff's routine receive/inspect/complete/return calls against any still-existing
  legacy null-customer row. Mandatory linkage for **new** quotes is therefore an application-layer
  rule only (`ShopTradeInQuoteService#requestQuote` throws if ever asked to create one with no
  customer id — the sole remaining caller, `ShopQuoteController`, always supplies one from the
  authenticated session).
- `guestEmail`/`guestName`/`guestPhone` remain on the entity/table solely because legacy rows
  reference them — never populated for a new quote any more (see `ShopTradeInQuote`'s class
  javadoc "Members-only").

## Payment gateway scaffold (dormant, `com.mulaerp.shop.payment`)

`PaymentGateway` interface + `NoopGateway` (the only bean while `payment.gateway.enabled=false`,
the default) + `GatewayWebhookController` (`POST /public/shop/payment/webhook`, permitAll — a real
webhook arrives unauthenticated from the provider's own servers, verified only by
`PaymentGateway#verifyWebhook` against a shared secret, never a cookie). **Currently always
returns 501** — either the gateway is disabled, or enabled with no real provider bean registered
yet. No card data of any kind reaches this backend today; every provider this scaffold is built
for (Stripe/Fiuu/Billplz) is a hosted-checkout/redirect model precisely so that stays true.

**To enable a real provider later** (see `PaymentGateway`'s class javadoc for the full checklist):
set `PAYMENT_GATEWAY_ENABLED=true` + `PAYMENT_GATEWAY_PROVIDER`/`_API_KEY`/`_WEBHOOK_SECRET`/
`_RETURN_URL`, then (1) add a new `@Component` implementing `PaymentGateway`,
`@ConditionalOnProperty` on the same flag so it only replaces `NoopGateway` when turned on; (2)
implement `createCheckout` (call the provider's hosted-checkout API, return a `PaymentIntentResult`
with the redirect URL — this is also where an order would first move `RESERVED →
AWAITING_PAYMENT`, not implemented yet); (3) implement `verifyWebhook` (HMAC/provider-specific
signature check against the webhook secret — never trust an unsigned payload); (4) replace
`GatewayWebhookController`'s 501 stub with a real handler that verifies, resolves the order, and
transitions `AWAITING_PAYMENT → PAID` — **never straight to `FULFILLED`**, fulfilment still
requires a staff handover/shipment action.

## Configuration reference (`application.yml`, `mulaerp.shop.*` / `payment.gateway.*`)

| Key | Env | Default | Meaning |
|---|---|---|---|
| `mulaerp.shop.order.reservation-hours` | `SHOP_ORDER_RESERVATION_HOURS` | `48` | Reservation hold length |
| `mulaerp.shop.order.delivery-fee` | `SHOP_ORDER_DELIVERY_FEE` | `0.00` | Flat fee added when `fulfilmentType=POST` |
| `mulaerp.shop.order.reservation-release-cron` | `SHOP_ORDER_RESERVATION_RELEASE_CRON` | every 15 min | Scheduler cron |
| `mulaerp.shop.order.reservation-release-enabled` | `SHOP_ORDER_RESERVATION_RELEASE_ENABLED` | `true` | Disable the scheduled bean entirely |
| `mulaerp.shop.quote.valid-days` | `SHOP_QUOTE_VALID_DAYS` | `7` | Indicative-range validity |
| `mulaerp.shop.quote.min-factor` | `SHOP_QUOTE_MIN_FACTOR` | `0.7` | `quotedMin = quotedMax × this` |
| `mulaerp.shop.quote.expiry-schedule-cron` | `SHOP_QUOTE_EXPIRY_SCHEDULE_CRON` | every 15 min | Expiry sweep cron |
| `mulaerp.shop.void-window-days` | `SHOP_ORDER_VOID_WINDOW_DAYS` | `7` | V42: days after `fulfilledAt` a FULFILLED order may still be voided |
| `payment.gateway.enabled` | `PAYMENT_GATEWAY_ENABLED` | `false` | Dormant unless `true` |
| `payment.gateway.provider` | `PAYMENT_GATEWAY_PROVIDER` | `none` | Free-text provider name |

## Oversight integration

A completed postal trade-in goes through the same `PosTradeInService#createTradeIn` an in-store
trade-in uses, so it needed **no WEBSHOP-specific change** to already show up in the branch
manager's item trace (`TRADE_IN_RECEIPT` event) and money-flow day book (`storeCreditIssued`/
`tradeInCashPayouts`) — verified live. A `SHOP_RESERVE`/`SHOP_RELEASE` movement falls through
`ItemTraceService`'s generic event handler (it isn't one of the explicitly-cased movement types)
and still renders with its type name/reference/notes — functional, if less richly narrated than
`TRADE_IN_RECEIPT`'s dedicated case.

**Money-flow day book previously omitted fulfilled web orders entirely** — `MoneyFlowService` never
counted `ShopOrder` revenue in its cross-check against posted journal entries (only PoS goods +
repair service + invoice revenue), so any environment with a fulfilled online order permanently
showed the `postedJournalCrossCheck.matchesOperational: false` banner with no real explanation —
the exact same class of false-positive the existing invoice fix addressed. Fixed the same narrow
way: FULFILLED `ShopOrder` totals (filtered on `updatedAt`, the fulfilment write) are folded into
the cross-check's comparable operational figure. **Note (V42)**: `ShopOrder` now has a dedicated
`fulfilledAt` column (added for the void window, see Orders above) — `MoneyFlowService` itself was
left querying `updatedAt` rather than switched over, since that's outside this task's
`shop.order.**`/`shop.quote.**` ownership boundary; a future pass could tighten this to the more
precise column. A `VOIDED` order (V42) is automatically excluded from this cross-check (it filters
on `status = FULFILLED`), the same way a voided PoS sale already is. **Still not fixed** (a larger, undone reporting gap, left for a follow-up): the day book's
headline `totalRevenue`/COGS/payment-method breakdown still attribute nothing to web orders at
all — there's no line item for online sales, and no payment-method bucket a `PAY_AT_COLLECTION`
web sale's cash would land in (`fulfilOrder` always resolves it to CASH regardless of how the
customer actually paid at the till).

## Testing

Top-level specs: `shop-auth.spec.ts`, `shop-orders.spec.ts`, `shop-quotes.spec.ts`,
`shop-storefront.spec.ts` (cart/checkout/account UI), plus the pre-existing `storefront.spec.ts`
(anonymous browsing). Persona scenarios under `frontend/tests/e2e/personas/` (see the `personas`
skill): `shop-guest-buyer.spec.ts`, `shop-member-buyer.spec.ts`,
`shop-trade-in-accepted.spec.ts`, `shop-trade-in-declined.spec.ts`,
`shop-reservation-expiry.spec.ts`. The reservation-expiry persona spec proves the shared
`releaseReservation` mechanism exhaustively via the (automatable) customer-cancel trigger — the
genuinely time-based scheduler trigger itself was verified live against a running stack (Postgres
`reserved_until` backdated directly, the manual release endpoint called, confirmed to flip
`RESERVED → EXPIRED` with stock returned and the storefront showing the item `IN_STOCK` again) for
the same reason `shop-quotes.spec.ts` already documents doing this for its own `EXPIRED`
transition: no per-request override exists for the hours-scale defaults, and this suite is
black-box HTTP/UI only.

**V42 (Gap B/C) additions**: `shop-orders.spec.ts` gained tests (j)-(o) — warranty auto-issue for
a member order (one per unit), a guest order's warranty findable via guest lookup, and the full
void flow (stock/journal/points/warranty reversal,
idempotent 409 on a second void, cashier 403). Test (k) (a no-`warrantyMonths` product) was
originally "issues nothing" — **updated for WARRANTY-TIERS (V44)** to assert the channel-base
floor warranty instead (see the `repair-warranty` skill), since that's no longer true. `warranties.
spec.ts` gained a second `describe.serial` block proving the same warranty-issuance contract via
the online channel specifically (mirroring its existing PoS `describe` block), likewise updated for
V44. `shop-guest-buyer.spec.ts` and
`shop-member-buyer.spec.ts` were extended so their existing end-to-end narratives also cover the
online purchase auto-issuing a warranty for real — the member-buyer persona no longer needs the
PoS-sale workaround its comment used to describe (Gap B is fixed, the product's own online
fulfilment issues it directly). The void-window-days (7-day) rejection itself was verified live
(fulfilledAt backdated directly in Postgres, void called, confirmed 409) rather than faked in
Playwright — same reasoning as the reservation-expiry paragraph above.
