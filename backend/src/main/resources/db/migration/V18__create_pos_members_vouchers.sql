-- WP: Thrift-store Point of Sale (flagship feature) - members, vouchers, PoS sales, and
-- thrift-specific product fields. All new product columns are nullable so existing product
-- create/update flows are unaffected.

-- ============================================
-- Product thrift fields
-- ============================================

ALTER TABLE products ADD COLUMN condition VARCHAR(20);
ALTER TABLE products ADD COLUMN acquisition_cost NUMERIC(15, 2);
ALTER TABLE products ADD COLUMN tags TEXT;
ALTER TABLE products ADD COLUMN accessories TEXT;
ALTER TABLE products ADD COLUMN has_box BOOLEAN;

-- ============================================
-- Members (loyalty)
-- ============================================

CREATE TABLE members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(30) NOT NULL UNIQUE,
    email VARCHAR(255),
    points INTEGER NOT NULL DEFAULT 0,
    tier VARCHAR(20) NOT NULL DEFAULT 'BASIC',
    discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_members_phone ON members(phone);
CREATE INDEX idx_members_code ON members(code);
CREATE INDEX idx_members_deleted ON members(deleted);

-- ============================================
-- Vouchers
-- ============================================

CREATE TABLE vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    type VARCHAR(20) NOT NULL,
    value NUMERIC(15, 2) NOT NULL,
    min_spend NUMERIC(15, 2),
    expires_at DATE,
    usage_limit INTEGER,
    used_count INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_vouchers_code ON vouchers(code);
CREATE INDEX idx_vouchers_deleted ON vouchers(deleted);

-- ============================================
-- PoS Sales
-- ============================================

CREATE TABLE pos_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_number VARCHAR(30) NOT NULL UNIQUE,
    client_sale_id VARCHAR(100) NOT NULL UNIQUE,
    member_id UUID REFERENCES members(id),
    voucher_code VARCHAR(50),
    payment_method VARCHAR(20) NOT NULL,
    subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0,
    discount_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    amount_tendered NUMERIC(15, 2),
    change NUMERIC(15, 2),
    points_earned INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_pos_sales_client_sale_id ON pos_sales(client_sale_id);
CREATE INDEX idx_pos_sales_created_at ON pos_sales(created_at);
CREATE INDEX idx_pos_sales_deleted ON pos_sales(deleted);

CREATE TABLE pos_sale_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES pos_sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    product_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(15, 2) NOT NULL,
    line_discount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    line_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    acquisition_cost_snapshot NUMERIC(15, 2),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_pos_sale_lines_sale ON pos_sale_lines(sale_id);
CREATE INDEX idx_pos_sale_lines_product ON pos_sale_lines(product_id);
