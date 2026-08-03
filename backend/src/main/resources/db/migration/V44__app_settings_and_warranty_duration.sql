-- V44: app_settings (runtime-editable key/value store, see com.mulaerp.settings) and day-granularity
-- warranty duration support (OWNER DECISION: guest/member channel-base warranties are a FLOOR
-- measured in DAYS, not months - see WarrantyService#resolveDuration).
--
-- Verified immediately before writing this migration: `ls db/migration` shows V43 as the latest
-- applied version on disk, so V44 is the correct next free number.

-- ============================================
-- app_settings
-- ============================================
-- Runtime-editable settings (BRANCH MANAGER, RoleRules.MANAGER_UP - see SettingsController),
-- read through com.mulaerp.settings.service.SettingsService's small in-memory cache (invalidated
-- on write, never read from the DB on every warranty issue). Every UPDATE is captured
-- automatically by the site-wide audit listener (AppSetting extends BaseEntity), so a manager's
-- old->new value change is visible on GET /audit-logs with no extra wiring.
CREATE TABLE app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    value TEXT NOT NULL,
    value_type VARCHAR(20) NOT NULL CHECK (value_type IN ('STRING', 'INT', 'DECIMAL', 'BOOLEAN')),
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP,
    version BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_app_settings_key ON app_settings(setting_key);
CREATE INDEX idx_app_settings_deleted ON app_settings(deleted);

-- OWNER DECISIONS: guest (non-member) buyers get a SHORT base warranty; members get a LONGER one
-- as a loyalty incentive to register. Applies uniformly to PoS and web-order fulfilment (see
-- WarrantyService#autoIssueForPosSaleLine / #autoIssueForShopOrderLine) - this is a FLOOR, never a
-- replacement for a longer product.warrantyMonths figure.
INSERT INTO app_settings (setting_key, value, value_type, description, created_by, updated_by)
VALUES
    ('warranty.guest-base-days', '3', 'INT',
     'Base in-house warranty (days) for a guest / non-member purchase, in-store or online. This is a FLOOR: a product with a warrantyMonths-derived expiry later than this always wins.',
     'system', 'system'),
    ('warranty.member-base-days', '10', 'INT',
     'Base in-house warranty (days) for a loyalty-member purchase, in-store or online (longer than the guest base as a registration incentive). This is a FLOOR: a product with a warrantyMonths-derived expiry later than this always wins.',
     'system', 'system');

-- ============================================
-- Warranty: day-granularity duration + explainable duration_source
-- ============================================
-- `months` stops being universally applicable now that a channel-base warranty is measured in
-- days, not months - relaxed to nullable rather than backfilled with a fabricated month figure.
-- `expiry_date` remains the single authoritative field for every warranty computation (claims,
-- void, display, public lookup); these two new columns exist purely so a claim dispute months
-- later can be explained: WHICH rule produced that expiry_date.
ALTER TABLE warranties ALTER COLUMN months DROP NOT NULL;

ALTER TABLE warranties ADD COLUMN duration_days INTEGER;

ALTER TABLE warranties ADD COLUMN duration_source VARCHAR(20) NOT NULL DEFAULT 'PRODUCT_MONTHS'
    CHECK (duration_source IN ('PRODUCT_MONTHS', 'GUEST_BASE', 'MEMBER_BASE'));

-- Backfill approach: every warranty row that existed before this migration (PoS/shop auto-issue,
-- sales-order serial delivery, workmanship warranty on repair collection, or manual staff issue)
-- was issued from an explicit `months` figure - there was no channel-day floor concept yet, so
-- 'PRODUCT_MONTHS' (the column DEFAULT above, applied by Postgres to every existing row when the
-- column is added) is already the correct, honest backfilled value; no separate UPDATE statement
-- is needed. duration_days stays NULL for all of these (no day-based figure ever applied to them).
COMMENT ON COLUMN warranties.duration_source IS
    'Which rule produced expiry_date: PRODUCT_MONTHS (an explicit months figure - product.warrantyMonths, a workmanship warranty, a sales-order serial delivery, or manual staff issue), GUEST_BASE / MEMBER_BASE (the channel-base-days floor beat the product months figure, or the product had no warrantyMonths at all). See WarrantyService#resolveDuration.';
COMMENT ON COLUMN warranties.duration_days IS
    'Set only when duration_source is GUEST_BASE or MEMBER_BASE - the channel base-days figure actually applied. NULL when duration_source is PRODUCT_MONTHS (see the months column instead).';
