-- WP: Trade-in purchases + store credit, part-exchange PoS sales, repair parts/payments
-- completion flow, and the public repair status lookup.
--
-- Verified immediately before writing this migration: `ls db/migration` and the running
-- database's flyway_schema_history both show V27 as the latest applied version (no V28 exists on
-- disk or in flyway_schema_history) - so V29 is the correct next free number.

-- ============================================
-- Stock movement ledger: widen the movement_type CHECK constraint (same pattern as V22)
-- ============================================
-- TRADE_IN_RECEIPT: +qty when a traded-in item is received into inventory (PosTradeInService).
-- REPAIR_PART_CONSUMED: -qty when a repair job consumes stock at the IN_REPAIR transition
-- (RepairJobService); the same type is reused with a positive delta to reverse consumption if the
-- job is later cancelled from IN_REPAIR.
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS chk_stock_movements_type;
ALTER TABLE stock_movements ADD CONSTRAINT chk_stock_movements_type CHECK (
    movement_type IN ('ADJUSTMENT', 'TRANSFER_OUT', 'TRANSFER_IN', 'POS_SALE', 'SO_DELIVERY',
                       'PO_RECEIPT', 'RECOUNT', 'TRADE_IN_RECEIPT', 'REPAIR_PART_CONSUMED')
);

-- ============================================
-- Store credit balance on members
-- ============================================
ALTER TABLE members ADD COLUMN store_credit_balance NUMERIC(15, 2) NOT NULL DEFAULT 0;

-- ============================================
-- Chart of accounts: Store Credit Liability (2140) + Customer Deposits (2150), both parented
-- under 2100 "Current Liabilities" exactly as V12 parents 2110/2120/2130.
-- ============================================
INSERT INTO accounts (code, name, account_type, description)
SELECT '2140', 'Store Credit Liability', 'LIABILITY', 'Store credit issued to members, redeemable against future purchases'
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '2140');

INSERT INTO accounts (code, name, account_type, description)
SELECT '2150', 'Customer Deposits', 'LIABILITY', 'Deposits held for repair jobs not yet collected'
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '2150');

UPDATE accounts SET parent_id = (SELECT id FROM accounts WHERE code = '2100')
WHERE code IN ('2140', '2150') AND parent_id IS NULL;

-- ============================================
-- PoS trade-ins (purchase of used goods from a customer - standalone payout or part-exchange)
-- ============================================
CREATE TABLE pos_trade_ins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_in_number VARCHAR(30) NOT NULL UNIQUE,
    client_trade_in_id VARCHAR(100) NOT NULL UNIQUE,
    member_id UUID REFERENCES members(id),
    pos_sale_id UUID,
    payout_type VARCHAR(20) NOT NULL,
    payout_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP,
    version BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_pos_trade_ins_client_id ON pos_trade_ins(client_trade_in_id);
CREATE INDEX idx_pos_trade_ins_created_at ON pos_trade_ins(created_at);
CREATE INDEX idx_pos_trade_ins_deleted ON pos_trade_ins(deleted);

CREATE TABLE pos_trade_in_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_in_id UUID NOT NULL REFERENCES pos_trade_ins(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    description VARCHAR(255) NOT NULL,
    condition VARCHAR(20),
    accessories TEXT,
    has_box BOOLEAN,
    offered_cash_value NUMERIC(15, 2) NOT NULL DEFAULT 0,
    offered_credit_value NUMERIC(15, 2) NOT NULL DEFAULT 0,
    payout_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP,
    version BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_pos_trade_in_lines_trade_in ON pos_trade_in_lines(trade_in_id);
CREATE INDEX idx_pos_trade_in_lines_product ON pos_trade_in_lines(product_id);

-- ============================================
-- PoS sales: part-exchange fields (item 3 - CreatePosSaleRequest.tradeIn / storeCreditRedeemed)
-- ============================================
ALTER TABLE pos_sales ADD COLUMN trade_in_id UUID REFERENCES pos_trade_ins(id);
ALTER TABLE pos_sales ADD COLUMN trade_in_value_applied NUMERIC(15, 2) NOT NULL DEFAULT 0;
ALTER TABLE pos_sales ADD COLUMN store_credit_redeemed NUMERIC(15, 2) NOT NULL DEFAULT 0;
ALTER TABLE pos_sales ADD COLUMN net_cash_amount NUMERIC(15, 2) NOT NULL DEFAULT 0;
ALTER TABLE pos_sales ADD COLUMN net_cash_direction VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER_PAYS';

-- ============================================
-- Repair jobs: promised date + approved-at timestamp
-- ============================================
ALTER TABLE repair_jobs ADD COLUMN promised_date DATE;
ALTER TABLE repair_jobs ADD COLUMN approved_at TIMESTAMP;

-- ============================================
-- Repair parts consumed from stock (added while a job is being quoted/approved; actually
-- decremented from stock at the IN_REPAIR transition - see RepairJobService)
-- ============================================
CREATE TABLE repair_parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repair_job_id UUID NOT NULL REFERENCES repair_jobs(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    product_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_cost NUMERIC(15, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255)
);

CREATE INDEX idx_repair_parts_job ON repair_parts(repair_job_id);
CREATE INDEX idx_repair_parts_product ON repair_parts(product_id);

-- ============================================
-- Repair payments (deposit / balance / full)
-- ============================================
CREATE TABLE repair_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repair_job_id UUID NOT NULL REFERENCES repair_jobs(id) ON DELETE CASCADE,
    amount_type VARCHAR(20) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    payment_method VARCHAR(20) NOT NULL,
    paid_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255)
);

CREATE INDEX idx_repair_payments_job ON repair_payments(repair_job_id);

-- ============================================
-- Warranties: link back to the repair job that produced a workmanship warranty at COLLECTED
-- (distinct from repair_jobs.warranty_id, which points the other way - the warranty that was
-- CLAIMED to spawn a repair job in the first place).
-- ============================================
ALTER TABLE warranties ADD COLUMN repair_job_id UUID;
CREATE INDEX idx_warranties_repair_job ON warranties(repair_job_id);
