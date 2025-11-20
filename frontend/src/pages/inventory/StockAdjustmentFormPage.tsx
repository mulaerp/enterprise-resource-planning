import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import Layout from '../../components/Layout';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import api from '../../lib/api';

interface AdjustmentForm {
  productId: string;
  warehouseId: string;
  adjustmentType: string;
  quantityAdjusted: number;
  reason: string;
  notes?: string;
  adjustmentDate: string;
}

export default function StockAdjustmentFormPage() {
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);

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
      const response = await api.get('/products');
      setProducts(response.data.content || response.data);
    } catch (err) {
      showError('Failed to fetch products');
    }
  };

  const fetchWarehouses = async () => {
    try {
      // For now, use a default warehouse
      setWarehouses([{ id: '00000000-0000-0000-0000-000000000001', name: 'Main Warehouse' }]);
    } catch (err) {
      console.error('Failed to fetch warehouses');
    }
  };

  const onSubmit = async (data: AdjustmentForm) => {
    setLoading(true);
    try {
      await api.post('/inventory/adjustments', data);
      success('Stock adjustment created successfully');
      navigate('/inventory/adjustments');
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to create adjustment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 max-w-2xl">
        {/* Gradient Banner Header */}
        <div className="bg-gradient-to-r from-orange-600 via-red-600 to-pink-600 rounded-xl shadow-lg p-8 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                New Stock Adjustment
              </h1>
              <p className="text-orange-100">
                Adjust inventory quantities for products
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/inventory/adjustments')}
              className="bg-white/20 hover:bg-white/30 text-white border-white/30"
            >
              Back to Adjustments
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Product *</label>
            <select
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
            <label className="block text-sm font-medium mb-1">Warehouse *</label>
            <select
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
            <label className="block text-sm font-medium mb-1">Adjustment Type *</label>
            <select
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
            <label className="block text-sm font-medium mb-1">Quantity *</label>
            <input
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
            <label className="block text-sm font-medium mb-1">Reason *</label>
            <input
              {...register('reason', { required: 'Reason is required' })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Reason for adjustment"
            />
            {errors.reason && (
              <p className="text-red-500 text-sm mt-1">{errors.reason.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Date *</label>
            <input
              type="date"
              {...register('adjustmentDate', { required: 'Date is required' })}
              className="w-full px-3 py-2 border rounded-lg"
            />
            {errors.adjustmentDate && (
              <p className="text-red-500 text-sm mt-1">{errors.adjustmentDate.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
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
