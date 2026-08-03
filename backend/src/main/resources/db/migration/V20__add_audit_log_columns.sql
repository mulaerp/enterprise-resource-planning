-- WP5: site-wide automatic audit trail.
-- The existing audit_logs table (V11) tracks a UUID user_id for manually-logged actions.
-- The new automatic listener logs the authenticated username directly (falling back to
-- "system"), plus a compact "old -> new" summary of changed fields for UPDATE actions.
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS username VARCHAR(150);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS change_summary TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_username ON audit_logs(username);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
