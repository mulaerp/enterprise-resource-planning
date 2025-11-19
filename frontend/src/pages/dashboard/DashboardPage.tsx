import { useAuth } from '../../contexts/AuthContext';
import { Navigate, Link } from 'react-router-dom';
import { Package, Users, ShoppingCart, FileText, AlertCircle } from 'lucide-react';
import Layout from '../../components/Layout';

export default function DashboardPage() {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const stats = [
    { label: 'Total Products', value: '0', icon: Package, color: 'bg-blue-500' },
    { label: 'Total Customers', value: '0', icon: Users, color: 'bg-green-500' },
    { label: 'Sales Orders', value: '0', icon: ShoppingCart, color: 'bg-purple-500' },
    { label: 'Invoices', value: '0', icon: FileText, color: 'bg-orange-500' },
  ];

  const quickActions = [
    { label: 'Add Product', path: '/products/new', icon: Package },
    { label: 'View Products', path: '/products', icon: Package },
    { label: 'Add Customer', path: '/customers/new', icon: Users },
    { label: 'Create Invoice', path: '/invoices/new', icon: FileText },
  ];

  return (
    <Layout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-600">Welcome back, {user?.fullName}!</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm">{stat.label}</p>
                    <p className="text-3xl font-bold mt-2">{stat.value}</p>
                  </div>
                  <div className={`${stat.color} p-3 rounded-lg`}>
                    <Icon className="text-white" size={24} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.path}
                  to={action.path}
                  className="flex flex-col items-center justify-center p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <Icon size={32} className="text-gray-600 mb-2" />
                  <span className="text-sm font-medium text-center">{action.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Alerts */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <AlertCircle className="text-yellow-500" />
            Alerts & Notifications
          </h2>
          <div className="text-gray-500 text-center py-8">
            No alerts at the moment
          </div>
        </div>
      </div>
    </Layout>
  );
}
