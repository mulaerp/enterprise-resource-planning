-- REPAIR/WARRANTY: adds Product.warrantyMonths + Product.buyPrice (feeds the public storefront's
-- buyPrice/sellPrice contract), the warranties and repair_jobs tables, and idempotently seeds the
-- Service Revenue account used by the repair-collection auto-journal hook (it already exists from
-- the V12 chart-of-accounts seed as code 4200 - the INSERT below is a defensive no-op there, but
-- keeps this migration self-sufficient if V12's seed ever changes).

-- ============================================
-- Product: thrift-store storefront fields
-- ============================================

ALTER TABLE products ADD COLUMN warranty_months INTEGER;
ALTER TABLE products ADD COLUMN buy_price DECIMAL(15, 2);

-- ============================================
-- Warranties
-- ============================================

CREATE TABLE warranties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warranty_number VARCHAR(50) NOT NULL UNIQUE,
    product_id UUID NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    serial_id UUID,
    batch_id UUID,
    pos_sale_id UUID,
    sales_order_id UUID,
    customer_id UUID,
    member_id UUID,
    start_date DATE NOT NULL,
    months INTEGER NOT NULL,
    expiry_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    terms TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP,
    version BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_warranties_number ON warranties(warranty_number);
CREATE INDEX idx_warranties_status ON warranties(status);
CREATE INDEX idx_warranties_serial ON warranties(serial_id);
CREATE INDEX idx_warranties_product ON warranties(product_id);
CREATE INDEX idx_warranties_deleted ON warranties(deleted);

-- ============================================
-- Repair jobs
-- ============================================

CREATE TABLE repair_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_number VARCHAR(50) NOT NULL UNIQUE,
    customer_id UUID,
    walk_in_name VARCHAR(255),
    walk_in_phone VARCHAR(30),
    product_id UUID,
    serial_number VARCHAR(100),
    device_description TEXT NOT NULL,
    reported_fault TEXT NOT NULL,
    diagnosis TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'RECEIVED',
    quote_amount DECIMAL(15, 2),
    parts_cost DECIMAL(15, 2),
    labour_cost DECIMAL(15, 2),
    total_cost DECIMAL(15, 2) NOT NULL DEFAULT 0,
    warranty_id UUID,
    is_warranty_claim BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    collected_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP,
    version BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_repair_jobs_number ON repair_jobs(job_number);
CREATE INDEX idx_repair_jobs_status ON repair_jobs(status);
CREATE INDEX idx_repair_jobs_warranty ON repair_jobs(warranty_id);
CREATE INDEX idx_repair_jobs_deleted ON repair_jobs(deleted);

-- ============================================
-- Idempotent Service Revenue seed (defensive - already present via V12)
-- ============================================

INSERT INTO accounts (code, name, account_type, description)
SELECT '4200', 'Service Revenue', 'REVENUE', 'Revenue from services'
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '4200');

UPDATE accounts SET parent_id = (SELECT id FROM accounts WHERE code = '4000')
WHERE code = '4200' AND parent_id IS NULL;
