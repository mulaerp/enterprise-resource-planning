import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { api, getErrorMessage } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { useToast } from '../../components/ui/Toast';
import Layout from '../../components/Layout';

interface InvoiceForm {
  customerId: string;
  invoiceDate: string;
  dueDate: string;
  tax: number;
  notes: string;
  items: Array<{
    productId?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
  }>;
}

interface CustomerOption {
  id: string;
  name: string;
}

interface InvoiceItemResponse {
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export default function InvoiceFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<InvoiceForm>({
    defaultValues: {
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      tax: 0,
      items: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 0 }],
    },
  });

  const items = watch('items');

  useEffect(() => {
    fetchCustomers();
    if (id) fetchInvoice();
  }, [id]);

  const fetchCustomers = async () => {
    try {
      // BUG FIX: this used to call GET /customers with no params, defaulting to the backend's
      // page size (10) - any environment with more than one page of customers (this dev DB alone
      // has 200+) silently hid every customer past page 0 from this dropdown, with no search/
      // pagination affordance to reach them. Same size=1000 pattern already used by
      // ProductSelector/CustomerSelector/SupplierSelector for exactly this "load the full list
      // for a select" case (see PageSizeCap's Javadoc).
      const response = await api.get('/customers?size=1000&sortBy=name&sortDir=ASC');
      setCustomers(response.data.content || []);
    } catch {
      showToast('error', 'Failed to fetch customers');
    }
  };



  const fetchInvoice = async () => {
    try {
      const response = await api.get(`/invoices/${id}`);
      const invoice = response.data;
      setValue('customerId', invoice.customerId);
      setValue('invoiceDate', invoice.invoiceDate);
      setValue('dueDate', invoice.dueDate);
      setValue('tax', invoice.tax);
      setValue('notes', invoice.notes);
      setValue('items', invoice.items.map((item: InvoiceItemResponse) => ({
        productId: item.productId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
      })));
    } catch {
      showToast('error', 'Failed to fetch invoice');
    }
  };

  const addItem = () => {
    setValue('items', [...items, { description: '', quantity: 1, unitPrice: 0, taxRate: 0 }]);
  };

  const removeItem = (index: number) => {
    setValue('items', items.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => {
      const itemTotal = item.quantity * item.unitPrice;
      const taxAmount = itemTotal * (item.taxRate / 100);
      return sum + itemTotal + taxAmount;
    }, 0);
  };

  const onSubmit = async (data: InvoiceForm) => {
    try {
      setLoading(true);
      if (id) {
        await api.put(`/invoices/${id}`, data);
        showToast('success', 'Invoice updated successfully');
      } else {
        await api.post('/invoices', data);
        showToast('success', 'Invoice created successfully');
      }
      navigate('/invoices');
    } catch (error) {
      showToast('error', getErrorMessage(error, 'Failed to save invoice'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Page Header */}
        <div>
          <button
            onClick={() => navigate('/invoices')}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Invoices
          </button>
          <h1 className="text-2xl font-semibold text-slate-900">
            {id ? 'Edit Invoice' : 'New Invoice'}
          </h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-xl font-semibold">Invoice Information</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="invoice-customer" className="block text-sm font-medium mb-1">Customer *</label>
              <Select id="invoice-customer" {...register('customerId', { required: 'Customer is required' })}>
                <option value="">Select customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </Select>
              {errors.customerId && (
                <p className="text-red-500 text-sm mt-1">{errors.customerId.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="invoice-date" className="block text-sm font-medium mb-1">Invoice Date *</label>
              <Input
                id="invoice-date"
                type="date"
                {...register('invoiceDate', { required: 'Invoice date is required' })}
              />
            </div>

            <div>
              <label htmlFor="invoice-due-date" className="block text-sm font-medium mb-1">Due Date *</label>
              <Input
                id="invoice-due-date"
                type="date"
                {...register('dueDate', { required: 'Due date is required' })}
              />
            </div>

            <div>
              <label htmlFor="invoice-tax" className="block text-sm font-medium mb-1">Tax Amount</label>
              <Input
                id="invoice-tax"
                type="number"
                step="0.01"
                {...register('tax', { valueAsNumber: true })}
              />
            </div>
          </div>

          <div>
            <label htmlFor="invoice-notes" className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              id="invoice-notes"
              {...register('notes')}
              className="w-full px-3 py-2 border rounded-md"
              rows={3}
            />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Line Items</h2>
            <Button type="button" onClick={addItem} variant="ghost">
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-4 items-start">
                <div className="col-span-4">
                  <Input
                    placeholder="Description *"
                    {...register(`items.${index}.description`, { required: true })}
                  />
                </div>

                <div className="col-span-2">
                  <Input
                    type="number"
                    placeholder="Qty"
                    {...register(`items.${index}.quantity`, { required: true, valueAsNumber: true })}
                  />
                </div>

                <div className="col-span-2">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Price"
                    {...register(`items.${index}.unitPrice`, { required: true, valueAsNumber: true })}
                  />
                </div>

                <div className="col-span-2">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Tax %"
                    {...register(`items.${index}.taxRate`, { valueAsNumber: true })}
                  />
                </div>

                <div className="col-span-1">
                  <p className="text-sm font-medium">
                    {formatMoney((item.quantity * item.unitPrice) * (1 + (item.taxRate / 100)))}
                  </p>
                </div>

                <div className="col-span-1">
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-end">
              <div className="text-right">
                <p className="text-lg font-semibold">
                  Total: {formatMoney(calculateTotal())}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : id ? 'Update' : 'Create'} Invoice
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate('/invoices')}>
            Cancel
          </Button>
        </div>
        </form>
      </div>
    </Layout>
  );
}
