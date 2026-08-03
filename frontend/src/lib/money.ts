/**
 * Base money formatter for Mula ERP.
 *
 * Every amount stored and transacted in the system is MYR (see the V25
 * `currencies` migration: `price_in_currency = price_in_MYR * rate`, with
 * the MYR row pinned at `rate_to_base = 1.0`). Staff-facing pages always
 * render the raw MYR amount via `formatMoney`; the public storefront's
 * currency switcher converts a MYR amount into a shopper-selected display
 * currency via `formatInCurrency`.
 *
 * `formatMoney(1234.5)` -> "RM 1,234.50" (the space between "RM" and the
 * digits is U+00A0 NO-BREAK SPACE, which is what `Intl.NumberFormat`
 * produces for the `en-MY` locale - e2e helpers asserting this string must
 * match that exact character, not a regular space).
 */

export interface CurrencyInfo {
  /** ISO 4217 code, e.g. "USD". */
  code: string;
  /** Display symbol as returned by the backend (admin-editable), e.g. "S$". */
  symbol: string;
  /** price_in_currency = price_in_MYR * rate (MYR row is always 1.0). */
  rate: number;
}

export interface FormatMoneyOptions {
  /** Compact notation for tight spaces (chart axis ticks, small stat tiles) - e.g. "RM 1.2M" instead of "RM 1,234,500.00". */
  compact?: boolean;
}

const MYR_FORMATTER = new Intl.NumberFormat('en-MY', {
  style: 'currency',
  currency: 'MYR',
});

const MYR_COMPACT_FORMATTER = new Intl.NumberFormat('en-MY', {
  style: 'currency',
  currency: 'MYR',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const NUMBER_FORMATTER = new Intl.NumberFormat('en-MY', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NUMBER_COMPACT_FORMATTER = new Intl.NumberFormat('en-MY', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const safe = (n: number): number => (Number.isFinite(n) ? n : 0);

/** Formats a MYR amount, e.g. `formatMoney(1234.5)` -> "RM 1,234.50" (see note above on the space). */
export function formatMoney(amount: number, opts?: FormatMoneyOptions): string {
  const value = safe(amount);
  return (opts?.compact ? MYR_COMPACT_FORMATTER : MYR_FORMATTER).format(value);
}

/**
 * Converts a MYR amount into `currency` (using its admin-editable `rate`)
 * and formats it with that currency's own `symbol`.
 *
 * Deliberately does NOT use `Intl.NumberFormat(..., { style: 'currency',
 * currency: currency.code })` for the symbol: Intl's own currency symbols
 * for `en-MY` don't match the backend's seeded symbols (USD -> "US$" not
 * "$", SGD -> "SGD" not "S$", and narrowSymbol collapses USD/SGD to the
 * same ambiguous "$"). The backend `symbol` field is the source of truth
 * (admin-editable via `PUT /currencies/{code}`), so we use Intl only for
 * locale-correct grouping/decimals and prefix the given symbol ourselves.
 * MYR is routed straight through `formatMoney` so the two functions render
 * byte-identical output for the base currency.
 */
export function formatInCurrency(
  amountMyr: number,
  currency: CurrencyInfo,
  opts?: FormatMoneyOptions
): string {
  if (currency.code === 'MYR') {
    return formatMoney(amountMyr, opts);
  }
  const converted = safe(amountMyr) * currency.rate;
  const formatter = opts?.compact ? NUMBER_COMPACT_FORMATTER : NUMBER_FORMATTER;
  return `${currency.symbol}\u00A0${formatter.format(converted)}`;
}
