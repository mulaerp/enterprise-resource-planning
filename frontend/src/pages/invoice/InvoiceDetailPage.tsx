import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Edit, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { api } from '../../lib/api';
import { useToast } from '../../components/ui/Toast';

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/invoices/${id}`);
      setInvoice(response.data);
    } catch (error) {
      showToast('error', 'Failed to fetch invoice');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    try {
      await api.patch(`/invoices/${id}/status?status=${status}`);
      showToast('success', 'Status updated successfully');
      fetchInvoice();
    } catch (error: any) {
      showToast('error', error.response?.data?.message || 'Failed to update status');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!invoice) return <div>Invoice not found</div>;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
      DRAFT: 'default',
      SENT: 'warning',
      PAID: 'success',
      OVERDUE: 'danger',
      CANCELLED: 'danger',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/invoices')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold">Invoice {invoice.invoiceNumber}</h1>
        {getStatusBadge(invoice.status)}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Invoice Information</h2>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm text-gray-500">Invoice Number</dt>
              <dd className="font-medium">{invoice.invoiceNumber}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Customer</dt>
              <dd className="font-medium">{invoice.customerName}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Invoice Date</dt>
              <dd className="font-medium">{new Date(invoice.invoiceDate).toLocaleDateString()}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Due Date</dt>
              <dd className="font-medium">{new Date(invoice.dueDate).toLocaleDateString()}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Status</dt>
              <dd className="font-medium">{invoice.status}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Actions</h2>
          <div className="space-y-2">
            {invoice.status === 'DRAFT' && (
              <>
                <Link to={`/invoices/${id}/edit`} className="block">
                  <Button className="w-full">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Invoice
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
            {invoice.status === 'SENT' && invoice.balanceDue === 0 && (
              <Button
                className="w-full"
                onClick={() => handleStatusChange('PAID')}
              >
                Mark as Paid
              </Button>
            )}
            {invoice.balanceDue > 0 && invoice.status !== 'CANCELLED' && (
              <Link to={`/payments/new?invoiceId=${id}`} className="block">
                <Button className="w-full" variant="ghost">
                  Record Payment
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Line Items</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Description</th>
                <th className="text-right py-2">Quantity</th>
                <th className="text-right py-2">Unit Price</th>
                <th className="text-right py-2">Tax Rate</th>
                <th className="text-right py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item: any) => (
                <tr key={item.id} className="border-b">
                  <td className="py-2">{item.description}</td>
                  <td className="text-right py-2">{item.quantity}</td>
                  <td className="text-right py-2">${item.unitPrice.toFixed(2)}</td>
                  <td className="text-right py-2">{item.taxRate}%</td>
                  <td className="text-right py-2">${item.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>${invoice.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax:</span>
              <span>${invoice.tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t pt-2">
              <span>Total:</span>
              <span>${invoice.total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-green-600">
              <span>Paid:</span>
              <span>${invoice.paidAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-red-600 font-bold">
              <span>Balance Due:</span>
              <span>${invoice.balanceDue.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {invoice.notes && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Notes</h2>
          <p className="text-gray-700">{invoice.notes}</p>
        </div>
      )}
    </div>
  );
}
