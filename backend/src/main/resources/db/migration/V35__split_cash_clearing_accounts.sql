-- Verified immediately before writing this migration: `ls db/migration` and the running
-- database's flyway_schema_history both show V34 as the latest applied version - so V35 is the
-- correct next free number.
--
-- WHY: every cash-leg posting site (PosSaleService/PosTradeInService/PaymentService/
-- RepairJobService, plus BankReconciliationService's new clearing entries) hardcoded account
-- 1110 "Cash and Cash Equivalents" regardless of how the customer actually paid, so the balance
-- sheet could never distinguish physical till cash from card/e-wallet money that hasn't settled
-- to the bank yet, and bank reconciliation had nothing of its own to clear against. See
-- CashAccountResolver (com.mulaerp.accounting.service) for the single-source-of-truth
-- payment-method -> account-code mapping now used at every posting site instead of a hardcoded
-- "1110".
--
-- 1110 is NOT rewritten or deleted here - it already has posted journal history from before this
-- migration (real transactions reference it), and a posted line must never be touched. It is
-- simply marked inactive (is_active = false) so the accountant UI/API can no longer pick it as
-- the target of a NEW manual journal entry; its historical balance stays exactly where it is, by
-- design - this is a go-forward split, not a restatement of the past.
UPDATE accounts SET is_active = false WHERE code = '1110';

-- ============================================
-- New cash/clearing accounts, seeded under the existing 1100 "Current Assets" parent - same
-- idempotent WHERE NOT EXISTS + parent-id-backfill style as V29's 2140/2150 seed (itself modelled
-- on V12's original chart of accounts).
-- ============================================
INSERT INTO accounts (code, name, account_type, description)
SELECT '1111', 'Cash on Hand', 'ASSET',
       'Physical till cash - CASH-tendered PoS sales, repair payments, and trade-in payouts'
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '1111');

INSERT INTO accounts (code, name, account_type, description)
SELECT '1112', 'Card Clearing', 'ASSET',
       'Card-tendered takings not yet settled to the bank - cleared to 1114 Bank Account once a bank statement match confirms settlement'
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '1112');

INSERT INTO accounts (code, name, account_type, description)
SELECT '1113', 'E-Wallet Clearing', 'ASSET',
       'E-wallet-tendered takings not yet settled to the bank - cleared to 1114 Bank Account once a bank statement match confirms settlement'
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '1113');

INSERT INTO accounts (code, name, account_type, description)
SELECT '1114', 'Bank Account', 'ASSET',
       'Funds in the bank - BANK_TRANSFER/CHECK payments post here directly; Card/E-Wallet Clearing move here once a bank statement match confirms settlement'
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '1114');

UPDATE accounts SET parent_id = (SELECT id FROM accounts WHERE code = '1100')
WHERE code IN ('1111', '1112', '1113', '1114') AND parent_id IS NULL;
