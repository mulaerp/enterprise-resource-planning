-- FX AUTO-REFRESH: today the `currencies.rate` column is manually edited only (see V25). This
-- migration adds the columns/table needed to also support an automatic daily refresh from a free
-- keyless FX-rate API (see com.mulaerp.currency.service.FxRateProviderClient /
-- FxRateRefreshService / currency.scheduler.FxRateRefreshScheduler), while keeping manual edits
-- (PUT /api/v1/currencies/{code}) fully working and distinguishable from auto-fetched ones.
--
-- Verified immediately before writing this migration: `ls db/migration` shows V30 as the latest
-- file on disk, so V31 is the correct next free number (V28 is a known, tolerated gap - see
-- backend-dev skill).
--
-- rate_source: MANUAL (operator PUT) or AUTO (scheduled/manual-trigger provider fetch). Existing
-- rows predate this feature and were all manually seeded/edited, so they default to MANUAL.
-- rate_fetched_at: when the row's rate was last set by an AUTO fetch; NULL for rows that have
-- never been auto-fetched (e.g. MYR, which the refresher never touches, or a currency added
-- before its first successful fetch).
--
-- Precedence rule for the MANUAL vs AUTO tug-of-war (see CurrencyService#updateRate javadoc and
-- FxRateApplier for the enforcing code): a manual PUT sets rate_source=MANUAL immediately, and the
-- scheduled/manual-trigger AUTO refresh will NOT silently overwrite a currency that was manually
-- edited on the same calendar day (Asia/Kuala_Lumpur) - it only overwrites it starting the next
-- scheduled day. This is enforced in application code by comparing the row's existing updatedAt
-- (BaseEntity audit column, already updated by every save) against "today" - no extra "manual
-- edit date" column is needed.
ALTER TABLE currencies ADD COLUMN rate_source VARCHAR(20) NOT NULL DEFAULT 'MANUAL';
ALTER TABLE currencies ADD COLUMN rate_fetched_at TIMESTAMP;

ALTER TABLE currencies ADD CONSTRAINT chk_currencies_rate_source CHECK (rate_source IN ('MANUAL', 'AUTO'));

-- fetch-log: one row per refresh ATTEMPT (scheduled or manual-trigger), success or failure, so a
-- silent provider outage is visible in GET /api/v1/currencies/fetch-log rather than only in
-- application logs. BaseEntity-shaped like every other audited table in this schema.
CREATE TABLE fx_rate_fetch_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fetched_at TIMESTAMP NOT NULL,
    provider VARCHAR(255),
    status VARCHAR(20) NOT NULL,
    message TEXT,
    rates_updated INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT chk_fx_rate_fetch_log_status CHECK (status IN ('SUCCESS', 'FAILED'))
);

CREATE INDEX idx_fx_rate_fetch_log_fetched_at ON fx_rate_fetch_log(fetched_at DESC);
