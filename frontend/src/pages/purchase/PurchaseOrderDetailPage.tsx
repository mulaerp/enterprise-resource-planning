import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Edit, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { api } from '../../lib/api';
import { useToast } from '../../components/ui/Toast';

export default function PurchaseOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [po, setPo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPurchaseOrder();
  }, [id]);

  const fetchPurchaseOrder = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/purchase-orders/${id}`);
      setPo(response.data);
    } catch (error) {
      showToast('error', 'Failed to fetch purchase order');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    try {
      await api.patch(`/purchase-orders/${id}/status?status=${status}`);
      showToast('success', 'Status updated successfully');
      fetchPurchaseOrder();
    } catch (error: any) {
      showToast('error', error.response?.data?.message || 'Failed to update status');
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!po) {
    return <div>Purchase order not found</div>;
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
      DRAFT: 'default',
      SENT: 'warning',
      RECEIVED: 'success',
      CANCELLED: 'danger',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/purchase-orders')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold">Purchase Order {po.poNumber}</h1>
        {getStatusBadge(po.status)}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Order Information</h2>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm text-gray-500">PO Number</dt>
              <dd className="font-medium">{po.poNumber}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Supplier</dt>
              <dd className="font-medium">{po.supplierName}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Order Date</dt>
              <dd className="font-medium">{new Date(po.orderDate).toLocaleDateString()}</dd>
            </div>
            {po.expectedDate && (
              <div>
                <dt className="text-sm text-gray-500">Expected Date</dt>
                <dd className="font-medium">{new Date(po.expectedDate).toLocaleDateString()}</dd>
              </div>
            )}
            <div>
              <dt className="text-sm text-gray-500">Status</dt>
              <dd className="font-medium">{po.status}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Actions</h2>
          <div className="space-y-2">
            {po.status === 'DRAFT' && (
              <>
                <Link to={`/purchase-orders/${id}/edit`} className="block">
                  <Button className="w-full">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Purchase Order
                  </Button>
                </Link>
                <Button
                  className="w-full"
                  variant="ghost"
                  onClick={() => handleStatusChange('SENT')}
                >
                  Mark as Sent
                </Button>
              </>
            )}
            {po.status === 'SENT' && (
              <Button
                className="w-full"
                onClick={() => handleStatusChange('RECEIVED')}
              >
                Mark as Received
              </Button>
            )}
            {po.status !== 'CANCELLED' && po.status !== 'RECEIVED' && (
              <Button
                className="w-full"
                variant="ghost"
                onClick={() => handleStatusChange('CANCELLED')}
              >
                Cancel Order
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Items</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Product</th>
                <th className="text-right py-2">Quantity</th>
                <th className="text-right py-2">Unit Price</th>
                <th className="text-right py-2">Tax Rate</th>
                <th className="text-right py-2">Total</th>
                <th className="text-right py-2">Received</th>
              </tr>
            </thead>
            <tbody>
              {po.items.map((item: any) => (
                <tr key={item.id} className="border-b">
                  <td className="py-2">
                    <div>
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-sm text-gray-500">{item.productSku}</p>
                    </div>
                  </td>
                  <td className="text-right py-2">{item.quantity}</td>
                  <td className="text-right py-2">${item.unitPrice.toFixed(2)}</td>
                  <td className="text-right py-2">{item.taxRate}%</td>
                  <td className="text-right py-2">${item.total.toFixed(2)}</td>
                  <td className="text-right py-2">{item.receivedQuantity || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>${po.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax:</span>
              <span>${po.tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t pt-2">
              <span>Total:</span>
              <span>${po.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {po.notes && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Notes</h2>
          <p className="text-gray-700">{po.notes}</p>
        </div>
      )}
    </div>
  );
}
