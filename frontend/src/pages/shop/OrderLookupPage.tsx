import { useState } from 'react';
import { Search, ShieldCheck } from 'lucide-react';
import PublicLayout from '../../components/PublicLayout';
import { Input, Button, Badge } from '../../components/ui';
import { useCurrency } from '../../contexts/CurrencyContext';
import publicApi from '../../lib/public-api';
import { getErrorMessage } from '../../lib/api';
import type { ShopOrder } from '../../lib/shop-types';

/**
 * Guest order status lookup ("save this to track your order" from the confirmation screen) -
 * `GET /api/v1/public/shop/orders/{orderNumber}?email=` (permitAll). Per
 * `ShopOrderService#guestLookup`'s javadoc, a non-matching order number/email pair always 404s
 * (never distinguishes "no such order" from "wrong email"), so the error message here is
 * deliberately generic too.
 */
export default function OrderLookupPage() {
  const { format } = useCurrency();
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setOrder(null);
    setLoading(true);
    try {
      const response = await publicApi.get<ShopOrder>(
        `/public/shop/orders/${encodeURIComponent(orderNumber.trim())}`,
        { params: { email: email.trim() } }
      );
      setOrder(response.data);
    } catch (err) {
      setError(getErrorMessage(err, 'No order found for that order number and email.'));
    } finally {
      setLoading(false);
    }
  };

  const isReserved = order && (order.status === 'RESERVED' || order.status === 'AWAITING_PAYMENT');

  return (
    <PublicLayout>
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Track an order</h1>
          <p className="text-slate-500 mt-1">Enter your order number and the email you checked out with.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
          <Input
            label="Order number"
            required
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="e.g. WEB-2026-000123-a1b2"
          />
          <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" loading={loading} icon={<Search className="w-4 h-4" />}>
            Track order
          </Button>
        </form>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {order && (
          <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">{order.orderNumber}</h2>
              <Badge variant={isReserved ? 'warning' : 'success'}>{order.status}</Badge>
            </div>
            {isReserved && order.reservedUntil && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                Held until {new Date(order.reservedUntil).toLocaleString()}.
              </p>
            )}
            {order.lines.map((line) => (
              <div key={line.id} className="flex justify-between text-sm text-slate-600">
                <span>
                  {line.productName} &times; {line.quantity}
                </span>
                <span className="tabular-nums">{format(line.lineTotal)}</span>
              </div>
            ))}
            <div className="border-t border-slate-200 pt-2 flex justify-between font-semibold text-slate-900">
              <span>Total</span>
              <span className="tabular-nums">{format(order.total)}</span>
            </div>
            <p className="text-sm text-slate-500">
              Fulfilment: {order.fulfilmentType === 'COLLECT' ? 'Collect at store' : 'Postage'}
            </p>
            {/* GAP B: a guest has no account to browse warranties in, so the order lookup they
                already know how to use (order number + the email they checked out with) is where
                their warranty number surfaces - independently re-checkable any time at
                /shop/warranty by warranty number, with no login required. */}
            {order.warrantyNumbers.length > 0 && (
              <div className="border-t border-slate-200 pt-3">
                <div className="flex items-center gap-2 text-sm font-medium text-green-800">
                  <ShieldCheck className="w-4 h-4" />
                  Warranty issued
                </div>
                <div className="flex flex-wrap gap-2 mt-1">
                  {order.warrantyNumbers.map((number) => (
                    <span key={number} className="font-mono text-xs bg-green-50 text-green-800 border border-green-200 rounded px-2 py-0.5">
                      {number}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Check its status any time at <span className="font-medium">/shop/warranty</span> using the number above.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
