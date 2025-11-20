import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { api } from '../../lib/api';
import { useToast } from '../../components/ui/Toast';
import Layout from '../../components/Layout';

interface PaymentForm {
  invoiceId: string;
  paymentDate: string;
  amount: number;
  method: string;
  reference: string;
  notes: string;
}

export default function PaymentFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<PaymentForm>({
    defaultValues: {
      invoiceId: searchParams.get('invoiceId') || '',
      paymentDate: new Date().toISOString().split('T')[0],
      amount: 0,
      method: 'CASH',
    },
  });

  const invoiceId = watch('invoiceId');

  useEffect(() => {
    fetchInvoices();
  }, []);

  useEffect(() => {
    if (invoiceId) {
      const invoice = invoices.find(inv => inv.id === invoiceId);
      setSelectedInvoice(invoice);
      if (invoice) {
        setValue('amount', invoice.balanceDue);
      }
    }
  }, [invoiceId, invoices]);

  const fetchInvoices = async () => {
    try {
      const response = await api.get('/invoices');
      const unpaidInvoices = (response.data.content || []).filter(
        (inv: any) => inv.balanceDue > 0 && inv.status !== 'CANCELLED'
      );
      setInvoices(unpaidInvoices);
    } catch (error) {
      showToast('error', 'Failed to fetch invoices');
    }
  };

  const onSubmit = async (data: PaymentForm) => {
    try {
      setLoading(true);
      await api.post('/payments', data);
      showToast('success', 'Payment recorded successfully');
      navigate('/payments');
    } catch (error: any) {
      showToast('error', error.response?.data?.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 rounded-2xl shadow-xl p-8 text-white">
          <button
            onClick={() => navigate('/payments')}
            className="flex items-center gap-2 text-white/90 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Payments
          </button>
          <h1 className="text-4xl font-bold">Record Payment</h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 space-y-4">
          <h2 className="text-xl font-semibold">Payment Information</h2>

          <div>
            <label className="block text-sm font-medium mb-1">Invoice *</label>
            <Select {...register('invoiceId', { required: 'Invoice is required' })}>
              <option value="">Select invoice</option>
              {invoices.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.invoiceNumber} - {invoice.customerName} (Balance: ${invoice.balanceDue.toFixed(2)})
                </option>
              ))}
            </Select>
            {errors.invoiceId && (
              <p className="text-red-500 text-sm mt-1">{errors.invoiceId.message}</p>
            )}
          </div>

          {selectedInvoice && (
            <div className="bg-blue-50 p-4 rounded-md">
              <p className="text-sm text-gray-700">
                <strong>Invoice Total:</strong> ${selectedInvoice.total.toFixed(2)}
              </p>
              <p className="text-sm text-gray-700">
                <strong>Paid Amount:</strong> ${selectedInvoice.paidAmount.toFixed(2)}
              </p>
              <p className="text-sm text-gray-700">
                <strong>Balance Due:</strong> ${selectedInvoice.balanceDue.toFixed(2)}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Payment Date *</label>
              <Input
                type="date"
                {...register('paymentDate', { required: 'Payment date is required' })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Amount *</label>
              <Input
                type="number"
                step="0.01"
                {...register('amount', { 
                  required: 'Amount is required',
                  valueAsNumber: true,
                  min: { value: 0.01, message: 'Amount must be greater than 0' }
                })}
              />
              {errors.amount && (
                <p className="text-red-500 text-sm mt-1">{errors.amount.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Payment Method *</label>
              <Select {...register('method', { required: 'Payment method is required' })}>
                <option value="CASH">Cash</option>
                <option value="CREDIT_CARD">Credit Card</option>
                <option value="DEBIT_CARD">Debit Card</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CHECK">Check</option>
                <option value="OTHER">Other</option>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Reference</label>
              <Input
                placeholder="Transaction reference"
                {...register('reference')}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              {...register('notes')}
              className="w-full px-3 py-2 border rounded-md"
              rows={3}
            />
          </div>
        </div>

        <div className="flex gap-4">
          <Button type="submit" disabled={loading}>
            {loading ? 'Recording...' : 'Record Payment'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate('/payments')}>
            Cancel
          </Button>
        </div>
        </form>
      </div>
    </Layout>
  );
}
