-- CURRENCY: multi-currency storefront support. Adds a `currencies` table (BaseEntity-shaped, same
-- audit/soft-delete/version columns as every other BaseEntity table - see V23's comment for the
-- pattern) and seeds MYR as the base currency plus four placeholder cross-rates.
--
-- Rate semantics (pick one direction and keep it everywhere - service/controller/frontend):
--   price_in_currency = price_in_MYR * rate
-- MYR itself carries rate = 1.0 (it *is* the base). All other rows are outbound conversions
-- FROM MYR TO that currency, not the reverse. E.g. USD rate 0.21 means a product priced at
-- MYR 100 displays as USD 21.00 (100 * 0.21). The service layer enforces MYR's rate can never
-- be changed away from 1.0 - see CurrencyService#updateRate.
--
-- Seed rates below are PLACEHOLDERS (not live market rates) - admin-editable via
-- PUT /api/v1/currencies/{code} (MANAGER+).

CREATE TABLE currencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(3) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    rate NUMERIC(15, 6) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP,
    version BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_currencies_code ON currencies(code);
CREATE INDEX idx_currencies_deleted ON currencies(deleted);

-- Base currency: rate is fixed at 1.0 by definition, never editable away from that (see
-- CurrencyService#updateRate).
INSERT INTO currencies (code, name, symbol, rate) VALUES ('MYR', 'Malaysian Ringgit', 'RM', 1.000000);

-- Placeholder cross-rates (MYR -> currency), admin-editable.
INSERT INTO currencies (code, name, symbol, rate) VALUES ('USD', 'US Dollar', '$', 0.210000);
INSERT INTO currencies (code, name, symbol, rate) VALUES ('SGD', 'Singapore Dollar', 'S$', 0.300000);
INSERT INTO currencies (code, name, symbol, rate) VALUES ('EUR', 'Euro', '€', 0.200000);
INSERT INTO currencies (code, name, symbol, rate) VALUES ('GBP', 'British Pound', '£', 0.170000);

-- WP company data was always MYR in practice (single-tenant, Malaysia-based thrift store) -
-- companies.currency defaulting to 'USD' (see Company entity) predates this module and never
-- reflected reality. Correct the existing row(s) rather than leaving stale data now that currency
-- is a first-class, admin-editable concept.
UPDATE companies SET currency = 'MYR' WHERE currency = 'USD';
