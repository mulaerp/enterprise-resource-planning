import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import Layout from '../../components/Layout';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import api from '../../lib/api';

interface BatchForm {
  productId: string;
  batchNumber: string;
  manufactureDate?: string;
  expiryDate?: string;
  quantity: number;
  notes?: string;
}

export default function BatchFormPage() {
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const isEdit = !!id;

  const { register, handleSubmit, formState: { errors }, reset } = useForm<BatchForm>();

  useEffect(() => {
    fetchProducts();
    if (isEdit) {
      fetchBatch();
    }
  }, [id]);

  const fetchProducts = async () => {
    try {
      const response = await api.get('/products');
      setProducts(response.data.content || response.data);
    } catch (err) {
      showError('Failed to fetch products');
    }
  };

  const fetchBatch = async () => {
    try {
      const response = await api.get(`/batches/${id}`);
      reset({
        productId: response.data.productId,
        batchNumber: response.data.batchNumber,
        manufactureDate: response.data.manufactureDate || '',
        expiryDate: response.data.expiryDate || '',
        quantity: response.data.quantity,
        notes: response.data.notes || '',
      });
    } catch (err) {
      showError('Failed to fetch batch');
    }
  };

  const onSubmit = async (data: BatchForm) => {
    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/batches/${id}`, data);
        success('Batch updated successfully');
      } else {
        await api.post('/batches', data);
        success('Batch created successfully');
      }
      navigate('/inventory/batches');
    } catch (err: any) {
      showError(err.response?.data?.message || `Failed to ${isEdit ? 'update' : 'create'} batch`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 max-w-2xl">
        {/* Gradient Banner Header */}
        <div className="bg-gradient-to-r from-lime-600 via-green-600 to-emerald-600 rounded-xl shadow-lg p-8 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                {isEdit ? 'Edit Batch' : 'New Batch'}
              </h1>
              <p className="text-lime-100">
                {isEdit ? 'Update batch/lot tracking information' : 'Create a new product batch or lot'}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/inventory/batches')}
              className="bg-white/20 hover:bg-white/30 text-white border-white/30"
            >
              Back to Batches
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Product *</label>
            <select
              {...register('productId', { required: 'Product is required' })}
              className="w-full px-3 py-2 border rounded-lg"
              disabled={isEdit}
            >
              <option value="">Select product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.sku})
                </option>
              ))}
            </select>
            {errors.productId && (
              <p className="text-red-500 text-sm mt-1">{errors.productId.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Batch Number *</label>
            <input
              {...register('batchNumber', { required: 'Batch number is required' })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="e.g., BATCH-2025-001"
            />
            {errors.batchNumber && (
              <p className="text-red-500 text-sm mt-1">{errors.batchNumber.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Manufacture Date</label>
            <input
              type="date"
              {...register('manufactureDate')}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Expiry Date</label>
            <input
              type="date"
              {...register('expiryDate')}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Quantity *</label>
            <input
              type="number"
              {...register('quantity', { 
                required: 'Quantity is required',
                min: { value: 0, message: 'Quantity must be non-negative' }
              })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Initial quantity"
            />
            {errors.quantity && (
              <p className="text-red-500 text-sm mt-1">{errors.quantity.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              {...register('notes')}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
              placeholder="Additional notes about this batch"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/inventory/batches')}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
