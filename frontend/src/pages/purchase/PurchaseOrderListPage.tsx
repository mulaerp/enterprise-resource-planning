import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Edit, Trash2, Eye } from 'lucide-react';
import Layout from '../../components/Layout';
import DataTable from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { api } from '../../lib/api';
import { useToast } from '../../components/ui/Toast';

interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierName: string;
  orderDate: string;
  expectedDate: string;
  status: string;
  total: number;
}

export default function PurchaseOrderListPage() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { showToast } = useToast();

  useEffect(() => {
    fetchPurchaseOrders();
  }, []);

  const fetchPurchaseOrders = async () => {
    try {
      setLoading(true);
      const response = await api.get('/purchase-orders');
      setPurchaseOrders(response.data.content || []);
    } catch (error) {
      showToast('error', 'Failed to fetch purchase orders');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchPurchaseOrders();
      return;
    }

    try {
      const response = await api.get(`/purchase-orders/search?query=${searchQuery}`);
      setPurchaseOrders(response.data.content || []);
    } catch (error) {
      showToast('error', 'Search failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this purchase order?')) return;

    try {
      await api.delete(`/purchase-orders/${id}`);
      showToast('success', 'Purchase order deleted successfully');
      fetchPurchaseOrders();
    } catch (error: any) {
      showToast('error', error.response?.data?.message || 'Failed to delete purchase order');
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
      DRAFT: 'default',
      SENT: 'warning',
      RECEIVED: 'success',
      CANCELLED: 'danger',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  const columns = [
    { key: 'poNumber', header: 'PO Number' },
    { key: 'supplierName', header: 'Supplier' },
    { key: 'orderDate', header: 'Order Date', render: (row: PurchaseOrder) => new Date(row.orderDate).toLocaleDateString() },
    { key: 'expectedDate', header: 'Expected Date', render: (row: PurchaseOrder) => row.expectedDate ? new Date(row.expectedDate).toLocaleDateString() : '-' },
    { key: 'status', header: 'Status', render: (row: PurchaseOrder) => getStatusBadge(row.status) },
    { key: 'total', header: 'Total', render: (row: PurchaseOrder) => `$${row.total.toFixed(2)}` },
    {
      key: 'actions',
      header: 'Actions',
      render: (row: PurchaseOrder) => (
        <div className="flex gap-2">
          <Link to={`/purchase-orders/${row.id}`}>
            <Button variant="ghost" size="sm">
              <Eye className="h-4 w-4" />
            </Button>
          </Link>
          {row.status === 'DRAFT' && (
            <>
              <Link to={`/purchase-orders/${row.id}/edit`}>
                <Button variant="ghost" size="sm">
                  <Edit className="h-4 w-4" />
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(row.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Purchase Orders</h1>
          <Link to="/purchase-orders/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Purchase Order
            </Button>
          </Link>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search purchase orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <Button onClick={handleSearch}>
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
        </div>

        <DataTable
          columns={columns}
          data={purchaseOrders}
          loading={loading}
          keyExtractor={(po) => po.id}
        />
      </div>
    </Layout>
  );
}
