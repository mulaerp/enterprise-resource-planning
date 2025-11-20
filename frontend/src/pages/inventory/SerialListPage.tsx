import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, AlertTriangle } from 'lucide-react';
import Layout from '../../components/Layout';
import DataTable from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import api from '../../lib/api';

interface ProductSerial {
  id: string;
  productName: string;
  productSku: string;
  serialNumber: string;
  purchaseDate: string | null;
  warrantyExpiryDate: string | null;
  status: 'IN_STOCK' | 'SOLD' | 'RETURNED' | 'DEFECTIVE' | 'WARRANTY_CLAIM';
  customerName: string | null;
}

export default function SerialListPage() {
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const [serials, setSerials] = useState<ProductSerial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSerials();
  }, []);

  const fetchSerials = async () => {
    try {
      const response = await api.get('/serials');
      setSerials(response.data);
    } catch (err) {
      showError('Failed to fetch serial numbers');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this serial number?')) return;

    try {
      await api.delete(`/serials/${id}`);
      success('Serial number deleted successfully');
      fetchSerials();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to delete serial number');
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      IN_STOCK: 'bg-green-100 text-green-800',
      SOLD: 'bg-blue-100 text-blue-800',
      RETURNED: 'bg-yellow-100 text-yellow-800',
      DEFECTIVE: 'bg-red-100 text-red-800',
      WARRANTY_CLAIM: 'bg-purple-100 text-purple-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status as keyof typeof colors]}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  const isWarrantyExpiringSoon = (warrantyDate: string | null) => {
    if (!warrantyDate) return false;
    const daysUntilExpiry = Math.floor(
      (new Date(warrantyDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilExpiry <= 30 && daysUntilExpiry >= 0;
  };

  const columns = [
    { key: 'serialNumber', header: 'Serial Number' },
    { key: 'productSku', header: 'SKU' },
    { key: 'productName', header: 'Product' },
    {
      key: 'purchaseDate',
      header: 'Purchase Date',
      render: (serial: ProductSerial) =>
        serial.purchaseDate ? new Date(serial.purchaseDate).toLocaleDateString() : '-',
    },
    {
      key: 'warrantyExpiryDate',
      header: 'Warranty Expiry',
      render: (serial: ProductSerial) => (
        <div className="flex items-center gap-2">
          {serial.warrantyExpiryDate ? new Date(serial.warrantyExpiryDate).toLocaleDateString() : '-'}
          {isWarrantyExpiringSoon(serial.warrantyExpiryDate) && (
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (serial: ProductSerial) => getStatusBadge(serial.status),
    },
    { 
      key: 'customerName', 
      header: 'Customer',
      render: (serial: ProductSerial) => serial.customerName || '-',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (serial: ProductSerial) => (
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/inventory/serials/${serial.id}/edit`)}
            className="text-blue-600 hover:text-blue-800"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(serial.id)}
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
        {/* Gradient Banner Header */}
        <div className="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 rounded-xl shadow-lg p-8 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Serial Number Tracking</h1>
              <p className="text-sky-100">Track individual product serial numbers and warranties</p>
            </div>
            <Button 
              onClick={() => navigate('/inventory/serials/new')}
              className="bg-white/20 hover:bg-white/30 text-white border-white/30"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Serial Number
            </Button>
          </div>
        </div>

        <DataTable columns={columns} data={serials}
        keyExtractor={(serial) => serial.id} />
      </div>
    </Layout>
  );
}
