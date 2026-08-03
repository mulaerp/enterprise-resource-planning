import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import api, { getErrorMessage } from '../../lib/api';
import { formatMoney } from '../../lib/money';

interface DeepDiscountSale {
  saleNumber: string;
  createdAt: string;
  cashier: string | null;
  subtotal: number;
  discountTotal: number;
  discountPercent: number;
}

interface PriceFloorSaleLine {
  saleNumber: string;
  createdAt: string;
  cashier: string | null;
  productSku: string | null;
  productName: string;
  unitPrice: number;
  priceFloor: number;
  marginAbovefloorPercent: number;
}

interface StaleRepairJob {
  jobNumber: string;
  status: string;
  receivedAt: string;
  daysOpen: number;
  customer: string | null;
}

interface CashierTotals {
  cashier: string;
  count: number;
  gross: number;
  average: number;
  discountRate: number;
  documents: string[];
}

interface VoidedSale {
  id: string;
  saleNumber: string;
  voidedAt: string;
  voidedBy: string | null;
  voidReason: string | null;
  total: number;
}

interface ExceptionsResponse {
  from: string;
  to: string;
  deepDiscountThresholdPercent: number;
  deepDiscountSales: DeepDiscountSale[];
  nearPriceFloorSales: PriceFloorSaleLine[];
  unpostedDraftJournalCount: number;
  unpostedDraftJournalIds: string[];
  unreconciledBankTransactionCount: number;
  unreconciledBankTransactionReferences: string[];
  staleRepairJobThresholdDays: number;
  staleRepairJobs: StaleRepairJob[];
  cashierTotals: CashierTotals[];
  voidedSaleCount: number;
  voidedSales: VoidedSale[];
}

const today = () => new Date().toISOString().split('T')[0];
const firstDayOfMonth = () => {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().split('T')[0];
};

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="px-6 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <Badge variant={count > 0 ? 'warning' : 'default'}>{count}</Badge>
    </div>
  );
}

export default function ExceptionsPage() {
  const { error: showError } = useToast();
  const [from, setFrom] = useState(firstDayOfMonth());
  const [to, setTo] = useState(today());
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ExceptionsResponse | null>(null);

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadReport = async () => {
    setLoading(true);
    try {
      const response = await api.get('/oversight/exceptions', { params: { from, to } });
      setData(response.data);
    } catch (err) {
      showError(getErrorMessage(err, 'Failed to load exceptions'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Exceptions</h1>
          <p className="text-sm text-slate-500 mt-1">Deep discounts, near-floor sales, unposted drafts, unreconciled banking, stale repairs</p>
        </div>

        <Card className="p-6">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="flex-1">
              <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <Button onClick={loadReport} loading={loading}>Generate</Button>
          </div>
        </Card>

        {loading && !data && <Card className="p-12 text-center"><p className="text-slate-500">Loading...</p></Card>}

        {!loading && data && (
          <>
            <Card padding="none" className="overflow-hidden">
              <SectionHeader title={`Deep Discounts (over ${data.deepDiscountThresholdPercent}%)`} count={data.deepDiscountSales.length} />
              {data.deepDiscountSales.length === 0 ? (
                <p className="p-6 text-sm text-slate-500 text-center">No deep-discount sales in this period</p>
              ) : (
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Sale</th>
                      <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Cashier</th>
                      <th className="px-6 py-2 text-right text-xs font-medium text-slate-500 uppercase">Subtotal</th>
                      <th className="px-6 py-2 text-right text-xs font-medium text-slate-500 uppercase">Discount</th>
                      <th className="px-6 py-2 text-right text-xs font-medium text-slate-500 uppercase">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.deepDiscountSales.map((s) => (
                      <tr key={s.saleNumber} className="hover:bg-slate-50">
                        <td className="px-6 py-2.5 text-sm font-mono text-slate-700">
                          <Link to="/pos" className="text-brand-600 hover:underline">{s.saleNumber}</Link>
                        </td>
                        <td className="px-6 py-2.5 text-sm text-slate-700">{s.cashier}</td>
                        <td className="px-6 py-2.5 text-sm text-right tabular-nums">{formatMoney(s.subtotal)}</td>
                        <td className="px-6 py-2.5 text-sm text-right tabular-nums">{formatMoney(s.discountTotal)}</td>
                        <td className="px-6 py-2.5 text-sm text-right tabular-nums font-medium text-red-600">{s.discountPercent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            <Card padding="none" className="overflow-hidden">
              <SectionHeader title="Sales At/Near Price Floor (within 5%)" count={data.nearPriceFloorSales.length} />
              {data.nearPriceFloorSales.length === 0 ? (
                <p className="p-6 text-sm text-slate-500 text-center">No near-floor sale lines in this period</p>
              ) : (
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Sale</th>
                      <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Product</th>
                      <th className="px-6 py-2 text-right text-xs font-medium text-slate-500 uppercase">Unit Price</th>
                      <th className="px-6 py-2 text-right text-xs font-medium text-slate-500 uppercase">Floor</th>
                      <th className="px-6 py-2 text-right text-xs font-medium text-slate-500 uppercase">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.nearPriceFloorSales.map((l, idx) => (
                      <tr key={`${l.saleNumber}-${idx}`} className="hover:bg-slate-50">
                        <td className="px-6 py-2.5 text-sm font-mono text-slate-700">
                          <Link to="/pos" className="text-brand-600 hover:underline">{l.saleNumber}</Link>
                        </td>
                        <td className="px-6 py-2.5 text-sm text-slate-700">{l.productName} <span className="text-slate-400">({l.productSku})</span></td>
                        <td className="px-6 py-2.5 text-sm text-right tabular-nums">{formatMoney(l.unitPrice)}</td>
                        <td className="px-6 py-2.5 text-sm text-right tabular-nums">{formatMoney(l.priceFloor)}</td>
                        <td className="px-6 py-2.5 text-sm text-right tabular-nums font-medium text-amber-600">{l.marginAbovefloorPercent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card padding="none" className="overflow-hidden">
                <SectionHeader title="Unposted Draft Journal Entries" count={data.unpostedDraftJournalCount} />
                <div className="p-6 flex flex-wrap gap-2">
                  {data.unpostedDraftJournalIds.length === 0 ? (
                    <p className="text-sm text-slate-500">No unposted drafts in this period</p>
                  ) : (
                    data.unpostedDraftJournalIds.map((id) => (
                      <Link key={id} to="/accounting/journal-entries" className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200 font-mono hover:bg-amber-100">
                        {id}
                      </Link>
                    ))
                  )}
                </div>
              </Card>

              <Card padding="none" className="overflow-hidden">
                <SectionHeader title="Unreconciled Bank Transactions" count={data.unreconciledBankTransactionCount} />
                <div className="p-6 flex flex-wrap gap-2">
                  {data.unreconciledBankTransactionReferences.length === 0 ? (
                    <p className="text-sm text-slate-500">No unreconciled transactions in this period</p>
                  ) : (
                    data.unreconciledBankTransactionReferences.map((ref) => (
                      <Link key={ref} to="/accounting/bank" className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 border border-red-200 font-mono hover:bg-red-100">
                        {ref}
                      </Link>
                    ))
                  )}
                </div>
              </Card>
            </div>

            <Card padding="none" className="overflow-hidden">
              <SectionHeader title={`Stale Repair Jobs (open over ${data.staleRepairJobThresholdDays} days)`} count={data.staleRepairJobs.length} />
              {data.staleRepairJobs.length === 0 ? (
                <p className="p-6 text-sm text-slate-500 text-center">No stale repair jobs</p>
              ) : (
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Job</th>
                      <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                      <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Customer</th>
                      <th className="px-6 py-2 text-right text-xs font-medium text-slate-500 uppercase">Days Open</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.staleRepairJobs.map((j) => (
                      <tr key={j.jobNumber} className="hover:bg-slate-50">
                        <td className="px-6 py-2.5 text-sm font-mono text-slate-700">
                          <Link to="/repairs" className="text-brand-600 hover:underline">{j.jobNumber}</Link>
                        </td>
                        <td className="px-6 py-2.5 text-sm"><Badge variant="warning" size="sm">{j.status}</Badge></td>
                        <td className="px-6 py-2.5 text-sm text-slate-700">{j.customer ?? '-'}</td>
                        <td className="px-6 py-2.5 text-sm text-right tabular-nums font-medium">{j.daysOpen}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            <Card padding="none" className="overflow-hidden">
              <SectionHeader title="Per-Cashier Sales Totals" count={data.cashierTotals.length} />
              {data.cashierTotals.length === 0 ? (
                <p className="p-6 text-sm text-slate-500 text-center">No sales in this period</p>
              ) : (
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Cashier</th>
                      <th className="px-6 py-2 text-right text-xs font-medium text-slate-500 uppercase">Sales</th>
                      <th className="px-6 py-2 text-right text-xs font-medium text-slate-500 uppercase">Gross</th>
                      <th className="px-6 py-2 text-right text-xs font-medium text-slate-500 uppercase">Average</th>
                      <th className="px-6 py-2 text-right text-xs font-medium text-slate-500 uppercase">Discount Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.cashierTotals.map((c) => (
                      <tr key={c.cashier} className="hover:bg-slate-50">
                        <td className="px-6 py-2.5 text-sm text-slate-700">{c.cashier}</td>
                        <td className="px-6 py-2.5 text-sm text-right tabular-nums">{c.count}</td>
                        <td className="px-6 py-2.5 text-sm text-right tabular-nums">{formatMoney(c.gross)}</td>
                        <td className="px-6 py-2.5 text-sm text-right tabular-nums">{formatMoney(c.average)}</td>
                        <td className="px-6 py-2.5 text-sm text-right tabular-nums">{c.discountRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            <Card padding="none" className="overflow-hidden">
              <SectionHeader title="Voided Sales" count={data.voidedSaleCount} />
              {data.voidedSales.length === 0 ? (
                <p className="p-6 text-sm text-slate-500 text-center">No sales were voided in this period</p>
              ) : (
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Sale</th>
                      <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Voided At</th>
                      <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Voided By</th>
                      <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Reason</th>
                      <th className="px-6 py-2 text-right text-xs font-medium text-slate-500 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.voidedSales.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50">
                        <td className="px-6 py-2.5 text-sm font-mono text-slate-700">
                          <Link to={`/pos/sales/${v.id}`} className="text-brand-600 hover:underline">{v.saleNumber}</Link>
                        </td>
                        <td className="px-6 py-2.5 text-sm text-slate-700">{new Date(v.voidedAt).toLocaleString()}</td>
                        <td className="px-6 py-2.5 text-sm text-slate-700">{v.voidedBy ?? 'unknown'}</td>
                        <td className="px-6 py-2.5 text-sm text-slate-700">{v.voidReason ?? '-'}</td>
                        <td className="px-6 py-2.5 text-sm text-right tabular-nums">{formatMoney(v.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
