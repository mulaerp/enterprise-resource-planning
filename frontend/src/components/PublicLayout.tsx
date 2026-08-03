import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { branding } from '../branding';
import { useCurrency } from '../contexts/CurrencyContext';
import { useShopAuth } from '../contexts/ShopAuthContext';
import { useCart } from '../contexts/CartContext';

interface PublicLayoutProps {
  children: ReactNode;
}

function CurrencySelect() {
  const { currencies, selected, setCurrencyCode } = useCurrency();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="shop-currency" className="text-sm text-slate-500 hidden sm:inline">
        Currency
      </label>
      <select
        id="shop-currency"
        value={selected.code}
        onChange={(e) => setCurrencyCode(e.target.value)}
        className="text-sm border border-slate-300 rounded-lg py-1.5 pl-2 pr-7 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus:border-brand-600"
      >
        {currencies.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code} ({c.symbol})
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Layout shell for the anonymous B2C storefront ('/', '/shop/*'). Deliberately
 * separate from the staff `Layout` (no sidebar, no auth-aware nav) - see the
 * SHOP module spec.
 *
 * The currency-select in the header reads `useCurrency()`, so this component
 * must always be rendered under the `CurrencyProvider` layout route mounted
 * in `App.tsx` around the public routes - see the CURRENCY module spec.
 */
function ShopAccountLink() {
  // ShopAuthContext's own session probe (GET /shop/auth/me) never redirects and treats a 401
  // as "signed out" - see that context's javadoc - so it's always safe to read here even for a
  // fully anonymous visitor; `loading` just briefly shows the signed-out state until it resolves.
  const { isAuthenticated, customer } = useShopAuth();
  if (isAuthenticated && customer) {
    return (
      <Link
        to="/shop/account"
        className="text-slate-700 hover:text-brand-600 transition-colors font-semibold"
      >
        My account
      </Link>
    );
  }
  return (
    <Link to="/shop/login" className="text-slate-700 hover:text-brand-600 transition-colors">
      Sign in
    </Link>
  );
}

function CartLink() {
  const { itemCount } = useCart();
  return (
    <Link
      to="/shop/cart"
      aria-label={`View cart, ${itemCount} item${itemCount === 1 ? '' : 's'}`}
      className="relative text-slate-700 hover:text-brand-600 transition-colors"
    >
      <ShoppingCart className="w-5 h-5" />
      {itemCount > 0 && (
        <span className="absolute -top-2 -right-2 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
          {itemCount}
        </span>
      )}
    </Link>
  );
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={branding.appName} className="w-9 h-9 rounded-lg object-contain" />
            ) : (
              <div className="w-9 h-9 bg-brand-600 rounded-lg flex items-center justify-center">
                <span className="text-lg font-bold text-white">{branding.logoInitial}</span>
              </div>
            )}
            <span className="text-lg font-bold text-slate-900">{branding.appName}</span>
          </Link>
          <nav className="flex items-center gap-4 sm:gap-6 text-sm font-medium">
            <Link to="/" className="text-slate-700 hover:text-brand-600 transition-colors">
              Shop
            </Link>
            <Link to="/shop/warranty" className="text-slate-700 hover:text-brand-600 transition-colors">
              Warranty Check
            </Link>
            <Link to="/shop/trade-in" className="text-slate-700 hover:text-brand-600 transition-colors">
              Sell / Trade-in
            </Link>
            <CurrencySelect />
            <CartLink />
            <ShopAccountLink />
            <Link
              to="/login"
              className="text-slate-500 hover:text-brand-600 transition-colors border-l border-slate-200 pl-4 sm:pl-6"
            >
              Staff login
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-white border-t border-slate-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 text-sm text-slate-500 text-center">
          {branding.copyright}
        </div>
      </footer>
    </div>
  );
}
