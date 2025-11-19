-- Fix admin user password
-- This migration updates the admin password hash to ensure it works correctly
-- Password: admin123

-- Delete existing admin user
DELETE FROM users WHERE email = 'admin@mulaerp.com';

-- Insert admin user with correct BCrypt hash for "admin123"
-- Generated with BCryptPasswordEncoder with strength 10
INSERT INTO users (email, password_hash, full_name, role, status, created_at, updated_at, deleted)
VALUES ('admin@mulaerp.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'System Administrator', 'ADMIN', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, false);
