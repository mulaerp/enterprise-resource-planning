-- V39: shop_customers - customer identity for the B2C storefront (SHOP module), strictly
-- separate from the staff `users` table.
--
-- Verified immediately before writing this migration: `ls db/migration` shows V38 as the latest
-- applied version on disk, so V39 is the correct next free number.
--
-- SECURITY BOUNDARY: this is a brand-new table, not an extension of `users` - a shop customer
-- row has no `role` column and can never be loaded by CustomUserDetailsService (which only ever
-- queries `users`), so a shop customer can never obtain a staff role/authority. The reverse is
-- also true: ShopCustomerRepository only ever queries this table, so a staff account can never
-- authenticate as a shop customer either. See ShopCustomerAuthenticationFilter (auth/security)
-- and ShopAuthService (shop/service) for the runtime enforcement of this split.
CREATE TABLE shop_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(30),

    -- Links a web account to an existing loyalty member so their points/store credit carry
    -- over (see ShopAuthService#register - auto-linked when the registering email matches an
    -- existing member's email). Nullable: most shoppers registering online have never been a
    -- walk-in loyalty member. Deliberately NOT the other direction (no shop_customer_id column
    -- added to `members`, per the WEBSHOP task spec) - `members` stays the single source of
    -- truth for loyalty state, referenced FROM here.
    member_id UUID REFERENCES members(id),

    email_verified BOOLEAN NOT NULL DEFAULT FALSE,

    -- ACTIVE (default) or SUSPENDED - mirrors the shape of users.status but is its own enum
    -- domain (no INACTIVE - a shop account has no "staff offboarded" state; a suspended account
    -- is blocked at login, see ShopAuthService#login).
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    -- BaseEntity columns (createdAt/updatedAt/createdBy/updatedBy, soft delete, @Version optimistic
    -- locking) - included directly here since this is a brand-new table, matching the end state
    -- V23 brought every other BaseEntity table to rather than the two-step users/V1+V23 history.
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP,
    version BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_shop_customers_email ON shop_customers(email);
CREATE INDEX idx_shop_customers_member_id ON shop_customers(member_id);
CREATE INDEX idx_shop_customers_deleted ON shop_customers(deleted);
