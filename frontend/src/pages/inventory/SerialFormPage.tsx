import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import Layout from '../../components/Layout';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import api, { getErrorMessage } from '../../lib/api';

interface SerialForm {
  productId: string;
  serialNumber: string;
  purchaseDate?: string;
  warrantyExpiryDate?: string;
  warehouseId?: string;
  notes?: string;
}

interface ProductOption {
  id: string;
  name: string;
  sku: string;
}

export default function SerialFormPage() {
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<ProductOption[]>([]);
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
    } catch {
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
    } catch {
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
    } catch (err) {
      showError(getErrorMessage(err, `Failed to ${isEdit ? 'update' : 'create'} serial number`));
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
                {isEdit ? 'Edit Serial Number' : 'New Serial Number'}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {isEdit ? 'Update serial number tracking information' : 'Register a new product serial number'}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/inventory/serials')}
            >
              Back to Serial Numbers
            </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="serial-product" className="block text-sm font-medium mb-1">Product *</label>
            <select
              id="serial-product"
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
            <label htmlFor="serial-number" className="block text-sm font-medium mb-1">Serial Number *</label>
            <input
              id="serial-number"
              {...register('serialNumber', { required: 'Serial number is required' })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="e.g., SN-2025-001"
            />
            {errors.serialNumber && (
              <p className="text-red-500 text-sm mt-1">{errors.serialNumber.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="serial-purchase-date" className="block text-sm font-medium mb-1">Purchase Date</label>
            <input
              id="serial-purchase-date"
              type="date"
              {...register('purchaseDate')}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label htmlFor="serial-warranty-expiry-date" className="block text-sm font-medium mb-1">Warranty Expiry Date</label>
            <input
              id="serial-warranty-expiry-date"
              type="date"
              {...register('warrantyExpiryDate')}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label htmlFor="serial-notes" className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              id="serial-notes"
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
