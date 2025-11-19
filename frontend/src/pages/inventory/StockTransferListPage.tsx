import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, Trash2 } from 'lucide-react';
import Layout from '../../components/Layout';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { toast } from '../../components/ui/Toast';
import api from '../../lib/api';

interface StockTransfer {
  id: string;
  transferNumber: string;
  fromWarehouseName: string;
  toWarehouseName: string;
  transferDate: string;
  status: 'PENDING' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';
  items: any[];
}

export default function StockTransferListPage() {
  const navigate = useNavigate();
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTransfers();
  }, []);

  const fetchTransfers = async () => {
    try {
      const response = await api.get('/stock-transfers');
      setTransfers(response.data);
    } catch (error) {
      toast.error('Failed to fetch stock transfers');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this transfer?')) return;

    try {
      await api.delete(`/stock-transfers/${id}`);
      toast.success('Transfer deleted successfully');
      fetchTransfers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete transfer');
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      IN_TRANSIT: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status as keyof typeof colors]}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  const columns = [
    { key: 'transferNumber', label: 'Transfer #' },
    { key: 'fromWarehouseName', label: 'From Warehouse' },
    { key: 'toWarehouseName', label: 'To Warehouse' },
    {
      key: 'transferDate',
      label: 'Transfer Date',
      render: (transfer: StockTransfer) => new Date(transfer.transferDate).toLocaleDateString(),
    },
    {
      key: 'items',
      label: 'Items',
      render: (transfer: StockTransfer) => transfer.items?.length || 0,
    },
    {
      key: 'status',
      label: 'Status',
      render: (transfer: StockTransfer) => getStatusBadge(transfer.status),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (transfer: StockTransfer) => (
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/inventory/transfers/${transfer.id}`)}
            className="text-blue-600 hover:text-blue-800"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(transfer.id)}
            className="text-red-600 hover:text-red-800"
            disabled={transfer.status === 'COMPLETED'}
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
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Stock Transfers</h1>
          <Button onClick={() => navigate('/inventory/transfers/new')}>
            <Plus className="w-4 h-4 mr-2" />
            New Transfer
          </Button>
        </div>

        <DataTable columns={columns} data={transfers} />
      </div>
    </Layout>
  );
}
