import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Download } from 'lucide-react';
import Layout from '../../components/Layout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';
import api, { downloadFile } from '../../lib/api';
import { formatMoney } from '../../lib/money';

interface BalanceSheetLine {
  accountCode: string;
  accountName: string;
  amount: number;
}

interface BalanceSheetReport {
  asOfDate: string;
  assets: BalanceSheetLine[];
  liabilities: BalanceSheetLine[];
  equity: BalanceSheetLine[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  retainedEarnings?: number;
  draftEntriesInPeriod: number;
}

const today = () => new Date().toISOString().split('T')[0];


function SectionTable({
  title,
  lines,
  total,
  totalLabel,
  emptyLabel,
  extraRow,
}: {
  title: string;
  lines: BalanceSheetLine[];
  total: number;
  totalLabel: string;
  emptyLabel: string;
  extraRow?: { label: string; amount: number };
}) {
  return (
    <Card padding="none" className="overflow-hidden">
      <div className="px-6 py-3 border-b border-slate-200 bg-slate-50">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      </div>
      <table className="w-full">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Account Code</th>
            <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Account Name</th>
            <th className="px-6 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {lines.length === 0 && !extraRow ? (
            <tr>
              <td colSpan={3} className="px-6 py-4 text-sm text-slate-500 text-center">{emptyLabel}</td>
            </tr>
          ) : (
            lines.map((line) => (
              <tr key={line.accountCode} className="hover:bg-slate-50">
                <td className="px-6 py-2.5 text-sm text-slate-700">{line.accountCode}</td>
                <td className="px-6 py-2.5 text-sm text-slate-700">{line.accountName}</td>
                <td className="px-6 py-2.5 text-sm text-right tabular-nums text-slate-900">{formatMoney(line.amount)}</td>
              </tr>
            ))
          )}
          {extraRow && (
            <tr className="hover:bg-slate-50">
              <td className="px-6 py-2.5 text-sm text-slate-700" colSpan={2}>{extraRow.label}</td>
              <td className="px-6 py-2.5 text-sm text-right tabular-nums text-slate-900">{formatMoney(extraRow.amount)}</td>
            </tr>
          )}
        </tbody>
        <tfoot className="bg-slate-50 border-t-2 border-slate-200">
          <tr>
            <td colSpan={2} className="px-6 py-3 text-sm font-semibold text-slate-900">{totalLabel}</td>
            <td className="px-6 py-3 text-sm text-right font-semibold tabular-nums text-slate-900">{formatMoney(total)}</td>
          </tr>
        </tfoot>
      </table>
    </Card>
  );
}

export default function BalanceSheetPage() {
  const { error: showError } = useToast();
  const [report, setReport] = useState<BalanceSheetReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportingFormat, setExportingFormat] = useState<'pdf' | 'csv' | null>(null);
  const [asOfDate, setAsOfDate] = useState(today());

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    setLoading(true);
    try {
      const response = await api.get('/accounting/reports/balance-sheet', {
        params: { asOfDate },
      });
      setReport(response.data);
    } catch {
      showError('Failed to fetch balance sheet');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'pdf' | 'csv') => {
    setExportingFormat(format);
    try {
      await downloadFile(
        '/accounting/reports/balance-sheet/export',
        { asOfDate, format },
        `balance-sheet-${asOfDate}.${format}`
      );
    } catch {
      showError(`Failed to export balance sheet as ${format.toUpperCase()}`);
    } finally {
      setExportingFormat(null);
    }
  };

  const hasData =
    !!report && (report.assets.length > 0 || report.liabilities.length > 0 || report.equity.length > 0);

  const liabilitiesPlusEquity = report ? report.totalLiabilities + report.totalEquity : 0;
  const difference = report ? report.totalAssets - liabilitiesPlusEquity : 0;
  const isBalanced = report ? Math.abs(difference) < 0.01 : true;

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Balance Sheet</h1>
            <p className="text-sm text-slate-500 mt-1">Assets, liabilities, and equity as of a given date</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              icon={<Download size={16} />}
              loading={exportingFormat === 'pdf'}
              disabled={!hasData}
              onClick={() => handleExport('pdf')}
            >
              Export PDF
            </Button>
            <Button
              variant="secondary"
              icon={<Download size={16} />}
              loading={exportingFormat === 'csv'}
              disabled={!hasData}
              onClick={() => handleExport('csv')}
            >
              Export CSV
            </Button>
          </div>
        </div>

        <Card className="p-6">
          <div className="flex items-end gap-4">
            <div className="flex-1 max-w-xs">
              <Input
                label="As Of Date"
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
              />
            </div>
            <Button onClick={loadReport} loading={loading}>
              Generate
            </Button>
          </div>
        </Card>

        {!loading && report && report.draftEntriesInPeriod > 0 && (
          <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
            <AlertTriangle size={16} className="shrink-0" />
            <span>
              {report.draftEntriesInPeriod} unposted {report.draftEntriesInPeriod === 1 ? 'entry' : 'entries'} excluded
              as of this date.
            </span>
            <Link
              to="/accounting/journal-entries/post-drafts"
              className="ml-auto font-medium underline hover:text-amber-900"
            >
              Review drafts
            </Link>
          </div>
        )}

        {loading && !report && (
          <Card className="p-12 text-center">
            <p className="text-slate-500">Loading report...</p>
          </Card>
        )}

        {!loading && report && !hasData && (
          <Card className="p-12 text-center">
            <p className="text-slate-500">No balances found as of the selected date.</p>
          </Card>
        )}

        {!loading && report && hasData && (
          <>
            <SectionTable
              title="Assets"
              lines={report.assets}
              total={report.totalAssets}
              totalLabel="Total Assets"
              emptyLabel="No asset accounts"
            />

            <SectionTable
              title="Liabilities"
              lines={report.liabilities}
              total={report.totalLiabilities}
              totalLabel="Total Liabilities"
              emptyLabel="No liability accounts"
            />

            <SectionTable
              title="Equity"
              lines={report.equity}
              total={report.totalEquity}
              totalLabel="Total Equity"
              emptyLabel="No equity accounts"
              extraRow={
                report.retainedEarnings !== undefined
                  ? { label: 'Retained Earnings', amount: report.retainedEarnings }
                  : undefined
              }
            />

            <Card className={`p-6 flex items-center justify-between ${isBalanced ? '' : 'border-amber-300 bg-amber-50'}`}>
              <div className="flex items-center gap-3">
                {isBalanced ? (
                  <CheckCircle2 className="text-green-600" size={24} />
                ) : (
                  <AlertTriangle className="text-amber-600" size={24} />
                )}
                <span className="text-base font-semibold text-slate-900">Assets = Liabilities + Equity</span>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-600 tabular-nums">
                  {formatMoney(report.totalAssets)} = {formatMoney(liabilitiesPlusEquity)}
                </p>
                {!isBalanced && (
                  <p className="text-sm font-semibold text-amber-600 tabular-nums">
                    Out of balance by {formatMoney(Math.abs(difference))}
                  </p>
                )}
              </div>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
