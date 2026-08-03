import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, AlertTriangle } from 'lucide-react';
import api, { getErrorMessage } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import { Card, Button, Badge, Modal, ModalFooter, Textarea, useToast } from '../../components/ui';

interface PosSaleLine {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineDiscount: number;
  lineTotal: number;
}

interface PosSale {
  id: string;
  saleNumber: string;
  clientSaleId: string;
  memberId: string | null;
  voucherCode: string | null;
  paymentMethod: string;
  subtotal: number;
  discountTotal: number;
  total: number;
  amountTendered: number | null;
  change: number | null;
  pointsEarned: number;
  lines: PosSaleLine[];
  createdAt: string;
  createdBy: string | null;
  tradeInId: string | null;
  tradeInValueApplied: number;
  storeCreditRedeemed: number;
  netCashDirection: 'CUSTOMER_PAYS' | 'SHOP_PAYS' | 'EVEN';
  netCashAmount: number;
  tradeInStoreCreditGranted: number;
  status: 'COMPLETED' | 'VOIDED';
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
}

interface StockReturnedItem {
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
}

interface TradeInItemRemoved {
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  tradeInNumber: string;
}

interface VoidResponse {
  sale: PosSale;
  refundMethod: string;
  refundAmount: number;
  stockReturned: StockReturnedItem[];
  tradeInItemRemoved: TradeInItemRemoved | null;
  storeCreditReversed: number;
  pointsDeducted: number;
  tradeInStoreCreditDeducted: number;
}

/** V34: sale detail + the "Void sale" action - visible only to MANAGER/ADMIN (RoleRules.MANAGER_UP
 * backs POST /pos/sales/{id}/void; a cashier hitting it directly gets a 403). */
export default function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success: showSuccess, error: showError } = useToast();

  const [sale, setSale] = useState<PosSale | null>(null);
  const [loading, setLoading] = useState(true);
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [voiding, setVoiding] = useState(false);
  const [voidSummary, setVoidSummary] = useState<VoidResponse | null>(null);

  const canVoid = user?.role === 'MANAGER' || user?.role === 'ADMIN';

  useEffect(() => {
    fetchSale();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchSale = async () => {
    try {
      setLoading(true);
      const response = await api.get<PosSale>(`/pos/sales/${id}`);
      setSale(response.data);
    } catch (err) {
      showError(getErrorMessage(err, 'Failed to load sale'));
    } finally {
      setLoading(false);
    }
  };

  const handleVoid = async () => {
    if (!sale || !reason.trim()) return;
    try {
      setVoiding(true);
      const response = await api.post<VoidResponse>(`/pos/sales/${sale.id}/void`, { reason: reason.trim() });
      setSale(response.data.sale);
      setVoidSummary(response.data);
      setVoidModalOpen(false);
      setReason('');
      showSuccess(
        `Sale ${response.data.sale.saleNumber} voided. Refund ${response.data.refundAmount > 0 ? formatMoney(response.data.refundAmount) : 'none'} owed via ${response.data.refundMethod}.`
      );
    } catch (err) {
      showError(getErrorMessage(err, 'Failed to void sale'));
    } finally {
      setVoiding(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-6"><Card className="p-12 text-center"><p className="text-slate-500">Loading...</p></Card></div>
      </Layout>
    );
  }

  if (!sale) {
    return (
      <Layout>
        <div className="p-6"><Card className="p-12 text-center"><p className="text-slate-500">Sale not found</p></Card></div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <button
            onClick={() => navigate('/pos/sales')}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Sales History
          </button>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold text-slate-900 font-mono">{sale.saleNumber}</h1>
                <Badge variant={sale.status === 'VOIDED' ? 'danger' : 'success'}>{sale.status}</Badge>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                {new Date(sale.createdAt).toLocaleString()} · rung up by {sale.createdBy ?? 'unknown'}
              </p>
            </div>
            {canVoid && sale.status === 'COMPLETED' && (
              <Button variant="danger" icon={<Ban className="w-4 h-4" />} onClick={() => setVoidModalOpen(true)}>
                Void Sale
              </Button>
            )}
          </div>
        </div>

        {sale.status === 'VOIDED' && (
          <Card padding="sm" className="bg-red-50 border-red-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800">
                <p className="font-medium">
                  Voided {sale.voidedAt ? new Date(sale.voidedAt).toLocaleString() : ''} by {sale.voidedBy ?? 'unknown'}
                </p>
                <p className="mt-1">Reason: {sale.voidReason}</p>
                <p className="mt-1 text-red-600">Excluded from takings, revenue, and margin in oversight reports.</p>
                {voidSummary && (
                  <div className="mt-3 pt-3 border-t border-red-200 space-y-1">
                    <p className="font-medium">What was reversed:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {voidSummary.stockReturned.map((item) => (
                        <li key={item.productId}>
                          {item.quantity}x {item.productName} ({item.sku}) returned to stock
                        </li>
                      ))}
                      {voidSummary.tradeInItemRemoved && (
                        <li>
                          Traded-in item {voidSummary.tradeInItemRemoved.productName} ({voidSummary.tradeInItemRemoved.sku}) removed
                          from stock again (trade-in {voidSummary.tradeInItemRemoved.tradeInNumber})
                        </li>
                      )}
                      {voidSummary.refundAmount > 0 && (
                        <li>
                          Refund owed: {formatMoney(voidSummary.refundAmount)} via {voidSummary.refundMethod}
                        </li>
                      )}
                      {voidSummary.storeCreditReversed > 0 && (
                        <li>Store credit {formatMoney(voidSummary.storeCreditReversed)} credited back to the member</li>
                      )}
                      {voidSummary.tradeInStoreCreditDeducted > 0 && (
                        <li>
                          Store credit {formatMoney(voidSummary.tradeInStoreCreditDeducted)} clawed back from the member
                          (was granted by the over-valued trade-in)
                        </li>
                      )}
                      {voidSummary.pointsDeducted > 0 && <li>{voidSummary.pointsDeducted} points deducted from the member</li>}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        <Card padding="none" className="overflow-hidden">
          <div className="px-6 py-3 border-b border-slate-200 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-900">Items</h2>
          </div>
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Product</th>
                <th className="px-6 py-2 text-right text-xs font-medium text-slate-500 uppercase">Qty</th>
                <th className="px-6 py-2 text-right text-xs font-medium text-slate-500 uppercase">Unit Price</th>
                <th className="px-6 py-2 text-right text-xs font-medium text-slate-500 uppercase">Discount</th>
                <th className="px-6 py-2 text-right text-xs font-medium text-slate-500 uppercase">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sale.lines.map((line) => (
                <tr key={line.id}>
                  <td className="px-6 py-2.5 text-sm text-slate-700">{line.productName}</td>
                  <td className="px-6 py-2.5 text-sm text-right tabular-nums">{line.quantity}</td>
                  <td className="px-6 py-2.5 text-sm text-right tabular-nums">{formatMoney(line.unitPrice)}</td>
                  <td className="px-6 py-2.5 text-sm text-right tabular-nums">{formatMoney(line.lineDiscount)}</td>
                  <td className="px-6 py-2.5 text-sm text-right tabular-nums font-medium">{formatMoney(line.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="max-w-md ml-auto space-y-2">
          <div className="flex justify-between text-sm text-slate-700">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatMoney(sale.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-slate-700">
            <span>Discount</span>
            <span className="tabular-nums">-{formatMoney(sale.discountTotal)}</span>
          </div>
          {sale.storeCreditRedeemed > 0 && (
            <div className="flex justify-between text-sm text-slate-700">
              <span>Store credit redeemed</span>
              <span className="tabular-nums">-{formatMoney(sale.storeCreditRedeemed)}</span>
            </div>
          )}
          {sale.tradeInValueApplied > 0 && (
            <div className="flex justify-between text-sm text-slate-700">
              <span>Trade-in applied</span>
              <span className="tabular-nums">-{formatMoney(sale.tradeInValueApplied)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-semibold text-slate-900 pt-2 border-t border-slate-200">
            <span>{sale.netCashDirection === 'SHOP_PAYS' ? 'Owed to customer' : 'Total'}</span>
            <span className="tabular-nums">{formatMoney(Math.abs(sale.netCashAmount))}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>Payment method</span>
            <span>{sale.paymentMethod}</span>
          </div>
        </Card>
      </div>

      <Modal isOpen={voidModalOpen} onClose={() => !voiding && setVoidModalOpen(false)} title="Void Sale" size="sm">
        <div className="space-y-4">
          {sale.tradeInId ? (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 space-y-1">
                <p className="font-medium">This sale includes a part-exchange trade-in. Voiding it reverses all three legs:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>The sold goods go back into stock.</li>
                  <li>The traded-in item is removed from stock again (rejected if it has since been resold, used as a repair part, transferred, or adjusted down).</li>
                  <li>
                    Money moves back{' '}
                    {sale.netCashDirection === 'SHOP_PAYS'
                      ? '- the customer must return the cash the shop paid out'
                      : '- the customer is refunded what they paid'}
                    , plus any store credit/points/voucher use (including a trade-in over-valuation store credit grant, if any) is reversed.
                  </li>
                </ul>
                <p>This cannot be undone.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                This reverses sale <span className="font-mono">{sale.saleNumber}</span>: stock is returned, the sale
                revenue/COGS journal entries are reversed, and any store credit/points/voucher use tied to it is
                reversed. This cannot be undone.
              </p>
            </div>
          )}
          <Textarea
            label="Reason for void"
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. rung up against the wrong customer"
            rows={3}
          />
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setVoidModalOpen(false)} disabled={voiding}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleVoid} loading={voiding} disabled={!reason.trim()}>
            Void Sale
          </Button>
        </ModalFooter>
      </Modal>
    </Layout>
  );
}
