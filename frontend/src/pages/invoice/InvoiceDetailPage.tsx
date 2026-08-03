import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Edit, ArrowLeft, Download } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { api, downloadFile, getErrorMessage } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { useToast } from '../../components/ui/Toast';
import Layout from '../../components/Layout';

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  total: number;
}

interface InvoiceDetail {
  invoiceNumber: string;
  customerName: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
  balanceDue: number;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  paidAmount: number;
  notes?: string;
}

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/invoices/${id}`);
      setInvoice(response.data);
    } catch {
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
    } catch (error) {
      showToast('error', getErrorMessage(error, 'Failed to update status'));
    }
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      await downloadFile(`/invoices/${id}/pdf`, {}, `invoice-${invoice?.invoiceNumber || id}.pdf`);
    } catch {
      showToast('error', 'Failed to download invoice PDF');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <Layout><div>Loading...</div></Layout>;
  if (!invoice) return <Layout><div>Invoice not found</div></Layout>;

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
    <Layout>
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/invoices')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-semibold text-slate-900">Invoice {invoice.invoiceNumber}</h1>
        {getStatusBadge(invoice.status)}
        <div className="ml-auto">
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} loading={downloading} onClick={handleDownloadPdf}>
            Download PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <h2 className="text-xl font-semibold mb-4">Invoice Information</h2>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm text-slate-500">Invoice Number</dt>
              <dd className="font-medium">{invoice.invoiceNumber}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Customer</dt>
              <dd className="font-medium">{invoice.customerName}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Invoice Date</dt>
              <dd className="font-medium">{new Date(invoice.invoiceDate).toLocaleDateString()}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Due Date</dt>
              <dd className="font-medium">{new Date(invoice.dueDate).toLocaleDateString()}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Status</dt>
              <dd className="font-medium">{invoice.status}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
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

      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
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
              {invoice.items.map((item: InvoiceItem) => (
                <tr key={item.id} className="border-b">
                  <td className="py-2">{item.description}</td>
                  <td className="text-right py-2">{item.quantity}</td>
                  <td className="text-right py-2">{formatMoney(item.unitPrice)}</td>
                  <td className="text-right py-2">{item.taxRate}%</td>
                  <td className="text-right py-2">{formatMoney(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{formatMoney(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax:</span>
              <span>{formatMoney(invoice.tax)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t pt-2">
              <span>Total:</span>
              <span>{formatMoney(invoice.total)}</span>
            </div>
            <div className="flex justify-between text-green-600">
              <span>Paid:</span>
              <span>{formatMoney(invoice.paidAmount)}</span>
            </div>
            <div className="flex justify-between text-red-600 font-bold">
              <span>Balance Due:</span>
              <span>{formatMoney(invoice.balanceDue)}</span>
            </div>
          </div>
        </div>
      </div>

      {invoice.notes && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <h2 className="text-xl font-semibold mb-4">Notes</h2>
          <p className="text-slate-700">{invoice.notes}</p>
        </div>
      )}
    </div>
    </Layout>
  );
}
