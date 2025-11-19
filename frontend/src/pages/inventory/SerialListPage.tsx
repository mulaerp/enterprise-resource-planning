import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, AlertTriangle } from 'lucide-react';
import Layout from '../../components/Layout';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { toast } from '../../components/ui/Toast';
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
  const [serials, setSerials] = useState<ProductSerial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSerials();
  }, []);

  const fetchSerials = async () => {
    try {
      const response = await api.get('/serials');
      setSerials(response.data);
    } catch (error) {
      toast.error('Failed to fetch serial numbers');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this serial number?')) return;

    try {
      await api.delete(`/serials/${id}`);
      toast.success('Serial number deleted successfully');
      fetchSerials();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete serial number');
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
    { key: 'serialNumber', label: 'Serial Number' },
    { key: 'productSku', label: 'SKU' },
    { key: 'productName', label: 'Product' },
    {
      key: 'purchaseDate',
      label: 'Purchase Date',
      render: (serial: ProductSerial) =>
        serial.purchaseDate ? new Date(serial.purchaseDate).toLocaleDateString() : '-',
    },
    {
      key: 'warrantyExpiryDate',
      label: 'Warranty Expiry',
      render: (serial: ProductSerial) => (
        <div className="flex items-center gap-2">
          {serial.warrantyExpiryDate ? new Date(serial.warrantyExpiryDate).toLocaleDateString() : '-'}
          {isWarrantyExpiringSoon(serial.warrantyExpiryDate) && (
            <AlertTriangle className="w-4 h-4 text-yellow-500" title="Warranty expiring soon" />
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (serial: ProductSerial) => getStatusBadge(serial.status),
    },
    { 
      key: 'customerName', 
      label: 'Customer',
      render: (serial: ProductSerial) => serial.customerName || '-',
    },
    {
      key: 'actions',
      label: 'Actions',
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
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Serial Number Tracking</h1>
          <Button onClick={() => navigate('/inventory/serials/new')}>
            <Plus className="w-4 h-4 mr-2" />
            New Serial Number
          </Button>
        </div>

        <DataTable columns={columns} data={serials} />
      </div>
    </Layout>
  );
}
