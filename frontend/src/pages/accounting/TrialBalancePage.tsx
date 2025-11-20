import { useState, useEffect } from 'react';
import { useToast } from '../../components/ui/Toast';
import api from '../../lib/api';

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
    } catch (err) {
      showError('Failed to fetch trial balance');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!trialBalance) {
    return <div className="p-6">No data available</div>;
  }

  return (
    <div className="p-6">
      {/* Gradient Banner Header */}
      <div className="bg-gradient-to-r from-slate-600 via-gray-600 to-zinc-600 rounded-xl shadow-lg p-8 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Trial Balance</h1>
          <p className="text-slate-100">As of {new Date().toLocaleDateString()}</p>
        </div>
      </div>

      {!trialBalance.balanced && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 font-semibold">
            ⚠️ Trial Balance is out of balance!
          </p>
          <p className="text-red-600 text-sm">
            Difference: ${Math.abs(trialBalance.totalDebits - trialBalance.totalCredits).toFixed(2)}
          </p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold">Account Code</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Account Name</th>
              <th className="px-6 py-3 text-right text-sm font-semibold">Debit</th>
              <th className="px-6 py-3 text-right text-sm font-semibold">Credit</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {trialBalance.items.map((item, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm">{item.accountCode}</td>
                <td className="px-6 py-4 text-sm">{item.accountName}</td>
                <td className="px-6 py-4 text-sm text-right">
                  {item.debit > 0 ? `$${item.debit.toFixed(2)}` : '-'}
                </td>
                <td className="px-6 py-4 text-sm text-right">
                  {item.credit > 0 ? `$${item.credit.toFixed(2)}` : '-'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 border-t-2">
            <tr>
              <td colSpan={2} className="px-6 py-4 text-sm font-bold">Total</td>
              <td className="px-6 py-4 text-sm text-right font-bold">
                ${trialBalance.totalDebits.toFixed(2)}
              </td>
              <td className="px-6 py-4 text-sm text-right font-bold">
                ${trialBalance.totalCredits.toFixed(2)}
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
  );
}
