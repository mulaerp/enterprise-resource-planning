#!/bin/bash

# Script to create a new admin user in the database
# This bypasses the password encoding issue

set -e

echo "=========================================="
echo "Create Admin User"
echo "=========================================="
echo ""

# Generate a new BCrypt hash for "admin123"
# This is a pre-generated BCrypt hash with strength 10
PASSWORD_HASH='$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'

echo "Creating new admin user..."
echo "Email: admin@mulaerp.com"
echo "Password: admin123"
echo ""

# Delete existing admin user and create new one
docker-compose exec -T postgres psql -U mulaerp -d mulaerp <<EOF
-- Delete existing admin user
DELETE FROM users WHERE email = 'admin@mulaerp.com';

-- Create new admin user with correct password hash
INSERT INTO users (id, email, password_hash, full_name, role, status, created_at, updated_at, deleted)
VALUES (
    gen_random_uuid(),
    'admin@mulaerp.com',
    '$PASSWORD_HASH',
    'System Administrator',
    'ADMIN',
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    false
);

-- Verify user was created
SELECT email, full_name, role, status FROM users WHERE email = 'admin@mulaerp.com';
EOF

echo ""
echo "=========================================="
echo "Admin user created successfully!"
echo "=========================================="
echo ""
echo "Login credentials:"
echo "  Email:    admin@mulaerp.com"
echo "  Password: admin123"
echo ""
echo "You can now login at: http://localhost:5173"
echo ""
