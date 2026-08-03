-- OVERSIGHT: cash-up / Z-report per-payment-method reconciliation.
--
-- Verified immediately before writing this migration: `ls db/migration` shows V29 as the latest
-- file on disk (no V28 exists - the sequence skips it, same numbering gap tolerated by Flyway as
-- any other), so V30 is the correct next free number.
--
-- One row per (date, payment_method): staff record the counted cash/float for a given day and
-- payment method; expected is recomputed server-side from operational tables at both GET and POST
-- time (never trusted from the client) - see CashUpService. variance = counted - expected.
CREATE TABLE cash_ups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cash_up_date DATE NOT NULL,
    payment_method VARCHAR(20) NOT NULL,
    expected NUMERIC(15, 2) NOT NULL DEFAULT 0,
    counted NUMERIC(15, 2) NOT NULL DEFAULT 0,
    variance NUMERIC(15, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    approved_by VARCHAR(255),
    approved_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uq_cash_ups_date_method UNIQUE (cash_up_date, payment_method)
);

CREATE INDEX idx_cash_ups_date ON cash_ups(cash_up_date);
