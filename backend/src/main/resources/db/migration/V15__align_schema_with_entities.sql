-- Align schema with JPA entities (Hibernate ddl-auto: validate)
-- Entities drifted from V1..V14 migrations; this migration adds every
-- missing column/type fix required for schema-validation to pass.

-- ============================================
-- companies (Company entity)
-- missing: logo, status
-- ============================================
ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

-- ============================================
-- payments (Payment entity)
-- entity field "method" (PaymentMethod enum) has no @Column(name=...),
-- so it maps to column "method", not the existing "payment_method" column.
-- ============================================
ALTER TABLE payments ADD COLUMN IF NOT EXISTS method VARCHAR(50) NOT NULL DEFAULT 'CASH';

-- ============================================
-- product_serials (ProductSerial entity)
-- missing: purchase_date, warranty_expiry_date, sales_order_id, warehouse_id
-- (table has sold_date/warranty_expiry/batch_id instead - unmapped, left as-is)
-- ============================================
ALTER TABLE product_serials ADD COLUMN IF NOT EXISTS purchase_date DATE;
ALTER TABLE product_serials ADD COLUMN IF NOT EXISTS warranty_expiry_date DATE;
ALTER TABLE product_serials ADD COLUMN IF NOT EXISTS sales_order_id UUID;
ALTER TABLE product_serials ADD COLUMN IF NOT EXISTS warehouse_id UUID;

-- ============================================
-- invoice_items (InvoiceItem entity extends BaseEntity)
-- missing soft-delete/audit columns
-- ============================================
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS updated_by VARCHAR(255);
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- ============================================
-- purchase_order_items (PurchaseOrderItem entity extends BaseEntity)
-- missing soft-delete/audit columns + received_quantity
-- ============================================
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS updated_by VARCHAR(255);
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS received_quantity INTEGER DEFAULT 0;

-- ============================================
-- sales_order_items (SalesOrderItem entity extends BaseEntity)
-- missing soft-delete/audit columns
-- ============================================
ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);
ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS updated_by VARCHAR(255);
ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- ============================================
-- notifications (Notification entity extends BaseEntity)
-- missing: deleted; id column is VARCHAR(36) but BaseEntity.id is UUID
-- (GenerationType.UUID). userId/referenceType/referenceId are plain
-- String fields on the entity, so they stay VARCHAR - no change there.
-- Table is empty in local dev, safe to retype the PK.
-- ============================================
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE notifications ALTER COLUMN id TYPE UUID USING id::uuid;
