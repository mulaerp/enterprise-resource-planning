import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import Layout from '../../components/Layout';
import DataTable from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
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
    } catch (err) {
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
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to delete adjustment');
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
        {/* Gradient Banner Header */}
        <div className="bg-gradient-to-r from-orange-600 via-red-600 to-pink-600 rounded-xl shadow-lg p-8 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Stock Adjustments</h1>
              <p className="text-orange-100">Track inventory quantity adjustments and corrections</p>
            </div>
            <Button 
              onClick={() => navigate('/inventory/adjustments/new')}
              className="bg-white/20 hover:bg-white/30 text-white border-white/30"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Adjustment
            </Button>
          </div>
        </div>

        <DataTable columns={columns} data={adjustments}
        keyExtractor={(adjustment) => adjustment.id} />
      </div>
    </Layout>
  );
}
