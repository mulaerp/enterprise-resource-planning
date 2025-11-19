import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, AlertTriangle } from 'lucide-react';
import Layout from '../../components/Layout';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { toast } from '../../components/ui/Toast';
import api from '../../lib/api';

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
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBatches();
  }, []);

  const fetchBatches = async () => {
    try {
      const response = await api.get('/batches');
      setBatches(response.data);
    } catch (error) {
      toast.error('Failed to fetch batches');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this batch?')) return;

    try {
      await api.delete(`/batches/${id}`);
      toast.success('Batch deleted successfully');
      fetchBatches();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete batch');
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      ACTIVE: 'bg-green-100 text-green-800',
      EXPIRED: 'bg-red-100 text-red-800',
      RECALLED: 'bg-yellow-100 text-yellow-800',
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
    { key: 'batchNumber', label: 'Batch Number' },
    { key: 'productSku', label: 'SKU' },
    { key: 'productName', label: 'Product' },
    {
      key: 'manufactureDate',
      label: 'Manufacture Date',
      render: (batch: ProductBatch) =>
        batch.manufactureDate ? new Date(batch.manufactureDate).toLocaleDateString() : '-',
    },
    {
      key: 'expiryDate',
      label: 'Expiry Date',
      render: (batch: ProductBatch) => (
        <div className="flex items-center gap-2">
          {batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString() : '-'}
          {isExpiringSoon(batch.expiryDate) && (
            <AlertTriangle className="w-4 h-4 text-yellow-500" title="Expiring soon" />
          )}
        </div>
      ),
    },
    { key: 'quantity', label: 'Quantity' },
    {
      key: 'status',
      label: 'Status',
      render: (batch: ProductBatch) => getStatusBadge(batch.status),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (batch: ProductBatch) => (
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/inventory/batches/${batch.id}/edit`)}
            className="text-blue-600 hover:text-blue-800"
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
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Batch/Lot Tracking</h1>
          <Button onClick={() => navigate('/inventory/batches/new')}>
            <Plus className="w-4 h-4 mr-2" />
            New Batch
          </Button>
        </div>

        <DataTable columns={columns} data={batches} />
      </div>
    </Layout>
  );
}
