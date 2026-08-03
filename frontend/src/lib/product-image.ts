/**
 * WP: product images. Shared helper for the storefront pages (StorefrontPage,
 * StorefrontItemPage) and the staff product pages (ProductListPage, ProductFormPage,
 * pos/IntakePage) so every surface falls back to the same tasteful, zero-copyright placeholder
 * art when a product has no uploaded photo yet.
 *
 * Placeholders are static SVGs under `frontend/public/branding/placeholders/` - simple
 * geometric device silhouettes drawn for this repo, not copied artwork. A legitimate route to
 * real box art (IGDB's licensed cover-art API) is documented in the README; this repo does not
 * scrape retailer sites.
 */

const PLACEHOLDER_BASE = '/branding/placeholders';

export const PRODUCT_IMAGE_PLACEHOLDERS = {
  console: `${PLACEHOLDER_BASE}/console.svg`,
  handheld: `${PLACEHOLDER_BASE}/handheld.svg`,
  game: `${PLACEHOLDER_BASE}/game.svg`,
  generic: `${PLACEHOLDER_BASE}/generic.svg`,
} as const;

/** Minimal shape covering every product-ish object this helper is called with across the app. */
export interface ProductImageLike {
  imageUrl?: string | null;
  /** Public storefront's CatalogItem field. */
  category?: string | null;
  /** Staff-side ProductDto field. */
  categoryName?: string | null;
}

function placeholderForCategory(categoryName: string | null | undefined): string {
  if (!categoryName) return PRODUCT_IMAGE_PLACEHOLDERS.generic;
  const normalized = categoryName.toLowerCase();
  if (normalized.includes('handheld')) return PRODUCT_IMAGE_PLACEHOLDERS.handheld;
  if (normalized.includes('console')) return PRODUCT_IMAGE_PLACEHOLDERS.console;
  if (normalized.includes('game')) return PRODUCT_IMAGE_PLACEHOLDERS.game;
  return PRODUCT_IMAGE_PLACEHOLDERS.generic;
}

/**
 * Returns the product's uploaded photo URL if present, otherwise a category-based SVG
 * placeholder. Also the function to call from an `<img onError>` handler (pass the same
 * product) so a broken/expired image URL falls back to the placeholder instead of a broken
 * image icon.
 */
export function getProductImage(product: ProductImageLike): string {
  if (product.imageUrl) return product.imageUrl;
  return placeholderForCategory(product.category ?? product.categoryName);
}

/** Category-only placeholder lookup, for callers (e.g. onError) that don't want to re-check imageUrl. */
export function getProductImagePlaceholder(product: ProductImageLike): string {
  return placeholderForCategory(product.category ?? product.categoryName);
}
