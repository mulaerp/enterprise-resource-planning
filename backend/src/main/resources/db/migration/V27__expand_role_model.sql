-- WP: five-role model (ADMIN/MANAGER/USER -> ADMIN/MANAGER/ACCOUNTANT/INVENTORY/CASHIER).
--
-- `role` has always been a plain VARCHAR(50) with no CHECK constraint (see
-- V1__create_users_table.sql) and User.UserRole is a @Enumerated(EnumType.STRING) column, so no
-- column widen/constraint drop-and-readd is needed here - only a data migration of existing rows
-- plus seed data for the new roles.

-- Every existing 'USER' account is a front-line staff account under the old model; it becomes
-- CASHIER under the new one (see RoleRules for the full @PreAuthorize matrix this maps to).
UPDATE users SET role = 'CASHIER' WHERE role = 'USER';

-- DEV-ONLY SEED DATA: one user per new role for manual/e2e testing, all sharing admin@mulaerp.com's
-- existing bcrypt hash (see V14__fix_admin_password.sql) so 'admin123' logs in as any of them.
-- admin@mulaerp.com itself is untouched and stays ADMIN.
INSERT INTO users (email, password_hash, full_name, role, status, created_at, updated_at, deleted)
VALUES
    ('cashier@mulaerp.com', '$2y$10$utS6gy2aMzZ1H3e83dGhKOxLhV5MuMrlxe3RQuiHY0aV0W3AbDWMS', 'Cashier Test Account', 'CASHIER', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, false),
    ('accountant@mulaerp.com', '$2y$10$utS6gy2aMzZ1H3e83dGhKOxLhV5MuMrlxe3RQuiHY0aV0W3AbDWMS', 'Accountant Test Account', 'ACCOUNTANT', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, false),
    ('inventory@mulaerp.com', '$2y$10$utS6gy2aMzZ1H3e83dGhKOxLhV5MuMrlxe3RQuiHY0aV0W3AbDWMS', 'Inventory Test Account', 'INVENTORY', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, false),
    ('manager@mulaerp.com', '$2y$10$utS6gy2aMzZ1H3e83dGhKOxLhV5MuMrlxe3RQuiHY0aV0W3AbDWMS', 'Manager Test Account', 'MANAGER', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, false)
ON CONFLICT (email) DO NOTHING;
