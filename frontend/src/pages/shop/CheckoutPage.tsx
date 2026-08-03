import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Truck, Store, CreditCard, ArrowLeft } from 'lucide-react';
import PublicLayout from '../../components/PublicLayout';
import { Input, Textarea, Button } from '../../components/ui';
import { useCart } from '../../contexts/CartContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useShopAuth } from '../../contexts/ShopAuthContext';
import publicApi from '../../lib/public-api';
import shopApi from '../../lib/shop-api';
import { getErrorMessage } from '../../lib/api';
import { PAYMENT_GATEWAY_ENABLED } from '../../lib/shop-config';
import type { ShopOrder, FulfilmentType } from '../../lib/shop-types';

/**
 * Guest OR signed-in-member checkout for the storefront cart - see the WEBSHOP frontend report
 * for the full design writeup (payment section, points estimate, store-credit note).
 *
 * Places the real order via `POST /api/v1/public/shop/orders` (guest, no session) or
 * `POST /api/v1/shop/orders` (member, MULAERP_SHOP cookie) - both accept the identical
 * `PlaceShopOrderRequest` shape, guest fields simply ignored server-side for the member path.
 */
export default function CheckoutPage() {
  const { lines, subtotal, clear } = useCart();
  const { format } = useCurrency();
  const { customer, isAuthenticated } = useShopAuth();
  const navigate = useNavigate();

  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [fulfilmentType, setFulfilmentType] = useState<FulfilmentType>('COLLECT');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (lines.length === 0) {
    return (
      <PublicLayout>
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-16 text-center space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">Your cart is empty</h1>
          <p className="text-slate-500">Add something to your cart before checking out.</p>
          <Link to="/">
            <Button icon={<ArrowLeft className="w-4 h-4" />}>Back to shop</Button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (fulfilmentType === 'POST' && !deliveryAddress.trim()) {
      setError('A delivery address is required for postage.');
      return;
    }
    if (!isAuthenticated && (!guestName.trim() || !guestEmail.trim() || !guestPhone.trim())) {
      setError('Name, email and phone are required to check out as a guest.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        fulfilmentType,
        deliveryAddress: fulfilmentType === 'POST' ? deliveryAddress.trim() : undefined,
        notes: notes.trim() || undefined,
        ...(isAuthenticated
          ? {}
          : { guestEmail: guestEmail.trim(), guestName: guestName.trim(), guestPhone: guestPhone.trim() }),
      };

      const response = isAuthenticated
        ? await shopApi.post<ShopOrder>('/shop/orders', payload)
        : await publicApi.post<ShopOrder>('/public/shop/orders', payload);

      clear();
      navigate(`/shop/order-confirmation/${response.data.orderNumber}`, { state: { order: response.data } });
    } catch (err) {
      setError(
        getErrorMessage(err, 'Something went wrong placing your order. Please check your details and try again.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Points estimate mirrors ShopOrderService#fulfilOrder's own formula (floor(total)) - accrual
  // itself only actually happens at staff fulfilment, not at placement, so this is described as
  // an estimate, and only shown for a customer whose web account is linked to a loyalty member
  // (ShopCustomer.memberId != null) - a guest or unlinked customer earns nothing.
  const pointsEstimate = Math.floor(subtotal);

  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Checkout</h1>

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {isAuthenticated && customer ? (
            <section className="bg-white rounded-lg border border-slate-200 p-6 space-y-1">
              <h2 className="font-semibold text-slate-900 mb-2">Your details</h2>
              <p className="text-sm text-slate-600">{customer.fullName}</p>
              <p className="text-sm text-slate-600">{customer.email}</p>
              {customer.phone && <p className="text-sm text-slate-600">{customer.phone}</p>}
              {customer.memberId && (
                <p className="text-sm text-brand-700 mt-2">
                  You&apos;ll earn an estimated {pointsEstimate} loyalty point{pointsEstimate === 1 ? '' : 's'} once
                  this order is collected/delivered.
                </p>
              )}
            </section>
          ) : (
            <section className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
              <h2 className="font-semibold text-slate-900">Your details</h2>
              <p className="text-sm text-slate-500 -mt-2">
                Checking out as a guest - no account needed.{' '}
                <Link to="/shop/login" className="font-semibold text-brand-600 hover:text-brand-700">
                  Sign in
                </Link>{' '}
                if you have an account.
              </p>
              <Input label="Full name" required value={guestName} onChange={(e) => setGuestName(e.target.value)} />
              <Input
                label="Email address"
                type="email"
                required
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                helperText="Save this - you'll need it to look up your order later."
              />
              <Input label="Phone" type="tel" required value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
            </section>
          )}

          <section className="bg-white rounded-lg border border-slate-200 p-6 space-y-3">
            <h2 className="font-semibold text-slate-900">Fulfilment</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`flex items-start gap-3 border rounded-lg p-3 cursor-pointer ${
                  fulfilmentType === 'COLLECT' ? 'border-brand-600 ring-1 ring-brand-600' : 'border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="fulfilmentType"
                  className="mt-1"
                  checked={fulfilmentType === 'COLLECT'}
                  onChange={() => setFulfilmentType('COLLECT')}
                />
                <span>
                  <span className="flex items-center gap-2 font-medium text-slate-900">
                    <Store className="w-4 h-4" /> Collect at store
                  </span>
                  <span className="text-sm text-slate-500">No delivery fee.</span>
                </span>
              </label>
              <label
                className={`flex items-start gap-3 border rounded-lg p-3 cursor-pointer ${
                  fulfilmentType === 'POST' ? 'border-brand-600 ring-1 ring-brand-600' : 'border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="fulfilmentType"
                  className="mt-1"
                  checked={fulfilmentType === 'POST'}
                  onChange={() => setFulfilmentType('POST')}
                />
                <span>
                  <span className="flex items-center gap-2 font-medium text-slate-900">
                    <Truck className="w-4 h-4" /> Postage
                  </span>
                  <span className="text-sm text-slate-500">
                    A delivery fee may apply - the exact amount is confirmed on your order once placed.
                  </span>
                </span>
              </label>
            </div>

            {fulfilmentType === 'POST' && (
              <Textarea
                label="Delivery address"
                required
                rows={3}
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
              />
            )}

            <Textarea
              label="Order notes (optional)"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </section>

          <section className="bg-white rounded-lg border border-slate-200 p-6 space-y-3">
            <h2 className="font-semibold text-slate-900">Payment</h2>
            <div className="flex items-start gap-3 border border-brand-600 ring-1 ring-brand-600 rounded-lg p-3">
              <input type="radio" checked readOnly className="mt-1" />
              <span>
                <span className="font-medium text-slate-900">Pay at collection / on delivery</span>
                <span className="block text-sm text-slate-500">
                  No payment is taken now - pay in cash or by card when you collect or receive your order.
                </span>
              </span>
            </div>
            <div className="flex items-start gap-3 border border-slate-200 rounded-lg p-3 opacity-60 cursor-not-allowed">
              <input type="radio" disabled className="mt-1" />
              <span>
                <span className="flex items-center gap-2 font-medium text-slate-500">
                  <CreditCard className="w-4 h-4" /> Card / online payment
                </span>
                <span className="block text-sm text-slate-400">
                  {PAYMENT_GATEWAY_ENABLED
                    ? "This payment method isn't available for checkout yet."
                    : 'Coming soon.'}
                </span>
              </span>
            </div>
          </section>

          <section className="bg-white rounded-lg border border-slate-200 p-6 space-y-2">
            <h2 className="font-semibold text-slate-900 mb-2">Order summary</h2>
            {lines.map((l) => (
              <div key={l.productId} className="flex justify-between text-sm text-slate-600">
                <span>
                  {l.name} &times; {l.quantity}
                </span>
                <span className="tabular-nums">{format(l.unitPrice * l.quantity)}</span>
              </div>
            ))}
            <div className="border-t border-slate-200 pt-2 flex justify-between font-semibold text-slate-900">
              <span>Subtotal</span>
              <span className="tabular-nums">{format(subtotal)}</span>
            </div>
            {fulfilmentType === 'POST' && (
              <p className="text-xs text-slate-500">Plus any delivery fee, added to your confirmed order total.</p>
            )}
          </section>

          <Button type="submit" loading={submitting} className="w-full" size="lg">
            Place order
          </Button>
        </form>
      </div>
    </PublicLayout>
  );
}
