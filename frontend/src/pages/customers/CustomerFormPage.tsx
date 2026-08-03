import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api, { getErrorMessage } from '../../lib/api';
import Layout from '../../components/Layout';
import { useToast } from '../../components/ui/Toast';

interface CustomerForm {
  name: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
  creditLimit: string;
  status: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function CustomerFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CustomerForm>({
    name: '',
    email: '',
    phone: '',
    address: '',
    taxId: '',
    creditLimit: '0',
    status: 'ACTIVE',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CustomerForm, string>>>({});

  useEffect(() => {
    if (isEdit) {
      fetchCustomer();
    }
  }, [id]);

  const fetchCustomer = async () => {
    try {
      const response = await api.get(`/customers/${id}`);
      const customer = response.data;
      setFormData({
        name: customer.name,
        email: customer.email || '',
        phone: customer.phone || '',
        address: customer.address || '',
        taxId: customer.taxId || '',
        creditLimit: customer.creditLimit.toString(),
        status: customer.status,
      });
    } catch (error) {
      console.error('Failed to fetch customer:', error);
      showError('Failed to load customer');
    }
  };

  const validate = (): boolean => {
    const nextErrors: Partial<Record<keyof CustomerForm, string>> = {};
    if (!formData.name.trim()) {
      nextErrors.name = 'Name is required';
    }
    if (formData.email.trim() && !EMAIL_RE.test(formData.email.trim())) {
      nextErrors.email = 'Invalid email format';
    }
    if (formData.creditLimit.trim() === '' || Number.isNaN(parseFloat(formData.creditLimit))) {
      nextErrors.creditLimit = 'Credit limit is required';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setLoading(true);

    try {
      const payload = {
        ...formData,
        creditLimit: parseFloat(formData.creditLimit),
      };

      if (isEdit) {
        await api.put(`/customers/${id}`, payload);
        success('Customer updated successfully');
      } else {
        await api.post('/customers', payload);
        success('Customer created successfully');
      }

      navigate('/customers');
    } catch (error) {
      console.error('Failed to save customer:', error);
      showError(getErrorMessage(error, 'Failed to save customer'));
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
            onClick={() => navigate('/customers')}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Customers
          </button>
          <h1 className="text-2xl font-semibold text-slate-900">
            {isEdit ? 'Edit Customer' : 'Add New Customer'}
          </h1>
        </div>

        <form onSubmit={handleSubmit} noValidate className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 max-w-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label htmlFor="customer-name" className="block text-sm font-medium text-slate-700 mb-2">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                id="customer-name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>

            <div>
              <label htmlFor="customer-email" className="block text-sm font-medium text-slate-700 mb-2">
                Email
              </label>
              <input
                id="customer-email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
            </div>

            <div>
              <label htmlFor="customer-phone" className="block text-sm font-medium text-slate-700 mb-2">
                Phone
              </label>
              <input
                id="customer-phone"
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="customer-address" className="block text-sm font-medium text-slate-700 mb-2">
                Address
              </label>
              <textarea
                id="customer-address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label htmlFor="customer-tax-id" className="block text-sm font-medium text-slate-700 mb-2">
                Tax ID
              </label>
              <input
                id="customer-tax-id"
                type="text"
                name="taxId"
                value={formData.taxId}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label htmlFor="customer-credit-limit" className="block text-sm font-medium text-slate-700 mb-2">
                Credit Limit <span className="text-red-500">*</span>
              </label>
              <input
                id="customer-credit-limit"
                type="number"
                name="creditLimit"
                value={formData.creditLimit}
                onChange={handleChange}
                step="0.01"
                min="0"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              {errors.creditLimit && <p className="text-red-500 text-sm mt-1">{errors.creditLimit}</p>}
            </div>

            <div>
              <label htmlFor="customer-status" className="block text-sm font-medium text-slate-700 mb-2">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                id="customer-status"
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
              {loading ? 'Saving...' : isEdit ? 'Update Customer' : 'Create Customer'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/customers')}
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
