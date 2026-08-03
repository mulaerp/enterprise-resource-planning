---
name: accounting
description: Mula ERP accounting — chart of accounts, journal entries, P&L/balance sheet, invoice PDFs, and bank reconciliation. Use for accounting, journal, P&L, profit and loss, balance sheet, LHDN, export report, bank statement, reconciliation, invoice pdf.
---

# Accounting

Backend: `com.mulaerp.accounting` (`AccountingController`/`FinancialStatementController`/`AccountingService`), `com.mulaerp.banking`, `com.mulaerp.invoice`. Frontend: `frontend/src/pages/accounting/*`, routes under `/accounting/*`.

## Chart of accounts & journal entries

`AccountingController` (`/api/v1/accounting`) covers accounts + journal CRUD. Journal entries have a `DRAFT` → `POSTED` lifecycle. Since the five-role model (`V27`), account CRUD and journal create/update/**post**/delete are all `RoleRules.ACCOUNTANT_WRITERS` (ACCOUNTANT/MANAGER/ADMIN) — posting a journal entry is an ACCOUNTANT function now, no longer ADMIN-only. Reads (accounts/journal entries/reports) stay open to any authenticated user.

**Bulk draft posting** (`V29`-era work — fixes the "reports always read zero" audit finding): auto-generated `DRAFT` entries from PoS/invoice/payment/repair hooks can pile up ~180 at a time with no practical way to post them one dialog at a time. `GET /accounting/journal-entries/drafts/preview?startDate&endDate` returns a grouped-by-source preview; `POST /accounting/journal-entries/post-batch` posts a batch (by id list or date range) in one all-or-nothing transaction. Both `ACCOUNTANT_WRITERS`. Frontend: `PostDraftsPage.tsx` at `/accounting/journal-entries/post-drafts`.

**Auto-posting policy (current default)**: system-generated entries (see sources below) go through `AccountingService#createSystemEntry`, which auto-posts them immediately — saved `DRAFT` first (the `trg_journal_entry_balanced` trigger below needs the lines to already exist), then posted in the same call via the same validation/balance-update path as a manual `POST /journal-entries/{id}/post` — controlled by `mulaerp.accounting.auto-post-system-entries` (env `AUTO_POST_SYSTEM_ENTRIES`, **default `true`**). Set it `false` to fall back to the old draft-pile-up behaviour (e.g. for a branch that wants a human to review every system entry before it hits the reports).

**Manual entries are the one exception**: anything created via `POST /accounting/journal-entries` (the accountant UI/API, not a hook) always goes through the original `createJournalEntry` path and always lands `DRAFT` regardless of the auto-post flag — an accountant must explicitly `POST /journal-entries/{id}/post` (or use the batch endpoint below) to post one. `ProfitLossDTO`/`BalanceSheetDTO` carry a `draftEntriesInPeriod` count so a report caller can see at a glance whether any DRAFT entries exist for the period being reported — with auto-posting on, this should normally read `0` unless someone has created (and not yet posted) a manual entry.

**Draft-journal gotcha (now mostly a manual-entry concern)**: `FinancialStatementService` (P&L, balance sheet, trial balance) only ever counts `POSTED` entries. With auto-posting on (the default), the four system sources below no longer pile up as unposted drafts — but a manual journal entry still does, and still needs someone with `ACCOUNTANT_WRITERS` to post it (singly or via the batch endpoint below) before it shows up in a report.

A Postgres **constraint trigger** (`trg_journal_entry_balanced`, `V22__stock_movement_ledger_and_journal_balance_trigger.sql`) is the hard backstop: any transition of a `journal_entries` row's status to `POSTED` where `SUM(debit) != SUM(credit)` across its lines raises an exception and the whole transaction rolls back — this fires regardless of which code path posted the entry, so it can't be bypassed by a bug in `AccountingService`.

Auto-journal sources — all go through `createSystemEntry` (auto-post per the policy above), wrapped in `NonBlockingHookExecutor.runInNewTransaction` + try/catch so a hook failure can never roll back the source transaction (logged and swallowed on failure, source operation never fails because of it):
- Invoice (`InvoiceService#createInvoiceJournalEntry`)
- Payment (`PaymentService`) — debit the cash/clearing account resolved from `payment.getMethod()` via `CashAccountResolver`, credit Accounts Receivable (1120). **Cancellation reverses it**: `PaymentService#updateStatus(id, CANCELLED)` on a `COMPLETED` payment posts a mirror-image reversing SYSTEM entry (`createPaymentCancellationJournalEntry` — debit AR, credit the same cash/clearing account the original debited, never hardcoded) in addition to its existing invoice `paidAmount`/status reversal, so a cancelled payment no longer leaves revenue/cash recognised behind it; the original entry is never edited or deleted. Both reversals are gated on `oldStatus == COMPLETED` (read before the status is overwritten), which makes cancelling an already-CANCELLED payment a no-op on both counts — idempotent by construction, no separate flag/column needed.
- PoS sale (`PosSaleService` — see the `pos` skill; Cash/Sales + COGS/Inventory, plus store-credit-liability and trade-in lines when applicable; a void posts the exact mirror-image reversal the same way, see the `pos` skill's void/refund section)
- Repair job (`RepairJobService` — parts COGS at `IN_REPAIR`, Service Revenue at `COLLECTED`; see the `repair-warranty` skill)

## Chart of accounts additions (`V29`)

`2140 Store Credit Liability` (credited when a trade-in payout is store credit or a sale issues store credit; debited on redemption) and `2150 Customer Deposits` (repair deposits held before collection), both parented under `2100 Current Liabilities`.

## Cash/clearing account split (`V35__split_cash_clearing_accounts.sql`, `CashAccountResolver`)

**Every posting site that touches a customer's chosen payment method** (`PosSaleService`, `PosTradeInService`, `PaymentService`, `RepairJobService`, `BankReconciliationService`) resolves the cash/clearing leg through the single `CashAccountResolver.resolveCode(paymentMethod)` — never a hardcoded account. Before `V35`, every one of these hardcoded `1110 Cash and Cash Equivalents` regardless of how the customer actually paid, so the balance sheet couldn't distinguish physical till cash from unsettled card/e-wallet money, and bank reconciliation had nothing dedicated to clear against. Mapping (case-insensitive, unknown/blank input WARN-logs and falls back to Cash on Hand rather than failing the posting):

| Payment-method token | Account | Meaning |
|---|---|---|
| `CASH` | `1111` Cash on Hand | physical till cash |
| `CARD`/`CREDIT_CARD`/`DEBIT_CARD` | `1112` Card Clearing | card takings not yet settled to the bank |
| `EWALLET` | `1113` E-Wallet Clearing | same idea, e-wallet takings |
| `BANK_TRANSFER`/`CHECK` | `1114` Bank Account | lands straight in the bank, nothing to clear |
| `STORE_CREDIT` | `2140` Store Credit Liability | a liability movement, never till cash or a bank-clearing account |

`1110` itself is kept exactly as posted history left it but is marked **inactive** — nothing new can post to it. A reversal (PoS void, trade-in void, payment cancellation, repair refund) always re-resolves the same way from the original's own payment method, so it reverses the account that was actually used, not a hardcoded one.

**Clearing-to-bank sweep** (`BankReconciliationService#match`/`#unmatch`): matching a bank statement line to a `CARD`/`EWALLET` payment also posts a non-blocking `Dr 1114 Bank Account / Cr <1112 or 1113>` clearing entry — a bank match is exactly the evidence that money landed in the bank, so the clearing balance should now move to Bank. Skipped entirely for a `CASH` (never touches the bank), `BANK_TRANSFER`/`CHECK` (already 1114), or `STORE_CREDIT` (2140, never a real bank movement) payment. `unmatch` reverses the same entry by reading back the lines it actually posted (keyed on the payment number), not by recomputing the mapping — stays correct even if the mapping ever changes.

## Reports

`FinancialStatementController` (`/api/v1/accounting/reports`) is class-level `@PreAuthorize(RoleRules.ACCOUNTANT_WRITERS)` — every endpoint in it, including the GETs (was `ADMIN`/`MANAGER`-only before the five-role model; ACCOUNTANT now included). Endpoints: `GET /profit-loss?startDate&endDate`, `GET /balance-sheet?asOfDate`, and `/export` variants of both (`GET .../profit-loss/export?startDate&endDate&format=pdf|csv`, same for balance-sheet). Export builds via `FinancialStatementExportService` using **OpenPDF** (`com.github.librepdf:openpdf` in `backend/pom.xml`) for PDF, plain CSV otherwise; response has `Content-Disposition: attachment` so `lib/api.ts#downloadFile` on the frontend can save it.

## Currency / FX rates (`com.mulaerp.currency`, `V31__automatic_fx_rates.sql`)

`GET /api/v1/currencies` (any authenticated user); rate updates, manual refresh trigger, and fetch-log read are all `RoleRules.MANAGER_UP`. MYR is the base currency and is **never** touched by any of this — `MYR.rate` stays `1.0` always, and no accounting report (P&L, balance sheet, all posted in MYR) is affected by a currency's rate one way or the other; the currency table only feeds the storefront's currency-converted display prices.

- `POST /currencies/refresh-rates` fetches MYR → X rates from a free, keyless provider (`mulaerp.fx.providers`, default `https://open.er-api.com/v6/latest/MYR` with `https://api.frankfurter.app/latest?from=MYR` as fallback — first provider to answer with a non-empty rates map wins; 3s connect / 5s read timeouts). Also runs on a schedule (`@ConditionalOnProperty(mulaerp.fx.enabled)`, cron `mulaerp.fx.schedule-cron`, default `0 0 6 * * *` `Asia/Kuala_Lumpur`) — the scheduled path never rethrows, so a bad morning fetch can't crash anything.
- **Precedence rule** (`CurrencyRateApplier`): a currency last set by a manual `PUT /currencies/{code}` (`rateSource=MANUAL`) **on the same calendar day** it was previously under AUTO management is skipped by that day's refresh — an operator's same-day override isn't silently clobbered; it resumes auto-refreshing from the next scheduled day. A currency's pristine never-yet-auto-fetched default (`rateFetchedAt == null`) is not protected by this rule — it's eligible for its first auto-fetch immediately. A code the provider doesn't quote is left unchanged (stale beats null/zero).
- Every currency carries `rateSource` (`MANUAL`/`AUTO`) and `rateFetchedAt`, both surfaced on `CurrencyDto` — a manual `PUT` always stamps `MANUAL`; a successful auto-refresh stamps `AUTO`.
- `GET /currencies/fetch-log` (paginated, newest first) records every refresh attempt (`fx_rate_fetch_log`: provider, status, message, ratesUpdated) via `NonBlockingHookExecutor.runInNewTransaction`, so the log survives even if the caller's own transaction later rolls back. Every provider failing throws `FxProviderException` → `502` (a local `@ExceptionHandler` on `CurrencyController`, not the shared `GlobalExceptionHandler` — this exception type is owned by, and only ever thrown from within, this module).

## Invoice PDF

`GET /api/v1/invoices/{id}/pdf` (`InvoicePdfService`, also OpenPDF-based) — no explicit role restriction on this endpoint.

## Bank reconciliation (`com.mulaerp.banking`, UI at `/accounting/bank`)

All endpoints below are `RoleRules.ACCOUNTANT_WRITERS` unless noted (was MANAGER+ before the five-role model; ACCOUNTANT now included).

- `POST /bank/import` (multipart CSV) — parsed by `BankStatementParser`. Sample file: `scripts/sample-bank-statement.csv`.
- `GET /bank/transactions` (paginated, filterable by `reconciled`/date range) — no role restriction.
- `GET /bank/transactions/{id}/suggestions` — candidate payments within **±3 days** of the transaction date (`BankReconciliationService.MATCH_WINDOW_DAYS = 3`), ranked by date proximity.
- `POST /bank/transactions/{id}/match` — body is `{paymentId, force?}`. `force` defaults `false`; when `false` the match is rejected (400) if the payment amount doesn't equal the transaction amount — set `force: true` to override the amount check. There is no separate "force" endpoint, it's a flag on `match`.
- `POST /bank/transactions/{id}/unmatch`.
- `GET /bank/summary` (reconciled/unreconciled counts) — no role restriction.
