/**
 * Shared display formatting for the public storefront pages (StorefrontPage,
 * StorefrontItemPage) - condition/stock-status labels+colours, kept in one
 * place so the two pages render products identically.
 *
 * Money formatting lives in `lib/money.ts` (`formatMoney`/`formatInCurrency`)
 * now that the currency contract is in place - see `contexts/CurrencyContext`
 * for the storefront's currency-switcher wiring.
 */
export type ThriftCondition = 'NEW' | 'LIKE_NEW' | 'GOOD' | 'FAIR' | 'POOR';
export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export const CONDITION_LABELS: Record<ThriftCondition, string> = {
  NEW: 'New',
  LIKE_NEW: 'Like New',
  GOOD: 'Good',
  FAIR: 'Fair',
  POOR: 'Poor',
};

export const CONDITION_VARIANTS: Record<ThriftCondition, 'success' | 'info' | 'default' | 'warning' | 'danger'> = {
  NEW: 'success',
  LIKE_NEW: 'info',
  GOOD: 'default',
  FAIR: 'warning',
  POOR: 'danger',
};

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  IN_STOCK: 'In Stock',
  LOW_STOCK: 'Low Stock',
  OUT_OF_STOCK: 'Out of Stock',
};

export const STOCK_STATUS_VARIANTS: Record<StockStatus, 'success' | 'warning' | 'default'> = {
  IN_STOCK: 'success',
  LOW_STOCK: 'warning',
  OUT_OF_STOCK: 'default',
};
