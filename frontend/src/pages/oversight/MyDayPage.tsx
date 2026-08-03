import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import Layout from '../../components/Layout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import api, { getErrorMessage } from '../../lib/api';
import { formatMoney } from '../../lib/money';

interface PaymentMethodTakings {
  paymentMethod: string;
  amount: number;
  saleCount: number;
}

interface DiscountsGiven {
  memberDiscount: number;
  voucherDiscount: number;
  cartDiscount: number;
  total: number;
}

interface TradeInsProcessed {
  count: number;
  cashPaidOut: number;
  storeCreditIssued: number;
}

interface VoidedSales {
  count: number;
  value: number;
}

interface RepairPaymentsCollected {
  count: number;
  value: number;
}

interface MyDaySale {
  saleNumber: string;
  time: string;
  total: number;
  paymentMethod: string;
  status: string;
}

interface MyDayResponse {
  date: string;
  username: string;
  saleCount: number;
  itemsSold: number;
  grossTakings: number;
  takingsByPaymentMethod: PaymentMethodTakings[];
  averageBasket: number;
  discountsGiven: DiscountsGiven;
  tradeInsProcessed: TradeInsProcessed;
  storeCreditRedeemed: number;
  voidedSales: VoidedSales;
  repairPaymentsCollected: RepairPaymentsCollected;
  expectedCashInDrawer: number;
  sales: MyDaySale[];
}

const today = () => new Date().toISOString().split('T')[0];

const MANAGER_ROLES = ['ADMIN', 'MANAGER'];

export default function MyDayPage() {
  const { error: showError } = useToast();
  const { user } = useAuth();
  const canViewOthers = !!user?.role && MANAGER_ROLES.includes(user.role);

  const [date, setDate] = useState(today());
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<MyDayResponse | null>(null);

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadReport = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { date };
      if (canViewOthers && username.trim()) {
        params.username = username.trim();
      }
      const response = await api.get('/oversight/my-day', { params });
      setReport(response.data);
    } catch (err) {
      showError(getErrorMessage(err, 'Failed to load My Day report'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6 print:p-0 print:space-y-4" id="my-day-print-area">
        <style>{`
          @media print {
            body * { visibility: hidden; }
            #my-day-print-area, #my-day-print-area * { visibility: visible; }
            #my-day-print-area { position: absolute; left: 0; top: 0; width: 100%; }
            .print\\:hidden { display: none !important; }
          }
        `}</style>

        <div className="flex items-start justify-between print:hidden">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">My Day</h1>
            <p className="text-sm text-slate-500 mt-1">
              Your own shift summary - reconcile your till before handover
            </p>
          </div>
          <Button variant="secondary" onClick={() => window.print()} icon={<Printer size={16} />}>
            Print
          </Button>
        </div>

        <div className="hidden print:block">
          <h1 className="text-xl font-semibold text-slate-900">My Day - {report?.username}</h1>
          <p className="text-sm text-slate-600">{report?.date}</p>
        </div>

        <Card className="p-6 print:hidden">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="flex-1 min-w-[160px]">
              <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            {canViewOthers && (
              <div className="flex-1 min-w-[220px]">
                <Input
                  label="Cashier (leave blank for your own)"
                  type="text"
                  placeholder="e.g. cashier@mulaerp.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            )}
            <Button onClick={loadReport} loading={loading}>Load</Button>
          </div>
        </Card>

        {loading && !report && (
          <Card className="p-12 text-center print:hidden"><p className="text-slate-500">Loading...</p></Card>
        )}

        {!loading && report && (
          <>
            <p className="text-sm text-slate-500 print:hidden">
              Showing <span className="font-medium text-slate-700">{report.username}</span>&apos;s day for{' '}
              <span className="font-medium text-slate-700">{report.date}</span>
            </p>

            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="p-5">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Sales</p>
                <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">{report.saleCount}</p>
                <p className="text-xs text-slate-500 mt-1">{report.itemsSold} item(s) sold</p>
              </Card>
              <Card className="p-5">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Gross Takings</p>
                <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">{formatMoney(report.grossTakings)}</p>
              </Card>
              <Card className="p-5">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Average Basket</p>
                <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">{formatMoney(report.averageBasket)}</p>
              </Card>
            </div>

            {/* Takings by method */}
            <div>
              <h2 className="text-sm font-semibold text-slate-900 mb-3">Takings by Payment Method</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {report.takingsByPaymentMethod.length === 0 && (
                  <Card className="p-6 col-span-full text-center text-sm text-slate-500">No takings recorded for this day</Card>
                )}
                {report.takingsByPaymentMethod.map((m) => (
                  <Card key={m.paymentMethod} className="p-5">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{m.paymentMethod}</p>
                    <p className="text-xl font-bold text-slate-900 tabular-nums mt-1">{formatMoney(m.amount)}</p>
                    <p className="text-xs text-slate-500 mt-1">{m.saleCount} sale(s)</p>
                  </Card>
                ))}
              </div>
            </div>

            {/* Trade-in / store credit / void lines */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-slate-900">Discounts Given</h3>
                <p className="text-lg font-bold text-slate-900 tabular-nums mt-1">{formatMoney(report.discountsGiven.total)}</p>
                <div className="mt-2 space-y-1 text-xs text-slate-600">
                  <div className="flex justify-between"><span>Member</span><span className="tabular-nums">{formatMoney(report.discountsGiven.memberDiscount)}</span></div>
                  <div className="flex justify-between"><span>Voucher</span><span className="tabular-nums">{formatMoney(report.discountsGiven.voucherDiscount)}</span></div>
                  <div className="flex justify-between"><span>Cart</span><span className="tabular-nums">{formatMoney(report.discountsGiven.cartDiscount)}</span></div>
                </div>
              </Card>

              <Card className="p-5">
                <h3 className="text-sm font-semibold text-slate-900">Trade-ins Processed</h3>
                <p className="text-lg font-bold text-slate-900 tabular-nums mt-1">{report.tradeInsProcessed.count}</p>
                <div className="mt-2 space-y-1 text-xs text-slate-600">
                  <div className="flex justify-between"><span>Cash paid out</span><span className="tabular-nums">{formatMoney(report.tradeInsProcessed.cashPaidOut)}</span></div>
                  <div className="flex justify-between"><span>Store credit issued</span><span className="tabular-nums">{formatMoney(report.tradeInsProcessed.storeCreditIssued)}</span></div>
                  <div className="flex justify-between"><span>Store credit redeemed</span><span className="tabular-nums">{formatMoney(report.storeCreditRedeemed)}</span></div>
                </div>
              </Card>

              <Card className="p-5">
                <h3 className="text-sm font-semibold text-slate-900">Voided Sales</h3>
                <p className="text-lg font-bold text-slate-900 tabular-nums mt-1">
                  {report.voidedSales.count} <span className="text-sm font-normal text-slate-500">({formatMoney(report.voidedSales.value)})</span>
                </p>
                <p className="text-xs text-slate-500 mt-2">Excluded from gross takings and the method breakdown above</p>
              </Card>
            </div>

            {report.repairPaymentsCollected.count > 0 && (
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-slate-900">Repair Payments Collected</h3>
                <p className="text-lg font-bold text-slate-900 tabular-nums mt-1">
                  {report.repairPaymentsCollected.count} <span className="text-sm font-normal text-slate-500">({formatMoney(report.repairPaymentsCollected.value)})</span>
                </p>
              </Card>
            )}

            {/* Expected cash in drawer - prominent */}
            <Card className="p-6 border-2 border-brand-600 bg-brand-50/40">
              <p className="text-xs font-semibold text-brand-700 uppercase tracking-wide">Expected Cash in Drawer</p>
              <p className="text-3xl font-bold text-brand-900 tabular-nums mt-1">{formatMoney(report.expectedCashInDrawer)}</p>
              <p className="text-xs text-slate-600 mt-2">
                = Cash sales &minus; cash trade-in payouts &minus; cash refunds
              </p>
            </Card>

            {/* Sale list drill-down */}
            <div>
              <h2 className="text-sm font-semibold text-slate-900 mb-3">Sales</h2>
              <Card padding="none" className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Sale #</th>
                        <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Time</th>
                        <th className="px-6 py-2 text-right text-xs font-medium text-slate-500 uppercase">Total</th>
                        <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Method</th>
                        <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {report.sales.length === 0 && (
                        <tr><td colSpan={5} className="px-6 py-6 text-center text-sm text-slate-500">No sales recorded for this day</td></tr>
                      )}
                      {report.sales.map((sale) => (
                        <tr key={sale.saleNumber}>
                          <td className="px-6 py-3 text-sm font-mono text-slate-900">{sale.saleNumber}</td>
                          <td className="px-6 py-3 text-sm text-slate-600">{new Date(sale.time).toLocaleTimeString('en-MY')}</td>
                          <td className="px-6 py-3 text-sm text-right tabular-nums">{formatMoney(sale.total)}</td>
                          <td className="px-6 py-3 text-sm text-slate-600">{sale.paymentMethod}</td>
                          <td className="px-6 py-3 text-sm">
                            {sale.status === 'VOIDED' ? <Badge variant="danger">Voided</Badge> : <Badge variant="success">Completed</Badge>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
