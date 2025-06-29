-- Initialize MulaERP Database
-- This script sets up the initial database structure and configuration

-- Create extensions if they don't exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create schemas for better organization
CREATE SCHEMA IF NOT EXISTS hr;
CREATE SCHEMA IF NOT EXISTS manufacturing;
CREATE SCHEMA IF NOT EXISTS purchasing;
CREATE SCHEMA IF NOT EXISTS accounting;
CREATE SCHEMA IF NOT EXISTS crm;
CREATE SCHEMA IF NOT EXISTS inventory;

-- Grant permissions
GRANT ALL PRIVILEGES ON SCHEMA hr TO mulaerp;
GRANT ALL PRIVILEGES ON SCHEMA manufacturing TO mulaerp;
GRANT ALL PRIVILEGES ON SCHEMA purchasing TO mulaerp;
GRANT ALL PRIVILEGES ON SCHEMA accounting TO mulaerp;
GRANT ALL PRIVILEGES ON SCHEMA crm TO mulaerp;
GRANT ALL PRIVILEGES ON SCHEMA inventory TO mulaerp;

-- Create audit trigger function for tracking changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create function to generate IDs
CREATE OR REPLACE FUNCTION generate_id(prefix TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN prefix || EXTRACT(EPOCH FROM NOW())::BIGINT || LPAD(FLOOR(RANDOM() * 1000)::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- Set default search path
ALTER DATABASE mulaerp SET search_path TO public, hr, manufacturing, purchasing, accounting, crm, inventory;

-- Create initial admin user (will be handled by application)
-- This is just a placeholder for reference
INSERT INTO employees (
    id, name, email, phone, position, department, 
    hire_date, salary, status, created_at, updated_at
) VALUES (
    'EMP000001', 
    'System Administrator', 
    'admin@mulaerp.local', 
    '+1-000-000-0000', 
    'System Administrator', 
    'IT', 
    CURRENT_DATE, 
    0, 
    'active', 
    CURRENT_TIMESTAMP, 
    CURRENT_TIMESTAMP
) ON CONFLICT (id) DO NOTHING;

-- Create indexes for full-text search
CREATE INDEX IF NOT EXISTS idx_employees_search ON employees USING gin(to_tsvector('english', name || ' ' || email));
CREATE INDEX IF NOT EXISTS idx_suppliers_search ON suppliers USING gin(to_tsvector('english', name || ' ' || email));

-- Performance optimization settings
-- These will be applied when the database starts
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET track_activity_query_size = 2048;
ALTER SYSTEM SET pg_stat_statements.track = 'all';
ALTER SYSTEM SET log_statement = 'mod';
ALTER SYSTEM SET log_min_duration_statement = 1000;

-- Reload configuration
SELECT pg_reload_conf();