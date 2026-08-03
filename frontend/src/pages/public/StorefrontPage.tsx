import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Search, ShoppingCart, Check } from 'lucide-react';
import publicApi from '../../lib/public-api';
import PublicLayout from '../../components/PublicLayout';
import { Badge, Button } from '../../components/ui';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useCart } from '../../contexts/CartContext';
import { getProductImage, getProductImagePlaceholder } from '../../lib/product-image';
import {
  CONDITION_LABELS,
  CONDITION_VARIANTS,
  STOCK_STATUS_LABELS,
  STOCK_STATUS_VARIANTS,
  type ThriftCondition,
  type StockStatus,
} from '../../lib/storefront-format';

const REFRESH_INTERVAL_MS = 30000;
const PAGE_SIZE = 12;

interface CatalogItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  condition: ThriftCondition;
  tags?: string[];
  sellPrice: number;
  buyPrice?: number | null;
  stockStatus: StockStatus;
  hasBox: boolean;
  accessories?: string[];
  imageUrl?: string | null;
}

interface CategoryOption {
  name: string;
  count: number;
}

function AddToCartButton({ item }: { item: CatalogItem }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  if (item.stockStatus === 'OUT_OF_STOCK') {
    return (
      <Button variant="secondary" size="sm" className="w-full" disabled>
        Out of stock
      </Button>
    );
  }

  return (
    <Button
      variant={added ? 'secondary' : 'primary'}
      size="sm"
      className="w-full"
      icon={added ? <Check className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
      onClick={() => {
        addItem({
          productId: item.id,
          sku: item.sku,
          name: item.name,
          unitPrice: item.sellPrice,
          imageUrl: item.imageUrl,
          stockStatus: item.stockStatus,
        });
        setAdded(true);
        setTimeout(() => setAdded(false), 1500);
      }}
    >
      {added ? 'Added' : 'Add to cart'}
    </Button>
  );
}

export default function StorefrontPage() {
  const { selected, format } = useCurrency();
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    publicApi
      .get('/public/categories')
      .then((res) => setCategories(res.data))
      .catch((err) => console.error('Failed to load categories:', err));
  }, []);

  useEffect(() => {
    const fetchCatalog = async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const params = new URLSearchParams({ page: page.toString(), size: PAGE_SIZE.toString() });
        if (search) params.append('search', search);
        if (selectedCategory) params.append('category', selectedCategory);

        const response = await publicApi.get(`/public/catalog?${params}`);
        setItems(response.data.content);
        setTotalPages(response.data.totalPages);
      } catch (err) {
        console.error('Failed to load catalogue:', err);
      } finally {
        if (!silent) setLoading(false);
      }
    };

    fetchCatalog();
    // "Live" stock: refresh the visible page on an interval so shoppers see
    // stock-status changes without reloading. Silent (no loading spinner) so
    // it doesn't flicker the page every 30s.
    const interval = setInterval(() => fetchCatalog(true), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [search, selectedCategory, page]);

  return (
    <PublicLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Shop</h1>
          <p className="text-slate-500 mt-1">Browse our current stock - prices update live.</p>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <label htmlFor="storefront-search" className="sr-only">
            Search products
          </label>
          <input
            id="storefront-search"
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search by name or SKU..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus:border-brand-600"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('');
              setPage(0);
            }}
            className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${
              selectedCategory === ''
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.name}
              type="button"
              onClick={() => {
                setSelectedCategory(cat.name);
                setPage(0);
              }}
              className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${
                selectedCategory === cat.name
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {cat.name} ({cat.count})
            </button>
          ))}
        </div>

        {!loading && items.length > 0 && selected.code !== 'MYR' && (
          <p className="text-xs text-slate-400 -mb-2">Prices are approximate conversions from MYR</p>
        )}

        {loading ? (
          <div className="py-16 text-center text-slate-500">Loading catalogue...</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-slate-500">No products found.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {items.map((item) => (
              <div
                key={item.sku}
                className="bg-white rounded-lg border border-slate-200 p-4 hover:border-brand-600 hover:shadow-sm transition-all flex flex-col gap-2"
              >
                {/* Card's whole browse/navigate surface stays one <a> (unchanged shape for the
                    existing storefront.spec.ts/buyer.spec.ts locators) - AddToCartButton is a
                    sibling <button> below it, not nested inside the anchor (invalid HTML to nest
                    interactive elements, and it would otherwise also trigger navigation). */}
                <Link to={`/shop/item/${item.sku}`} className="flex flex-col gap-2 flex-1">
                  <div className="aspect-[4/3] w-full overflow-hidden rounded-md bg-slate-100 -mt-1">
                    <img
                      src={getProductImage(item)}
                      alt={item.name}
                      loading="lazy"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = getProductImagePlaceholder(item);
                      }}
                    />
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-medium text-slate-900">{item.name}</h2>
                    <Badge variant={STOCK_STATUS_VARIANTS[item.stockStatus]} size="sm">
                      {STOCK_STATUS_LABELS[item.stockStatus]}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500">{item.category}</p>
                  <div>
                    <Badge variant={CONDITION_VARIANTS[item.condition]} size="sm">
                      {CONDITION_LABELS[item.condition]}
                    </Badge>
                  </div>
                  <div className="mt-auto pt-2 space-y-0.5">
                    <p className="text-lg font-bold text-brand-700 tabular-nums">
                      WE SELL {format(item.sellPrice)}
                    </p>
                    {item.buyPrice != null && (
                      <p className="text-sm text-slate-500 tabular-nums">WE BUY {format(item.buyPrice)}</p>
                    )}
                  </div>
                </Link>
                <AddToCartButton item={item} />
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 pt-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <span className="text-sm text-slate-700">
              Page {page + 1} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
