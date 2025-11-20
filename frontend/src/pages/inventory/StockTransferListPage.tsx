import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, Trash2 } from 'lucide-react';
import Layout from '../../components/Layout';
import DataTable from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
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
  const { success, error: showError } = useToast();
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTransfers();
  }, []);

  const fetchTransfers = async () => {
    try {
      const response = await api.get('/stock-transfers');
      setTransfers(response.data);
    } catch (err) {
      showError('Failed to fetch stock transfers');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this transfer?')) return;

    try {
      await api.delete(`/stock-transfers/${id}`);
      success('Transfer deleted successfully');
      fetchTransfers();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to delete transfer');
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
    { key: 'transferNumber', header: 'Transfer #' },
    { key: 'fromWarehouseName', header: 'From Warehouse' },
    { key: 'toWarehouseName', header: 'To Warehouse' },
    {
      key: 'transferDate',
      header: 'Transfer Date',
      render: (transfer: StockTransfer) => new Date(transfer.transferDate).toLocaleDateString(),
    },
    {
      key: 'items',
      header: 'Items',
      render: (transfer: StockTransfer) => transfer.items?.length || 0,
    },
    {
      key: 'status',
      header: 'Status',
      render: (transfer: StockTransfer) => getStatusBadge(transfer.status),
    },
    {
      key: 'actions',
      header: 'Actions',
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
        {/* Gradient Banner Header */}
        <div className="bg-gradient-to-r from-rose-600 via-pink-600 to-fuchsia-600 rounded-xl shadow-lg p-8 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Stock Transfers</h1>
              <p className="text-rose-100">Manage inventory transfers between warehouses</p>
            </div>
            <Button 
              onClick={() => navigate('/inventory/transfers/new')}
              className="bg-white/20 hover:bg-white/30 text-white border-white/30"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Transfer
            </Button>
          </div>
        </div>

        <DataTable columns={columns} data={transfers}
        keyExtractor={(transfer) => transfer.id} />
      </div>
    </Layout>
  );
}
