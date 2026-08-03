import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import Layout from '../../components/Layout';
import DataTable from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import api, { getErrorMessage } from '../../lib/api';

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
  const { success, error: showError } = useToast();
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdjustments();
  }, []);

  const fetchAdjustments = async () => {
    try {
      const response = await api.get('/inventory/adjustments');
      setAdjustments(response.data);
    } catch {
      showError('Failed to fetch stock adjustments');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this adjustment?')) return;

    try {
      await api.delete(`/inventory/adjustments/${id}`);
      success('Adjustment deleted successfully');
      fetchAdjustments();
    } catch (err) {
      showError(getErrorMessage(err, 'Failed to delete adjustment'));
    }
  };

  const columns = [
    { key: 'adjustmentNumber', header: 'Adjustment #' },
    { key: 'productName', header: 'Product' },
    { key: 'adjustmentType', header: 'Type' },
    { key: 'quantityBefore', header: 'Before' },
    { key: 'quantityAdjusted', header: 'Adjusted' },
    { key: 'quantityAfter', header: 'After' },
    { key: 'reason', header: 'Reason' },
    {
      key: 'adjustmentDate',
      header: 'Date',
      render: (adj: StockAdjustment) => new Date(adj.adjustmentDate).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: 'Actions',
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
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Stock Adjustments</h1>
              <p className="text-sm text-slate-500 mt-1">Track inventory quantity adjustments and corrections</p>
            </div>
            <Button
              onClick={() => navigate('/inventory/adjustments/new')}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Adjustment
            </Button>
        </div>

        <DataTable columns={columns} data={adjustments}
        keyExtractor={(adjustment) => adjustment.id} />
      </div>
    </Layout>
  );
}
