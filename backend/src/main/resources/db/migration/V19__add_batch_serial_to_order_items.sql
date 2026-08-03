-- WP3: link existing batch/lot + serial tracking (V13) to sales & purchase order lines.
-- Both columns are nullable so orders created without any tracking info are unaffected
-- (no NOT NULL constraint, no default required, existing rows get NULL).

-- ============================================
-- Sales order items: optional batch selected for the line + optional serials sold
-- ============================================
ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES product_batches(id);
ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS serial_ids TEXT;

CREATE INDEX IF NOT EXISTS idx_sales_order_items_batch ON sales_order_items(batch_id);

-- ============================================
-- Purchase order items: optional batch created/attached + serials registered on receipt
-- ============================================
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES product_batches(id);
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS serial_ids TEXT;

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_batch ON purchase_order_items(batch_id);
