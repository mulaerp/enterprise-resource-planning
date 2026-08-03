import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Button } from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { api, getErrorMessage } from '../../lib/api';
import { useToast } from '../../components/ui/Toast';
import Layout from '../../components/Layout';

interface UserForm {
  email: string;
  password?: string;
  fullName: string;
  role: string;
  status?: string;
}

export default function UserFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<UserForm>({
    defaultValues: {
      role: 'CASHIER',
      status: 'ACTIVE',
    },
  });

  useEffect(() => {
    if (id) fetchUser();
  }, [id]);

  const fetchUser = async () => {
    try {
      const response = await api.get(`/users/${id}`);
      const user = response.data;
      setValue('email', user.email);
      setValue('fullName', user.fullName);
      setValue('role', user.role);
      setValue('status', user.status);
    } catch {
      showToast('error', 'Failed to fetch user');
    }
  };

  const onSubmit = async (data: UserForm) => {
    try {
      setLoading(true);
      if (id) {
        await api.put(`/users/${id}`, data);
        showToast('success', 'User updated successfully');
      } else {
        await api.post('/users', data);
        showToast('success', 'User created successfully');
      }
      navigate('/users');
    } catch (error) {
      showToast('error', getErrorMessage(error, 'Failed to save user'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {id ? 'Edit User' : 'New User'}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {id ? 'Update user information and permissions' : 'Create a new user account'}
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/users')}
          >
            Back to Users
          </Button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-xl font-semibold">User Information</h2>

          <div>
            <label htmlFor="user-email" className="block text-sm font-medium mb-1">Email *</label>
            <Input
              id="user-email"
              type="email"
              {...register('email', { required: 'Email is required' })}
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
            )}
          </div>

          {!id && (
            <div>
              <label htmlFor="user-password" className="block text-sm font-medium mb-1">Password *</label>
              <Input
                id="user-password"
                type="password"
                {...register('password', {
                  required: !id ? 'Password is required' : false,
                  minLength: { value: 6, message: 'Password must be at least 6 characters' }
                })}
              />
              {errors.password && (
                <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="user-full-name" className="block text-sm font-medium mb-1">Full Name *</label>
            <Input
              id="user-full-name"
              {...register('fullName', { required: 'Full name is required' })}
            />
            {errors.fullName && (
              <p className="text-red-500 text-sm mt-1">{errors.fullName.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="user-role" className="block text-sm font-medium mb-1">Role *</label>
              <Select id="user-role" {...register('role', { required: 'Role is required' })}>
                <option value="CASHIER">Cashier</option>
                <option value="ACCOUNTANT">Accountant</option>
                <option value="INVENTORY">Inventory</option>
                <option value="MANAGER">Manager</option>
                <option value="ADMIN">Admin</option>
              </Select>
            </div>

            {id && (
              <div>
                <label htmlFor="user-status" className="block text-sm font-medium mb-1">Status *</label>
                <Select id="user-status" {...register('status')}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="SUSPENDED">Suspended</option>
                </Select>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-4">
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : id ? 'Update' : 'Create'} User
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate('/users')}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
    </Layout>
  );
}
