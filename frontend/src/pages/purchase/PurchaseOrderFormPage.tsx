import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { api } from '../../lib/api';
import { useToast } from '../../components/ui/Toast';
import Layout from '../../components/Layout';

interface PurchaseOrderForm {
  supplierId: string;
  orderDate: string;
  expectedDate: string;
  tax: number;
  notes: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
  }>;
}

export default function PurchaseOrderFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<PurchaseOrderForm>({
    defaultValues: {
      orderDate: new Date().toISOString().split('T')[0],
      tax: 0,
      items: [{ productId: '', quantity: 1, unitPrice: 0, taxRate: 0 }],
    },
  });

  const items = watch('items');

  useEffect(() => {
    fetchSuppliers();
    fetchProducts();
    if (id) fetchPurchaseOrder();
  }, [id]);

  const fetchSuppliers = async () => {
    try {
      const response = await api.get('/suppliers');
      setSuppliers(response.data.content || []);
    } catch (error) {
      showToast('error', 'Failed to fetch suppliers');
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await api.get('/products');
      setProducts(response.data.content || []);
    } catch (error) {
      showToast('error', 'Failed to fetch products');
    }
  };

  const fetchPurchaseOrder = async () => {
    try {
      const response = await api.get(`/purchase-orders/${id}`);
      const po = response.data;
      setValue('supplierId', po.supplierId);
      setValue('orderDate', po.orderDate);
      setValue('expectedDate', po.expectedDate);
      setValue('tax', po.tax);
      setValue('notes', po.notes);
      setValue('items', po.items.map((item: any) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
      })));
    } catch (error) {
      showToast('error', 'Failed to fetch purchase order');
    }
  };

  const addItem = () => {
    setValue('items', [...items, { productId: '', quantity: 1, unitPrice: 0, taxRate: 0 }]);
  };

  const removeItem = (index: number) => {
    setValue('items', items.filter((_, i) => i !== index));
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => {
      const itemTotal = item.quantity * item.unitPrice;
      const taxAmount = itemTotal * (item.taxRate / 100);
      return sum + itemTotal + taxAmount;
    }, 0);
  };

  const onSubmit = async (data: PurchaseOrderForm) => {
    try {
      setLoading(true);
      if (id) {
        await api.put(`/purchase-orders/${id}`, data);
        showToast('success', 'Purchase order updated successfully');
      } else {
        await api.post('/purchase-orders', data);
        showToast('success', 'Purchase order created successfully');
      }
      navigate('/purchase-orders');
    } catch (error: any) {
      showToast('error', error.response?.data?.message || 'Failed to save purchase order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 rounded-2xl shadow-xl p-8 text-white">
          <button
            onClick={() => navigate('/purchase-orders')}
            className="flex items-center gap-2 text-white/90 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Purchase Orders
          </button>
          <h1 className="text-4xl font-bold">
            {id ? 'Edit Purchase Order' : 'New Purchase Order'}
          </h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 space-y-4">
          <h2 className="text-xl font-semibold">Order Information</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Supplier *</label>
              <Select {...register('supplierId', { required: 'Supplier is required' })}>
                <option value="">Select supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </Select>
              {errors.supplierId && (
                <p className="text-red-500 text-sm mt-1">{errors.supplierId.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Order Date *</label>
              <Input
                type="date"
                {...register('orderDate', { required: 'Order date is required' })}
              />
              {errors.orderDate && (
                <p className="text-red-500 text-sm mt-1">{errors.orderDate.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Expected Date</label>
              <Input type="date" {...register('expectedDate')} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Tax Amount</label>
              <Input
                type="number"
                step="0.01"
                {...register('tax', { valueAsNumber: true })}
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

        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Items</h2>
            <Button type="button" onClick={addItem} variant="ghost">
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-4 items-start">
                <div className="col-span-4">
                  <Select
                    {...register(`items.${index}.productId`, { required: true })}
                    onChange={(e) => {
                      const product = products.find(p => p.id === e.target.value);
                      if (product) {
                        setValue(`items.${index}.unitPrice`, product.costPrice || 0);
                      }
                    }}
                  >
                    <option value="">Select product</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} ({product.sku})
                      </option>
                    ))}
                  </Select>
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
                    ${((item.quantity * item.unitPrice) * (1 + (item.taxRate / 100))).toFixed(2)}
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
                  Total: ${calculateSubtotal().toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : id ? 'Update' : 'Create'} Purchase Order
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate('/purchase-orders')}>
            Cancel
          </Button>
        </div>
        </form>
      </div>
    </Layout>
  );
}
