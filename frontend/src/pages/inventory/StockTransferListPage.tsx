import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, Trash2, Truck, CheckCircle2 } from 'lucide-react';
import Layout from '../../components/Layout';
import DataTable from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import api, { getErrorMessage } from '../../lib/api';

interface StockTransfer {
  id: string;
  transferNumber: string;
  fromWarehouseName: string;
  toWarehouseName: string;
  transferDate: string;
  status: 'PENDING' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';
  items: unknown[];
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
    } catch {
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
    } catch (err) {
      showError(getErrorMessage(err, 'Failed to delete transfer'));
    }
  };

  // BUG FIX: a transfer's lifecycle (PENDING -> IN_TRANSIT -> COMPLETED) had backend support
  // (StockTransferController's status/complete endpoints) but no UI trigger anywhere - this list
  // was the only page rendering a transfer's actions, and it only offered View/Delete. A
  // transfer therefore could never actually move stock between warehouses (completeTransfer -
  // the only place that writes the TRANSFER_OUT/TRANSFER_IN ledger rows - requires IN_TRANSIT,
  // which nothing could ever reach). Added the two status-advance actions here.
  const handleMarkInTransit = async (id: string) => {
    try {
      await api.patch(`/stock-transfers/${id}/status?status=IN_TRANSIT`);
      success('Transfer marked in transit');
      fetchTransfers();
    } catch (err) {
      showError(getErrorMessage(err, 'Failed to update transfer status'));
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await api.post(`/stock-transfers/${id}/complete`);
      success('Transfer completed');
      fetchTransfers();
    } catch (err) {
      showError(getErrorMessage(err, 'Failed to complete transfer'));
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      PENDING: 'bg-amber-100 text-amber-800',
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
            className="text-brand-600 hover:text-brand-800"
            title="View / Edit"
          >
            <Eye className="w-4 h-4" />
          </button>
          {transfer.status === 'PENDING' && (
            <button
              onClick={() => handleMarkInTransit(transfer.id)}
              className="text-blue-600 hover:text-blue-800"
              title="Mark In Transit"
              aria-label={`Mark transfer ${transfer.transferNumber} in transit`}
            >
              <Truck className="w-4 h-4" />
            </button>
          )}
          {transfer.status === 'IN_TRANSIT' && (
            <button
              onClick={() => handleComplete(transfer.id)}
              className="text-green-600 hover:text-green-800"
              title="Complete Transfer"
              aria-label={`Complete transfer ${transfer.transferNumber}`}
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => handleDelete(transfer.id)}
            className="text-red-600 hover:text-red-800"
            disabled={transfer.status === 'COMPLETED'}
            title="Delete"
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
              <h1 className="text-2xl font-semibold text-slate-900">Stock Transfers</h1>
              <p className="text-sm text-slate-500 mt-1">Manage inventory transfers between warehouses</p>
            </div>
            <Button
              onClick={() => navigate('/inventory/transfers/new')}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Transfer
            </Button>
        </div>

        <DataTable columns={columns} data={transfers}
        keyExtractor={(transfer) => transfer.id} />
      </div>
    </Layout>
  );
}
