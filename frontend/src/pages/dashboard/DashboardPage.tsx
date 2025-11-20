import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Navigate, Link } from 'react-router-dom';
import { Package, Users, ShoppingCart, TrendingUp, DollarSign, AlertTriangle, Plus, Eye } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import Layout from '../../components/Layout';
import { Button } from '../../components/ui/Button';
import api from '../../lib/api';

interface DashboardStats {
  totalProducts: number;
  totalCustomers: number;
  totalSuppliers: number;
  totalSalesOrders: number;
  pendingSalesOrders: number;
  confirmedSalesOrders: number;
  totalRevenue: number;
  monthlyRevenue: number;
  lowStockProducts: number;
  outOfStockProducts: number;
}

interface ChartDataPoint {
  label: string;
  value: number;
  count: number;
}

interface SalesChartData {
  dailySales: ChartDataPoint[];
}

export default function DashboardPage() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chartData, setChartData] = useState<SalesChartData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      loadDashboardData();
    }
  }, [isAuthenticated]);

  const loadDashboardData = async () => {
    try {
      const [statsRes, chartRes] = await Promise.all([
        api.get('/analytics/dashboard-stats'),
        api.get('/analytics/sales-chart?days=7')
      ]);
      setStats(statsRes.data);
      setChartData(chartRes.data);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-gray-600 text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const statsData = [
    { 
      label: 'Total Products', 
      value: stats?.totalProducts || 0, 
      icon: Package, 
      gradient: 'from-blue-500 to-cyan-500',
      subtext: stats && stats.lowStockProducts > 0 ? `${stats.lowStockProducts} low stock` : null,
      subtextColor: 'text-orange-600'
    },
    { 
      label: 'Total Customers', 
      value: stats?.totalCustomers || 0, 
      icon: Users, 
      gradient: 'from-green-500 to-emerald-500',
      subtext: `${stats?.totalSuppliers || 0} suppliers`,
      subtextColor: 'text-gray-500'
    },
    { 
      label: 'Sales Orders', 
      value: stats?.totalSalesOrders || 0, 
      icon: ShoppingCart, 
      gradient: 'from-purple-500 to-pink-500',
      subtext: `${stats?.pendingSalesOrders || 0} pending, ${stats?.confirmedSalesOrders || 0} confirmed`,
      subtextColor: 'text-gray-500'
    },
    { 
      label: 'Total Revenue', 
      value: `$${stats?.totalRevenue?.toFixed(2) || '0.00'}`, 
      icon: DollarSign, 
      gradient: 'from-orange-500 to-red-500',
      subtext: `$${stats?.monthlyRevenue?.toFixed(2) || '0.00'} this month`,
      subtextColor: 'text-green-600'
    },
  ];

  const quickActions = [
    { label: 'Add Product', path: '/products/new', icon: Plus, color: 'from-blue-500 to-cyan-500' },
    { label: 'View Products', path: '/products', icon: Eye, color: 'from-indigo-500 to-purple-500' },
    { label: 'Add Customer', path: '/customers/new', icon: Plus, color: 'from-green-500 to-teal-500' },
    { label: 'New Sales Order', path: '/sales-orders/new', icon: Plus, color: 'from-purple-500 to-pink-500' },
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
          {statsData.map((stat) => {
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
                </div>
                <div>
                  <p className="text-gray-500 text-sm font-medium">{stat.label}</p>
                  <p className="text-3xl font-bold mt-1 bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                    {stat.value}
                  </p>
                  {stat.subtext && (
                    <p className={`text-xs mt-2 ${stat.subtextColor}`}>{stat.subtext}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Sales Chart */}
        {chartData && chartData.dailySales.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Sales Overview (Last 7 Days)
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData.dailySales}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#8b5cf6" 
                  strokeWidth={3}
                  name="Revenue ($)"
                  dot={{ fill: '#8b5cf6', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Inventory Alerts */}
        {stats && (stats.lowStockProducts > 0 || stats.outOfStockProducts > 0) && (
          <div className="bg-orange-50 border-2 border-orange-200 rounded-xl shadow-lg p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-orange-900 mb-2">Inventory Alerts</h3>
                <div className="space-y-1 text-sm text-orange-800">
                  {stats.lowStockProducts > 0 && (
                    <p>• {stats.lowStockProducts} product(s) running low on stock</p>
                  )}
                  {stats.outOfStockProducts > 0 && (
                    <p>• {stats.outOfStockProducts} product(s) out of stock</p>
                  )}
                </div>
                <Link to="/products">
                  <Button variant="ghost" size="sm" className="mt-3 border-orange-300 hover:bg-orange-100">
                    View Products
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

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
      </div>
    </Layout>
  );
}
