import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import Layout from '../../components/Layout';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import api from '../../lib/api';

interface SerialForm {
  productId: string;
  serialNumber: string;
  purchaseDate?: string;
  warrantyExpiryDate?: string;
  warehouseId?: string;
  notes?: string;
}

export default function SerialFormPage() {
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const isEdit = !!id;

  const { register, handleSubmit, formState: { errors }, reset } = useForm<SerialForm>();

  useEffect(() => {
    fetchProducts();
    if (isEdit) {
      fetchSerial();
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

  const fetchSerial = async () => {
    try {
      const response = await api.get(`/serials/${id}`);
      reset({
        productId: response.data.productId,
        serialNumber: response.data.serialNumber,
        purchaseDate: response.data.purchaseDate || '',
        warrantyExpiryDate: response.data.warrantyExpiryDate || '',
        warehouseId: response.data.warehouseId || '',
        notes: response.data.notes || '',
      });
    } catch (err) {
      showError('Failed to fetch serial number');
    }
  };

  const onSubmit = async (data: SerialForm) => {
    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/serials/${id}`, data);
        success('Serial number updated successfully');
      } else {
        await api.post('/serials', data);
        success('Serial number created successfully');
      }
      navigate('/inventory/serials');
    } catch (err: any) {
      showError(err.response?.data?.message || `Failed to ${isEdit ? 'update' : 'create'} serial number`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 max-w-2xl">
        {/* Gradient Banner Header */}
        <div className="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 rounded-xl shadow-lg p-8 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                {isEdit ? 'Edit Serial Number' : 'New Serial Number'}
              </h1>
              <p className="text-sky-100">
                {isEdit ? 'Update serial number tracking information' : 'Register a new product serial number'}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/inventory/serials')}
              className="bg-white/20 hover:bg-white/30 text-white border-white/30"
            >
              Back to Serial Numbers
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
            <label className="block text-sm font-medium mb-1">Serial Number *</label>
            <input
              {...register('serialNumber', { required: 'Serial number is required' })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="e.g., SN-2025-001"
            />
            {errors.serialNumber && (
              <p className="text-red-500 text-sm mt-1">{errors.serialNumber.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Purchase Date</label>
            <input
              type="date"
              {...register('purchaseDate')}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Warranty Expiry Date</label>
            <input
              type="date"
              {...register('warrantyExpiryDate')}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              {...register('notes')}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
              placeholder="Additional notes about this serial number"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/inventory/serials')}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
