-- V42: closes two disclosed WEBSHOP gaps (see the webshop skill's "Known gap (disclosed)" notes
-- on ShopOrderService#fulfilOrder before this migration):
--   GAP B - an online purchase of a warrantyMonths product never issued an in-house warranty,
--     unlike the identical item bought at the till (PosSaleService#issueLineWarranties).
--   GAP C - a FULFILLED web order had no void/reversal path at all (cancelInternal only accepted
--     RESERVED/AWAITING_PAYMENT), unlike PoS which has a dedicated void/refund endpoint (V34).
--
-- Verified immediately before writing this migration: `ls db/migration` shows V41
-- (shop_trade_in_quotes) as the latest applied version on disk - V42 is the correct next free
-- number (this file owned exclusively by the order/quote-order agent; a parallel agent owns V43
-- for the quote module, per the task's file-ownership split).

-- ---- GAP B: attribute a warranty to the online order/buyer that earned it -------------------
-- Mirrors the existing repair_job_id/pos_sale_id/sales_order_id columns exactly (plain UUID, no
-- FK constraint - app-validated, same as every other warranty origin column added since V24).
--
-- shop_order_id: the originating web order - always set for a webshop-issued warranty, this is
--   also how a GUEST's warranty is found later even though they have no shop_customers row of
--   their own: ShopOrderService looks warranties up by this column when building a
--   ShopOrderDto/guest-lookup response, so the warranty number surfaces directly on the order the
--   guest already knows how to find (order number + the email they themselves supplied - see
--   ShopOrderService#guestLookup). The guest can independently re-check it any time via the
--   existing anonymous GET /api/v1/public/warranty/{code} lookup by warranty number - no new
--   public endpoint needed for that, since PublicWarrantyService already looks up purely by
--   warrantyNumber/serial, never by customer identity.
-- shop_customer_id: attribution for a SIGNED-IN shop customer's warranty when that customer is
--   NOT linked to a loyalty Member (member_id below covers the linked case, exactly mirroring
--   PosSaleService#issueLineWarranties, which only ever sets member_id, never customer_id, for a
--   member sale). There is deliberately no bridge from shop_customers to the back-office
--   com.mulaerp.customer.Customer table today (ShopCustomer/Customer are two separate identities
--   in this codebase - verified: ShopCustomer carries only an optional member_id link, nothing
--   pointing at customers) - reusing the existing customer_id column for a ShopCustomer id would
--   silently mix two different identity spaces under one label, so a dedicated column is added
--   instead rather than overloading customer_id.
ALTER TABLE warranties ADD COLUMN shop_order_id UUID;
ALTER TABLE warranties ADD COLUMN shop_customer_id UUID;

CREATE INDEX idx_warranties_shop_order ON warranties(shop_order_id);
CREATE INDEX idx_warranties_shop_customer ON warranties(shop_customer_id);

-- ---- GAP C: void a FULFILLED web order --------------------------------------------------------
-- fulfilled_at: stamped once, at ShopOrderService#fulfilOrder - the shop_orders table had no
--   dedicated fulfilment timestamp before this (fulfilOrder only ever touched updated_at as a
--   side effect of saving the row - see MoneyFlowService's pre-existing "no fulfilledAt column"
--   workaround, still true for that unrelated reporting query and left as-is here, out of this
--   agent's ownership). The void window (mulaerp.shop.void-window-days, default 7, mirrors
--   mulaerp.pos.void-window-days) is measured from THIS column, not created_at - a web order can
--   sit RESERVED for up to 48h (mulaerp.shop.order.reservation-hours) before ever being fulfilled,
--   so the window must count from the sale itself (fulfilment), exactly like PoS's void window
--   counts from pos_sales.created_at (the sale itself, since a PoS sale has no separate
--   reservation phase).
-- store_credit_redeemed / points_earned: fulfilOrder computed both transiently before this
--   migration and never persisted them onto the order row - #voidOrder needs to read back exactly
--   what was redeemed/earned to reverse it accurately and idempotently, so both are now snapshot
--   columns on the order itself (mirrors pos_sales.store_credit_redeemed/points_earned, which
--   already existed for the same reason).
-- voided_at/voided_by/void_reason: same three columns V34 added to pos_sales, same rationale
--   (who/when/why, surfaced verbatim in the void response and any future oversight view).
ALTER TABLE shop_orders ADD COLUMN fulfilled_at TIMESTAMP;
ALTER TABLE shop_orders ADD COLUMN store_credit_redeemed NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE shop_orders ADD COLUMN points_earned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shop_orders ADD COLUMN voided_at TIMESTAMP;
ALTER TABLE shop_orders ADD COLUMN voided_by VARCHAR(255);
ALTER TABLE shop_orders ADD COLUMN void_reason TEXT;

ALTER TABLE shop_orders DROP CONSTRAINT IF EXISTS chk_shop_orders_status;
ALTER TABLE shop_orders ADD CONSTRAINT chk_shop_orders_status CHECK (status IN
    ('PENDING', 'RESERVED', 'AWAITING_PAYMENT', 'PAID', 'READY', 'FULFILLED', 'CANCELLED', 'EXPIRED', 'VOIDED'));

-- MOVEMENT TYPE DECISION: a new SHOP_VOID type is added rather than reusing SHOP_RELEASE.
-- SHOP_RELEASE means "this reservation was released WITHOUT ever becoming a sale" (cancel/expiry -
-- no revenue/COGS was ever posted for it, see V40's javadoc). Voiding a FULFILLED order is the
-- opposite case: revenue+COGS WERE posted at fulfilment and must be reversed - conflating the two
-- under one movement type would make it impossible for any later report (item trace, oversight
-- exceptions, money-flow day book) to tell "never sold, stock just came back" apart from "sold,
-- then the sale was reversed" by movement type alone, forcing every such report to re-derive that
-- distinction from order status instead of the ledger. This exactly mirrors the existing PoS
-- precedent: SALE_VOID (V34) is its own distinct type, never folded into some generic "stock back"
-- movement, specifically so a voided completed sale stays distinguishable from every other
-- stock-in event. SHOP_VOID follows the same rule for the webshop side.
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS chk_stock_movements_type;
ALTER TABLE stock_movements ADD CONSTRAINT chk_stock_movements_type CHECK (
    movement_type IN ('ADJUSTMENT', 'TRANSFER_OUT', 'TRANSFER_IN', 'POS_SALE', 'SO_DELIVERY',
                       'PO_RECEIPT', 'RECOUNT', 'TRADE_IN_RECEIPT', 'REPAIR_PART_CONSUMED', 'SALE_VOID',
                       'TRADE_IN_VOID', 'SHOP_RESERVE', 'SHOP_RELEASE', 'SHOP_VOID')
);
