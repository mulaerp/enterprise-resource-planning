-- WP12: adds `@Version private Long version;` to BaseEntity for optimistic locking. Every table
-- backing a BaseEntity-extending @Entity class needs the column or Hibernate's `ddl-auto: validate`
-- (see backend/src/main/resources/application.yml) fails schema validation at boot for that table.
--
-- Table list enumerated by grepping `extends BaseEntity` across backend/src/main/java and reading
-- each entity's @Table(name = ...):
--   accounts, journal_entries, users, bank_transactions, companies, customers, customer_contacts,
--   product_batches, product_serials, stock_adjustments, stock_transfers, invoices, invoice_items,
--   members, notifications, payments, pos_sales, pos_sale_lines, products, product_categories,
--   purchase_orders, purchase_order_items, sales_orders, sales_order_items, suppliers, vouchers,
--   warehouses.
--
-- Deliberately EXCLUDED: stock_movements. Its entity (com.mulaerp.inventory.entity.StockMovement,
-- altered in V22) is a plain @Entity that does NOT extend BaseEntity (no id/createdAt/deleted/etc.
-- from the mapped superclass) - adding a version column there would be schema drift with nothing
-- in the entity mapping to validate against.

ALTER TABLE accounts ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE journal_entries ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE bank_transactions ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE companies ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE customer_contacts ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE product_batches ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE product_serials ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE stock_adjustments ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE stock_transfers ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE invoice_items ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE members ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE notifications ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE payments ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE pos_sales ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE pos_sale_lines ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE product_categories ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE purchase_orders ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE purchase_order_items ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE sales_orders ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE sales_order_items ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE vouchers ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE warehouses ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
