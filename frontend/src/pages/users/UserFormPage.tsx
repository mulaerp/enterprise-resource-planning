import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Button } from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { api } from '../../lib/api';
import { useToast } from '../../components/ui/Toast';

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
      role: 'USER',
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
    } catch (error) {
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
    } catch (error: any) {
      showToast('error', error.response?.data?.message || 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Gradient Banner Header */}
      <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              {id ? 'Edit User' : 'New User'}
            </h1>
            <p className="text-violet-100">
              {id ? 'Update user information and permissions' : 'Create a new user account'}
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/users')}
            className="bg-white/20 hover:bg-white/30 text-white border-white/30"
          >
            Back to Users
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 space-y-4">
          <h2 className="text-xl font-semibold">User Information</h2>

          <div>
            <label className="block text-sm font-medium mb-1">Email *</label>
            <Input
              type="email"
              {...register('email', { required: 'Email is required' })}
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
            )}
          </div>

          {!id && (
            <div>
              <label className="block text-sm font-medium mb-1">Password *</label>
              <Input
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
            <label className="block text-sm font-medium mb-1">Full Name *</label>
            <Input
              {...register('fullName', { required: 'Full name is required' })}
            />
            {errors.fullName && (
              <p className="text-red-500 text-sm mt-1">{errors.fullName.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Role *</label>
              <Select {...register('role', { required: 'Role is required' })}>
                <option value="USER">User</option>
                <option value="MANAGER">Manager</option>
                <option value="ADMIN">Admin</option>
              </Select>
            </div>

            {id && (
              <div>
                <label className="block text-sm font-medium mb-1">Status *</label>
                <Select {...register('status')}>
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
  );
}
