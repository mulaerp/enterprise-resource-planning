-- V34: PoS sale void/refund.
--
-- Today there is no reversal mechanism at all for a PoS sale: no status field, no void
-- endpoint - a mistaken sale can only be "fixed" by deleting rows, which orphans stock
-- movements and leaves posted revenue for a sale that no longer exists. This adds an
-- append-only void: the original sale row and its POS_SALE stock movement are never edited
-- or deleted - a void instead flips status, stamps who/when/why, and records its own
-- SALE_VOID stock movement + reversing journal entries alongside the untouched originals.
--
-- Verified immediately before writing this migration: `ls db/migration` shows V32 as the
-- latest applied version on disk (no V33 - the auto-post-system-entries work needed no schema
-- change, confirmed against flyway_schema_history separately) - so V34 is the correct next
-- free number.

ALTER TABLE pos_sales ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED';
ALTER TABLE pos_sales ADD CONSTRAINT chk_pos_sales_status CHECK (status IN ('COMPLETED', 'VOIDED'));

ALTER TABLE pos_sales ADD COLUMN voided_at TIMESTAMP;
ALTER TABLE pos_sales ADD COLUMN voided_by VARCHAR(255);
ALTER TABLE pos_sales ADD COLUMN void_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_pos_sales_status ON pos_sales(status);

-- Widen the movement_type CHECK constraint (same pattern as V22/V29) to add SALE_VOID: +qty
-- when a voided sale's stock is returned to inventory. Reuses the existing signed-delta ledger
-- rather than a dedicated void table - a void's stock effect is just another movement row.
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS chk_stock_movements_type;
ALTER TABLE stock_movements ADD CONSTRAINT chk_stock_movements_type CHECK (
    movement_type IN ('ADJUSTMENT', 'TRANSFER_OUT', 'TRANSFER_IN', 'POS_SALE', 'SO_DELIVERY',
                       'PO_RECEIPT', 'RECOUNT', 'TRADE_IN_RECEIPT', 'REPAIR_PART_CONSUMED', 'SALE_VOID')
);
