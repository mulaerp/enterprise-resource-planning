import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import Layout from '../../components/Layout';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import api, { getErrorMessage } from '../../lib/api';

interface TransferForm {
  fromWarehouseId: string;
  toWarehouseId: string;
  transferDate: string;
  notes?: string;
  items: {
    productId: string;
    batchId?: string;
    quantity: number;
  }[];
}

interface ProductOption {
  id: string;
  name: string;
  sku: string;
}

interface WarehouseOption {
  id: string;
  name: string;
}

interface TransferItemResponse {
  productId: string;
  batchId?: string;
  quantity: number;
}

export default function StockTransferFormPage() {
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const isEdit = !!id;

  const { register, control, handleSubmit, formState: { errors }, reset } = useForm<TransferForm>({
    defaultValues: {
      transferDate: new Date().toISOString().split('T')[0],
      items: [{ productId: '', quantity: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  useEffect(() => {
    fetchProducts();
    fetchWarehouses();
    if (isEdit) {
      fetchTransfer();
    }
  }, [id]);

  const fetchProducts = async () => {
    try {
      // BUG FIX: see StockAdjustmentFormPage's fetchProducts for the same root cause - GET
      // /products with no size param defaults to the backend's page size, hiding every product
      // past page 0 in a catalogue this large (800+ products).
      const response = await api.get('/products?size=1000&sortBy=name&sortDir=ASC');
      setProducts(response.data.content || response.data);
    } catch {
      showError('Failed to fetch products');
    }
  };

  const fetchWarehouses = async () => {
    try {
      // BUG FIX: this used to hardcode two fixed placeholder warehouses ('Main Warehouse' /
      // 'Secondary Warehouse' at well-known-but-nonexistent ids) - neither actually exists in a
      // normal deployment (see StockAdjustmentFormPage's fetchWarehouses for the same root cause),
      // so every transfer submission 404'd with "Warehouse not found". Fetch the real list instead.
      const response = await api.get('/warehouses', { params: { size: 1000 } });
      setWarehouses(response.data.content ?? []);
    } catch {
      showError('Failed to fetch warehouses');
    }
  };

  const fetchTransfer = async () => {
    try {
      const response = await api.get(`/stock-transfers/${id}`);
      reset({
        fromWarehouseId: response.data.fromWarehouseId,
        toWarehouseId: response.data.toWarehouseId,
        transferDate: response.data.transferDate,
        notes: response.data.notes || '',
        items: response.data.items.map((item: TransferItemResponse) => ({
          productId: item.productId,
          batchId: item.batchId || '',
          quantity: item.quantity,
        })),
      });
    } catch {
      showError('Failed to fetch transfer');
    }
  };

  const onSubmit = async (data: TransferForm) => {
    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/stock-transfers/${id}`, data);
        success('Transfer updated successfully');
      } else {
        await api.post('/stock-transfers', data);
        success('Transfer created successfully');
      }
      navigate('/inventory/transfers');
    } catch (err) {
      showError(getErrorMessage(err, `Failed to ${isEdit ? 'update' : 'create'} transfer`));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 max-w-4xl">
        <h1 className="text-2xl font-bold mb-6">{isEdit ? 'Edit' : 'New'} Stock Transfer</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="transfer-from-warehouse" className="block text-sm font-medium mb-1">From Warehouse *</label>
              <select
                id="transfer-from-warehouse"
                {...register('fromWarehouseId', { required: 'From warehouse is required' })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Select warehouse</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
              {errors.fromWarehouseId && (
                <p className="text-red-500 text-sm mt-1">{errors.fromWarehouseId.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="transfer-to-warehouse" className="block text-sm font-medium mb-1">To Warehouse *</label>
              <select
                id="transfer-to-warehouse"
                {...register('toWarehouseId', { required: 'To warehouse is required' })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Select warehouse</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
              {errors.toWarehouseId && (
                <p className="text-red-500 text-sm mt-1">{errors.toWarehouseId.message}</p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="transfer-date" className="block text-sm font-medium mb-1">Transfer Date *</label>
            <input
              id="transfer-date"
              type="date"
              {...register('transferDate', { required: 'Transfer date is required' })}
              className="w-full px-3 py-2 border rounded-lg"
            />
            {errors.transferDate && (
              <p className="text-red-500 text-sm mt-1">{errors.transferDate.message}</p>
            )}
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium">Items *</label>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => append({ productId: '', quantity: 1 })}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Item
              </Button>
            </div>

            <div className="space-y-2">
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <select
                      {...register(`items.${index}.productId`, { required: 'Product is required' })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="">Select product</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} ({product.sku})
                        </option>
                      ))}
                    </select>
                    {errors.items?.[index]?.productId && (
                      <p className="text-red-500 text-sm mt-1">{errors.items[index]?.productId?.message}</p>
                    )}
                  </div>

                  <div className="w-32">
                    <input
                      type="number"
                      {...register(`items.${index}.quantity`, {
                        required: 'Quantity is required',
                        min: { value: 1, message: 'Min 1' },
                      })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="Qty"
                    />
                    {errors.items?.[index]?.quantity && (
                      <p className="text-red-500 text-sm mt-1">{errors.items[index]?.quantity?.message}</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="p-2 text-red-600 hover:text-red-800"
                    disabled={fields.length === 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="transfer-notes" className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              id="transfer-notes"
              {...register('notes')}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
              placeholder="Additional notes"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/inventory/transfers')}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
