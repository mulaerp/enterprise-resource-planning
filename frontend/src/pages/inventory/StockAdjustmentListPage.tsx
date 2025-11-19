import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import Layout from '../../components/Layout';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { toast } from '../../components/ui/Toast';
import api from '../../lib/api';

interface StockAdjustment {
  id: string;
  adjustmentNumber: string;
  productName: string;
  adjustmentType: string;
  quantityBefore: number;
  quantityAdjusted: number;
  quantityAfter: number;
  reason: string;
  adjustmentDate: string;
}

export default function StockAdjustmentListPage() {
  const navigate = useNavigate();
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdjustments();
  }, []);

  const fetchAdjustments = async () => {
    try {
      const response = await api.get('/inventory/adjustments');
      setAdjustments(response.data);
    } catch (error) {
      toast.error('Failed to fetch stock adjustments');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this adjustment?')) return;

    try {
      await api.delete(`/inventory/adjustments/${id}`);
      toast.success('Adjustment deleted successfully');
      fetchAdjustments();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete adjustment');
    }
  };

  const columns = [
    { key: 'adjustmentNumber', label: 'Adjustment #' },
    { key: 'productName', label: 'Product' },
    { key: 'adjustmentType', label: 'Type' },
    { key: 'quantityBefore', label: 'Before' },
    { key: 'quantityAdjusted', label: 'Adjusted' },
    { key: 'quantityAfter', label: 'After' },
    { key: 'reason', label: 'Reason' },
    {
      key: 'adjustmentDate',
      label: 'Date',
      render: (adj: StockAdjustment) => new Date(adj.adjustmentDate).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (adj: StockAdjustment) => (
        <button
          onClick={() => handleDelete(adj.id)}
          className="text-red-600 hover:text-red-800"
        >
          <Trash2 className="w-4 h-4" />
        </button>
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
          <h1 className="text-2xl font-bold">Stock Adjustments</h1>
          <Button onClick={() => navigate('/inventory/adjustments/new')}>
            <Plus className="w-4 h-4 mr-2" />
            New Adjustment
          </Button>
        </div>

        <DataTable columns={columns} data={adjustments} />
      </div>
    </Layout>
  );
}
