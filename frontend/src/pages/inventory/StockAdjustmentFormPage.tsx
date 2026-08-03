import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import Layout from '../../components/Layout';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import api, { getErrorMessage } from '../../lib/api';

interface AdjustmentForm {
  productId: string;
  warehouseId: string;
  adjustmentType: string;
  quantityAdjusted: number;
  reason: string;
  notes?: string;
  adjustmentDate: string;
}

interface ProductOption {
  id: string;
  name: string;
  stockQuantity: number;
}

interface WarehouseOption {
  id: string;
  name: string;
}

export default function StockAdjustmentFormPage() {
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);

  const { register, handleSubmit, formState: { errors } } = useForm<AdjustmentForm>({
    defaultValues: {
      adjustmentDate: new Date().toISOString().split('T')[0],
    },
  });

  useEffect(() => {
    fetchProducts();
    fetchWarehouses();
  }, []);

  const fetchProducts = async () => {
    try {
      // BUG FIX: this used to call GET /products with no params, defaulting to the backend's
      // page size - any environment with more than one page of products (this catalogue alone
      // has 800+) silently hid every product past page 0 from this dropdown, same root cause as
      // the ProductSelector/CustomerSelector components already work around with size=1000.
      const response = await api.get('/products?size=1000&sortBy=name&sortDir=ASC');
      setProducts(response.data.content || response.data);
    } catch {
      showError('Failed to fetch products');
    }
  };

  const fetchWarehouses = async () => {
    try {
      // BUG FIX: this used to hardcode a fixed placeholder warehouse id
      // ('00000000-0000-0000-0000-000000000001'), which only matches a real row when the V16
      // migration's id-less "safety net" INSERT actually fires - it never does in a normal
      // deployment, because V2's earlier `INSERT INTO warehouses (name, location) VALUES
      // ('Main Warehouse', ...)` (no explicit id) always creates that row first with a
      // random UUID, and V16 only backfills its `code` column rather than replacing the id.
      // Submitting that hardcoded id therefore 404'd on every real environment ("Warehouse not
      // found with id: 00000000-0000-0000-0000-000000000001") - fetch the real list instead,
      // same pattern as fetchProducts above.
      const response = await api.get('/warehouses', { params: { size: 1000 } });
      setWarehouses(response.data.content ?? []);
    } catch {
      console.error('Failed to fetch warehouses');
      showError('Failed to fetch warehouses');
    }
  };

  const onSubmit = async (data: AdjustmentForm) => {
    setLoading(true);
    try {
      await api.post('/inventory/adjustments', data);
      success('Stock adjustment created successfully');
      navigate('/inventory/adjustments');
    } catch (err) {
      showError(getErrorMessage(err, 'Failed to create adjustment'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 max-w-2xl">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                New Stock Adjustment
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Adjust inventory quantities for products
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/inventory/adjustments')}
            >
              Back to Adjustments
            </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="adjustment-product" className="block text-sm font-medium mb-1">Product *</label>
            <select
              id="adjustment-product"
              {...register('productId', { required: 'Product is required' })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Select product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} (Current: {product.stockQuantity})
                </option>
              ))}
            </select>
            {errors.productId && (
              <p className="text-red-500 text-sm mt-1">{errors.productId.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="adjustment-warehouse" className="block text-sm font-medium mb-1">Warehouse *</label>
            <select
              id="adjustment-warehouse"
              {...register('warehouseId', { required: 'Warehouse is required' })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Select warehouse</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
            {errors.warehouseId && (
              <p className="text-red-500 text-sm mt-1">{errors.warehouseId.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="adjustment-type" className="block text-sm font-medium mb-1">Adjustment Type *</label>
            <select
              id="adjustment-type"
              {...register('adjustmentType', { required: 'Type is required' })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Select type</option>
              <option value="INCREASE">Increase</option>
              <option value="DECREASE">Decrease</option>
              <option value="RECOUNT">Recount</option>
            </select>
            {errors.adjustmentType && (
              <p className="text-red-500 text-sm mt-1">{errors.adjustmentType.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="adjustment-quantity" className="block text-sm font-medium mb-1">Quantity *</label>
            <input
              id="adjustment-quantity"
              type="number"
              {...register('quantityAdjusted', {
                required: 'Quantity is required',
                min: { value: 1, message: 'Quantity must be at least 1' }
              })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Adjustment quantity"
            />
            {errors.quantityAdjusted && (
              <p className="text-red-500 text-sm mt-1">{errors.quantityAdjusted.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="adjustment-reason" className="block text-sm font-medium mb-1">Reason *</label>
            <input
              id="adjustment-reason"
              {...register('reason', { required: 'Reason is required' })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Reason for adjustment"
            />
            {errors.reason && (
              <p className="text-red-500 text-sm mt-1">{errors.reason.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="adjustment-date" className="block text-sm font-medium mb-1">Date *</label>
            <input
              id="adjustment-date"
              type="date"
              {...register('adjustmentDate', { required: 'Date is required' })}
              className="w-full px-3 py-2 border rounded-lg"
            />
            {errors.adjustmentDate && (
              <p className="text-red-500 text-sm mt-1">{errors.adjustmentDate.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="adjustment-notes" className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              id="adjustment-notes"
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
              onClick={() => navigate('/inventory/adjustments')}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
