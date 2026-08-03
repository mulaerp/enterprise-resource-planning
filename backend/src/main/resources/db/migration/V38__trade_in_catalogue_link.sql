-- V38: trade-in catalogue linkage + deterministic suggestion search.
--
-- PROBLEM (owner-reported): the register's Trade-In panel only ever created a brand-new one-off
-- Product per line (see PosTradeInService#receiveLines pre-V38) - trade in five PS5s over a month
-- and the catalogue fragments into five products with five spellings, stock never consolidates,
-- and the created product has no category. This migration adds the schema PosTradeInService needs
-- to link a trade-in line to an EXISTING product instead of always minting a new one, plus the
-- pg_trgm-backed search the new GET /api/v1/pos/trade-ins/suggest endpoint uses to find that
-- existing product in the first place.
--
-- Verified immediately before writing this migration: `ls db/migration` shows V37 as the latest
-- applied version on disk - so V38 is the correct next free number. Per the task split, V39 is
-- reserved for a parallel change (oversight module) - not touched here.
--
-- ============================================
-- 1. pos_trade_in_lines: catalogue linkage columns
-- ============================================
-- product_id already exists (V29, NOT NULL) as "the product this line created". Relaxed to
-- nullable here for schema flexibility (a genuinely-unknown/unlinked item is still allowed to
-- exist without ever resolving to a catalogue row in some future flow) - in the normal flow
-- implemented by PosTradeInService today, this column stays populated either way: either the
-- EXISTING linked product's id, or the newly-created product's id for an unlinked line.
ALTER TABLE pos_trade_in_lines ALTER COLUMN product_id DROP NOT NULL;

-- The category assigned to whichever product this line ended up against - the newly-created
-- product's category for an unlinked line (required at the application layer, see
-- PosTradeInService#receiveLines - "categoryId is required when productId is absent" is enforced
-- in Java, not by a DB NOT NULL, so this stays nullable at the schema level), or the already-linked
-- product's own category for a linked line (denormalized here purely for trade-in reporting/audit
-- convenience - the product row remains the source of truth for its own category).
ALTER TABLE pos_trade_in_lines ADD COLUMN category_id UUID REFERENCES product_categories(id);

-- TRUE when this line was linked to an already-existing product (cashier picked a suggestion or
-- passed productId directly) rather than minting a new one. Needed as an explicit flag (not just
-- "previous_acquisition_cost IS NOT NULL") because a linked product can legitimately have had a
-- NULL acquisitionCost before this trade-in (never priced before) - that would otherwise be
-- indistinguishable from "this line was never linked at all".
ALTER TABLE pos_trade_in_lines ADD COLUMN linked_existing_product BOOLEAN NOT NULL DEFAULT FALSE;

-- Snapshot of the linked product's acquisitionCost immediately BEFORE this trade-in's weighted-
-- average update (see PosTradeInService#applyWeightedAverageAcquisitionCost) - NULL for an unlinked
-- (newly-created) line, and NULL for a linked line whose product had no acquisitionCost set yet.
-- Exists so PosSaleService#voidSale can restore the EXACT prior value on reversal instead of trying
-- to recompute it backwards out of the (now-mutated) weighted average, which is not always
-- invertible once further trade-ins/sales have moved the same product's stock in between.
ALTER TABLE pos_trade_in_lines ADD COLUMN previous_acquisition_cost NUMERIC(15, 2);

CREATE INDEX IF NOT EXISTS idx_pos_trade_in_lines_category ON pos_trade_in_lines(category_id);

-- ============================================
-- 2. pg_trgm - fuzzy name/SKU matching for GET /pos/trade-ins/suggest
-- ============================================
-- The official postgres:16-alpine image ships pg_trgm as part of the bundled contrib modules, so
-- CREATE EXTENSION is expected to succeed - but this is wrapped in a DO block with an exception
-- handler (rather than a bare CREATE EXTENSION) so that if it's ever unavailable for any reason
-- (a stripped-down image, missing shared_preload/contrib package, insufficient privilege) the
-- migration still completes instead of leaving the whole app unable to start. TradeInSuggestionService
-- checks pg_extension at runtime and falls back to a plain ILIKE/word-overlap ranking whenever this
-- didn't take - see that class's javadoc.
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_trgm extension could not be enabled (%) - trade-in suggest will use the ILIKE/word-overlap fallback ranking instead of trigram similarity', SQLERRM;
END $$;

-- Only created if the extension actually took (the operator class gin_trgm_ops doesn't exist
-- otherwise, which would fail this statement too) - same defensive DO-block pattern as above.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
        CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING GIN (name gin_trgm_ops);
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create trigram GIN index on products.name (%) - trade-in suggest will use the ILIKE/word-overlap fallback ranking', SQLERRM;
END $$;
