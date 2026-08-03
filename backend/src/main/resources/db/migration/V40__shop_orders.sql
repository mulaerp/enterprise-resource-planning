-- V40: shop_orders / shop_order_lines - online storefront ordering with immediate stock
-- reservation and a dormant payment-gateway scaffold (WEBSHOP task, owner decisions 1 & 2).
--
-- Verified immediately before writing this migration: `ls db/migration` shows V39
-- (shop_customers, identity agent) as the latest applied version on disk - V40 is the correct
-- next free number.
--
-- OWNER DECISIONS this schema implements:
--  1. Online orders are PAY AT COLLECTION / ON DELIVERY today - payment_method exists as an enum
--     of two values (PAY_AT_COLLECTION, GATEWAY) so the schema doesn't need another migration
--     when a real gateway is switched on later, but GATEWAY is not reachable while
--     payment.gateway.enabled=false (see com.mulaerp.shop.payment).
--  2. Placing an order RESERVES stock immediately (a SHOP_RESERVE stock movement, written by
--     ShopOrderService in the same transaction as this row), with reserved_until driving an
--     expiry release job.
CREATE TABLE shop_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(40) NOT NULL UNIQUE,

    -- Nullable: a GUEST checkout has no shop_customers row. Exactly one identity is populated -
    -- (shop_customer_id) XOR (guest_email/guest_name/guest_phone) - enforced in
    -- ShopOrderService at the app layer (mirrors how PosSale.memberId is an optional, unvalidated
    -- FK at the DB level and the app layer owns the "is this a member sale" branching).
    shop_customer_id UUID REFERENCES shop_customers(id),
    guest_email VARCHAR(255),
    guest_name VARCHAR(255),
    guest_phone VARCHAR(30),

    fulfilment_type VARCHAR(20) NOT NULL,
    -- Required (app-layer, see ShopOrderService#validateRequest) when fulfilment_type = 'POST';
    -- nullable otherwise - a COLLECT order has nowhere to ship.
    delivery_address TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    payment_method VARCHAR(20) NOT NULL,

    subtotal NUMERIC(15,2) NOT NULL,
    delivery_fee NUMERIC(15,2) NOT NULL DEFAULT 0,
    total NUMERIC(15,2) NOT NULL,

    -- Set the instant an order is RESERVED (now + mulaerp.shop.reservation-hours); the release
    -- job (ShopOrderService#releaseExpiredReservations) only ever looks at rows still in
    -- RESERVED/AWAITING_PAYMENT with reserved_until in the past, so this column is never read
    -- once an order moves on to PAID/READY/FULFILLED/CANCELLED/EXPIRED.
    reserved_until TIMESTAMP,

    notes TEXT,

    -- BaseEntity columns - included directly here since this is a brand-new table (same rationale
    -- as V39__shop_customers.sql).
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP,
    version BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT chk_shop_orders_fulfilment_type CHECK (fulfilment_type IN ('COLLECT', 'POST')),
    CONSTRAINT chk_shop_orders_status CHECK (status IN
        ('PENDING', 'RESERVED', 'AWAITING_PAYMENT', 'PAID', 'READY', 'FULFILLED', 'CANCELLED', 'EXPIRED')),
    CONSTRAINT chk_shop_orders_payment_method CHECK (payment_method IN ('PAY_AT_COLLECTION', 'GATEWAY'))
);

CREATE INDEX idx_shop_orders_shop_customer_id ON shop_orders(shop_customer_id);
CREATE INDEX idx_shop_orders_status ON shop_orders(status);
CREATE INDEX idx_shop_orders_reserved_until ON shop_orders(reserved_until);
CREATE INDEX idx_shop_orders_guest_email ON shop_orders(guest_email);
CREATE INDEX idx_shop_orders_deleted ON shop_orders(deleted);

CREATE TABLE shop_order_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES shop_orders(id),
    product_id UUID NOT NULL REFERENCES products(id),

    -- Point-in-time snapshots (product name/sku/price can change after the order is placed) -
    -- same rationale as PosSaleLine.productName/acquisitionCostSnapshot.
    product_name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(15,2) NOT NULL,
    line_total NUMERIC(15,2) NOT NULL,
    -- COGS snapshot taken at reservation time - mirrors PosSaleLine.acquisitionCostSnapshot; null
    -- when the product has no acquisitionCost set, in which case no COGS leg is posted for this
    -- line at fulfilment (same "needs acquisitionCost, not costPrice" caveat as PoS - see the pos
    -- skill).
    acquisition_cost_snapshot NUMERIC(15,2),

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP,
    version BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT chk_shop_order_lines_quantity CHECK (quantity > 0)
);

CREATE INDEX idx_shop_order_lines_order_id ON shop_order_lines(order_id);
CREATE INDEX idx_shop_order_lines_product_id ON shop_order_lines(product_id);

-- Widen the movement_type CHECK (same pattern as V22/V29/V34/V36) to add the two ledger events
-- specific to reservation semantics:
--   SHOP_RESERVE (-qty) - stock removed from availability the instant an order is placed, so the
--     storefront can never sell the same one-of-a-kind unit twice (owner decision 2).
--   SHOP_RELEASE (+qty) - stock returned when a reservation is cancelled (immediately) or expires
--     unpaid/uncollected (the release job).
-- Deliberately NOT adding a third "fulfilment" movement type: converting a reservation into a
-- completed sale (order status -> FULFILLED) does not move stock a second time - the SHOP_RESERVE
-- row already IS the ledger entry that removed this stock from inventory. See
-- ShopOrderService#fulfilOrder's javadoc for the full ledger-model writeup.
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS chk_stock_movements_type;
ALTER TABLE stock_movements ADD CONSTRAINT chk_stock_movements_type CHECK (
    movement_type IN ('ADJUSTMENT', 'TRANSFER_OUT', 'TRANSFER_IN', 'POS_SALE', 'SO_DELIVERY',
                       'PO_RECEIPT', 'RECOUNT', 'TRADE_IN_RECEIPT', 'REPAIR_PART_CONSUMED', 'SALE_VOID',
                       'TRADE_IN_VOID', 'SHOP_RESERVE', 'SHOP_RELEASE')
);
