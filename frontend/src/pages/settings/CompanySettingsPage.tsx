import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { api } from '../../lib/api';
import { useToast } from '../../components/ui/Toast';

interface CompanyForm {
  name: string;
  taxId: string;
  address: string;
  phone: string;
  email: string;
  currency: string;
}

export default function CompanySettingsPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<CompanyForm>({
    defaultValues: {
      currency: 'USD',
    },
  });

  useEffect(() => {
    fetchCompany();
  }, []);

  const fetchCompany = async () => {
    try {
      const response = await api.get('/companies');
      const companies = response.data.content || [];
      if (companies.length > 0) {
        const company = companies[0];
        setCompanyId(company.id);
        setValue('name', company.name);
        setValue('taxId', company.taxId);
        setValue('address', company.address);
        setValue('phone', company.phone);
        setValue('email', company.email);
        setValue('currency', company.currency);
      }
    } catch (error) {
      showToast('Failed to fetch company settings', 'error');
    }
  };

  const onSubmit = async (data: CompanyForm) => {
    try {
      setLoading(true);
      if (companyId) {
        await api.put(`/companies/${companyId}`, data);
        showToast('Company settings updated successfully', 'success');
      } else {
        const response = await api.post('/companies', data);
        setCompanyId(response.data.id);
        showToast('Company settings created successfully', 'success');
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to save company settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Company Settings</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <h2 className="text-xl font-semibold">Company Information</h2>

          <div>
            <label className="block text-sm font-medium mb-1">Company Name *</label>
            <Input
              {...register('name', { required: 'Company name is required' })}
            />
            {errors.name && (
              <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Tax ID</label>
              <Input {...register('taxId')} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Currency</label>
              <Input {...register('currency')} placeholder="USD" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Address</label>
            <textarea
              {...register('address')}
              className="w-full px-3 py-2 border rounded-md"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <Input {...register('phone')} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <Input type="email" {...register('email')} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <h2 className="text-xl font-semibold">System Settings</h2>
          
          <div className="bg-blue-50 p-4 rounded-md">
            <p className="text-sm text-gray-700">
              Additional system settings like email configuration, backup schedules, 
              and integrations can be configured in the application.yml file.
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </form>
    </div>
  );
}
