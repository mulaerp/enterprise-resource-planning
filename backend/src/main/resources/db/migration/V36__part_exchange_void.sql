-- V36: guided part-exchange void reversal.
--
-- Today POST /pos/sales/{id}/void rejects (409) any sale with a trade-in attached - reversing the
-- sold-goods leg, the traded-in item's own stock receipt, and the money (cash/store-credit/points/
-- voucher) leg together safely was deferred. This migration adds the schema needed to do all three
-- properly, in one transaction, from PosSaleService#voidSale:
--
--  1. TRADE_IN_VOID: a new stock-movement type (widening the existing chk_stock_movements_type
--     CHECK, same pattern as V22/V29/V34) - a negative-delta movement removing a traded-in item's
--     stock again when the sale that part-exchanged it is voided (mirrors SALE_VOID's positive-delta
--     "put stock back" pattern, just in the opposite direction and against the OTHER product - the
--     one the customer traded in, not the one they bought).
--
--  2. pos_trade_ins.status (ACTIVE|VOIDED) + voided_at - so a voided part-exchange trade-in is
--     marked (soft-status, never deleted - same append-only philosophy as V34's pos_sales.status)
--     rather than needing its own separate reversal-tracking table.
--
--  3. pos_sales.trade_in_store_credit_granted - see PosSaleService#createSale/#voidSale javadoc:
--     when an embedded (part-exchange) trade-in is valued at the STORE_CREDIT rate and its value
--     exceeds what the sale needs (would otherwise be a SHOP_PAYS cash payout), the excess is
--     granted to the member's store credit balance instead of paid out as cash - this column
--     records exactly how much was granted this way so voidSale has a real, guarded (can't take the
--     member's balance negative) ledger entry to reverse for that case, distinct from the existing
--     storeCreditRedeemed reversal (which is always a safe credit-back, never a debit). Zero for
--     every sale that isn't this specific case (CASH-valued trade-ins, non-part-exchange sales,
--     part-exchange sales that didn't produce a SHOP_PAYS excess).
--
-- Verified immediately before writing this migration: `ls db/migration` shows V35 as the latest
-- applied version on disk (confirmed against flyway_schema_history separately) - so V36 is the
-- correct next free number. Per the task split, V37 is reserved for a parallel change (repair
-- module) - not touched here.

ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS chk_stock_movements_type;
ALTER TABLE stock_movements ADD CONSTRAINT chk_stock_movements_type CHECK (
    movement_type IN ('ADJUSTMENT', 'TRANSFER_OUT', 'TRANSFER_IN', 'POS_SALE', 'SO_DELIVERY',
                       'PO_RECEIPT', 'RECOUNT', 'TRADE_IN_RECEIPT', 'REPAIR_PART_CONSUMED', 'SALE_VOID',
                       'TRADE_IN_VOID')
);

ALTER TABLE pos_trade_ins ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE pos_trade_ins ADD CONSTRAINT chk_pos_trade_ins_status CHECK (status IN ('ACTIVE', 'VOIDED'));
ALTER TABLE pos_trade_ins ADD COLUMN voided_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_pos_trade_ins_status ON pos_trade_ins(status);

ALTER TABLE pos_sales ADD COLUMN trade_in_store_credit_granted NUMERIC(15, 2) NOT NULL DEFAULT 0;
