import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api, { getErrorMessage } from '../../lib/api';
import Layout from '../../components/Layout';
import { useToast } from '../../components/ui/Toast';

interface SupplierForm {
  name: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
  paymentTerms: string;
  status: string;
}

export default function SupplierFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<SupplierForm>({
    name: '',
    email: '',
    phone: '',
    address: '',
    taxId: '',
    paymentTerms: '',
    status: 'ACTIVE',
  });

  useEffect(() => {
    if (isEdit) {
      fetchSupplier();
    }
  }, [id]);

  const fetchSupplier = async () => {
    try {
      const response = await api.get(`/suppliers/${id}`);
      const supplier = response.data;
      setFormData({
        name: supplier.name,
        email: supplier.email || '',
        phone: supplier.phone || '',
        address: supplier.address || '',
        taxId: supplier.taxId || '',
        paymentTerms: supplier.paymentTerms || '',
        status: supplier.status,
      });
    } catch (error) {
      console.error('Failed to fetch supplier:', error);
      showError('Failed to load supplier');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isEdit) {
        await api.put(`/suppliers/${id}`, formData);
        success('Supplier updated successfully');
      } else {
        await api.post('/suppliers', formData);
        success('Supplier created successfully');
      }

      navigate('/suppliers');
    } catch (error) {
      console.error('Failed to save supplier:', error);
      showError(getErrorMessage(error, 'Failed to save supplier'));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Page Header */}
        <div>
          <button
            onClick={() => navigate('/suppliers')}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Suppliers
          </button>
          <h1 className="text-2xl font-semibold text-slate-900">
            {isEdit ? 'Edit Supplier' : 'Add New Supplier'}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 max-w-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label htmlFor="supplier-name" className="block text-sm font-medium text-slate-700 mb-2">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                id="supplier-name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label htmlFor="supplier-email" className="block text-sm font-medium text-slate-700 mb-2">
                Email
              </label>
              <input
                id="supplier-email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label htmlFor="supplier-phone" className="block text-sm font-medium text-slate-700 mb-2">
                Phone
              </label>
              <input
                id="supplier-phone"
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="supplier-address" className="block text-sm font-medium text-slate-700 mb-2">
                Address
              </label>
              <textarea
                id="supplier-address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label htmlFor="supplier-tax-id" className="block text-sm font-medium text-slate-700 mb-2">
                Tax ID
              </label>
              <input
                id="supplier-tax-id"
                type="text"
                name="taxId"
                value={formData.taxId}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label htmlFor="supplier-payment-terms" className="block text-sm font-medium text-slate-700 mb-2">
                Payment Terms
              </label>
              <input
                id="supplier-payment-terms"
                type="text"
                name="paymentTerms"
                value={formData.paymentTerms}
                onChange={handleChange}
                placeholder="e.g., Net 30"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label htmlFor="supplier-status" className="block text-sm font-medium text-slate-700 mb-2">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                id="supplier-status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>

          <div className="mt-6 flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="bg-brand-600 text-white px-6 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : isEdit ? 'Update Supplier' : 'Create Supplier'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/suppliers')}
              className="bg-slate-200 text-slate-700 px-6 py-2 rounded-lg hover:bg-slate-300"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
