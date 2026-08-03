import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, Award, LogOut, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';
import PublicLayout from '../../components/PublicLayout';
import { useShopAuth } from '../../contexts/ShopAuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { Button, Badge, Tabs, TabsList, TabsTrigger, TabsContent, Input } from '../../components/ui';
import shopApi from '../../lib/shop-api';
import publicApi from '../../lib/public-api';
import type { ShopOrder, ShopTradeInQuote, OrderStatus } from '../../lib/shop-types';

const ORDER_STATUS_VARIANT: Record<OrderStatus, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  PENDING: 'default',
  RESERVED: 'warning',
  AWAITING_PAYMENT: 'warning',
  PAID: 'info',
  READY: 'info',
  FULFILLED: 'success',
  CANCELLED: 'danger',
  EXPIRED: 'danger',
  VOIDED: 'danger',
};

function OrdersTab() {
  const { format } = useCurrency();
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    shopApi
      .get('/shop/orders', { params: { size: 50, sort: 'createdAt,desc' } })
      .then((res) => setOrders(res.data.content))
      .catch((err) => console.error('Failed to load orders:', err))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try {
      await shopApi.post(`/shop/orders/${id}/cancel`);
      load();
    } catch (err) {
      console.error('Failed to cancel order:', err);
    } finally {
      setCancellingId(null);
    }
  };

  if (loading) {
    return <p className="text-slate-500 text-sm py-6">Loading orders...</p>;
  }
  if (orders.length === 0) {
    return <p className="text-slate-500 text-sm py-6">You haven&apos;t placed any orders yet.</p>;
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => {
        const isReserved = order.status === 'RESERVED' || order.status === 'AWAITING_PAYMENT';
        return (
          <div key={order.id} className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-sm font-semibold text-slate-900">{order.orderNumber}</span>
              <Badge variant={ORDER_STATUS_VARIANT[order.status]} size="sm">
                {order.status}
              </Badge>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {new Date(order.createdAt).toLocaleString()} &middot;{' '}
              {order.fulfilmentType === 'COLLECT' ? 'Collect at store' : 'Postage'}
            </p>
            {isReserved && order.reservedUntil && (
              <p className="text-sm text-amber-700 mt-1">
                Held until {new Date(order.reservedUntil).toLocaleString()}
              </p>
            )}
            <div className="flex items-center justify-between mt-2">
              <span className="font-semibold text-slate-900 tabular-nums">{format(order.total)}</span>
              {isReserved && (
                <Button
                  variant="secondary"
                  size="sm"
                  loading={cancellingId === order.id}
                  onClick={() => handleCancel(order.id)}
                >
                  Cancel order
                </Button>
              )}
            </div>
            {/* GAP B: warranty auto-issued at fulfilment for any warrantyMonths line - findable
                right here, or independently via the same lookup on the Warranties tab/public
                /shop/warranty page (PublicWarrantyService looks up purely by warranty/serial
                number, never by customer identity). */}
            {order.warrantyNumbers.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-green-600 flex-shrink-0" />
                {order.warrantyNumbers.map((number) => (
                  <span key={number} className="font-mono text-xs bg-green-50 text-green-800 border border-green-200 rounded px-2 py-0.5">
                    {number}
                  </span>
                ))}
              </div>
            )}
            {order.status === 'VOIDED' && order.voidReason && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 mt-2">
                Voided{order.voidedAt ? ` ${new Date(order.voidedAt).toLocaleString()}` : ''}: {order.voidReason}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TradeInsTab() {
  const { format } = useCurrency();
  const [quotes, setQuotes] = useState<ShopTradeInQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    shopApi
      .get('/shop/quotes', { params: { size: 50 } })
      .then((res) => setQuotes(res.data.content))
      .catch((err) => console.error('Failed to load trade-in quotes:', err))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const decide = async (id: string, decision: 'accept' | 'decline') => {
    setDecidingId(id);
    try {
      await shopApi.post(`/shop/quotes/${id}/${decision}-offer`);
      load();
    } catch (err) {
      console.error(`Failed to ${decision} offer:`, err);
    } finally {
      setDecidingId(null);
    }
  };

  if (loading) {
    return <p className="text-slate-500 text-sm py-6">Loading trade-in quotes...</p>;
  }
  if (quotes.length === 0) {
    return <p className="text-slate-500 text-sm py-6">You haven&apos;t requested any trade-in quotes yet.</p>;
  }

  return (
    <div className="space-y-3">
      {quotes.map((quote) => (
        <div key={quote.id} className="bg-white rounded-lg border border-slate-200 p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-sm font-semibold text-slate-900">{quote.quoteNumber}</span>
            <Badge variant="info" size="sm">
              {quote.status}
            </Badge>
          </div>
          <p className="text-sm text-slate-600">{quote.productName ?? quote.freeTextDescription}</p>
          <p className="text-slate-900 font-semibold tabular-nums">
            Indicative: {format(quote.quotedMin)} - {format(quote.quotedMax)}
          </p>
          <p className="text-xs text-slate-500">Valid until {new Date(quote.expiresAt).toLocaleString()}</p>

          {quote.finalOffer != null && (
            <div className="border-t border-slate-200 pt-2">
              <p className="text-sm text-slate-500">Final offer</p>
              <p className="font-semibold text-slate-900 tabular-nums">{format(quote.finalOffer)}</p>
              {quote.status === 'OFFER_MADE' && (
                <div className="flex gap-2 mt-2">
                  <Button size="sm" loading={decidingId === quote.id} onClick={() => decide(quote.id, 'accept')}>
                    Accept offer
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={decidingId === quote.id}
                    onClick={() => decide(quote.id, 'decline')}
                  >
                    Decline offer
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function LoyaltyTab({ memberId }: { memberId: string | null }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-3">
      {memberId ? (
        <>
          <Badge variant="success">Linked to your in-store loyalty account</Badge>
          <p className="text-sm text-slate-600">
            You earn loyalty points and can redeem store credit at the till when a staff member fulfils your
            order.
          </p>
          {/* KNOWN GAP (disclosed - see the WEBSHOP frontend report): no customer-accessible
              endpoint exposes the actual points/store-credit balance today - `ShopCustomerDto`
              only carries `memberId` (a link), and `MemberController` (which does have the
              numbers) sits behind staff auth, not reachable from a shop-customer session. */}
          <p className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
            We can&apos;t show your exact points balance or store credit here yet - please ask a staff member
            in-store for your current balance.
          </p>
        </>
      ) : (
        <p className="text-slate-500 text-sm">
          Not linked - visit a branch and ask staff to link your loyalty membership to this account.
        </p>
      )}
    </div>
  );
}

function WarrantiesTab() {
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ found: boolean; status?: string; productName?: string; expiryDate?: string } | null>(
    null
  );

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setChecking(true);
    setResult(null);
    try {
      const response = await publicApi.get(`/public/warranty/${encodeURIComponent(code.trim())}`);
      setResult(response.data);
    } catch (err) {
      console.error('Warranty check failed:', err);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      {/* KNOWN GAP (disclosed): there is no customer-scoped "list my warranties" endpoint today
          (only the anonymous GET /public/warranty/{code} lookup by warranty/serial number
          exists) - reusing that same checker here rather than inventing a new endpoint, per the
          task's own instruction for this exact situation. */}
      <p className="text-sm text-slate-500">
        We don&apos;t yet have a way to automatically list every warranty on your account - check one by its
        warranty or serial number below (the same lookup as the public Warranty Check page).
      </p>
      <form onSubmit={handleCheck} className="flex items-end gap-2">
        <div className="flex-1">
          <Input label="Warranty or serial number" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <Button type="submit" loading={checking} disabled={!code.trim()}>
          Check
        </Button>
      </form>
      {result && (
        <div className="border-t border-slate-200 pt-3">
          {result.found ? (
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {result.productName} - {result.status}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-500">
              <XCircle className="w-4 h-4" />
              <span>No warranty found for that number.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Member self-service hub for the storefront account area - requires an active MULAERP_SHOP
 * session, unauthenticated visitors are sent to `/shop/login` (never the staff `/login`).
 */
export default function ShopAccountPage() {
  const { customer, loading, logout } = useShopAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !customer) {
      navigate('/shop/login', { replace: true });
    }
  }, [loading, customer, navigate]);

  if (loading || !customer) {
    return (
      <PublicLayout>
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
        </div>
      </PublicLayout>
    );
  }

  // No explicit navigate() here: logout() clears `customer`, and the redirect effect above
  // (unauthenticated -> /shop/login) then owns the navigation - calling navigate('/') here too
  // raced against that effect (React 18 doesn't synchronously flush the post-await setCustomer
  // before this continuation runs), landing on whichever navigation call won nondeterministically.
  const handleLogout = async () => {
    await logout();
  };

  return (
    <PublicLayout>
      <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900">My account</h1>
          <Button variant="secondary" size="sm" icon={<LogOut className="h-4 w-4" />} onClick={handleLogout}>
            Sign out
          </Button>
        </div>

        <Tabs defaultValue="profile">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="trade-ins">Trade-ins</TabsTrigger>
            <TabsTrigger value="loyalty">Loyalty</TabsTrigger>
            <TabsTrigger value="warranties">Warranties</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 divide-y divide-slate-200">
              <div className="p-6 flex items-start gap-3">
                <User className="h-5 w-5 text-slate-400 mt-0.5" />
                <div>
                  <div className="text-sm text-slate-500">Full name</div>
                  <div className="text-slate-900 font-medium">{customer.fullName}</div>
                </div>
              </div>
              <div className="p-6 flex items-start gap-3">
                <Mail className="h-5 w-5 text-slate-400 mt-0.5" />
                <div>
                  <div className="text-sm text-slate-500">Email</div>
                  <div className="text-slate-900 font-medium">{customer.email}</div>
                </div>
              </div>
              {customer.phone && (
                <div className="p-6 flex items-start gap-3">
                  <Phone className="h-5 w-5 text-slate-400 mt-0.5" />
                  <div>
                    <div className="text-sm text-slate-500">Phone</div>
                    <div className="text-slate-900 font-medium">{customer.phone}</div>
                  </div>
                </div>
              )}
              <div className="p-6 flex items-start gap-3">
                <Award className="h-5 w-5 text-slate-400 mt-0.5" />
                <div>
                  <div className="text-sm text-slate-500 mb-1">Loyalty membership</div>
                  {customer.memberId ? (
                    <Badge variant="success">Linked to your in-store loyalty account</Badge>
                  ) : (
                    <span className="text-slate-500 text-sm">Not linked - visit a branch to join the loyalty program.</span>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="orders">
            <OrdersTab />
          </TabsContent>

          <TabsContent value="trade-ins">
            <TradeInsTab />
          </TabsContent>

          <TabsContent value="loyalty">
            <LoyaltyTab memberId={customer.memberId} />
          </TabsContent>

          <TabsContent value="warranties">
            <WarrantiesTab />
          </TabsContent>
        </Tabs>
      </div>
    </PublicLayout>
  );
}
