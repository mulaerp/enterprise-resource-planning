# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project does not currently follow semantic versioning (no tagged
releases exist yet); entries are grouped by working session instead.

## [Unreleased] - 2026-08-02 Flyway out-of-order: safe-by-default, dev-only override

### Security

- **`spring.flyway.out-of-order` is no longer hardcoded `true`.** `application.yml` now reads
  `${FLYWAY_OUT_OF_ORDER:false}` — a production or test deploy that doesn't explicitly opt in fails
  loudly on an out-of-order migration instead of silently applying one out of numeric sequence.
  `compose.yaml`'s `backend` service sets `FLYWAY_OUT_OF_ORDER=${FLYWAY_OUT_OF_ORDER:-true}` so
  local Docker dev keeps today's tolerant behaviour (needed because V42/V43 landed out of numeric
  order across parallel working sessions — see the V42 entry below). Documented in `CLAUDE.md`, the
  `backend-dev` skill, and the README deployment checklist.

## Documentation sweep (2026-08-02)

Reconciled `CLAUDE.md`, `README.md`, this changelog, and all `.claude/skills/*/SKILL.md` files
against the current code (controllers/`@PreAuthorize`, `RoleRules.java`, migrations, `App.tsx`,
`Layout.tsx`, `application.yml`, `compose.yaml`, `Makefile`, `scripts/*.sh`, and the e2e specs) —
several prior passes had left stale figures behind piecemeal. Corrected, with what was measured:

- Flyway migrations: highest version is **V44** (gaps at V4–V9, V28, V33) — `CLAUDE.md` and the
  `backend-dev` skill still said "up to V30, V28 missing".
- E2E specs: **47 spec files** (36 top-level + 11 persona, not 46/35) and **345 tests on chromium
  alone** (measured via `npx playwright test --list --project=chromium`, 1035 across all 3 browser
  projects) — `README.md`, `e2e-tests` skill, and `personas` skill all undercounted by one spec file
  (`warranty-tiers.spec.ts` had been added since those figures were last recorded).
- `CLAUDE.md`'s stock-movement type list and "known constraints" section were stale: it still
  listed only 9 movement types (missing `SALE_VOID`/`TRADE_IN_VOID`/`SHOP_RESERVE`/`SHOP_RELEASE`/
  `SHOP_VOID`) and claimed "no void/refund flow for PoS sales; no dedicated stock-take workflow" —
  both shipped since (`V32`, `V34`). It also had no mention of the webshop module, the two separate
  auth systems, the warranty floor rule, or the runtime settings store at all.
- `inventory` skill's `MovementType` list was similarly missing the four webshop-era movement types.
- Confirmed the `CommercialTermsPage.tsx` file/route discrepancy between an earlier brief and this
  changelog's own V44 entry: the changelog was correct (`frontend/src/pages/settings/CommercialTermsPage.tsx`,
  routed at `/oversight/settings`).
- No new skill created for settings/commercial-terms: the `app_settings` store has exactly one
  consumer today (the warranty floor rule) and is already documented in depth in the
  `repair-warranty` skill's WARRANTY-TIERS section, referenced from `webshop`/`CLAUDE.md`/`backend-dev`
  — a dedicated skill would fragment a two-key feature across two places for no benefit; revisit if
  `app_settings` grows beyond warranty-related keys.
- **Significant correction, not just a stale number**: `pos`/`webshop`/`CLAUDE.md`/README all
  claimed a part-exchange PoS sale is refused outright (409) by the void endpoint, "reverse the
  three legs manually" — this was true before `V36__part_exchange_void.sql`, but that migration
  (already on disk, itself undocumented until the entry above) implemented a full three-leg
  reversal (sold goods, traded-in item via a new `TRADE_IN_VOID` movement, and money incl. a
  store-credit clawback). The real, narrower refusal is only two specific unsafe cases — the
  traded-in item already moved on, or the member already spent the store credit being clawed back
  — verified directly against `PosSaleService#voidSale`'s current implementation and javadoc, not
  assumed from the old doc text. Corrected in `CLAUDE.md`, `README.md` (two places), and the `pos`
  skill's Void & refund section, which also gained the void-window (`mulaerp.pos.void-window-days`,
  default 7) that none of these docs previously mentioned at all.
- Added missing changelog entries for `V35`-`V38` (cash/clearing account split, guided
  part-exchange void, repair payment refunds, trade-in catalogue linking) — real, shipped
  migrations with no prior changelog record at all, found by cross-checking the migration
  directory against every dated entry above.

## [Unreleased] - 2026-08-02 WARRANTY-TIERS: guest/member warranty floor + runtime Commercial Terms

Owner decision: guest (non-member) buyers get a short base in-house warranty, members get a longer
one as a loyalty incentive to register — applied uniformly at the PoS till and on web-order
fulfilment, and never allowed to shorten a product's own longer `warrantyMonths` cover.

### Added

- **`app_settings` (V44, `com.mulaerp.settings`)**: a runtime-editable key/value store — `GET`/`PUT
  /api/v1/settings` (`RoleRules.MANAGER_UP`), typed values (`STRING|INT|DECIMAL|BOOLEAN`),
  `SettingsService`'s small in-memory cache (invalidated on every write, never read from the DB on
  a warranty issue) with safe fallback to a compile-time default (logged as a warning, never a 500)
  when a row is missing or malformed. Every change is captured automatically by the existing
  site-wide audit listener (`AppSetting extends BaseEntity`) — no extra wiring needed, verified live
  (`GET /audit-logs` shows the acting username and old→new value). Seeded with
  `warranty.guest-base-days=3` and `warranty.member-base-days=10`.
- **Warranty duration is now explainable** (`warranties.duration_days`, `warranties.duration_source`
  — `PRODUCT_MONTHS|GUEST_BASE|MEMBER_BASE`, V44): `months` is now nullable (a channel-base
  warranty is day-granularity, not months); `expiry_date` stays the single authoritative field for
  every warranty computation. Every pre-existing row backfills to `PRODUCT_MONTHS` (the column
  default) — accurate, since every warranty before this change came from an explicit months figure.
- **The FLOOR rule, one shared helper**: `WarrantyService#resolveDuration` (private, called from
  both `#autoIssueForPosSaleLine` and `#autoIssueForShopOrderLine` — no duplicated max() logic)
  computes `MAX(product warrantyMonths converted to a date, channel base days)`; the product's own
  warranty NEVER gets shortened by this feature. Member vs guest is decided by `memberId != null` —
  the exact same signal both call sites already had, so neither `PosSaleService` nor
  `ShopOrderService` needed to change at all.
- **Deliberate behaviour change**: a product with no `warrantyMonths` at all — previously issued no
  warranty whatsoever on sale/fulfilment — now always gets the channel base-days floor. Verified
  live for both channels (PoS walk-in/member, and online guest/member fulfilment) and covered by
  `warranty-tiers.spec.ts`; the two pre-existing specs that asserted the old "no warranty" behaviour
  (`warranties.spec.ts`, `shop-orders.spec.ts` test (k)) were updated to match.
- **"Commercial Terms" page** (`/oversight/settings`, `frontend/src/pages/settings/
  CommercialTermsPage.tsx`) — MANAGER/ADMIN only (`Layout.tsx` nav + a page-level guard), lists
  every setting with its description, type-appropriate input, inline validation, and a save action
  with a success/error toast. Deliberately separate from the ADMIN-only Company Settings page:
  commercial terms are branch-manager territory, ADMIN is IT.
- The buyer-facing warranty coverage is now explicit everywhere a warranty is shown —
  `WarrantyDto`/`PublicWarrantyDto` both carry a `coverageLabel` (e.g. "10 days (member)" / "6
  months (product)"), computed once (`WarrantyDto.coverageLabel`) and reused by the staff detail
  page and the anonymous public warranty checker alike.

### Verified live (2026-08-02)

- `GET /api/v1/settings` → manager 200 (both keys, values 3/10), cashier 403, anonymous 401, an
  authenticated shop customer 401 (the settings path is outside `ShopCustomerAuthenticationFilter`'s
  scope, so its cookie is never parsed there).
- PoS floor rule: a no-`warrantyMonths` product sold to a walk-in → 3-day `GUEST_BASE` warranty;
  the same sale with a member attached → 10-day `MEMBER_BASE`; a `warrantyMonths=6` product sold to
  either → still 6 months, `PRODUCT_MONTHS` (never shortened).
  Online fulfilment: identical outcomes for guest/member web orders.
- `PUT /api/v1/settings/warranty.guest-base-days` (manager) → 200, and the very next guest sale
  used the new value with no restart; a negative or non-numeric value → 400; as cashier → 403.
- The change appeared in `GET /audit-logs` with the manager's username and `value: 3 -> 5`.
- A setting row corrupted directly in Postgres (`value='abc'`) → the next sale still succeeded
  (201), using the compile-time default, with a logged warning — no 500.
- A pre-existing (pre-V44) warranty row still loads correctly (`durationSource: PRODUCT_MONTHS`,
  `coverageLabel: "6 months (product)"`); trial balance stayed balanced and the balance sheet still
  balances (assets = liabilities + equity) — warranties post no journals, and nothing regressed.

### Not migrated (out of scope for this pass)

- The optional extra knobs (`pos.void-window-days`, `shop.reservation-hours`,
  `shop.quote.valid-days`, `oversight.deep-discount-percent`) were **not** moved into `app_settings`
  — doing so would mean editing `PosSaleService`/`ShopOrderService` outside their warranty-duration
  decision points, and `ExceptionsService`, none of which are part of this task's file ownership.
  They remain `application.yml`-only knobs for now.

## [Unreleased] - 2026-08-02 WEBSHOP: online-order warranty auto-issue and void (Gap B/C)

Closes two disclosed WEBSHOP gaps documented in the `webshop` skill: an online purchase never
issued an in-house warranty, and a FULFILLED web order had no void/reversal path at all.

### Added

- **GAP B - warranty auto-issue on fulfilment**: `ShopOrderService#fulfilOrder` now calls
  `WarrantyService#autoIssueForShopOrderLine` (new method, mirrors
  `PosSaleService#issueLineWarranties`/`WarrantyService#autoIssueForPosSaleLine` exactly - one
  warranty per unit, same `NonBlockingHookExecutor` non-blocking pattern, no duplicated logic) for
  any line whose product has `warrantyMonths` set. Attribution: `memberId` when the buyer's
  `ShopCustomer` is linked to a loyalty `Member`; a new `warranties.shop_customer_id` column for a
  signed-in customer with no loyalty link; a new `warranties.shop_order_id` column always set,
  which is also how a **guest's** warranty is found later - the guest has no account, but their
  order (found via order number + the email they themselves supplied, the same "lookup token"
  `ShopOrderService#guestLookup` already used) now carries the warranty number directly, and it's
  independently re-checkable at any time via the existing anonymous `GET
  /api/v1/public/warranty/{code}` lookup by warranty/serial number.
- `ShopOrderDto.warrantyNumbers` - surfaced on `/shop/account`'s Orders tab, the guest
  order-lookup page, and the new staff web-orders page (below).
- **GAP C - void a FULFILLED order**: `POST /api/v1/shop/admin/orders/{id}/void`
  (`RoleRules.MANAGER_UP`, `VoidShopOrderRequest{reason}`), mirroring
  `PosSaleService#voidSale`/`V34` closely. Idempotent (second void 409s), a configurable window
  (`mulaerp.shop.void-window-days`, default 7, measured from a new `ShopOrder#fulfilledAt` column
  rather than `createdAt`, since a reservation can sit for up to `reservation-hours` before ever
  being fulfilled). Stock returned via a new **`SHOP_VOID`** movement type (kept distinct from
  `SHOP_RELEASE` - that type means "released, never sold, nothing to reverse"; `SHOP_VOID` means "a
  sale was posted and is now reversed", mirroring `SALE_VOID`'s distinct role on the PoS side); the
  original `SHOP_RESERVE` row is never touched. Revenue/COGS reverse as `SYSTEM` entries
  (auto-posted); points/store-credit snapshotted at fulfilment onto two new `ShopOrder` columns
  (`pointsEarned`/`storeCreditRedeemed`) are deducted/credited back exactly; every warranty the
  order issued is VOIDed via the existing `WarrantyService#voidWarranty` path. Refuses (409) if any
  linked warranty has already been **CLAIMED** (a repair job exists against it) - the same shape as
  PoS's "traded-in item already moved on" refusal.
- **Staff web-order management UI** (`frontend/src/pages/oversight/WebOrdersPage.tsx`,
  `/oversight/web-orders`) - there was no staff-facing UI for order admin actions before this
  (order admin was API-only); this page covers ready/fulfil/cancel/void, with reason capture and a
  clear warning on the void action that it reverses stock and the books.
- `V42__shop_order_warranty_and_void.sql`: `warranties.shop_order_id`/`shop_customer_id`;
  `shop_orders.fulfilled_at`/`store_credit_redeemed`/`points_earned`/`voided_at`/`voided_by`/
  `void_reason`; widens `chk_shop_orders_status` (+`VOIDED`) and `chk_stock_movements_type`
  (+`SHOP_VOID`). Applied out-of-order behind `spring.flyway.out-of-order=true` (newly enabled)
  since a parallel agent's `V43` had already applied to the shared dev database before `V42`
  existed on disk - every migration in this repo is additive/backward-compatible by convention, so
  this changes nothing about what either migration actually does.
- `mulaerp.shop.void-window-days` config key (`SHOP_ORDER_VOID_WINDOW_DAYS`, default `7`).

### Tests

- `frontend/tests/e2e/shop-orders.spec.ts`: new cases (j)-(o) covering warranty issuance (member,
  no-warranty product, guest) and the full void flow (stock/journal/points/warranty reversal,
  idempotent 409, cashier 403).
- `frontend/tests/e2e/warranties.spec.ts`: new `describe` block proving the same warranty-issuance
  contract via the online channel.
- `frontend/tests/e2e/personas/shop-guest-buyer.spec.ts` /
  `frontend/tests/e2e/personas/shop-member-buyer.spec.ts`: extended to prove the ONLINE purchase
  itself now issues a warranty (the member-buyer persona no longer needs its former PoS-sale
  workaround).

## [Unreleased] - 2026-08-02 WEBSHOP: postal trade-in quotes are now members-only

OWNER DECISION: online postal/drop-off trade-in quotes require a signed-in shop account. Guests
can still browse and buy freely — only requesting a trade-in quote now requires registering. This
also resolves the previously-disclosed dead end where a guest quote could be inspected by staff
but never accepted or declined.

### Removed

- **Guest trade-in quote request/lookup** (`PublicShopQuoteController` — `POST
  /api/v1/public/shop/quotes`, `GET /api/v1/public/shop/quotes/{quoteNumber}?email=`) — deleted
  outright, not just hidden. `SecurityConfig` now carves out `/api/v1/public/shop/quotes/**` with
  an explicit `denyAll()`, declared *before* the general `/api/v1/public/**` permitAll rule, so
  this sub-path can never again be accidentally exposed as permitAll by a future change to that
  general rule. An anonymous request now gets 401 with a clear message; an authenticated-but-wrong
  identity (e.g. staff) gets 403 — both verified live.
- `RequestTradeInQuoteRequest`'s `guestEmail`/`guestName`/`guestPhone` fields (no longer collected
  from any caller — the sole remaining creation endpoint, `POST /api/v1/shop/quotes`, is
  `ROLE_SHOP_CUSTOMER`-scoped and auto-attaches the caller's own id).
- `ShopTradeInQuoteService#getForGuestLookup` (backed the deleted lookup endpoint).

### Changed

- `ShopTradeInQuoteService#requestQuote` now requires a non-null `shopCustomerId` (throws 409 if
  ever called without one — defensive, since the only remaining caller always supplies one).
  Mandatory linkage for new quotes is an **application-layer** rule only, not a schema change: the
  DB identity `CHECK` (`shop_customer_id IS NOT NULL OR guest_email IS NOT NULL`) is deliberately
  left as-is rather than hardened to `NOT NULL`, since a Postgres `CHECK` re-validates the *whole
  row* on every `UPDATE`, not just `INSERT` — a hard constraint would break staff's routine
  receive/inspect/complete/return calls against pre-existing legacy null-customer rows.
- `frontend/src/pages/shop/TradeInQuotePage.tsx`: a signed-out visitor now sees a sign-in/register
  prompt (linking to `/shop/login` and `/shop/register`, explaining staff need to contact and pay
  the seller) instead of the request form — no guest contact fields are collected anywhere on the
  page any more. A signed-in customer sees the same form as before.
- `frontend/src/pages/shop/TradeInQuoteLookupPage.tsx`: repointed towards `/shop/account` (where
  quotes now always live) and sign-in/register — no longer performs a quote-number+email lookup,
  since the backing guest endpoint is gone.

### Added

- `V43__close_legacy_guest_quotes.sql` — **legacy row policy** (chosen over "leave in place
  untouched", see the migration's own javadoc for the full justification): pre-existing guest rows
  (`shop_customer_id IS NULL`, mostly test data from earlier verification passes — 27 such rows,
  none ever reached `ACCEPTED`/`DECLINED`/`COMPLETED`/`RETURNED` because a guest never had an
  accept/decline path) are **never deleted** and **never retrofitted** with a `shopCustomerId`.
  Instead, any such row still sitting in an open/actionable status (`QUOTED`/`RECEIVED`/
  `OFFER_MADE`) is swept to `EXPIRED` — an existing status already meaning "no longer actionable",
  not a new enum value or schema change. Verified live: all 27 legacy rows closed to `EXPIRED`,
  staff admin endpoints (`list`/`receive`/etc., all five roles) confirmed not to 500 against them.

### Fixed

- Regression risk closed: `shop-quotes.spec.ts` test (a) and
  `personas/shop-trade-in-declined.spec.ts`'s former "DISCLOSED GAP" test both used to *exercise*
  the guest permitAll path — both rewritten to assert the refusal instead, so a future accidental
  re-exposure of that path trips the suite.

## [Unreleased] - 2026-08-02 WEBSHOP verification gate: security fix, cross-check fix, persona e2e coverage

Verification gate for the WEBSHOP online-shop layer (customer accounts, orders/reservations,
postal trade-in quotes, dormant payment gateway) built across three parallel sessions. Re-proved
the security boundary live (found and fixed one real, confirmed access-control gap), added the
five owner-specified persona scenarios, checked the PoS-vs-reservation and trade-in-vs-oversight
cross-feature questions live, and re-ran the full regression suite. See the new `webshop` skill
for the module write-up.

### Fixed

- **Security: a logged-in shop customer could reach the entire staff trade-in-quote admin
  surface** (`ShopAdminQuoteController`, `/api/v1/shop/admin/quotes/**`). The controller carried no
  `@PreAuthorize`, mirroring the (unrelated) `PosTradeInController` "no restriction, any staff
  role" precedent — safe there only because `/api/v1/pos/**` is never authenticated by
  `ShopCustomerAuthenticationFilter`. This controller sits under `/api/v1/shop/**`, which that
  filter *does* authenticate (granting `ROLE_SHOP_CUSTOMER`), and `SecurityConfig`'s
  `/api/v1/shop/admin/**` matcher was only `authenticated()` — satisfied just as well by a shop
  customer as by staff. Proven live before the fix: a logged-in shop customer could list every
  customer's/guest's trade-in quotes (PII, quoted amounts) and call every mutating admin action
  (`receive`/`inspect`/`complete`/`return`) on an arbitrary quote id. Fixed with a new
  `RoleRules.ANY_STAFF_ROLE` constant applied as a class-level `@PreAuthorize`; re-verified live
  (customer → 403, every staff role → 200/unchanged) and regression-guarded in a new test in
  `shop-quotes.spec.ts`.
- **Oversight money-flow cross-check false positive for fulfilled web orders** (same class of bug
  the existing invoice fix addressed). `MoneyFlowService`'s posted-journal cross-check never
  counted `ShopOrder` revenue on the operational side, even though `ShopOrderService#fulfilOrder`
  posts a real Sales Revenue (4100) credit — so any environment with a fulfilled online order
  permanently showed `matchesOperational: false` with a "check for a manual posting error" note
  that had nothing to do with the actual cause. Proven live (a single fulfilled RM250 web order
  produced exactly that false mismatch). Fixed the same narrow way as the invoice precedent: added
  `ShopOrderRepository#findByStatusAndUpdatedAtBetween` and folded FULFILLED order totals into the
  cross-check's comparable operational figure only — the headline `totalRevenue`/COGS/payment-
  method breakdown are unchanged (a real, larger, still-undisclosed reporting gap — see the
  `webshop` skill).

### Added

- Five persona e2e scenarios under `frontend/tests/e2e/personas/`: `shop-guest-buyer.spec.ts`,
  `shop-member-buyer.spec.ts`, `shop-trade-in-accepted.spec.ts`, `shop-trade-in-declined.spec.ts`,
  `shop-reservation-expiry.spec.ts` — see the `personas` and `webshop` skills for what each covers.
- New `.claude/skills/webshop/SKILL.md`.
- Regression test in `shop-quotes.spec.ts` guarding the security fix above.

### Disclosed (not fixed this pass — flagged for a future task, see the `webshop` skill)

- Online order fulfilment does not auto-issue an in-house warranty for a `warrantyMonths`-bearing
  product, unlike a PoS sale or SO delivery.
- No supported way to void an already-**fulfilled** online order (only `RESERVED`/
  `AWAITING_PAYMENT` can be cancelled).
- A **guest** postal trade-in quote has no way at all to accept/decline the final staff offer
  (`accept-offer`/`decline-offer` are `SHOP_CUSTOMER`-scoped only; the guest lookup page is
  read-only).
- The oversight money-flow day book's headline revenue/COGS/payment-method figures still don't
  attribute anything to web orders (only the cross-check was fixed, see above).

### Verified

- Full security matrix (staff↔shop-customer cross-boundary, cross-customer order/quote isolation,
  guest lookup non-leakage, public catalogue exclusions) via live curls.
- Reservation → PoS oversell guard: a unit reserved by an online order is independently rejected
  by `PosSaleService`'s own stock check — no cross-module change needed.
- Completed postal trade-in appears in the branch manager's item trace and money-flow day book
  (via the existing, unmodified `PosTradeInService`).
- Reservation expiry release mechanism (live, via direct Postgres backdating + the manual staff
  release trigger): `RESERVED → EXPIRED`, stock returned, `SHOP_RELEASE` movement, storefront shows
  the item purchasable again.
- Full Playwright regression suite, two full runs: run 1 (329 tests, chromium) found 1 real
  failure — a bug in the new item-trace assertion itself (`ItemTraceEventDto`'s field is
  `documentNumber`, not `reference`), fixed immediately — plus 2 pre-existing flaky tests
  unrelated to this work (passed on retry). Run 2 (clean re-run after the fix, backend restarted):
  **320 passed, 2 flaky (different pre-existing tests, passed on retry), 7 skipped, 0 failed**
  (7.8m).
- `scripts/run-backend-tests.sh`: **Tests run: 22, Failures: 0, Errors: 0, Skipped: 0. BUILD
  SUCCESS.**

## [Unreleased] - 2026-08-01 optional AI trade-in matching

Adds an optional, disabled-by-default local LLM reranker for the PoS Trade-In panel's product
matching only (never pricing) — see the `pos` skill for the full write-up. Also fixes one latent
NPE found in the existing deterministic code path while verifying this feature.

### Added

- **Optional AI trade-in product matching** (`mulaerp.tradein.ai-match.*`, default `enabled:
  false`): `com.mulaerp.ai.OllamaTradeInMatcher` talks to a local Ollama instance (new `ollama`
  Compose service, behind `profiles: ["ai"]` so the default stack/CI is untouched) over
  `/api/generate` with `format: "json"`, asking it to pick the best-matching SKU from the
  already-retrieved trigram/ILIKE candidate list (`TradeInSuggestionService`) and parse
  condition/hasBox/accessories hints out of the free-text query. Hard constraints, all enforced in
  `OllamaTradeInMatcher`: disabled by default (no HTTP client even constructed when off); the
  returned SKU **must** be one of the candidates handed to it or the whole result is discarded
  (proven live via a prompt-injection-style query attempting to force an off-list SKU — discarded
  and logged, never surfaced); a hard timeout (`timeout-ms`, default 2000ms); any timeout/
  connection error/malformed JSON logged at INFO (never ERROR) and falls back to the unchanged
  deterministic result — proven live by stopping the `ollama` container mid-session (clean ~1s
  fallback, no 500, no hang). Price (`suggestedCashOffer`/`suggestedCreditOffer`) is never touched
  by any of this — the deterministic formula in `TradeInSuggestionService` is unaffected either way.
  API response stays a bare JSON array (unchanged for backward compatibility) with two new
  additive fields per candidate (`aiSuggested`, `aiMatch`) rather than a top-level sibling of the
  array, since a JSON array can't carry extra non-index properties on the wire.
- `RegisterPage.tsx`: deterministic trade-in suggestions render immediately as before; when the
  backend marks a row `aiSuggested`, it gets an accessible "AI suggested" badge and — only for
  condition/hasBox/accessories fields the cashier hasn't already touched by hand (new dirty-tracking
  flags, same pattern as the existing cash/credit-offer dirty tracking) — the parsed hints pre-fill.
  An `AbortController` cancels the previous in-flight suggest request whenever the query changes, so
  a slow model response can never land after the cashier has moved on and apply stale hints.
- **Measured latency** (real, not estimated — see README "AI trade-in matching (optional)" for the
  full table and methodology): `qwen2.5:0.5b` (the default model) p50 1134ms / max 1831ms across 15
  warm runs; `llama3.2:1b` p50 1620ms / max 2068ms (several runs at/over the 2s default timeout).
  Neither model reliably fixed the two failure modes this was meant to address (brand synonyms,
  full sentences) — in testing, the deterministic top-8 candidate retrieval simply didn't contain
  the correct product for those queries at all, so no reranker could recover it. **Recommendation:
  leave this disabled on a shop counter box** — see the README section for the full reasoning.

### Fixed

- **`GET /pos/trade-ins/suggest` 500 when every retrieved candidate lacked a category**:
  `TradeInSuggestionService#resolveCategoryNames` returns `Map.of()` when no candidate has a
  category, and `Map.of()` throws `NullPointerException` from its own `.get()` on a null key by
  design (found while load-testing the AI reranker above against a dev DB with several
  uncategorised trade-in-created products — unrelated to the AI change itself, this exact lookup
  existed unchanged beforehand). Fixed by guarding the lookup itself
  (`c.categoryId() != null ? categoryNames.get(...) : null`) rather than relying on which `Map`
  implementation the resolver happens to return for the empty case.

## [Unreleased] - 2026-08-01 oversight/payment fixes

Three targeted fixes: the money-flow cross-check's false-positive mismatch, unmapped API paths
returning 500 instead of 404, and cancelled payments leaving their journal entry behind.

### Fixed

- **Money-flow cross-check false positive**: `MoneyFlowService#buildCrossCheck` compared an
  operational revenue tally (PoS + repair only) against POSTED journal revenue on Sales
  Revenue (4100) / Service Revenue (4200) - but every invoice also posts to 4100 at creation
  time regardless of its own DRAFT/SENT/PAID/OVERDUE/CANCELLED status, so on any environment with
  real invoice activity (this dev DB has ~RM88k of it) the two sides could never agree, and the
  banner permanently reported `matchesOperational: false` for a reason that had nothing to do
  with unposted drafts. Chose option (a): the operational side now also sums invoice revenue for
  the period (`OversightInvoiceRepository`), so both sides cover the same ground; the headline
  `totalRevenue` figure (used for gross margin, which has no invoice-side COGS) is unchanged. The
  banner also now explicitly looks up unposted DRAFT entries touching revenue accounts for the
  period (`OversightJournalEntryRepository`) and treats their presence as a mismatch in its own
  right (named in `unpostedDraftRevenueEntryNumbers`), even when the two raw sums happen to
  agree - previously a manual DRAFT entry wouldn't move either side's sum and so went unnoticed.
  Verified live: a period with a real mix of PoS/repair/invoice activity and nothing unposted
  reports no mismatch; creating a manual DRAFT entry crediting Sales Revenue for the same period
  immediately reports a mismatch naming that entry number; deleting it clears the banner back to
  matching. New DTO fields: `PostedJournalCrossCheckDto.unpostedDraftRevenueCount`/
  `unpostedDraftRevenueEntryNumbers`.
- **Unmapped API paths returned 500**: a typo'd/unmapped path (e.g. `GET
  /api/v1/accounting/trial-balance` instead of the real `/api/v1/accounting/reports/trial-balance`)
  raised Spring's `NoResourceFoundException` ("No static resource ...") on Spring Boot 3.4/
  Framework 6.2, which fell through to `GlobalExceptionHandler`'s generic `Exception` handler and
  was logged as an "Unhandled Exception" 500. Added dedicated handlers for
  `NoResourceFoundException` (the one actually observed) and `NoHandlerFoundException` (defensive
  companion, in case `spring.mvc.throw-exception-if-no-handler-found` is ever enabled), both
  mapping to 404 with the standard `{timestamp,status,error,message,path,fieldErrors}` shape and a
  message naming the method/path that wasn't found. Genuine unexpected exceptions are unaffected -
  the `RuntimeException`/`Exception` catch-all handlers are untouched and still log a stack trace
  and return 500 (confirmed via an existing endpoint's invalid-UUID-format 400 still working
  unchanged, proving the routing/handler chain around it wasn't disturbed).
- **Payment cancellation left its journal entry behind**: `PaymentService#updateStatus(CANCELLED)`
  reversed the invoice's `paidAmount`/status but never reversed the Cash/Accounts-Receivable
  journal entry the payment posted at creation, so cancelling a payment silently left revenue/cash
  recognised as if the payment still stood. Cancelling a `COMPLETED` payment now also posts a
  reversing SYSTEM entry (`createPaymentCancellationJournalEntry`) - exact mirror image of the
  original (debit AR, credit the cash/clearing account resolved from `payment.getMethod()` via
  `CashAccountResolver`, same as every other reversal in this codebase) - auto-posted per the same
  policy as the original, never editing/deleting it. Idempotent by construction: both the invoice
  reversal and the journal reversal are gated on `oldStatus == COMPLETED` (read before the status
  is overwritten), so cancelling an already-CANCELLED payment is a no-op on both counts - no new
  flag/column needed. Verified live: invoice + BANK_TRANSFER payment created (RM500), cancelled -
  reversing entry posted, the 1114/1120 legs net to zero across the pair, a second cancel call
  created no further entries and left the invoice unchanged, and the trial balance
  (debits == credits) and balance sheet (assets == liabilities + equity) still held afterwards.

## [Unreleased] - cash/clearing account split, guided part-exchange void, repair refunds, trade-in catalogue linking

Four migrations (`V35`-`V38`) landed with no changelog entry of their own until this documentation
pass found the gap — all four are real, shipped, and already partially documented in the
`accounting`/`pos`/`repair-warranty` skills; recorded here for a complete history.

### Added

- **Cash/clearing account split** (`V35__split_cash_clearing_accounts.sql`, `CashAccountResolver`):
  every posting site that used to hardcode account `1110 Cash and Cash Equivalents` regardless of
  how the customer paid (`PosSaleService`, `PosTradeInService`, `PaymentService`,
  `RepairJobService`) now resolves the cash/clearing leg from the payment method: `CASH` → `1111`
  Cash on Hand, `CARD`/`CREDIT_CARD`/`DEBIT_CARD` → `1112` Card Clearing, `EWALLET` → `1113`
  E-Wallet Clearing, `BANK_TRANSFER`/`CHECK` → `1114` Bank Account, `STORE_CREDIT` → `2140` Store
  Credit Liability. `1110` is kept exactly as posted history left it but marked inactive - a
  go-forward split, not a restatement. `BankReconciliationService#match` additionally posts a new
  non-blocking clearing entry (`Dr 1114 / Cr 1112-or-1113`) when a bank statement line matches a
  CARD/EWALLET payment, since a match is the evidence the money actually reached the bank;
  `#unmatch` reverses it by reading back the entry's own posted lines, not by recomputing the
  mapping. See the `accounting` skill's "Cash/clearing account split" section.
- **Guided part-exchange void** (`V36__part_exchange_void.sql`): `POST /pos/sales/{id}/void` now
  fully reverses a part-exchange sale (`tradeInId` set) as a third leg alongside the sold-goods
  reversal - the traded-in item's stock is removed again (new `TRADE_IN_VOID` movement type,
  negative delta), the trade-in flips to `VOIDED`, its Inventory journal leg reverses, and any
  trade-in over-valuation store-credit grant is clawed back from the member. Refused (409) only in
  two specific unsafe cases: the traded-in item has already moved on (resold/consumed as a repair
  part/transferred/adjusted down since receipt), or the member has already spent the store credit
  being clawed back - not a blanket refusal of every part-exchange sale. New columns:
  `pos_trade_ins.status`/`voided_at`, `pos_sales.trade_in_store_credit_granted`.
- **Repair payment refunds** (`V37__repair_payment_refunds.sql`): `repair_payments` gains
  `is_refund`/`original_payment_id`/`refund_reason`/`refunded_by` so a repair job can give money
  back (cancelled after a deposit, overpayment at collection, re-quote lower than the deposit, a
  goodwill refund) without ever writing a negative `amount` - refund rows stay append-only and
  positive, linked back to the payment they refund. The journal treatment (clear a deposit
  liability vs. reverse recognised revenue) is derived from the job's status, never guessed from
  `amount_type`. The refunded account is resolved via `CashAccountResolver`, same as every other
  posting site.
- **Trade-in catalogue linking** (`V38__trade_in_catalogue_link.sql`): the register's Trade-In
  panel can now link a trade-in line to an *existing* catalogue product instead of always minting a
  brand-new one-off Product per intake (previously: trading in five of the same console over a
  month fragmented the catalogue into five products with five spellings, stock never
  consolidated). Adds a `pg_trgm`-backed `GET /api/v1/pos/trade-ins/suggest` endpoint (deterministic
  trigram/ILIKE candidate search + `buyPrice x conditionMultiplier x box-bonus` pricing - the
  optional AI reranker documented elsewhere sits on top of this, matching only) and a weighted-average
  acquisition-cost recompute when a line links to an existing product with existing stock. A voided
  part-exchange (`V36`, above) restores the product's pre-trade-in `acquisitionCost` exactly for a
  linked line, rather than trying to back it out of the weighted average.

## [Unreleased] - 2026-07-31 overhaul

Everything below is currently uncommitted working-tree state (`git diff --stat`
against `HEAD` shows 145 tracked files changed, +6,079/-1,849 lines, plus
untracked files/directories not yet counted in that diff — new backend
modules, migrations V14-V27 and V29-V30 (no `V28`), new frontend pages/libs,
the test suite additions including `frontend/tests/e2e/personas/`, and the
`.claude/`, `.github/`, `.githooks/` scaffolding).

### Added

- Real server-enforced authentication: session restored via `GET /auth/me`
  against the httpOnly `MULAERP_AUTH` cookie, replacing a hardcoded dev user
  in `AuthContext`.
- `ADMIN` / `MANAGER` / `USER` roles enforced server-side via
  `@EnableMethodSecurity`/`@PreAuthorize`, replacing a blanket
  `anyRequest().permitAll()`.
- Optimistic locking: `@Version` column (`V23`) across 27 `BaseEntity` tables,
  plus service-level comparison of client-submitted vs. loaded version on
  update flows (stale writes surface as 409).
- httpOnly cookie auth migration: `POST /auth/login` sets a `SameSite=Lax`,
  `Path=/` `MULAERP_AUTH` cookie; `JwtAuthenticationFilter` checks the
  `Authorization` header first and falls back to the cookie, so Bearer-token
  API clients keep working alongside browser cookie auth.
- White-label branding: `frontend/src/branding.ts` + `VITE_BRAND_*` env vars,
  `brand-*` Tailwind theme tokens (`index.css`), logo/favicon slots, backend
  `BRAND_NAME` for email subjects/bodies (`.claude/skills/branding/SKILL.md`).
- PoS suite: register with an offline sale queue (`lib/pos-offline.ts`,
  localStorage-only), customer-facing display synced via `BroadcastChannel`
  with a `localStorage`/`storage`-event fallback (`lib/pos-broadcast.ts`),
  thrift-store item intake (`/pos/intake`), members with BASIC/SILVER/GOLD
  tiers and points accrual, vouchers with validate/apply.
- Accounting: P&L and balance sheet statements (`FinancialStatementController`),
  PDF/CSV export via OpenPDF, invoice PDF (`InvoicePdfService`), non-blocking
  automatic draft journal postings from invoices/payments/PoS sales/repairs,
  bank reconciliation (CSV statement import, match/unmatch, suggestions within
  a ±3-day window), and a Postgres constraint trigger blocking any unbalanced
  journal from posting.
- Inventory: multi-warehouse model with a default `MAIN` warehouse (`V16`),
  batch/lot and serial-number tracking linked into sales/purchase order lines
  (`V19`), and an append-only stock movement ledger with a reconcile endpoint
  (`V22`).
- Repair and warranty: repair job lifecycle through to `COLLECTED`, in-house
  warranty auto-issued from `warrantyMonths` on PoS sale or sales-order
  delivery, public warranty checker (`V24`).
- B2C storefront and public API: anonymous catalogue at `/`, backed by
  `/api/v1/public/**` (`permitAll`, deliberately excludes cost price, raw
  stock counts, and internal IDs beyond SKU).
- Multi-currency: `currencies` table (`V25`) seeded with MYR as base plus
  four placeholder cross-rates; storefront currency switcher
  (`CurrencyContext`) converts from the admin-editable rate.
- Product images: per-product photo upload (`ProductImageController`/
  `ProductImageService`, ADMIN/MANAGER, jpg/jpeg/png/webp, ~5MB), served
  anonymously; zero-copyright SVG placeholders for products with no upload
  (`V26` adds `image_url`).
- Seed data, CSV imports, and a scraped catalogue: idempotent
  `DemoDataSeeder` (seeds entirely through the normal service layer, never
  raw SQL), tolerant CSV importers for products and customers, and a
  ~500-item console/game catalogue in `scripts/seed-data/` sourced from
  scraped `gamershideout` sheets (MYR pricing).
- Site-wide audit log: `AuditPersistenceEventListener` registered directly
  against Hibernate's `EventListenerRegistry`, viewer UI at
  `/settings/audit-logs`, `username`/`change_summary` columns (`V20`).
- Consistent JSON error contract
  (`{timestamp, status, error, message, path, fieldErrors?}`) via
  `GlobalExceptionHandler`, now also applied to Spring Security
  filter-chain 401/403 responses via a custom `AuthenticationEntryPoint`/
  `AccessDeniedHandler` (previously these fell through to Spring Security's
  own bare-text defaults).
- Auth-scoped rate limiter (Bucket4j, 300 requests/15 min per source IP,
  keyed on the direct socket address rather than the spoofable
  `X-Forwarded-For` header), narrowed to `/api/v1/auth/**` and returning the
  same JSON error shape as the rest of the API.
- Email wiring: `EmailNotificationScheduler`, `EmailTemplateService`
  (brand-aware subjects/bodies), non-blocking send hooks.
- Test infrastructure: full Playwright e2e gate (212 chromium tests across
  26 spec files, dockerized via `docker-compose.e2e.yml` +
  `scripts/run-e2e-docker.sh`), 22 backend integration tests
  (`backend/src/test/java/com/mulaerp/it/`), `make check` pre-push gate
  (`Makefile`), opt-in pre-push hook (`.githooks/pre-push` +
  `scripts/install-hooks.sh`).
- Dependabot/CI scaffolding: `.github/dependabot.yml` (weekly npm/Maven/
  Docker/GitHub Actions PRs, grouped minor/patch bumps) and
  `.github/workflows/dependency-checks.yml` — both dormant until this repo
  is pushed to GitHub.
- Project docs and skills: `CLAUDE.md`, and nine skills under
  `.claude/skills/` (`accounting`, `backend-dev`, `branding`, `data-tools`,
  `e2e-tests`, `frontend-dev`, `inventory`, `pos`, `run-stack`).
- Five-role model (`V27__expand_role_model.sql`): `ADMIN`/`MANAGER`/
  `ACCOUNTANT`/`INVENTORY`/`CASHIER` replace `ADMIN`/`MANAGER`/`USER` (old
  `USER` rows data-migrated to `CASHIER`); the whole `@PreAuthorize` matrix is
  centralised in `RoleRules.java` (`ADMIN_ONLY`, `MANAGER_UP`,
  `ACCOUNTANT_WRITERS`, `STOCK_WRITERS`, `PRODUCT_CREATE`,
  `CUSTOMER_MEMBER_CREATE`); journal posting moved from ADMIN-only to
  ACCOUNTANT-and-up. Dev seed accounts `cashier@`/`accountant@`/`inventory@`/
  `manager@mulaerp.com` added alongside `admin@`, all password `admin123`.
- Accounting: bulk draft posting — `GET
  /accounting/journal-entries/drafts/preview` (grouped-by-source preview) and
  `POST /accounting/journal-entries/post-batch` (all-or-nothing batch post by
  id list or date range), plus a `PostDraftsPage` UI, so the auto-generated
  PoS/invoice/payment/repair `DRAFT` entries can reach `POSTED` without a
  per-row confirm dialog — P&L/balance sheet/trial balance only ever counted
  `POSTED` entries and previously always read zero.
- Trade-in and part-exchange (`V29__trade_in_store_credit_repair_parts_payments.sql`):
  `POST /api/v1/pos/trade-ins` (payout `CASH` or `STORE_CREDIT`); member
  store-credit balance (`members.store_credit_balance`) with server-side
  overdraft protection; part-exchange via a `tradeIn` sub-object on the PoS
  sale request, netting against the sale (`netCashDirection`/`netCashAmount`
  — the shop can end up owing the customer); store-credit redemption in the
  discount chain (member % → voucher → cart discount → store credit → net
  cash/tender); new stock movement types `TRADE_IN_RECEIPT` and
  `REPAIR_PART_CONSUMED`; new accounts `2140 Store Credit Liability` and
  `2150 Customer Deposits`.
- Repair service completed (`V29`): `repair_parts` consumed from stock at the
  `IN_REPAIR` transition (posting COGS/Inventory even for a warranty claim,
  reversed if the job is cancelled back out of `IN_REPAIR`); `repair_payments`
  (deposit/balance/full, incl. `STORE_CREDIT`); `COLLECTED` rejected (409)
  until fully paid; a promised date and an approved-at timestamp; a
  workmanship warranty auto-issued at collection
  (`mulaerp.repair.warranty-months`); a public repair-status lookup
  `GET /api/v1/public/repairs/{jobNumber}` (`PublicRepairController`, no
  storefront page wired to it yet).
- Oversight (`V30__oversight_cash_ups.sql`, MANAGER/ADMIN, `/oversight`):
  item trace, a money-flow day book sourced from operational tables with a
  posted-journal cross-check that flags mismatches, exceptions (deep
  discounts, near-price-floor sales, unposted drafts, unreconciled bank
  lines, stuck repair jobs, per-cashier totals), and a cash-up/Z-report with
  variance and a stamped approver (`cash_ups` table, one row per date +
  payment method).
- Persona-based testing: `.claude/skills/personas/SKILL.md` documents five
  business personas (seller, buyer, accountant, inventory staff, branch
  manager), each mapped to a real login role, with scenario specs under
  `frontend/tests/e2e/personas/*.spec.ts` (6 new spec files).
- Two new skills documenting previously-undocumented domains:
  `.claude/skills/repair-warranty/SKILL.md` (repair job lifecycle, parts/COGS,
  payments, warranty issue/claim/void, public repair-status lookup) and
  `.claude/skills/oversight/SKILL.md` (item trace, money-flow cross-check,
  exceptions, cash-up).
- Automatic FX rates (`V31__automatic_fx_rates.sql`): `POST
  /api/v1/currencies/refresh-rates` (`RoleRules.MANAGER_UP`) fetches MYR → X
  rates from `open.er-api.com`, falling back to `frankfurter.app`, on a daily
  schedule (default 06:00 `Asia/Kuala_Lumpur`, `mulaerp.fx.enabled`/
  `schedule-cron`) or on demand; `currencies.rate_source`
  (`MANUAL`/`AUTO`)/`rate_fetched_at` track provenance, with a same-day
  manual-override grace period so an operator's edit isn't immediately
  clobbered by the next refresh; every attempt is recorded in
  `fx_rate_fetch_log` (`GET /currencies/fetch-log`); MYR itself is never
  touched (stays `1.0`).
- Guided stock-take (`V32__stock_take_sessions.sql`): `POST
  /api/v1/inventory/stock-takes` opens a session for one warehouse,
  snapshotting its current stock as count-sheet expected quantities; staff
  record counts and submit for review; a manager approves
  (`RoleRules.MANAGER_UP`), which is the only step that moves stock, writing
  one `RECOUNT` adjustment per non-zero-variance line through the existing
  adjustment path (so it moves stock/writes the ledger exactly like a manual
  RECOUNT would).
- Auto-posting for system-generated journal entries: `AccountingService
  #createSystemEntry` (used by the PoS/invoice/payment/repair hooks) now
  posts immediately by default (`mulaerp.accounting.auto-post-system-entries`,
  env `AUTO_POST_SYSTEM_ENTRIES`, default `true`), instead of landing as an
  unposted `DRAFT` that needed a separate post step. Manually-created journal
  entries are unaffected and still land `DRAFT`. `ProfitLossDTO`/
  `BalanceSheetDTO` gained a `draftEntriesInPeriod` count.
- PoS sale void & refund (`V34__pos_sale_void_refund.sql`): `POST
  /api/v1/pos/sales/{id}/void` (`RoleRules.MANAGER_UP` — the one endpoint on
  `PosSaleController` not open to every staff role) returns stock (new
  `SALE_VOID` movement type, original `POS_SALE` row untouched), reverses the
  sale's journal entries (auto-posted immediately, mirroring the original),
  and reports the physical `refundMethod`/`refundAmount` to hand back
  (store-credit/points/voucher reversal is automatic and excluded from that
  figure). Rejects (409) an already-voided sale or any part-exchange sale —
  those three legs (sale, trade-in credit, traded-in item's stock receipt)
  must be reversed manually. Surfaced in oversight: excluded from the
  money-flow day book's totals, listed in Exceptions'
  `voidedSales`/`voidedSaleCount`, and shown as both the original `POS_SALE`
  and a `SALE_VOID` event on the item trace.

### Changed

- `README.md` substantially rewritten (432 of 341 lines touched) against
  actual code and test runs, replacing prior marketing-style claims with a
  verified feature list and an honest Status/caveats section.
- `compose.yaml`: `DATABASE_URL`/`DATABASE_USERNAME`/`DATABASE_DRIVER` env
  vars replaced with `DATABASE_HOST`/`PORT`/`NAME`/`USER` to match
  `application.yml`'s `spring.datasource` block; added `SEED_DEMO_DATA`,
  `BRAND_NAME`, an `uploads` volume for product images, and moved
  `db-backup` behind `profiles: ["backup"]` so it no longer starts by
  default.
- Frontend `VITE_API_BASE_URL` switched from a hardcoded
  `http://localhost:8080` to a relative `/api/v1`, routed through Vite's dev
  proxy so frontend and backend appear same-origin.
- UI restyle: slate surfaces with a single `brand-*`/blue accent replacing
  the previous gradient/purple sidebar and card styling, applied across
  ~35 pages and the shared UI kit (`Badge`, `Button`, `Card`, `DataTable`,
  `Input`, `Modal`, `Select`, `Tabs`, `Textarea`, `Toast`).
- `SalesOrderRepository`'s generic type changed from
  `JpaRepository<SalesOrder, String>` to `<SalesOrder, UUID>` to match the
  entity's actual ID type.
- `backend/pom.xml`: added `flyway-database-postgresql` and `openpdf`
  1.3.42 dependencies; `maven-surefire-plugin` configured to also pick up
  `*IT.java` integration tests (previously only `*Test.java`/`*Tests.java`).
- Stock ledger integrity: product `stockQuantity` is no longer directly
  editable via `PUT /products/{id}` — the edit form field is read-only once a
  product exists and the server ignores a submitted value; every stock
  change now goes through an adjustment, transfer, or PO/SO receipt/delivery,
  each writing a `StockMovement` row. PO receipt and SO delivery now
  attribute the movement to a warehouse (previously `warehouseId` was left
  null on these two paths).
- `createdBy` exposed on the PoS sale DTO (was already captured by
  `BaseEntity` auditing, just not surfaced to API callers).
- Audit log (`GET /audit-logs`) supports an `entityId` filter alongside the
  existing entity type/username/action/date-range filters, for pulling a
  single entity's full history.

### Fixed

- Product edits were impossible: `UpdateProductRequest.stockQuantity` stayed
  `@NotNull` after the ledger fix made the server ignore that field, so every
  `PUT /products/{id}` returned 400 "Stock quantity is required" while the
  form's own field was read-only — no product could have its price, warranty
  term or thrift details changed. The field is now optional and still ignored.
- Persona scenario specs: the branch-manager setup resolved products by
  filtering a 700-row catalogue list, which raced its debounce; it now looks the
  id up via the API before opening the edit page.
- Sales-order UUID repository mismatch: `SalesOrderRepository` was typed
  against `String` and `countByStatus` bound a raw `String` against an enum
  column, throwing `QueryArgumentException` on every call — silently
  swallowed inside `AnalyticsService.getDashboardStats()` but a 500 for any
  other caller.
- Redis/`PageImpl` cache 500s: `GenericJackson2JsonRedisSerializer`'s default
  `ObjectMapper` didn't register `JavaTimeModule`, so any cached DTO with a
  `LocalDateTime` field failed to serialize, 500ing cached GETs (e.g.
  `GET /products/{id}`) while the equivalent POST worked fine; `CacheConfig`
  now supplies its own `ObjectMapper` with `JavaTimeModule` and default
  typing re-enabled.
- Rate-limiter `/auth/me` logouts: the limiter previously covered all of
  `/api/v1/auth/**` including `/auth/me`, which `AuthContext` calls on every
  page mount — routine navigation could exhaust the shared bucket, and the
  frontend treated a resulting 429 as a 401, forcing a spurious logout.
  `/auth/me` is now exempt from the limiter and a 429 is retried once before
  the session is cleared.
- Document-number collisions: `generateOrderNumber`/
  `generateAdjustmentNumber` used a second-precision timestamp alone, which
  collided under fast repeated calls; both now append a random hex suffix.
- Warehouse stock seeding: stock adjustments created before multi-warehouse
  support existed had no `warehouse_stock` row; `InventoryService` now
  defaults to the `MAIN` warehouse when the caller doesn't specify one.
- Flyway/PostgreSQL 16: added the `flyway-database-postgresql` dialect
  dependency — this Flyway version no longer bundles Postgres dialect
  support in `flyway-core` alone, so migrations failed to apply against
  `postgres:16-alpine` without it.
- Schema drift: `V15` adds every column/type fix required for JPA entities
  to match their actual tables, so Hibernate's `ddl-auto: validate` passes
  cleanly at boot.
- JWT boot/property mismatch: `JwtUtil` read `spring.security.jwt.secret`/
  `.expiration`, keys that don't exist in `application.yml` (the real keys
  are `jwt.secret`/`jwt.expiration`) — corrected the property paths.
- Admin login failure: `V14` replaces the admin password hash inserted by
  the now-removed `V3` migration with one verified against Spring's
  `BCryptPasswordEncoder`, which the old hash didn't authenticate against.
- Dev-mode auth bypass removed: `SecurityConfig` previously permitted
  `anyRequest()` unconditionally and `AuthContext` hardcoded a fake
  logged-in dev user; both are replaced by the real authentication flow
  above.
- Payment insert 500s: `V17` drops the legacy `payment_method` column, which
  kept a `NOT NULL` constraint nothing wrote to after `V15` introduced the
  entity-mapped `method` column, so every payment insert violated it.
- Sidebar nav click interception: removed `scale-105`/`hover:translate-x-1`
  transform effects on nav links (replaced with a plain colour-change
  active/hover state) and switched the fixed-position sidebar to a flex
  column layout, resolving overlap between the scrollable nav list and the
  bottom user-info panel that had been positioned with `absolute bottom-0`.
- 125 TypeScript build errors and assorted import/layout/Toast/`DataTable`
  issues across the frontend, resolved in the two most recent commits.
- Negative-stock guard: a stock adjustment that would take a product's
  quantity below zero is now rejected (400) instead of silently going
  negative.
- Reports understating the true financial position: PoS/invoice/payment/
  repair auto-journal hooks only ever posted `DRAFT` entries, and nothing
  previously made bulk-posting them practical, so P&L/balance sheet/trial
  balance read as zero even with real activity recorded — see bulk draft
  posting under Added.
- `SalesFlowIT` (backend integration suite) still asserted the invoice and
  payment auto-journal entries landed `DRAFT`, and separately posted the
  payment entry itself before checking the already-posted 409 guard — both
  now auto-post immediately (see auto-posting under Added), so the test
  asserted a status that no longer occurs and its own manual post call would
  have 409'd against an entry already posted. Updated both assertions to
  expect `POSTED` and to exercise the already-posted-guard directly.
- `stock-take.spec.ts` (e2e): the list-shell test's `getByText(/^open$/i)`
  matched the "Open" status-filter button *and* every OPEN badge in the
  list, tripping Playwright's strict-mode uniqueness check on any stack with
  more than one stock take already open — narrowed to the filter button via
  `getByRole('button', ...)`. The full count→submit→approve test called the
  UI's `login()` a second time on a page already authenticated via
  `apiLogin()` in the same test, which redirects `/login` straight to
  `/dashboard` for an already-logged-in session and hung waiting for a login
  form that would never appear; fixed by clearing cookies first. The same
  test's "approving twice must 409" check posted through the wrong browser
  context (`page`, authenticated as `inventory@`, which isn't permitted to
  call approve at all) and got a role-check 403 instead of ever exercising
  the already-approved 409 path — fixed to post through the manager's own
  context.

### Security

- `MULAERP_AUTH` is httpOnly and `SameSite=Lax`; the frontend no longer
  reads or stores the JWT itself. `Secure` is controlled by
  `AUTH_COOKIE_SECURE` (default `false` for local HTTP) — README documents
  this must be set `true` before any HTTPS deployment.
- Rate limiter keyed on the direct socket address rather than the
  spoofable `X-Forwarded-For` header.
- Public API contract enforced: `PublicProductDto`/`PublicCatalogService`
  never expose cost price, raw stock counts, or internal IDs beyond SKU.
- Every default secret in `compose.yaml` (`DATABASE_PASSWORD`,
  `REDIS_PASSWORD`, `JWT_SECRET`) flagged in README as dev-only placeholders
  requiring override via `.env` before any shared TEST/PROD environment.

## Historical (committed)

The committed history (46 commits, `2d9d916`..`1b24b65`) covers the project's
build-out from an empty repository through roughly seven development phases:
an initial monorepo scaffold with working auth (Phase 0), core product/
customer/supplier CRUD and a first component library (Phases 1-2), sales
orders and a colourful gradient-based UI pass (Phase 2-3 and several
subsequent Tailwind/styling fixes), dashboard analytics, reports, search and
notifications (Phase 4), a Playwright e2e suite and a "production ready"
milestone (Phase 5), and a broad Phase 6 push adding accounting, WebSocket
notifications, advanced inventory, and email notifications (6.1-6.8) —
interspersed with two rounds of "5S" documentation cleanup, an honest
production-readiness correction to the README, a Spring Boot 3.4/Java 21
upgrade, a licence change to the Business Source License 1.1, and, most
recently, fixes for all frontend import/layout/toast/`DataTable` issues and
125 TypeScript build errors.
