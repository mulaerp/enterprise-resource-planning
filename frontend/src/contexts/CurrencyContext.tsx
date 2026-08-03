import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import publicApi from '../lib/public-api';
import { formatInCurrency, type CurrencyInfo } from '../lib/money';

const STORAGE_KEY = 'shop_currency';

/** Used before `GET /public/currencies` resolves (and as the guaranteed fallback if it 404s/errors). */
const MYR_FALLBACK: CurrencyInfo = { code: 'MYR', symbol: 'RM', rate: 1 };

interface CurrencyContextType {
  /** All currencies the storefront can display in, MYR first. */
  currencies: CurrencyInfo[];
  /** The shopper's currently-selected display currency. */
  selected: CurrencyInfo;
  /** Switches the display currency and persists the choice to `localStorage['shop_currency']`. */
  setCurrencyCode: (code: string) => void;
  /** Converts + formats a MYR amount into the selected currency (identity for MYR). */
  format: (amountMyr: number) => string;
  /** True until the first `GET /public/currencies` response (or failure) lands. */
  loading: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

/**
 * Currency-switcher state for the anonymous B2C storefront. Mounted once by
 * `PublicLayout` so `StorefrontPage`/`StorefrontItemPage` share the same
 * selection without prop-drilling - see the CURRENCY module spec.
 */
export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currencies, setCurrencies] = useState<CurrencyInfo[]>([MYR_FALLBACK]);
  const [code, setCode] = useState<string>(() => localStorage.getItem(STORAGE_KEY) || 'MYR');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    publicApi
      .get('/public/currencies')
      .then((res) => {
        if (cancelled) return;
        const list: CurrencyInfo[] = res.data;
        if (Array.isArray(list) && list.length > 0) {
          setCurrencies(list);
        }
      })
      .catch((err) => console.error('Failed to load currencies:', err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setCurrencyCode = (next: string) => {
    setCode(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  const selected =
    currencies.find((c) => c.code === code) ??
    currencies.find((c) => c.code === 'MYR') ??
    MYR_FALLBACK;

  const format = (amountMyr: number) => formatInCurrency(amountMyr, selected);

  return (
    <CurrencyContext.Provider value={{ currencies, selected, setCurrencyCode, format, loading }}>
      {children}
    </CurrencyContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- context+provider+hook colocated by design
export function useCurrency(): CurrencyContextType {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return ctx;
}
