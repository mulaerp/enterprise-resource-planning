import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Package, ShieldCheck, ShoppingCart, Minus, Plus } from 'lucide-react';
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

export default function StorefrontItemPage() {
  const { selected, format } = useCurrency();
  const { sku } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [item, setItem] = useState<CatalogItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchItem = async () => {
      if (cancelled) return;
      setLoading(true);
      setNotFound(false);
      try {
        const response = await publicApi.get(`/public/catalog/${sku}`);
        if (!cancelled) setItem(response.data);
      } catch (err) {
        console.error('Failed to load item:', err);
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchItem();
    return () => {
      cancelled = true;
    };
  }, [sku]);

  useEffect(() => {
    setQuantity(1);
    setAdded(false);
  }, [sku]);

  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <Link to="/" className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors w-fit">
          <ArrowLeft size={20} />
          Back to Shop
        </Link>

        {loading && <div className="py-16 text-center text-slate-500">Loading...</div>}

        {!loading && notFound && (
          <div className="py-16 text-center text-slate-500">
            <p className="text-lg font-medium text-slate-700">Item not found</p>
            <p className="mt-1">This SKU may have been sold or removed from the catalogue.</p>
          </div>
        )}

        {!loading && item && (
          <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
            <div className="aspect-[4/3] w-full max-w-sm mx-auto overflow-hidden rounded-lg bg-slate-100">
              <img
                src={getProductImage(item)}
                alt={item.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = getProductImagePlaceholder(item);
                }}
              />
            </div>

            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">{item.name}</h1>
                <p className="text-sm text-slate-500 mt-1">
                  {item.sku} &middot; {item.category}
                </p>
              </div>
              <Badge variant={STOCK_STATUS_VARIANTS[item.stockStatus]}>
                {STOCK_STATUS_LABELS[item.stockStatus]}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant={CONDITION_VARIANTS[item.condition]}>{CONDITION_LABELS[item.condition]}</Badge>
              {item.hasBox && (
                <Badge variant="info">
                  <Package className="w-3.5 h-3.5 mr-1" />
                  Original box
                </Badge>
              )}
              {item.tags?.map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
            </div>

            {item.accessories && item.accessories.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-slate-700 mb-1">Included accessories</h2>
                <ul className="list-disc list-inside text-sm text-slate-600">
                  {item.accessories.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="border-t border-slate-200 pt-4 space-y-1">
              <p className="text-2xl font-bold text-brand-700 tabular-nums">
                WE SELL {format(item.sellPrice)}
              </p>
              {item.buyPrice != null && (
                <p className="text-slate-500 tabular-nums">WE BUY {format(item.buyPrice)}</p>
              )}
              {selected.code !== 'MYR' && (
                <p className="text-xs text-slate-400 pt-1">Prices are approximate conversions from MYR</p>
              )}
            </div>

            <div className="border-t border-slate-200 pt-4">
              {item.stockStatus === 'OUT_OF_STOCK' ? (
                // RESERVATION HONESTY: stockStatus is derived server-side from the same live
                // stockQuantity that a reservation (SHOP_RESERVE) already decremented at
                // placement, so a reserved one-off item shows OUT_OF_STOCK here automatically -
                // no separate "reserved" check needed on this page.
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm text-slate-600">
                  This item is currently unavailable (it may already be reserved in someone
                  else&apos;s order) and can&apos;t be added to your cart right now.
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex items-center border border-slate-300 rounded-lg">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="p-2.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                      disabled={quantity <= 1}
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-10 text-center tabular-nums font-medium">{quantity}</span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() => setQuantity((q) => q + 1)}
                      className="p-2.5 text-slate-600 hover:bg-slate-50"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <Button
                    variant={added ? 'secondary' : 'primary'}
                    icon={<ShoppingCart className="w-4 h-4" />}
                    className="flex-1"
                    onClick={() => {
                      addItem({
                        productId: item.id,
                        sku: item.sku,
                        name: item.name,
                        unitPrice: item.sellPrice,
                        imageUrl: item.imageUrl,
                        stockStatus: item.stockStatus,
                      }, quantity);
                      setAdded(true);
                      setTimeout(() => setAdded(false), 1500);
                    }}
                  >
                    {added ? 'Added to cart' : 'Add to cart'}
                  </Button>
                  <Button variant="secondary" onClick={() => navigate('/shop/cart')}>
                    View cart
                  </Button>
                </div>
              )}
            </div>

            <Link
              to="/shop/warranty"
              className="inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-800"
            >
              <ShieldCheck className="w-4 h-4" />
              Check warranty
            </Link>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
