-- WP: product images. Adds an optional photo URL to products for the public storefront and
-- staff product pages. Nullable: the ~500 seeded catalogue products have no photo until an
-- admin/manager uploads one via POST /api/v1/products/{id}/image (see ProductImageService) -
-- a null value renders as a category-based placeholder on both the storefront and staff UI.
ALTER TABLE products ADD COLUMN image_url VARCHAR(500);
