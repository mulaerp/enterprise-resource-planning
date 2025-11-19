import { useAuth } from '../../contexts/AuthContext';
import { Navigate, Link } from 'react-router-dom';
import { Package, Users, ShoppingCart, TrendingUp, DollarSign, ArrowUpRight } from 'lucide-react';
import Layout from '../../components/Layout';

export default function DashboardPage() {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-gray-600 text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const stats = [
    { 
      label: 'Total Products', 
      value: '0', 
      icon: Package, 
      gradient: 'from-blue-500 to-cyan-500',
      change: '+0%',
      changePositive: true
    },
    { 
      label: 'Total Customers', 
      value: '0', 
      icon: Users, 
      gradient: 'from-green-500 to-emerald-500',
      change: '+0%',
      changePositive: true
    },
    { 
      label: 'Sales Orders', 
      value: '0', 
      icon: ShoppingCart, 
      gradient: 'from-purple-500 to-pink-500',
      change: '+0%',
      changePositive: true
    },
    { 
      label: 'Revenue', 
      value: '$0', 
      icon: DollarSign, 
      gradient: 'from-orange-500 to-red-500',
      change: '+0%',
      changePositive: true
    },
  ];

  const quickActions = [
    { label: 'Add Product', path: '/products/new', icon: Package, color: 'from-blue-500 to-cyan-500' },
    { label: 'View Products', path: '/products', icon: Package, color: 'from-indigo-500 to-purple-500' },
    { label: 'Add Customer', path: '/customers/new', icon: Users, color: 'from-green-500 to-teal-500' },
    { label: 'New Sales Order', path: '/sales-orders/new', icon: ShoppingCart, color: 'from-purple-500 to-pink-500' },
  ];

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl shadow-xl p-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Welcome back, {user?.fullName}! 👋</h1>
              <p className="text-lg text-purple-100">Here's what's happening with your business today</p>
            </div>
            <div className="hidden lg:block">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <TrendingUp size={48} className="text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div 
                key={stat.label} 
                className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-200 hover:-translate-y-1"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`bg-gradient-to-br ${stat.gradient} p-3 rounded-xl shadow-lg`}>
                    <Icon className="text-white" size={24} />
                  </div>
                  <div className={`flex items-center gap-1 text-sm font-semibold ${
                    stat.changePositive ? 'text-green-600' : 'text-red-600'
                  }`}>
                    <ArrowUpRight size={16} />
                    {stat.change}
                  </div>
                </div>
                <div>
                  <p className="text-gray-500 text-sm font-medium">{stat.label}</p>
                  <p className="text-3xl font-bold mt-1 bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                    {stat.value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
          <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.path}
                  to={action.path}
                  className="group relative overflow-hidden rounded-xl border-2 border-gray-200 hover:border-transparent transition-all duration-200 hover:shadow-xl hover:-translate-y-1"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${action.color} opacity-0 group-hover:opacity-100 transition-opacity duration-200`} />
                  <div className="relative flex flex-col items-center justify-center p-6 bg-white group-hover:bg-transparent transition-colors duration-200">
                    <Icon size={32} className="text-gray-600 group-hover:text-white mb-3 transition-colors duration-200" />
                    <span className="text-sm font-semibold text-center text-gray-900 group-hover:text-white transition-colors duration-200">
                      {action.label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Recent Orders
            </h2>
            <div className="text-gray-500 text-center py-8">
              <ShoppingCart size={48} className="mx-auto mb-3 text-gray-300" />
              <p>No recent orders</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-xl font-bold mb-4 bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">
              Low Stock Alerts
            </h2>
            <div className="text-gray-500 text-center py-8">
              <Package size={48} className="mx-auto mb-3 text-gray-300" />
              <p>All products are well stocked</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
