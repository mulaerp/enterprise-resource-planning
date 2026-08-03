-- INVENTORY: guided stock-take (physical count) sessions.
--
-- Verified immediately before writing this migration: `ls db/migration` shows V30 as the
-- highest file actually on disk; V31 is reserved for a parallel agent's own migration (not yet
-- landed) so this file takes the next number after that, V32, per this task's explicit
-- assignment - not derived from a stale count.
--
-- One session per warehouse count pass. Opening a session snapshots that warehouse's current
-- warehouse_stock quantities into stock_take_lines (expected_quantity), staff then record
-- counted_quantity per line (variance = counted - expected). Lifecycle: OPEN -> COUNTING ->
-- REVIEW -> APPROVED, or CANCELLED at any point before APPROVED. Approval is the only step that
-- touches stock, and it does so by creating one RECOUNT stock adjustment per line with a
-- non-zero variance through the existing InventoryService/WarehouseStockService path (see
-- StockTakeService#approve) - this table itself never writes Product.stockQuantity or
-- warehouse_stock directly, so the existing StockMovement ledger stays the single record of every
-- stock-affecting event.
CREATE TABLE stock_take_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_number VARCHAR(100) NOT NULL UNIQUE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN'
        CHECK (status IN ('OPEN', 'COUNTING', 'REVIEW', 'APPROVED', 'CANCELLED')),
    opened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,
    approved_by VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP,
    version BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_stock_take_sessions_warehouse ON stock_take_sessions(warehouse_id);
CREATE INDEX idx_stock_take_sessions_status ON stock_take_sessions(status);

-- expected_quantity is a snapshot taken at session-open time (not recomputed later), so it
-- stays a faithful record of "what the system said we had" even if other stock movements
-- happen concurrently in the same warehouse while the count is in progress.
CREATE TABLE stock_take_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES stock_take_sessions(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    expected_quantity INTEGER NOT NULL,
    counted_quantity INTEGER,
    variance INTEGER,
    note TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uq_stock_take_lines_session_product UNIQUE (session_id, product_id)
);

CREATE INDEX idx_stock_take_lines_session ON stock_take_lines(session_id);
CREATE INDEX idx_stock_take_lines_product ON stock_take_lines(product_id);
