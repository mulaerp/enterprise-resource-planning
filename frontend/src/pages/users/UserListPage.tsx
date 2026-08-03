import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit, Trash2 } from 'lucide-react';
import Layout from '../../components/Layout';
import DataTable from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { api, getErrorMessage } from '../../lib/api';
import { useToast } from '../../components/ui/Toast';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  createdAt: string;
}

export default function UserListPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users');
      setUsers(response.data.content || []);
    } catch {
      showToast('error', 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      await api.delete(`/users/${id}`);
      showToast('success', 'User deleted successfully');
      fetchUsers();
    } catch (error) {
      showToast('error', getErrorMessage(error, 'Failed to delete user'));
    }
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
      ADMIN: 'danger',
      MANAGER: 'warning',
      ACCOUNTANT: 'info',
      INVENTORY: 'info',
      CASHIER: 'success',
    };
    return <Badge variant={variants[role] || 'default'}>{role}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'success' | 'danger' | 'info' | 'warning'> = {
      ACTIVE: 'success',
      INACTIVE: 'default',
      SUSPENDED: 'danger',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  const columns = [
    { key: 'fullName', header: 'Name' },
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Role', render: (row: User) => getRoleBadge(row.role) },
    { key: 'status', header: 'Status', render: (row: User) => getStatusBadge(row.status) },
    { key: 'createdAt', header: 'Created', render: (row: User) => new Date(row.createdAt).toLocaleDateString() },
    {
      key: 'actions',
      header: 'Actions',
      render: (row: User) => (
        <div className="flex gap-2">
          <Link to={`/users/${row.id}/edit`}>
            <Button variant="ghost" size="sm">
              <Edit className="h-4 w-4" />
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(row.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Layout>
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Users</h1>
            <p className="text-sm text-slate-500 mt-1">Manage user accounts and permissions</p>
          </div>
          <Link to="/users/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New User
            </Button>
          </Link>
      </div>

      <DataTable
        columns={columns}
        data={users}
        keyExtractor={(user) => user.id}
        loading={loading}
      />
    </div>
    </Layout>
  );
}
