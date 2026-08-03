-- V41: postal / drop-off trade-in quotes (WEBSHOP owner decision 3) - an INDICATIVE RANGE valid
-- for a configurable number of days, settled by staff inspection on arrival.
--
-- Verified immediately before writing this migration: `ls db/migration` shows V39 (shop_customers)
-- as the latest file on disk; V40 is reserved for a parallel agent's change (not present at the
-- time of writing) - so V41 is the correct next free number for this task, per the assignment.
--
-- SCOPE NOTE: this migration introduces NO new stock_movement type. Completing a quote
-- (ShopTradeInQuoteService#complete) calls the EXISTING PosTradeInService#createTradeIn - the same
-- code path the in-store register's standalone trade-in intake uses - which already writes a
-- TRADE_IN_RECEIPT movement (see V29/V38). chk_stock_movements_type is therefore left untouched.
--
-- A quote can belong to either a registered shop customer (shop_customer_id) or a guest
-- (guest_email/guest_name/guest_phone) - never neither, enforced below. The traded item is either
-- an existing catalogue product (product_id) or a free-text description + category (category_id) -
-- never neither, also enforced below. pos_trade_in_id is populated only once the quote is
-- COMPLETED, linking back to the real trade-in record created via the existing service.
CREATE TABLE shop_trade_in_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Server-generated, e.g. "TQ-2026-000001-a1b2" (same shape as PosTradeIn.tradeInNumber's
    -- "TI-..." - see ShopTradeInQuoteService#generateQuoteNumber).
    quote_number VARCHAR(40) NOT NULL UNIQUE,

    -- Identity: exactly one of shop_customer_id (registered web account) or guest_email (a guest
    -- request via the permitAll public endpoint) is populated - see chk_..._identity below. No
    -- FK-enforced ON DELETE behaviour is needed: shop_customers rows are soft-deleted, never
    -- hard-deleted (see BaseEntity), so this FK never dangles in practice.
    shop_customer_id UUID REFERENCES shop_customers(id),
    guest_email VARCHAR(255),
    guest_name VARCHAR(255),
    guest_phone VARCHAR(30),

    -- Item being traded in: either an existing catalogue product (product_id - pricing bases off
    -- that product's buyPrice/unitPrice, see ShopTradeInQuoteService) or a free-text description
    -- against a category (category_id) when the customer couldn't match a catalogue item - never
    -- neither, see chk_..._item below. free_text_description may still be set alongside product_id
    -- (customer's own words about condition/extras) - it is not exclusive with product_id.
    product_id UUID REFERENCES products(id),
    free_text_description TEXT,
    category_id UUID REFERENCES product_categories(id),

    -- Mirrors the same 5-value domain PosTradeInService/TradeInSuggestionService use for
    -- Product.condition (NEW|LIKE_NEW|GOOD|FAIR|POOR) - see chk_..._condition below.
    declared_condition VARCHAR(20) NOT NULL,
    has_box BOOLEAN,
    accessories TEXT,

    -- The indicative range (see ShopTradeInQuoteService#computeRange): quoted_max mirrors the
    -- deterministic formula TradeInSuggestionService already uses (pricingBase x
    -- conditionMultiplier x (1 + boxBonus)); quoted_min is that same figure haircut by
    -- mulaerp.shop.quote.min-factor (default 0.7) - a configurable "how much worse could
    -- inspection find this" floor. Never a firm commitment - see the indicative flag/message the
    -- API always returns alongside these two figures.
    quoted_min NUMERIC(15, 2) NOT NULL,
    quoted_max NUMERIC(15, 2) NOT NULL,
    quoted_at TIMESTAMP NOT NULL,

    -- quoted_at + mulaerp.shop.quote.valid-days (default 7). See
    -- ShopTradeInQuoteExpiryScheduler - a QUOTED row past this timestamp flips to EXPIRED and can
    -- no longer be received/inspected without the customer submitting a brand-new quote request
    -- (documented rule - see the scheduler's javadoc; no dedicated staff "re-quote" endpoint exists
    -- in this task's scope).
    expires_at TIMESTAMP NOT NULL,

    delivery_method VARCHAR(20) NOT NULL,

    -- QUOTED (initial) -> EXPIRED (scheduler, past expires_at, no staff action possible) or
    -- RECEIVED (staff: item physically arrived) -> OFFER_MADE (staff inspected, final_offer set;
    -- INSPECTED is reserved in this domain for a possible future "inspected but not yet priced"
    -- intermediate step - ShopTradeInQuoteService's #inspect goes straight to OFFER_MADE today,
    -- documented rather than silently dropped from the allowed-values list) -> ACCEPTED or DECLINED
    -- (customer's decision on the final offer) -> COMPLETED (staff, ACCEPTED only - creates the
    -- real trade-in via PosTradeInService) or RETURNED (staff, DECLINED only - item physically
    -- handed back, no stock/journal effect).
    status VARCHAR(20) NOT NULL DEFAULT 'QUOTED',

    -- Set at inspection (RECEIVED -> OFFER_MADE). Deliberately allowed to fall outside
    -- [quoted_min, quoted_max] (a real shop can offer less after seeing damage the photos/
    -- description didn't show, or more for a pleasant surprise) - final_offer_out_of_range records
    -- when that happened so it's auditable/reportable, and ShopTradeInQuoteService requires
    -- inspection_notes to carry a reason whenever it does (application-layer rule, not a CHECK,
    -- since "must be non-blank" needs no schema enforcement beyond NOT NULL-when-flagged, which
    -- Postgres CHECK could express but the extra rigidity isn't worth it for a staff-entered
    -- free-text reason).
    final_offer NUMERIC(15, 2),
    final_payout_type VARCHAR(20),
    final_offer_out_of_range BOOLEAN NOT NULL DEFAULT FALSE,

    inspection_notes TEXT,
    inspected_by VARCHAR(255),
    inspected_at TIMESTAMP,

    -- Stamped when the customer accepts or declines the final offer (accept-offer/decline-offer).
    decided_at TIMESTAMP,

    -- Populated only once COMPLETED - the real trade-in created via the existing
    -- PosTradeInService#createTradeIn code path (stock/TRADE_IN_RECEIPT movement/weighted-average
    -- acquisitionCost/store-credit/journal all happen there, not reimplemented here).
    pos_trade_in_id UUID REFERENCES pos_trade_ins(id),

    -- BaseEntity columns - included directly here since this is a brand-new table (same approach
    -- V39 took for shop_customers).
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP,
    version BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT chk_shop_trade_in_quotes_identity
        CHECK (shop_customer_id IS NOT NULL OR guest_email IS NOT NULL),
    CONSTRAINT chk_shop_trade_in_quotes_item
        CHECK (product_id IS NOT NULL OR category_id IS NOT NULL),
    CONSTRAINT chk_shop_trade_in_quotes_condition
        CHECK (declared_condition IN ('NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR')),
    CONSTRAINT chk_shop_trade_in_quotes_delivery_method
        CHECK (delivery_method IN ('POST', 'DROP_OFF')),
    CONSTRAINT chk_shop_trade_in_quotes_status
        CHECK (status IN ('QUOTED', 'EXPIRED', 'RECEIVED', 'INSPECTED', 'OFFER_MADE', 'ACCEPTED',
                           'DECLINED', 'RETURNED', 'COMPLETED')),
    CONSTRAINT chk_shop_trade_in_quotes_payout_type
        CHECK (final_payout_type IS NULL OR final_payout_type IN ('CASH', 'STORE_CREDIT')),
    CONSTRAINT chk_shop_trade_in_quotes_range
        CHECK (quoted_min >= 0 AND quoted_max >= quoted_min)
);

CREATE INDEX idx_shop_trade_in_quotes_shop_customer_id ON shop_trade_in_quotes(shop_customer_id);
CREATE INDEX idx_shop_trade_in_quotes_guest_email ON shop_trade_in_quotes(guest_email);
CREATE INDEX idx_shop_trade_in_quotes_status ON shop_trade_in_quotes(status);
-- Backs ShopTradeInQuoteExpiryScheduler's "status = QUOTED AND expires_at < now()" sweep.
CREATE INDEX idx_shop_trade_in_quotes_status_expires_at ON shop_trade_in_quotes(status, expires_at);
CREATE INDEX idx_shop_trade_in_quotes_deleted ON shop_trade_in_quotes(deleted);
