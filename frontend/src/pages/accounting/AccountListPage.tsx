import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2 } from 'lucide-react';
import DataTable from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import api from '../../lib/api';

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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const response = await api.get('/accounting/accounts');
      setAccounts(response.data);
    } catch (error) {
      error('Failed to fetch accounts');
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
    } catch (error: any) {
      error(error.response?.data?.message || 'Failed to delete account');
    }
  };

  const columns = [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'accountType', header: 'Type' },
    {
      key: 'balance',
      label: 'Balance',
      render: (account: Account) => `$${account.balance.toFixed(2)}`,
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (account: Account) => (
        <span className={`px-2 py-1 rounded text-xs ${
          account.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {account.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (account: Account) => (
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/accounting/accounts/${account.id}/edit`)}
            className="text-blue-600 hover:text-blue-800"
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
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Chart of Accounts</h1>
        <Button onClick={() => navigate('/accounting/accounts/new')}>
          <Plus className="w-4 h-4 mr-2" />
          New Account
        </Button>
      </div>

      <DataTable columns={columns} data={accounts} />
    </div>
  );
}
