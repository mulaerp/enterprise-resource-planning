import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import Layout from '../../components/Layout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';
import api, { getErrorMessage } from '../../lib/api';
import { formatMoney } from '../../lib/money';

interface AmountWithDocuments {
  amount: number;
  documents: string[];
}

interface PaymentMethodTakings {
  paymentMethod: string;
  posSalesAmount: number;
  posSalesCount: number;
  repairPaymentsAmount: number;
  repairPaymentsCount: number;
  total: number;
  documents: string[];
}

interface PostedJournalCrossCheck {
  operationalRevenue: number;
  postedJournalRevenue: number;
  matchesOperational: boolean;
  note: string;
  unpostedDraftRevenueCount: number;
  unpostedDraftRevenueEntryNumbers: string[];
}

interface MoneyFlowResponse {
  from: string;
  to: string;
  takingsByMethod: PaymentMethodTakings[];
  tradeInCashPayouts: AmountWithDocuments;
  storeCreditIssued: AmountWithDocuments;
  storeCreditRedeemed: AmountWithDocuments;
  serviceRevenue: AmountWithDocuments;
  posGoodsRevenue: AmountWithDocuments;
  totalRevenue: number;
  cogsGoods: AmountWithDocuments;
  cogsRepairParts: AmountWithDocuments;
  totalCogs: number;
  grossMargin: number;
  netCashMovement: number;
  postedJournalCrossCheck: PostedJournalCrossCheck;
}

const today = () => new Date().toISOString().split('T')[0];

function DocumentsList({ documents }: { documents: string[] }) {
  if (documents.length === 0) return <p className="text-xs text-slate-400 mt-2">No documents</p>;
  const shown = documents.slice(0, 8);
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {shown.map((doc) => (
        <span key={doc} className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">{doc}</span>
      ))}
      {documents.length > shown.length && (
        <span className="text-xs px-1.5 py-0.5 text-slate-400">+{documents.length - shown.length} more</span>
      )}
    </div>
  );
}

export default function MoneyFlowPage() {
  const { error: showError } = useToast();
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<MoneyFlowResponse | null>(null);

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadReport = async () => {
    setLoading(true);
    try {
      const response = await api.get('/oversight/money-flow', { params: { from, to } });
      setReport(response.data);
    } catch (err) {
      showError(getErrorMessage(err, 'Failed to load money flow report'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Money Flow / Day Book</h1>
          <p className="text-sm text-slate-500 mt-1">Takings, revenue, COGS, and margin for the selected period</p>
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

        {loading && !report && (
          <Card className="p-12 text-center"><p className="text-slate-500">Loading...</p></Card>
        )}

        {!loading && report && (
          <>
            <div
              className={`rounded-lg border px-4 py-3 flex items-start gap-3 text-sm ${
                report.postedJournalCrossCheck.matchesOperational
                  ? 'border-green-200 bg-green-50 text-green-800'
                  : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}
            >
              {report.postedJournalCrossCheck.matchesOperational ? (
                <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-medium">
                  Operational revenue (PoS + repairs + invoices) {formatMoney(report.postedJournalCrossCheck.operationalRevenue)}{' '}
                  vs. posted journal revenue {formatMoney(report.postedJournalCrossCheck.postedJournalRevenue)}
                </p>
                <p className="mt-0.5">{report.postedJournalCrossCheck.note}</p>
                {!report.postedJournalCrossCheck.matchesOperational && report.postedJournalCrossCheck.unpostedDraftRevenueCount > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {report.postedJournalCrossCheck.unpostedDraftRevenueEntryNumbers.map((entryNumber) => (
                      <span key={entryNumber} className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-mono">{entryNumber}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-900 mb-3">Takings by Payment Method</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {report.takingsByMethod.length === 0 && (
                  <Card className="p-6 col-span-full text-center text-sm text-slate-500">No takings recorded for this period</Card>
                )}
                {report.takingsByMethod.map((m) => (
                  <Card key={m.paymentMethod} className="p-5">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{m.paymentMethod}</p>
                    <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">{formatMoney(m.total)}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      PoS: {formatMoney(m.posSalesAmount)} ({m.posSalesCount}) &middot; Repairs: {formatMoney(m.repairPaymentsAmount)} ({m.repairPaymentsCount})
                    </p>
                    <DocumentsList documents={m.documents} />
                  </Card>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="p-6">
                <h2 className="text-sm font-semibold text-slate-900">Revenue</h2>
                <p className="text-2xl font-bold text-slate-900 tabular-nums mt-2">{formatMoney(report.totalRevenue)}</p>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <div className="flex justify-between"><span>Goods (PoS)</span><span className="tabular-nums">{formatMoney(report.posGoodsRevenue.amount)}</span></div>
                  <div className="flex justify-between"><span>Service (repairs)</span><span className="tabular-nums">{formatMoney(report.serviceRevenue.amount)}</span></div>
                </div>
              </Card>
              <Card className="p-6">
                <h2 className="text-sm font-semibold text-slate-900">COGS</h2>
                <p className="text-2xl font-bold text-slate-900 tabular-nums mt-2">{formatMoney(report.totalCogs)}</p>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <div className="flex justify-between"><span>Goods sold</span><span className="tabular-nums">{formatMoney(report.cogsGoods.amount)}</span></div>
                  <div className="flex justify-between"><span>Repair parts</span><span className="tabular-nums">{formatMoney(report.cogsRepairParts.amount)}</span></div>
                </div>
              </Card>
              <Card className="p-6">
                <h2 className="text-sm font-semibold text-slate-900">Gross Margin</h2>
                <p className={`text-2xl font-bold tabular-nums mt-2 ${report.grossMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatMoney(report.grossMargin)}
                </p>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <div className="flex justify-between"><span>Net cash movement</span><span className="tabular-nums">{formatMoney(report.netCashMovement)}</span></div>
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6">
                <h2 className="text-sm font-semibold text-slate-900">Trade-in Cash Payouts</h2>
                <p className="text-xl font-semibold text-slate-900 tabular-nums mt-1">{formatMoney(report.tradeInCashPayouts.amount)}</p>
                <DocumentsList documents={report.tradeInCashPayouts.documents} />
              </Card>
              <Card className="p-6">
                <h2 className="text-sm font-semibold text-slate-900">Store Credit Issued vs Redeemed</h2>
                <p className="text-sm text-slate-600 mt-1">
                  Issued <span className="font-semibold text-slate-900 tabular-nums">{formatMoney(report.storeCreditIssued.amount)}</span>
                  {' '}&middot; Redeemed{' '}
                  <span className="font-semibold text-slate-900 tabular-nums">{formatMoney(report.storeCreditRedeemed.amount)}</span>
                </p>
                <DocumentsList documents={[...report.storeCreditIssued.documents, ...report.storeCreditRedeemed.documents]} />
              </Card>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
