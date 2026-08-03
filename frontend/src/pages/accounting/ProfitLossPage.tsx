import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileBarChart, Download, AlertTriangle } from 'lucide-react';
import Layout from '../../components/Layout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';
import api, { downloadFile } from '../../lib/api';
import { formatMoney } from '../../lib/money';

interface ProfitLossLine {
  accountCode: string;
  accountName: string;
  amount: number;
}

interface ProfitLossReport {
  startDate: string;
  endDate: string;
  revenue: ProfitLossLine[];
  expenses: ProfitLossLine[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  draftEntriesInPeriod: number;
}

const firstDayOfMonth = () => {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().split('T')[0];
};

const today = () => new Date().toISOString().split('T')[0];

export default function ProfitLossPage() {
  const { error: showError } = useToast();
  const [report, setReport] = useState<ProfitLossReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportingFormat, setExportingFormat] = useState<'pdf' | 'csv' | null>(null);
  const [startDate, setStartDate] = useState(firstDayOfMonth());
  const [endDate, setEndDate] = useState(today());

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    setLoading(true);
    try {
      const response = await api.get('/accounting/reports/profit-loss', {
        params: { startDate, endDate },
      });
      setReport(response.data);
    } catch {
      showError('Failed to fetch profit & loss report');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'pdf' | 'csv') => {
    setExportingFormat(format);
    try {
      await downloadFile(
        '/accounting/reports/profit-loss/export',
        { startDate, endDate, format },
        `profit-loss-${startDate}_${endDate}.${format}`
      );
    } catch {
      showError(`Failed to export profit & loss report as ${format.toUpperCase()}`);
    } finally {
      setExportingFormat(null);
    }
  };


  const hasData = !!report && (report.revenue.length > 0 || report.expenses.length > 0);

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Profit &amp; Loss</h1>
            <p className="text-sm text-slate-500 mt-1">Revenue and expenses for the selected period</p>
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
            <div className="flex-1">
              <Input
                label="Start Date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <Input
                label="End Date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
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
              from this period.
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
            <p className="text-slate-500">No revenue or expense activity found for the selected period.</p>
          </Card>
        )}

        {!loading && report && hasData && (
          <>
            <Card padding="none" className="overflow-hidden">
              <div className="px-6 py-3 border-b border-slate-200 bg-slate-50">
                <h2 className="text-sm font-semibold text-slate-900">Revenue</h2>
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
                  {report.revenue.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-4 text-sm text-slate-500 text-center">No revenue accounts</td>
                    </tr>
                  ) : (
                    report.revenue.map((line) => (
                      <tr key={line.accountCode} className="hover:bg-slate-50">
                        <td className="px-6 py-2.5 text-sm text-slate-700">{line.accountCode}</td>
                        <td className="px-6 py-2.5 text-sm text-slate-700">{line.accountName}</td>
                        <td className="px-6 py-2.5 text-sm text-right tabular-nums text-slate-900">{formatMoney(line.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                  <tr>
                    <td colSpan={2} className="px-6 py-3 text-sm font-semibold text-slate-900">Total Revenue</td>
                    <td className="px-6 py-3 text-sm text-right font-semibold tabular-nums text-slate-900">{formatMoney(report.totalRevenue)}</td>
                  </tr>
                </tfoot>
              </table>
            </Card>

            <Card padding="none" className="overflow-hidden">
              <div className="px-6 py-3 border-b border-slate-200 bg-slate-50">
                <h2 className="text-sm font-semibold text-slate-900">Expenses</h2>
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
                  {report.expenses.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-4 text-sm text-slate-500 text-center">No expense accounts</td>
                    </tr>
                  ) : (
                    report.expenses.map((line) => (
                      <tr key={line.accountCode} className="hover:bg-slate-50">
                        <td className="px-6 py-2.5 text-sm text-slate-700">{line.accountCode}</td>
                        <td className="px-6 py-2.5 text-sm text-slate-700">{line.accountName}</td>
                        <td className="px-6 py-2.5 text-sm text-right tabular-nums text-slate-900">{formatMoney(line.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                  <tr>
                    <td colSpan={2} className="px-6 py-3 text-sm font-semibold text-slate-900">Total Expenses</td>
                    <td className="px-6 py-3 text-sm text-right font-semibold tabular-nums text-slate-900">{formatMoney(report.totalExpenses)}</td>
                  </tr>
                </tfoot>
              </table>
            </Card>

            <Card className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileBarChart className={report.netIncome >= 0 ? 'text-green-600' : 'text-red-600'} size={24} />
                <span className="text-base font-semibold text-slate-900">Net Income</span>
              </div>
              <span
                className={`text-2xl font-bold tabular-nums ${report.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}
              >
                {formatMoney(report.netIncome)}
              </span>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
