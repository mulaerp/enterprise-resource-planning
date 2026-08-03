import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import Layout from '../../components/Layout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import api, { getErrorMessage } from '../../lib/api';
import { formatMoney } from '../../lib/money';

interface CashUpLine {
  paymentMethod: string;
  expected: number;
  counted: number;
  variance: number | null;
  notes: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  saved: boolean;
}

interface CashUpResponse {
  date: string;
  lines: CashUpLine[];
}

interface DraftLine {
  counted: string;
  notes: string;
}

const today = () => new Date().toISOString().split('T')[0];

function varianceBadge(variance: number | null) {
  if (variance === null) return <Badge>Not counted</Badge>;
  if (Math.abs(variance) < 0.01) return <Badge variant="success">Balanced</Badge>;
  return <Badge variant={variance < 0 ? 'danger' : 'warning'}>{variance < 0 ? 'Short' : 'Over'} {formatMoney(Math.abs(variance))}</Badge>;
}

export default function CashUpPage() {
  const { error: showError, success: showSuccess } = useToast();
  const [date, setDate] = useState(today());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<CashUpResponse | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftLine>>({});

  useEffect(() => {
    loadCashUp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCashUp = async () => {
    setLoading(true);
    try {
      const response = await api.get('/oversight/cashup', { params: { date } });
      const cashUp: CashUpResponse = response.data;
      setData(cashUp);
      const nextDrafts: Record<string, DraftLine> = {};
      for (const line of cashUp.lines) {
        nextDrafts[line.paymentMethod] = {
          counted: line.saved ? String(line.counted) : '',
          notes: line.notes ?? '',
        };
      }
      setDrafts(nextDrafts);
    } catch (err) {
      showError(getErrorMessage(err, 'Failed to load cash-up'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!data) return;
    const counts = data.lines
      .filter((line) => drafts[line.paymentMethod]?.counted !== '')
      .map((line) => ({
        paymentMethod: line.paymentMethod,
        counted: Number(drafts[line.paymentMethod]?.counted ?? 0),
        notes: drafts[line.paymentMethod]?.notes || undefined,
      }));

    if (counts.length === 0) {
      showError('Enter a counted amount for at least one payment method');
      return;
    }

    setSaving(true);
    try {
      const response = await api.post('/oversight/cashup', { date, counts });
      setData(response.data);
      showSuccess('Cash-up saved');
    } catch (err) {
      showError(getErrorMessage(err, 'Failed to save cash-up'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Cash-up / Z-Report</h1>
          <p className="text-sm text-slate-500 mt-1">Expected vs counted cash per payment method</p>
        </div>

        <Card className="p-6">
          <div className="flex items-end gap-4">
            <div className="flex-1 max-w-xs">
              <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <Button onClick={loadCashUp} loading={loading} variant="secondary">Load</Button>
          </div>
        </Card>

        {loading && !data && <Card className="p-12 text-center"><p className="text-slate-500">Loading...</p></Card>}

        {!loading && data && (
          <Card padding="none" className="overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Method</th>
                  <th className="px-6 py-2 text-right text-xs font-medium text-slate-500 uppercase">Expected</th>
                  <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase w-40">Counted</th>
                  <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Notes</th>
                  <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Variance</th>
                  <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Approved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.lines.map((line) => (
                  <tr key={line.paymentMethod}>
                    <td className="px-6 py-3 text-sm font-medium text-slate-900">{line.paymentMethod}</td>
                    <td className="px-6 py-3 text-sm text-right tabular-nums">{formatMoney(line.expected)}</td>
                    <td className="px-6 py-3">
                      <input
                        type="number"
                        step="0.01"
                        aria-label={`Counted amount for ${line.paymentMethod}`}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                        value={drafts[line.paymentMethod]?.counted ?? ''}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [line.paymentMethod]: { ...prev[line.paymentMethod], counted: e.target.value, notes: prev[line.paymentMethod]?.notes ?? '' },
                          }))
                        }
                      />
                    </td>
                    <td className="px-6 py-3">
                      <input
                        type="text"
                        aria-label={`Notes for ${line.paymentMethod}`}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                        value={drafts[line.paymentMethod]?.notes ?? ''}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [line.paymentMethod]: { ...prev[line.paymentMethod], notes: e.target.value, counted: prev[line.paymentMethod]?.counted ?? '' },
                          }))
                        }
                      />
                    </td>
                    <td className="px-6 py-3 text-sm">{varianceBadge(line.saved ? line.variance : null)}</td>
                    <td className="px-6 py-3 text-xs text-slate-500">
                      {line.approvedBy ? (
                        <>
                          <p className="font-medium text-slate-700">{line.approvedBy}</p>
                          <p>{line.approvedAt && new Date(line.approvedAt).toLocaleString('en-MY')}</p>
                        </>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <Button onClick={handleSave} loading={saving} icon={<Save size={16} />}>
                Save &amp; Approve
              </Button>
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
}
