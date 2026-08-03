import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit } from 'lucide-react';
import api, { getErrorMessage } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import Layout from '../../components/Layout';

interface SalesOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  orderDate: string;
  deliveryDate?: string;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  notes?: string;
  items: Array<{
    id: string;
    productName: string;
    productSku: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    total: number;
  }>;
}

export default function SalesOrderDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    try {
      const response = await api.get(`/sales-orders/${id}`);
      setOrder(response.data);
    } catch (error) {
      console.error('Failed to fetch order:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await api.patch(`/sales-orders/${id}/status`, { status: newStatus });
      fetchOrder();
    } catch (error) {
      console.error('Failed to update status:', error);
      alert(getErrorMessage(error, 'Failed to update status'));
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-slate-100 text-slate-800',
      CONFIRMED: 'bg-blue-100 text-blue-800',
      DELIVERED: 'bg-green-100 text-green-800',
      INVOICED: 'bg-teal-100 text-teal-800',
      CANCELLED: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-slate-100 text-slate-800';
  };

  const getNextStatuses = (currentStatus: string) => {
    const transitions: Record<string, string[]> = {
      DRAFT: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['DELIVERED', 'CANCELLED'],
      DELIVERED: ['INVOICED'],
      INVOICED: [],
      CANCELLED: [],
    };
    return transitions[currentStatus] || [];
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-8 text-center">Loading...</div>
      </Layout>
    );
  }

  if (!order) {
    return (
      <Layout>
        <div className="p-8 text-center">Order not found</div>
      </Layout>
    );
  }

  return (
    <Layout>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/sales-orders')}
            className="p-2 hover:bg-slate-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{order.orderNumber}</h1>
            <p className="text-sm text-slate-500">Sales Order Details</p>
          </div>
        </div>
        <div className="flex gap-2">
          {order.status === 'DRAFT' && (
            <button
              onClick={() => navigate(`/sales-orders/${id}/edit`)}
              className="inline-flex items-center px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700"
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Order Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500">Customer</p>
                <p className="font-medium">{order.customerName}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Status</p>
                <span
                  className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                    order.status
                  )}`}
                >
                  {order.status}
                </span>
              </div>
              <div>
                <p className="text-sm text-slate-500">Order Date</p>
                <p className="font-medium">
                  {new Date(order.orderDate).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Delivery Date</p>
                <p className="font-medium">
                  {order.deliveryDate
                    ? new Date(order.deliveryDate).toLocaleDateString()
                    : 'Not set'}
                </p>
              </div>
            </div>
            {order.notes && (
              <div className="mt-4">
                <p className="text-sm text-slate-500">Notes</p>
                <p className="mt-1">{order.notes}</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Order Items</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                      Product
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">
                      Quantity
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">
                      Unit Price
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">
                      Discount
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-sm text-slate-500">{item.productSku}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">{item.quantity}</td>
                      <td className="px-4 py-3 text-right">{formatMoney(item.unitPrice)}</td>
                      <td className="px-4 py-3 text-right">{formatMoney(item.discount)}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatMoney(item.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Order Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Subtotal</span>
                <span className="font-medium">{formatMoney(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Tax</span>
                <span className="font-medium">{formatMoney(order.tax)}</span>
              </div>
              <div className="border-t pt-3 flex justify-between">
                <span className="font-semibold">Total</span>
                <span className="text-xl font-bold text-brand-600">
                  {formatMoney(order.total)}
                </span>
              </div>
            </div>
          </div>

          {getNextStatuses(order.status).length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Change Status</h2>
              <div className="space-y-2">
                {getNextStatuses(order.status).map((status) => (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    className="w-full px-4 py-2 text-left border rounded-lg hover:bg-slate-50"
                  >
                    Mark as {status}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </Layout>
  );
}
