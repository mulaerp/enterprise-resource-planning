import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import api, { getErrorMessage } from '../../lib/api';
import Layout from '../../components/Layout';

interface AccountForm {
  code: string;
  name: string;
  accountType: string;
  parentId?: string;
  isActive: boolean;
  description?: string;
}

interface AccountOption {
  id: string;
  code: string;
  name: string;
}

export default function AccountFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { success, error: showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<AccountForm>({
    defaultValues: {
      isActive: true,
    },
  });

  useEffect(() => {
    fetchAccounts();
    if (id) {
      fetchAccount();
    }
  }, [id]);

  const fetchAccounts = async () => {
    try {
      const response = await api.get('/accounting/accounts');
      setAccounts(response.data);
    } catch {
      console.error('Failed to fetch accounts');
    }
  };

  const fetchAccount = async () => {
    try {
      const response = await api.get(`/accounting/accounts/${id}`);
      reset(response.data);
    } catch {
      showError('Failed to fetch account');
    }
  };

  const onSubmit = async (data: AccountForm) => {
    setLoading(true);
    try {
      if (id) {
        await api.put(`/accounting/accounts/${id}`, data);
        success('Account updated successfully');
      } else {
        await api.post('/accounting/accounts', data);
        success('Account created successfully');
      }
      navigate('/accounting/accounts');
    } catch (err) {
      showError(getErrorMessage(err, 'Failed to save account'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
    <div className="p-6 max-w-2xl">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {id ? 'Edit Account' : 'New Account'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {id ? 'Update account details and settings' : 'Create a new chart of accounts entry'}
          </p>
        </div>
        <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/accounting/accounts')}
          >
            Back to Accounts
          </Button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="account-code" className="block text-sm font-medium mb-1">Code *</label>
          <input
            id="account-code"
            {...register('code', { required: 'Code is required' })}
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="e.g., 1000"
          />
          {errors.code && (
            <p className="text-red-500 text-sm mt-1">{errors.code.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="account-name" className="block text-sm font-medium mb-1">Name *</label>
          <input
            id="account-name"
            {...register('name', { required: 'Name is required' })}
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="Account name"
          />
          {errors.name && (
            <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="account-type" className="block text-sm font-medium mb-1">Account Type *</label>
          <select
            id="account-type"
            {...register('accountType', { required: 'Account type is required' })}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value="">Select type</option>
            <option value="ASSET">Asset</option>
            <option value="LIABILITY">Liability</option>
            <option value="EQUITY">Equity</option>
            <option value="REVENUE">Revenue</option>
            <option value="EXPENSE">Expense</option>
          </select>
          {errors.accountType && (
            <p className="text-red-500 text-sm mt-1">{errors.accountType.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="account-parent" className="block text-sm font-medium mb-1">Parent Account</label>
          <select
            id="account-parent"
            {...register('parentId')}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value="">None</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} - {account.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="account-description" className="block text-sm font-medium mb-1">Description</label>
          <textarea
            id="account-description"
            {...register('description')}
            className="w-full px-3 py-2 border rounded-lg"
            rows={3}
            placeholder="Account description"
          />
        </div>

        <div className="flex items-center">
          <input
            id="account-is-active"
            type="checkbox"
            {...register('isActive')}
            className="mr-2"
          />
          <label htmlFor="account-is-active" className="text-sm font-medium">Active</label>
        </div>

        <div className="flex gap-2 pt-4">
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/accounting/accounts')}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
    </Layout>
  );
}
