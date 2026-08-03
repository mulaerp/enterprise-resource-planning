import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import Layout from '../../components/Layout';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import api, { getErrorMessage } from '../../lib/api';

interface WarehouseForm {
  code: string;
  name: string;
  address?: string;
  active: boolean;
}

export default function WarehouseFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { success, error: showError } = useToast();
  const [loading, setLoading] = useState(false);
  const isEdit = !!id;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<WarehouseForm>({
    defaultValues: {
      active: true,
    },
  });

  useEffect(() => {
    if (isEdit) {
      fetchWarehouse();
    }
  }, [id]);

  const fetchWarehouse = async () => {
    try {
      const response = await api.get(`/warehouses/${id}`);
      reset({
        code: response.data.code,
        name: response.data.name,
        address: response.data.address || '',
        active: response.data.active,
      });
    } catch (err) {
      console.error('Failed to fetch warehouse:', err);
      showError('Failed to load warehouse');
    }
  };

  const onSubmit = async (data: WarehouseForm) => {
    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/warehouses/${id}`, data);
        success('Warehouse updated successfully');
      } else {
        await api.post('/warehouses', data);
        success('Warehouse created successfully');
      }
      navigate('/inventory/warehouses');
    } catch (err) {
      console.error('Failed to save warehouse:', err);
      showError(getErrorMessage(err, 'Failed to save warehouse'));
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
              {isEdit ? 'Edit Warehouse' : 'New Warehouse'}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {isEdit ? 'Update warehouse details' : 'Create a new warehouse location'}
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/inventory/warehouses')}
          >
            Back to Warehouses
          </Button>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-4"
        >
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-slate-700 mb-1">
              Code *
            </label>
            <input
              id="code"
              {...register('code', { required: 'Code is required' })}
              disabled={isEdit}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-600 disabled:bg-slate-100"
              placeholder="e.g., WH-001"
            />
            {errors.code && (
              <p className="text-red-600 text-sm mt-1">{errors.code.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
              Name *
            </label>
            <input
              id="name"
              {...register('name', { required: 'Name is required' })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-600"
              placeholder="Warehouse name"
            />
            {errors.name && (
              <p className="text-red-600 text-sm mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="address" className="block text-sm font-medium text-slate-700 mb-1">
              Address
            </label>
            <textarea
              id="address"
              {...register('address')}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-600"
              placeholder="Warehouse address or location"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="active"
              type="checkbox"
              {...register('active')}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600"
            />
            <label htmlFor="active" className="text-sm font-medium text-slate-700">
              Active
            </label>
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : isEdit ? 'Update Warehouse' : 'Create Warehouse'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/inventory/warehouses')}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
