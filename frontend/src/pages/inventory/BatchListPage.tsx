import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, AlertTriangle } from 'lucide-react';
import Layout from '../../components/Layout';
import DataTable from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import api, { getErrorMessage } from '../../lib/api';

interface ProductBatch {
  id: string;
  productName: string;
  productSku: string;
  batchNumber: string;
  manufactureDate: string | null;
  expiryDate: string | null;
  quantity: number;
  status: 'ACTIVE' | 'EXPIRED' | 'RECALLED';
}

export default function BatchListPage() {
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBatches();
  }, []);

  const fetchBatches = async () => {
    try {
      const response = await api.get('/batches');
      setBatches(response.data);
    } catch {
      showError('Failed to fetch batches');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this batch?')) return;

    try {
      await api.delete(`/batches/${id}`);
      success('Batch deleted successfully');
      fetchBatches();
    } catch (err) {
      showError(getErrorMessage(err, 'Failed to delete batch'));
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      ACTIVE: 'bg-green-100 text-green-800',
      EXPIRED: 'bg-red-100 text-red-800',
      RECALLED: 'bg-amber-100 text-amber-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status as keyof typeof colors]}`}>
        {status}
      </span>
    );
  };

  const isExpiringSoon = (expiryDate: string | null) => {
    if (!expiryDate) return false;
    const daysUntilExpiry = Math.floor(
      (new Date(expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilExpiry <= 30 && daysUntilExpiry >= 0;
  };

  const columns = [
    { key: 'batchNumber', header: 'Batch Number' },
    { key: 'productSku', header: 'SKU' },
    { key: 'productName', header: 'Product' },
    {
      key: 'manufactureDate',
      header: 'Manufacture Date',
      render: (batch: ProductBatch) =>
        batch.manufactureDate ? new Date(batch.manufactureDate).toLocaleDateString() : '-',
    },
    {
      key: 'expiryDate',
      header: 'Expiry Date',
      render: (batch: ProductBatch) => (
        <div className="flex items-center gap-2">
          {batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString() : '-'}
          {isExpiringSoon(batch.expiryDate) && (
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          )}
        </div>
      ),
    },
    { key: 'quantity', header: 'Quantity' },
    {
      key: 'status',
      header: 'Status',
      render: (batch: ProductBatch) => getStatusBadge(batch.status),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (batch: ProductBatch) => (
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/inventory/batches/${batch.id}/edit`)}
            className="text-brand-600 hover:text-brand-800"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(batch.id)}
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
              <h1 className="text-2xl font-semibold text-slate-900">Batch/Lot Tracking</h1>
              <p className="text-sm text-slate-500 mt-1">Monitor product batches, lots, and expiry dates</p>
            </div>
            <Button
              onClick={() => navigate('/inventory/batches/new')}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Batch
            </Button>
        </div>

        <DataTable columns={columns} data={batches}
        keyExtractor={(batch) => batch.id} />
      </div>
    </Layout>
  );
}
