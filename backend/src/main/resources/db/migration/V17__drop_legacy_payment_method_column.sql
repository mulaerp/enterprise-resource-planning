-- V15 added a "method" column so the payments table matches the Payment entity's
-- mapped field (PaymentMethod enum, no @Column(name=...) override), but left the
-- original "payment_method" column in place with its NOT NULL constraint and no
-- default. The entity never writes to "payment_method" (nothing in the Java code
-- references it), so every payment INSERT violates that dead column's NOT NULL
-- constraint and fails with a 500. Drop the obsolete column.
ALTER TABLE payments DROP COLUMN IF EXISTS payment_method;
