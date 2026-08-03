import { useState, useEffect } from 'react';
import { useToast } from '../../components/ui/Toast';
import api from '../../lib/api';
import { formatMoney } from '../../lib/money';
import Layout from '../../components/Layout';

interface TrialBalanceItem {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

interface TrialBalance {
  items: TrialBalanceItem[];
  totalDebits: number;
  totalCredits: number;
  balanced: boolean;
}

export default function TrialBalancePage() {
  const { error: showError } = useToast();
  const [trialBalance, setTrialBalance] = useState<TrialBalance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrialBalance();
  }, []);

  const fetchTrialBalance = async () => {
    try {
      const response = await api.get('/accounting/reports/trial-balance');
      setTrialBalance(response.data);
    } catch {
      showError('Failed to fetch trial balance');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-6">Loading...</div>
      </Layout>
    );
  }

  if (!trialBalance) {
    return (
      <Layout>
        <div className="p-6">No data available</div>
      </Layout>
    );
  }

  return (
    <Layout>
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Trial Balance</h1>
        <p className="text-sm text-slate-500 mt-1">As of {new Date().toLocaleDateString()}</p>
      </div>

      {!trialBalance.balanced && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 font-semibold">
            ⚠️ Trial Balance is out of balance!
          </p>
          <p className="text-red-600 text-sm">
            Difference: {formatMoney(Math.abs(trialBalance.totalDebits - trialBalance.totalCredits))}
          </p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold">Account Code</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Account Name</th>
              <th className="px-6 py-3 text-right text-sm font-semibold">Debit</th>
              <th className="px-6 py-3 text-right text-sm font-semibold">Credit</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {trialBalance.items.map((item, index) => (
              <tr key={index} className="hover:bg-slate-50">
                <td className="px-6 py-4 text-sm">{item.accountCode}</td>
                <td className="px-6 py-4 text-sm">{item.accountName}</td>
                <td className="px-6 py-4 text-sm text-right">
                  {item.debit > 0 ? formatMoney(item.debit) : '-'}
                </td>
                <td className="px-6 py-4 text-sm text-right">
                  {item.credit > 0 ? formatMoney(item.credit) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 border-t-2">
            <tr>
              <td colSpan={2} className="px-6 py-4 text-sm font-bold">Total</td>
              <td className="px-6 py-4 text-sm text-right font-bold">
                {formatMoney(trialBalance.totalDebits)}
              </td>
              <td className="px-6 py-4 text-sm text-right font-bold">
                {formatMoney(trialBalance.totalCredits)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {trialBalance.balanced && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800 font-semibold">
            ✓ Trial Balance is balanced
          </p>
        </div>
      )}
    </div>
    </Layout>
  );
}
