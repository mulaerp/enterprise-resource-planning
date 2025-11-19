-- Phase 6.8: Advanced Inventory Features

-- ============================================
-- Batch/Lot Tracking
-- ============================================

CREATE TABLE product_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id),
    batch_number VARCHAR(100) NOT NULL UNIQUE,
    manufacture_date DATE,
    expiry_date DATE,
    quantity INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, EXPIRED, RECALLED
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_product_batches_product ON product_batches(product_id);
CREATE INDEX idx_product_batches_batch_number ON product_batches(batch_number);
CREATE INDEX idx_product_batches_status ON product_batches(status);
CREATE INDEX idx_product_batches_expiry ON product_batches(expiry_date);
CREATE INDEX idx_product_batches_deleted ON product_batches(deleted);

-- ============================================
-- Serial Number Tracking
-- ============================================

CREATE TABLE product_serials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id),
    serial_number VARCHAR(100) NOT NULL UNIQUE,
    batch_id UUID REFERENCES product_batches(id),
    status VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE', -- AVAILABLE, SOLD, RETURNED, DEFECTIVE
    sold_date DATE,
    customer_id UUID REFERENCES customers(id),
    warranty_expiry DATE,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_product_serials_product ON product_serials(product_id);
CREATE INDEX idx_product_serials_serial_number ON product_serials(serial_number);
CREATE INDEX idx_product_serials_batch ON product_serials(batch_id);
CREATE INDEX idx_product_serials_status ON product_serials(status);
CREATE INDEX idx_product_serials_customer ON product_serials(customer_id);
CREATE INDEX idx_product_serials_deleted ON product_serials(deleted);

-- ============================================
-- Stock Adjustments
-- ============================================

CREATE TABLE stock_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    adjustment_number VARCHAR(100) NOT NULL UNIQUE,
    product_id UUID NOT NULL REFERENCES products(id),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    adjustment_type VARCHAR(50) NOT NULL, -- INCREASE, DECREASE, RECOUNT
    quantity_before INTEGER NOT NULL,
    quantity_adjusted INTEGER NOT NULL,
    quantity_after INTEGER NOT NULL,
    reason VARCHAR(255) NOT NULL,
    notes TEXT,
    adjustment_date DATE NOT NULL,
    approved_by VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_stock_adjustments_number ON stock_adjustments(adjustment_number);
CREATE INDEX idx_stock_adjustments_product ON stock_adjustments(product_id);
CREATE INDEX idx_stock_adjustments_warehouse ON stock_adjustments(warehouse_id);
CREATE INDEX idx_stock_adjustments_date ON stock_adjustments(adjustment_date);
CREATE INDEX idx_stock_adjustments_deleted ON stock_adjustments(deleted);

-- ============================================
-- Stock Transfers
-- ============================================

CREATE TABLE stock_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_number VARCHAR(100) NOT NULL UNIQUE,
    from_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    to_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    transfer_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, IN_TRANSIT, COMPLETED, CANCELLED
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_stock_transfers_number ON stock_transfers(transfer_number);
CREATE INDEX idx_stock_transfers_from_warehouse ON stock_transfers(from_warehouse_id);
CREATE INDEX idx_stock_transfers_to_warehouse ON stock_transfers(to_warehouse_id);
CREATE INDEX idx_stock_transfers_status ON stock_transfers(status);
CREATE INDEX idx_stock_transfers_date ON stock_transfers(transfer_date);
CREATE INDEX idx_stock_transfers_deleted ON stock_transfers(deleted);

CREATE TABLE stock_transfer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    batch_id UUID REFERENCES product_batches(id),
    quantity INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stock_transfer_items_transfer ON stock_transfer_items(transfer_id);
CREATE INDEX idx_stock_transfer_items_product ON stock_transfer_items(product_id);
CREATE INDEX idx_stock_transfer_items_batch ON stock_transfer_items(batch_id);

-- ============================================
-- Warehouse Stock Levels (Multi-warehouse support)
-- ============================================

CREATE TABLE warehouse_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL DEFAULT 0,
    reserved_quantity INTEGER NOT NULL DEFAULT 0,
    available_quantity INTEGER NOT NULL DEFAULT 0,
    reorder_level INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(warehouse_id, product_id)
);

CREATE INDEX idx_warehouse_stock_warehouse ON warehouse_stock(warehouse_id);
CREATE INDEX idx_warehouse_stock_product ON warehouse_stock(product_id);
CREATE INDEX idx_warehouse_stock_available ON warehouse_stock(available_quantity);

-- ============================================
-- Add tracking fields to products table
-- ============================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS track_batches BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS track_serials BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode VARCHAR(100);

CREATE INDEX idx_products_barcode ON products(barcode);
