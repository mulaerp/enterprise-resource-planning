import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, FileText, BarChart3, TrendingUp, Scale, Landmark } from 'lucide-react';
import Layout from '../../components/Layout';
import api from '../../lib/api';

export default function AccountingPage() {
  const navigate = useNavigate();
  const [unreconciledCount, setUnreconciledCount] = useState<number | null>(null);

  useEffect(() => {
    api
      .get('/bank/summary')
      .then((response) => setUnreconciledCount(response.data.unreconciledCount))
      .catch(() => setUnreconciledCount(null));
  }, []);

  const modules = [
    {
      title: 'Chart of Accounts',
      description: 'Manage your chart of accounts',
      icon: BookOpen,
      path: '/accounting/accounts',
      color: 'from-blue-500 to-blue-600',
    },
    {
      title: 'Journal Entries',
      description: 'Create and manage journal entries',
      icon: FileText,
      path: '/accounting/journal-entries',
      color: 'bg-blue-600',
    },
    {
      title: 'Trial Balance',
      description: 'View trial balance report',
      icon: BarChart3,
      path: '/accounting/trial-balance',
      color: 'bg-green-600',
    },
    {
      title: 'Profit & Loss',
      description: 'View revenue, expenses, and net income',
      icon: TrendingUp,
      path: '/accounting/profit-loss',
      color: 'bg-blue-600',
    },
    {
      title: 'Balance Sheet',
      description: 'View assets, liabilities, and equity',
      icon: Scale,
      path: '/accounting/balance-sheet',
      color: 'bg-slate-600',
    },
    {
      title: 'Bank Reconciliation',
      description:
        unreconciledCount !== null
          ? `${unreconciledCount} transaction(s) awaiting reconciliation`
          : 'Import bank statements and match against payments',
      icon: Landmark,
      path: '/accounting/bank',
      color: 'bg-blue-600',
    },
  ];

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Accounting</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your financial records and reports</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <button
                key={module.path}
                onClick={() => navigate(module.path)}
                className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow text-left"
              >
                <div className={`w-12 h-12 rounded-lg ${module.color} flex items-center justify-center mb-4`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-xl font-semibold mb-2">{module.title}</h2>
                <p className="text-slate-600">{module.description}</p>
              </button>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
