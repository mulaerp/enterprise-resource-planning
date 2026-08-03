-- WP7: append-only stock movement ledger + a DB-level double-entry backstop on journal_entries.
--
-- REUSE vs SUPERSEDE (stock_movements): a `stock_movements` table already exists from V2 with
-- FKs on product_id/warehouse_id/user_id, but no JPA entity/repository/service ever used it (grep
-- across backend/src/main/java confirmed zero references). Row count checked directly via
-- `docker compose exec -T postgres psql -U mulaerp -d mulaerp -c "SELECT count(*) FROM
-- stock_movements"` before writing this migration: 0 rows. With no code and no data depending on
-- its current shape, REUSE (alter in place) is the clean choice over superseding it with a new
-- table - same intent (a movement log keyed on product/warehouse), no orphaned legacy table left
-- behind, and the existing product_id/warehouse_id/reference/notes/created_at/created_by columns
-- already match what WP7 needs.
--
-- Changes applied:
--   * warehouse_id: NOT NULL -> nullable (PO_RECEIPT movements aren't tied to a warehouse today -
--     PurchaseOrderService only increments Product.stockQuantity, it never calls
--     WarehouseStockService, so there is no warehouse to attribute the receipt to).
--   * quantity (unsigned-in-name but already a plain INTEGER) renamed to quantity_delta to make
--     the signed-delta contract explicit; safe rename, table is empty.
--   * quantity_after added (nullable): Product.stockQuantity total immediately after the movement
--     - null is never actually produced by StockMovementService, but kept nullable per spec so a
--     future non-Product-total movement type isn't forced to fabricate a value.
--   * movement_type CHECK constraint added, replacing the old free-text IN/OUT/ADJUSTMENT
--     convention (never enforced, never populated) with the enum WP7 actually uses.
--   * indexes added on movement_type and created_at (product_id was already indexed).
-- Columns left untouched: movement_date, user_id, updated_at, updated_by - not part of the WP7
-- contract, no code reads them, removing them is out of scope for an additive ledger migration.

ALTER TABLE stock_movements ALTER COLUMN warehouse_id DROP NOT NULL;

ALTER TABLE stock_movements RENAME COLUMN quantity TO quantity_delta;

ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS quantity_after INTEGER;

ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS chk_stock_movements_type;
ALTER TABLE stock_movements ADD CONSTRAINT chk_stock_movements_type CHECK (
    movement_type IN ('ADJUSTMENT', 'TRANSFER_OUT', 'TRANSFER_IN', 'POS_SALE', 'SO_DELIVERY', 'PO_RECEIPT', 'RECOUNT')
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);

-- ============================================
-- Double-entry DB backstop: journal_entries POSTED transitions must be balanced.
-- ============================================
-- AccountingService#postJournalEntry already calls validateBalancedEntry() before flipping
-- status to POSTED (service-level check stays primary/first line of defense - unchanged by this
-- migration). This constraint trigger is the backstop for anything that flips a journal_entries
-- row to POSTED outside that service method (a hand-written SQL UPDATE, a future code path that
-- forgets the check, a migration/backfill script, etc.) - it rejects the transition at the DB
-- level regardless of how it was attempted.
CREATE OR REPLACE FUNCTION check_journal_entry_balanced() RETURNS trigger AS $$
DECLARE
    line_count INTEGER;
    total_debit NUMERIC(15, 2);
    total_credit NUMERIC(15, 2);
BEGIN
    IF NEW.status = 'POSTED' THEN
        SELECT COUNT(*), COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
          INTO line_count, total_debit, total_credit
          FROM journal_entry_lines
          WHERE entry_id = NEW.id;

        IF line_count = 0 THEN
            RAISE EXCEPTION 'Journal entry % (%) cannot be POSTED: it has no lines',
                NEW.entry_number, NEW.id
                USING ERRCODE = '23514';
        END IF;

        IF total_debit <> total_credit THEN
            RAISE EXCEPTION 'Journal entry % (%) cannot be POSTED: unbalanced (total debit %, total credit %)',
                NEW.entry_number, NEW.id, total_debit, total_credit
                USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_journal_entry_balanced ON journal_entries;
CREATE CONSTRAINT TRIGGER trg_journal_entry_balanced
    AFTER INSERT OR UPDATE ON journal_entries
    DEFERRABLE INITIALLY IMMEDIATE
    FOR EACH ROW
    WHEN (NEW.status = 'POSTED')
    EXECUTE FUNCTION check_journal_entry_balanced();
