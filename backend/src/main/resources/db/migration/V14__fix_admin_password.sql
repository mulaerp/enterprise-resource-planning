-- Fix admin user password
-- This migration updates the admin password hash to ensure it works correctly
-- Password: admin123

-- Delete existing admin user
DELETE FROM users WHERE email = 'admin@mulaerp.com';

-- Insert admin user with correct BCrypt hash for "admin123"
-- Generated with: htpasswd -bnBC 10 "" admin123 (verified against Spring's BCryptPasswordEncoder, which accepts $2y)
INSERT INTO users (email, password_hash, full_name, role, status, created_at, updated_at, deleted)
VALUES ('admin@mulaerp.com', '$2y$10$utS6gy2aMzZ1H3e83dGhKOxLhV5MuMrlxe3RQuiHY0aV0W3AbDWMS', 'System Administrator', 'ADMIN', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, false);
