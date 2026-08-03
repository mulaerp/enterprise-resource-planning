-- WP1a: Multi-warehouse backend infrastructure.
--
-- IMPORTANT: the `warehouses` table already exists (see V2__create_core_tables.sql) and already
-- has FK-referencing dependents (stock_adjustments, stock_movements, stock_transfers,
-- warehouse_stock, all created in V2/V13) - there has just never been a JPA entity for it. This
-- migration only adds the columns the new Warehouse entity needs, backfills the pre-existing
-- default row so it becomes the canonical MAIN warehouse, and closes the one missing FK
-- (product_serials.warehouse_id).
--
-- Row counts checked via `docker compose exec -T postgres psql -U mulaerp -d mulaerp` before
-- writing this migration: warehouses had exactly 1 row ('Main Warehouse', seeded by V2);
-- stock_adjustments, product_serials, stock_transfers, warehouse_stock and stock_movements were
-- all empty (0 rows) - so no data-migration risk and plain (not NOT VALID) FKs are safe.

-- ============================================
-- warehouses: add code + active flag (name/location/audit/soft-delete columns already exist
-- from V2 and already match BaseEntity)
-- ============================================
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS code VARCHAR(50);
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

-- Backfill: the row seeded by V2 ('Main Warehouse') becomes the MAIN warehouse, keeping its
-- existing id rather than inserting a duplicate.
UPDATE warehouses SET code = 'MAIN' WHERE code IS NULL AND name = 'Main Warehouse';

-- Backfill: any other pre-existing warehouse without a code gets one derived from its id, so the
-- NOT NULL/UNIQUE constraints below can be applied safely regardless of environment state.
UPDATE warehouses SET code = 'WH-' || substr(id::text, 1, 8) WHERE code IS NULL;

-- Safety net: if an environment has no warehouses at all (e.g. a database that skipped the V2
-- seed data), create the MAIN warehouse with a fixed, well-known id so application code has a
-- deterministic fallback to resolve by code.
INSERT INTO warehouses (id, code, name, location, active)
SELECT '00000000-0000-0000-0000-000000000001'::uuid, 'MAIN', 'Main Warehouse', 'Default Location', true
WHERE NOT EXISTS (SELECT 1 FROM warehouses WHERE code = 'MAIN');

ALTER TABLE warehouses ALTER COLUMN code SET NOT NULL;
ALTER TABLE warehouses ADD CONSTRAINT uq_warehouses_code UNIQUE (code);

CREATE INDEX IF NOT EXISTS idx_warehouses_code ON warehouses(code);
CREATE INDEX IF NOT EXISTS idx_warehouses_active ON warehouses(active);

-- ============================================
-- warehouse_stock: FK to warehouses(id) and products(id) already exist (V13) - nothing to add.
-- stock_adjustments.warehouse_id and stock_transfers.from/to_warehouse_id already have NOT NULL
-- FKs to warehouses(id) (V13) - nothing to add.
-- ============================================

-- ============================================
-- product_serials.warehouse_id: added nullable in V15 with no FK at all. Table is empty in
-- every checked environment, so a plain FK is safe.
-- ============================================
ALTER TABLE product_serials
    ADD CONSTRAINT fk_product_serials_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);

CREATE INDEX IF NOT EXISTS idx_product_serials_warehouse ON product_serials(warehouse_id);
