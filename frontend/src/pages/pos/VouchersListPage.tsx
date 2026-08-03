import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ArrowLeft } from 'lucide-react';
import api from '../../lib/api';
import { formatMoney } from '../../lib/money';
import Layout from '../../components/Layout';
import { DataTable, Button, Badge, useToast, type Column } from '../../components/ui';

interface Voucher {
  id: string;
  code: string;
  type: 'PERCENT' | 'FIXED';
  value: number;
  minSpend?: number;
  expiresAt?: string;
  usageLimit?: number;
}

export default function VouchersListPage() {
  const navigate = useNavigate();
  const { error: showError } = useToast();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVouchers();
  }, []);

  const fetchVouchers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/vouchers');
      setVouchers(Array.isArray(response.data) ? response.data : response.data.content);
    } catch (err) {
      console.error('Failed to fetch vouchers:', err);
      showError('Failed to load vouchers');
    } finally {
      setLoading(false);
    }
  };

  const columns: Column<Voucher>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (voucher) => <span className="font-medium text-slate-900">{voucher.code}</span>,
    },
    {
      key: 'type',
      header: 'Type',
      render: (voucher) => <Badge variant={voucher.type === 'PERCENT' ? 'info' : 'default'}>{voucher.type}</Badge>,
    },
    {
      key: 'value',
      header: 'Value',
      render: (voucher) => (voucher.type === 'PERCENT' ? `${voucher.value}%` : formatMoney(voucher.value)),
    },
    {
      key: 'minSpend',
      header: 'Min Spend',
      render: (voucher) => (voucher.minSpend ? formatMoney(voucher.minSpend) : '-'),
    },
    {
      key: 'expiresAt',
      header: 'Expires',
      render: (voucher) => (voucher.expiresAt ? new Date(voucher.expiresAt).toLocaleDateString() : 'Never'),
    },
    {
      key: 'usageLimit',
      header: 'Usage Limit',
      render: (voucher) => voucher.usageLimit ?? 'Unlimited',
    },
  ];

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <button
            onClick={() => navigate('/pos')}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Point of Sale
          </button>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Vouchers</h1>
              <p className="text-sm text-slate-500 mt-1">Manage discount vouchers for the register</p>
            </div>
            <Button onClick={() => navigate('/pos/vouchers/new')} icon={<Plus className="w-5 h-5" />}>
              Add Voucher
            </Button>
          </div>
        </div>

        <DataTable
          data={vouchers}
          columns={columns}
          keyExtractor={(voucher) => voucher.id}
          loading={loading}
          emptyMessage="No vouchers found. Create your first voucher!"
        />
      </div>
    </Layout>
  );
}
