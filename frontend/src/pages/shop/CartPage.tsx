import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, Trash2, ShoppingCart, ArrowLeft } from 'lucide-react';
import PublicLayout from '../../components/PublicLayout';
import { Button, Badge } from '../../components/ui';
import { useCart } from '../../contexts/CartContext';
import { useCurrency } from '../../contexts/CurrencyContext';

/**
 * Cart page for the public storefront - reads/writes `CartContext` only (localStorage, no
 * server session). Quantities are client-side and best-effort against the last-known
 * `stockStatus` captured when each line was added/updated - the backend's own 409 at checkout
 * (`ShopOrderService#placeOrder`, "Insufficient stock for ...") is the real authority, since
 * stock can change between adding to cart and placing the order (most thrift stock is quantity
 * 1 - see CheckoutPage for how that 409 is surfaced back here).
 */
export default function CartPage() {
  const { lines, updateQuantity, removeItem, subtotal } = useCart();
  const { format } = useCurrency();
  const navigate = useNavigate();

  if (lines.length === 0) {
    return (
      <PublicLayout>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center space-y-4">
          <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto" />
          <h1 className="text-2xl font-bold text-slate-900">Your cart is empty</h1>
          <p className="text-slate-500">Browse the shop and add something you like.</p>
          <Link to="/">
            <Button icon={<ArrowLeft className="w-4 h-4" />}>Back to shop</Button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Your cart</h1>

        <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-200">
          {lines.map((line) => (
            <div key={line.productId} className="p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 truncate">{line.name}</p>
                <p className="text-xs text-slate-500">{line.sku}</p>
                {line.stockStatus === 'OUT_OF_STOCK' && (
                  <Badge variant="danger" size="sm" className="mt-1">
                    May no longer be available
                  </Badge>
                )}
                <p className="text-sm text-slate-600 tabular-nums mt-1 sm:hidden">{format(line.unitPrice)} each</p>
              </div>

              <p className="hidden sm:block text-sm text-slate-600 tabular-nums w-28">{format(line.unitPrice)} each</p>

              <div className="flex items-center border border-slate-300 rounded-lg">
                <button
                  type="button"
                  aria-label={`Decrease quantity of ${line.name}`}
                  onClick={() => updateQuantity(line.productId, line.quantity - 1)}
                  className="p-2 text-slate-600 hover:bg-slate-50"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-8 text-center tabular-nums text-sm font-medium">{line.quantity}</span>
                <button
                  type="button"
                  aria-label={`Increase quantity of ${line.name}`}
                  onClick={() => updateQuantity(line.productId, line.quantity + 1)}
                  className="p-2 text-slate-600 hover:bg-slate-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="w-24 text-right font-semibold text-slate-900 tabular-nums">
                {format(line.unitPrice * line.quantity)}
              </p>

              <button
                type="button"
                aria-label={`Remove ${line.name} from cart`}
                onClick={() => removeItem(line.productId)}
                className="text-slate-400 hover:text-red-600 transition-colors p-1"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4 flex items-center justify-between">
          <span className="text-slate-600">Subtotal</span>
          <span className="text-xl font-bold text-slate-900 tabular-nums">{format(subtotal)}</span>
        </div>
        <p className="text-xs text-slate-500 -mt-4">
          Delivery fee (if postage is chosen) and the final total are confirmed on the next step.
        </p>

        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            &larr; Continue shopping
          </Link>
          <Button onClick={() => navigate('/shop/checkout')}>Proceed to checkout</Button>
        </div>
      </div>
    </PublicLayout>
  );
}
