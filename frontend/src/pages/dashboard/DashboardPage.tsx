import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Navigate, Link } from 'react-router-dom';
import { Package, Users, ShoppingCart, TrendingUp, DollarSign, AlertTriangle, Plus, Eye } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import Layout from '../../components/Layout';
import { Button } from '../../components/ui/Button';
import api from '../../lib/api';
import { formatMoney } from '../../lib/money';

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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-600 text-lg">Loading...</div>
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
      iconBg: 'bg-blue-600',
      subtext: stats && stats.lowStockProducts > 0 ? `${stats.lowStockProducts} low stock` : null,
      subtextColor: 'text-amber-600'
    },
    {
      label: 'Total Customers',
      value: stats?.totalCustomers || 0,
      icon: Users,
      iconBg: 'bg-green-600',
      subtext: `${stats?.totalSuppliers || 0} suppliers`,
      subtextColor: 'text-slate-500'
    },
    {
      label: 'Sales Orders',
      value: stats?.totalSalesOrders || 0,
      icon: ShoppingCart,
      iconBg: 'bg-slate-600',
      subtext: `${stats?.pendingSalesOrders || 0} pending, ${stats?.confirmedSalesOrders || 0} confirmed`,
      subtextColor: 'text-slate-500'
    },
    {
      label: 'Total Revenue',
      value: formatMoney(stats?.totalRevenue || 0),
      icon: DollarSign,
      iconBg: 'bg-amber-500',
      subtext: `${formatMoney(stats?.monthlyRevenue || 0)} this month`,
      subtextColor: 'text-green-600'
    },
  ];

  const quickActions = [
    { label: 'Add Product', path: '/products/new', icon: Plus, color: 'bg-blue-600' },
    { label: 'View Products', path: '/products', icon: Eye, color: 'bg-slate-600' },
    { label: 'Add Customer', path: '/customers/new', icon: Plus, color: 'bg-green-600' },
    { label: 'New Sales Order', path: '/sales-orders/new', icon: Plus, color: 'bg-amber-500' },
  ];

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Page Header - every other page in the app leads with a matching <h1>;
            Dashboard was missing one, so screen readers/tests had no way to
            identify the page landmark. aria-label (not visible text) keeps this
            from also matching plain getByText(/dashboard/i) queries, which
            already match the "Dashboard" sidebar nav link elsewhere on screen. */}
        <h1 aria-label="Dashboard" className="sr-only" />

        {/* Welcome Header */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-2 text-slate-900">Welcome back, {user?.fullName}! 👋</h1>
              <p className="text-base text-slate-500">Here's what's happening with your business today</p>
            </div>
            <div className="hidden lg:block">
              <div className="bg-brand-50 rounded-lg p-4">
                <TrendingUp size={48} className="text-brand-600" />
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
                className="bg-white rounded-lg shadow-sm border border-slate-200 p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`${stat.iconBg} p-3 rounded-lg`}>
                    <Icon className="text-white" size={24} />
                  </div>
                </div>
                <div>
                  <p className="text-slate-500 text-sm font-medium">{stat.label}</p>
                  <p className="text-3xl font-bold mt-1 text-slate-900 tabular-nums">
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
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold mb-6 text-slate-900">
              Sales Overview (Last 7 Days)
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData.dailySales}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#2563eb"
                  strokeWidth={2}
                  name="Revenue (RM)"
                  dot={{ fill: '#2563eb', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Inventory Alerts */}
        {stats && (stats.lowStockProducts > 0 || stats.outOfStockProducts > 0) && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg shadow-sm p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-900 mb-2">Inventory Alerts</h3>
                <div className="space-y-1 text-sm text-amber-800">
                  {stats.lowStockProducts > 0 && (
                    <p>• {stats.lowStockProducts} product(s) running low on stock</p>
                  )}
                  {stats.outOfStockProducts > 0 && (
                    <p>• {stats.outOfStockProducts} product(s) out of stock</p>
                  )}
                </div>
                <Link to="/products">
                  <Button variant="secondary" size="sm" className="mt-3">
                    View Products
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold mb-6 text-slate-900">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.path}
                  to={action.path}
                  className="group relative overflow-hidden rounded-lg border border-slate-200 hover:border-transparent transition-colors"
                >
                  <div className={`absolute inset-0 ${action.color} opacity-0 group-hover:opacity-100 transition-opacity duration-200`} />
                  <div className="relative flex flex-col items-center justify-center p-6 bg-white group-hover:bg-transparent transition-colors duration-200">
                    <Icon size={32} className="text-slate-600 group-hover:text-white mb-3 transition-colors duration-200" />
                    <span className="text-sm font-semibold text-center text-slate-900 group-hover:text-white transition-colors duration-200">
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
