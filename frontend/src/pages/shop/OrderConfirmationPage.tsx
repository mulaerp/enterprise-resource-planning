import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { CheckCircle2, Clock, Mail } from 'lucide-react';
import PublicLayout from '../../components/PublicLayout';
import { Badge, Button, Input } from '../../components/ui';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useShopAuth } from '../../contexts/ShopAuthContext';
import publicApi from '../../lib/public-api';
import { getErrorMessage } from '../../lib/api';
import type { ShopOrder } from '../../lib/shop-types';

/**
 * Order confirmation, landed on directly from `CheckoutPage`'s `navigate(..., { state: { order }
 * })` - the full `ShopOrderDto` response rides in router state so this page never needs a second
 * fetch on the happy path. A reload/direct visit loses that state (router state doesn't survive a
 * hard navigation), so this page falls back to a guest email-confirmation form (reusing the same
 * `GET /public/shop/orders/{orderNumber}?email=` guest lookup as `OrderLookupPage`) rather than
 * showing nothing - see the "no state" branch below.
 */
export default function OrderConfirmationPage() {
  const { orderNumber } = useParams();
  const location = useLocation();
  const { format } = useCurrency();
  const { isAuthenticated } = useShopAuth();
  const stateOrder = (location.state as { order?: ShopOrder } | null)?.order;

  const [order, setOrder] = useState<ShopOrder | null>(stateOrder ?? null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await publicApi.get<ShopOrder>(
        `/public/shop/orders/${encodeURIComponent(orderNumber ?? '')}`,
        { params: { email: email.trim() } }
      );
      setOrder(response.data);
    } catch (err) {
      setError(getErrorMessage(err, 'No order found for that order number and email.'));
    } finally {
      setLoading(false);
    }
  };

  if (!order) {
    return (
      <PublicLayout>
        <div className="max-w-md mx-auto px-4 sm:px-6 py-12">
          <div className="bg-white rounded-lg border border-slate-200 p-8 space-y-4">
            <h1 className="text-xl font-bold text-slate-900">Order {orderNumber}</h1>
            <p className="text-sm text-slate-600">
              {isAuthenticated
                ? 'Reloaded this page? Find your order in '
                : "We don't have this order's details on this page anymore - confirm the email you checked out with to view it again."}
              {isAuthenticated && (
                <Link to="/shop/account" className="font-semibold text-brand-600 hover:text-brand-700">
                  My account &rarr; Orders
                </Link>
              )}
            </p>
            {!isAuthenticated && (
              <form onSubmit={handleLookup} className="space-y-3">
                {error && <p className="text-sm text-red-600">{error}</p>}
                <Input
                  label="Email used at checkout"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Button type="submit" loading={loading} icon={<Mail className="w-4 h-4" />} className="w-full">
                  View order
                </Button>
              </form>
            )}
          </div>
        </div>
      </PublicLayout>
    );
  }

  const isReserved = order.status === 'RESERVED' || order.status === 'AWAITING_PAYMENT';

  return (
    <PublicLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 space-y-6">
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
          <h1 className="text-2xl font-bold text-slate-900">Order placed</h1>
          <p className="text-slate-600">
            Order number <span className="font-mono font-semibold text-slate-900">{order.orderNumber}</span>
          </p>
          <Badge variant={isReserved ? 'warning' : 'success'}>{order.status}</Badge>

          {!isAuthenticated && (
            <p className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3 mt-4">
              Save this order number - together with{' '}
              <span className="font-medium text-slate-700">{order.guestEmail}</span>, you can use it to track your
              order any time from{' '}
              <Link to="/shop/orders/lookup" className="font-semibold text-brand-600 hover:text-brand-700">
                Track an order
              </Link>
              .
            </p>
          )}
        </div>

        {isReserved && order.reservedUntil && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-700 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              Your item{order.lines.length === 1 ? ' is' : 's are'} held until{' '}
              <span className="font-semibold">{new Date(order.reservedUntil).toLocaleString()}</span> - if not
              collected/confirmed by then, the reservation is released and the stock returned to sale.
            </p>
          </div>
        )}

        <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-3">
          <h2 className="font-semibold text-slate-900">Order details</h2>
          {order.lines.map((line) => (
            <div key={line.id} className="flex justify-between text-sm text-slate-600">
              <span>
                {line.productName} &times; {line.quantity}
              </span>
              <span className="tabular-nums">{format(line.lineTotal)}</span>
            </div>
          ))}
          <div className="border-t border-slate-200 pt-2 space-y-1">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Subtotal</span>
              <span className="tabular-nums">{format(order.subtotal)}</span>
            </div>
            {order.deliveryFee > 0 && (
              <div className="flex justify-between text-sm text-slate-600">
                <span>Delivery fee</span>
                <span className="tabular-nums">{format(order.deliveryFee)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-slate-900">
              <span>Total</span>
              <span className="tabular-nums">{format(order.total)}</span>
            </div>
          </div>
          <p className="text-sm text-slate-500 pt-2">
            Fulfilment: {order.fulfilmentType === 'COLLECT' ? 'Collect at store' : 'Postage'}
            {order.deliveryAddress && ` - ${order.deliveryAddress}`}
          </p>
          <p className="text-sm text-slate-500">Payment: Pay at collection / on delivery</p>
        </div>

        <div className="text-center">
          <Link to="/" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            &larr; Continue shopping
          </Link>
        </div>
      </div>
    </PublicLayout>
  );
}
