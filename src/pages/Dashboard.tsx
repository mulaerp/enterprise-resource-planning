import React from 'react';
import { TrendingUp, TrendingDown, Users, Package, FileText, DollarSign } from 'lucide-react';
import StatCard from '../components/dashboard/StatCard';
import Chart from '../components/dashboard/Chart';
import { useConfig } from '../hooks/useConfig';

export default function Dashboard() {
  const { config } = useConfig();
  const companyName = config?.companyName || 'MulaERP';
  const currency = config?.currency || 'USD';

  const stats = [
    {
      title: 'Total Sales',
      value: `${currency === 'MYR' ? 'RM' : '$'}124,563`,
      change: '+12.5%',
      trend: 'up' as const,
      icon: DollarSign
    },
    {
      title: 'Active Customers',
      value: '1,234',
      change: '+5.2%',
      trend: 'up' as const,
      icon: Users
    },
    {
      title: 'Inventory Items',
      value: '5,678',
      change: '-2.1%',
      trend: 'down' as const,
      icon: Package
    },
    {
      title: 'Pending Invoices',
      value: '89',
      change: '+8.3%',
      trend: 'up' as const,
      icon: FileText
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">{companyName} Dashboard</h1>
        <div className="text-sm text-gray-500">
          Last updated: {new Date().toLocaleString()}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Sales Overview</h2>
          <Chart />
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <div className="space-y-4">
            {[
              { action: 'New order created', customer: 'John Doe', time: '2 minutes ago' },
              { action: 'Invoice sent', customer: 'Jane Smith', time: '15 minutes ago' },
              { action: 'Payment received', customer: 'Bob Johnson', time: '1 hour ago' },
              { action: 'Product updated', customer: 'Alice Brown', time: '2 hours ago' }
            ].map((activity, index) => (
              <div key={index} className="flex items-center justify-between p-3 border-l-4 border-blue-500 bg-blue-50 rounded">
                <div>
                  <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                  <p className="text-xs text-gray-600">{activity.customer}</p>
                </div>
                <span className="text-xs text-gray-500">{activity.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}