import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, PackageSearch, CheckCircle2, AlertTriangle, UserPlus, LogIn } from 'lucide-react';
import PublicLayout from '../../components/PublicLayout';
import { Input, Select, Textarea, Button, Badge } from '../../components/ui';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useShopAuth } from '../../contexts/ShopAuthContext';
import publicApi from '../../lib/public-api';
import shopApi from '../../lib/shop-api';
import { getErrorMessage } from '../../lib/api';
import { CONDITION_LABELS, type ThriftCondition } from '../../lib/storefront-format';
import type { ShopTradeInQuote } from '../../lib/shop-types';

interface CatalogHit {
  id: string;
  sku: string;
  name: string;
  sellPrice: number;
}

interface CategoryOption {
  id: string;
  name: string;
}

const CONDITIONS: ThriftCondition[] = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR'];

/**
 * Postal/drop-off trade-in QUOTE REQUEST (WEBSHOP owner decision 3 - an INDICATIVE RANGE, never a
 * firm price, settled by staff inspection on arrival).
 *
 * <p><b>Members-only (OWNER DECISION, 2026-08):</b> guests may browse and buy freely, but may NOT
 * request a trade-in quote online any more - the previous guest path (`POST
 * /api/v1/public/shop/quotes`) has been deleted on the backend, since staff need to be able to
 * contact the seller and pay them, and a guest quote had no way to ever accept/decline a staff
 * final offer once inspected (a permanent dead end - see the `webshop` skill / `ShopTradeInQuoteService`
 * javadoc). A signed-out visitor sees a sign-in/create-account prompt instead of the request form
 * below, and no guest contact fields are collected anywhere on this page any more. A signed-in
 * customer sees the exact same form as before.
 *
 * <p>Catalogue search is the primary path (resolves a real `productId`); "describe it instead" is
 * the fallback (`freeTextDescription` + `categoryId`) for an item not in the catalogue - mirrors
 * `ShopTradeInQuoteService#requestQuote`'s own "exactly one of productId or categoryId" rule.
 */
export default function TradeInQuotePage() {
  const { format } = useCurrency();
  const { customer, isAuthenticated, loading: authLoading } = useShopAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'catalogue' | 'describe'>('catalogue');
  const [search, setSearch] = useState('');
  const [hits, setHits] = useState<CatalogHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CatalogHit | null>(null);

  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [freeText, setFreeText] = useState('');

  const [declaredCondition, setDeclaredCondition] = useState<ThriftCondition>('GOOD');
  const [hasBox, setHasBox] = useState(false);
  const [accessories, setAccessories] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'POST' | 'DROP_OFF'>('DROP_OFF');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [quote, setQuote] = useState<ShopTradeInQuote | null>(null);

  useEffect(() => {
    // Signed-out visitors see the sign-in/register prompt instead of this form (see the render
    // branch below) - no point loading catalogue data for a form they can't submit.
    if (!isAuthenticated) return;
    publicApi
      .get('/public/categories')
      .then((res) => setCategories(res.data))
      .catch((err) => console.error('Failed to load categories:', err));
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || mode !== 'catalogue' || !search.trim()) {
      setHits([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timeout = setTimeout(() => {
      publicApi
        .get('/public/catalog', { params: { search: search.trim(), size: 8 } })
        .then((res) => {
          if (!cancelled) setHits(res.data.content);
        })
        .catch((err) => console.error('Catalogue search failed:', err))
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [search, mode, isAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'catalogue' && !selectedProduct) {
      setError('Please select an item from the catalogue, or switch to "Describe it instead".');
      return;
    }
    if (mode === 'describe' && (!freeText.trim() || !categoryId)) {
      setError('Please describe the item and choose the closest category.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        productId: mode === 'catalogue' ? selectedProduct!.id : undefined,
        freeTextDescription: mode === 'describe' ? freeText.trim() : undefined,
        categoryId: mode === 'describe' ? categoryId : undefined,
        declaredCondition,
        hasBox,
        accessories: accessories.trim() || undefined,
        deliveryMethod,
      };

      // Members-only - the only remaining creation endpoint is the SHOP_CUSTOMER-scoped one.
      // This branch is only reachable at all when isAuthenticated is true (see the sign-in/
      // register gate below, which replaces this whole form for a signed-out visitor).
      const response = await shopApi.post<ShopTradeInQuote>('/shop/quotes', payload);
      setQuote(response.data);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not get a quote for that item. Please check your details and try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Members-only gate (OWNER DECISION - see class javadoc). Wait for the auth probe to resolve
  // before deciding what to show, so a signed-in customer doesn't see a flash of the sign-in
  // prompt on first paint (ShopAuthProvider's own GET /shop/auth/me hasn't resolved yet).
  if (authLoading) {
    return (
      <PublicLayout>
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-12 text-center text-slate-500">Loading...</div>
      </PublicLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <PublicLayout>
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-12 space-y-6">
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center space-y-4">
            <PackageSearch className="w-12 h-12 text-brand-600 mx-auto" />
            <h1 className="text-2xl font-bold text-slate-900">Trade-ins are for account holders</h1>
            <p className="text-slate-600">
              We need to be able to contact you about the item and pay you for it, so postal/drop-off trade-in
              quotes require a free shop account. Browsing and buying don&apos;t - only selling to us does.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button
                icon={<UserPlus className="w-4 h-4" />}
                className="w-full sm:w-auto"
                onClick={() => navigate('/shop/register')}
              >
                Create an account
              </Button>
              <Button
                variant="secondary"
                icon={<LogIn className="w-4 h-4" />}
                className="w-full sm:w-auto"
                onClick={() => navigate('/shop/login')}
              >
                Sign in
              </Button>
            </div>
          </div>
        </div>
      </PublicLayout>
    );
  }

  if (quote) {
    return (
      <PublicLayout>
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-12 space-y-6">
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
            <h1 className="text-2xl font-bold text-slate-900">Quote number {quote.quoteNumber}</h1>
            <Badge variant="warning" size="lg">
              Indicative estimate only
            </Badge>
            <p className="text-3xl font-bold text-brand-700 tabular-nums">
              {format(quote.quotedMin)} - {format(quote.quotedMax)}
            </p>
            <div className="flex items-start gap-2 text-left bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-800">{quote.indicativeMessage}</p>
            </div>
            <p className="text-sm text-slate-500">
              Valid until {new Date(quote.expiresAt).toLocaleString()} - this is not a firm price. The final offer is
              only decided once we've physically inspected the item.
            </p>
          </div>
          <p className="text-sm text-slate-500 text-center">
            Track this quote's status any time from{' '}
            <Link to="/shop/account" className="font-semibold text-brand-600 hover:text-brand-700">
              your account
            </Link>
            .
          </p>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Sell or trade in an item</h1>
          <p className="text-slate-500 mt-1">
            Get an indicative price range by post or drop-off - a final offer is only confirmed after we inspect
            the item in person.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <section className="bg-white rounded-lg border border-slate-200 p-6 space-y-3">
            <h2 className="font-semibold text-slate-900">What are you selling?</h2>

            {mode === 'catalogue' ? (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <label htmlFor="trade-in-search" className="sr-only">
                    Search our catalogue
                  </label>
                  <input
                    id="trade-in-search"
                    type="text"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setSelectedProduct(null);
                    }}
                    placeholder="Search our catalogue by name or SKU..."
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus:border-brand-600"
                  />
                </div>

                {searching && <p className="text-sm text-slate-500">Searching...</p>}

                {selectedProduct ? (
                  <div className="flex items-center justify-between border border-brand-600 ring-1 ring-brand-600 rounded-lg p-3">
                    <div>
                      <p className="font-medium text-slate-900">{selectedProduct.name}</p>
                      <p className="text-xs text-slate-500">{selectedProduct.sku}</p>
                    </div>
                    <button
                      type="button"
                      className="text-sm text-slate-500 hover:text-slate-900"
                      onClick={() => setSelectedProduct(null)}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  hits.length > 0 && (
                    <div className="border border-slate-200 rounded-lg divide-y divide-slate-200 max-h-56 overflow-y-auto">
                      {hits.map((hit) => (
                        <button
                          type="button"
                          key={hit.id}
                          onClick={() => {
                            setSelectedProduct(hit);
                            setHits([]);
                            setSearch(hit.name);
                          }}
                          className="w-full text-left p-3 hover:bg-slate-50"
                        >
                          <p className="font-medium text-slate-900">{hit.name}</p>
                          <p className="text-xs text-slate-500">{hit.sku}</p>
                        </button>
                      ))}
                    </div>
                  )
                )}

                <button
                  type="button"
                  className="text-sm font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1"
                  onClick={() => setMode('describe')}
                >
                  <PackageSearch className="w-4 h-4" /> Can&apos;t find it? Describe it instead
                </button>
              </>
            ) : (
              <>
                <Textarea
                  label="Describe the item"
                  required
                  rows={3}
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  placeholder="Brand, model, what it is..."
                />
                <Select
                  label="Closest category"
                  required
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">Select a category...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                <button
                  type="button"
                  className="text-sm font-medium text-brand-600 hover:text-brand-700"
                  onClick={() => setMode('catalogue')}
                >
                  &larr; Search our catalogue instead
                </button>
              </>
            )}
          </section>

          <section className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
            <h2 className="font-semibold text-slate-900">Condition</h2>
            <Select
              label="Condition"
              required
              value={declaredCondition}
              onChange={(e) => setDeclaredCondition(e.target.value as ThriftCondition)}
            >
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {CONDITION_LABELS[c]}
                </option>
              ))}
            </Select>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={hasBox} onChange={(e) => setHasBox(e.target.checked)} />
              I still have the original box
            </label>
            <Input
              label="Included accessories (optional)"
              value={accessories}
              onChange={(e) => setAccessories(e.target.value)}
              placeholder="e.g. charger, controller, manual"
            />
            <Select
              label="How will we receive it?"
              required
              value={deliveryMethod}
              onChange={(e) => setDeliveryMethod(e.target.value as 'POST' | 'DROP_OFF')}
            >
              <option value="DROP_OFF">Drop off in-store</option>
              <option value="POST">Send by post</option>
            </Select>
          </section>

          {/* This form only renders once isAuthenticated is true (see the sign-in/register gate
              above) - customer is therefore always set here; no guest contact fields are
              collected on this page any more (OWNER DECISION - members-only). */}
          {customer && (
            <section className="bg-white rounded-lg border border-slate-200 p-6">
              <p className="text-sm text-slate-600">Quote will be linked to your account ({customer.email}).</p>
            </section>
          )}

          <Button type="submit" loading={submitting} className="w-full" size="lg">
            Get my indicative quote
          </Button>
        </form>
      </div>
    </PublicLayout>
  );
}
