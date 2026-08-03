import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2 } from 'lucide-react';
import DataTable from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import api, { getErrorMessage } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import Layout from '../../components/Layout';

interface Account {
  id: string;
  code: string;
  name: string;
  accountType: string;
  balance: number;
  isActive: boolean;
}

export default function AccountListPage() {
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const response = await api.get('/accounting/accounts');
      setAccounts(response.data);
    } catch {
      showError('Failed to fetch accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this account?')) return;

    try {
      await api.delete(`/accounting/accounts/${id}`);
      success('Account deleted successfully');
      fetchAccounts();
    } catch (error) {
      showError(getErrorMessage(error, 'Failed to delete account'));
    }
  };

  const columns = [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'accountType', header: 'Type' },
    {
      key: 'balance',
      header: 'Balance',
      render: (account: Account) => formatMoney(account.balance),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (account: Account) => (
        <span className={`px-2 py-1 rounded text-xs ${
          account.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'
        }`}>
          {account.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (account: Account) => (
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/accounting/accounts/${account.id}/edit`)}
            className="text-brand-600 hover:text-brand-800"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(account.id)}
            className="text-red-600 hover:text-red-800"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="p-6">Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Chart of Accounts</h1>
              <p className="text-sm text-slate-500 mt-1">Manage your accounting structure and account hierarchy</p>
            </div>
            <Button
              onClick={() => navigate('/accounting/accounts/new')}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Account
            </Button>
        </div>

        <DataTable columns={columns} data={accounts}
          keyExtractor={(account) => account.id} />
      </div>
    </Layout>
  );
}
