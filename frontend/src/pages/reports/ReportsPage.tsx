import { Link } from 'react-router-dom';
import { BarChart3, Package, DollarSign, FileText } from 'lucide-react';
import Layout from '../../components/Layout';
import { Card } from '../../components/ui/Card';

export default function ReportsPage() {
  const reports = [
    {
      title: 'Sales Report',
      description: 'Analyze sales performance by product, customer, and time period',
      icon: DollarSign,
      path: '/reports/sales',
      gradient: 'from-green-500 to-emerald-500',
    },
    {
      title: 'Inventory Report',
      description: 'View stock levels, valuations, and inventory status',
      icon: Package,
      path: '/reports/inventory',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      title: 'Financial Report',
      description: 'Coming soon - P&L, balance sheet, and financial metrics',
      icon: BarChart3,
      path: '#',
      gradient: 'from-purple-500 to-pink-500',
      disabled: true,
    },
    {
      title: 'Custom Reports',
      description: 'Coming soon - Build your own custom reports',
      icon: FileText,
      path: '#',
      gradient: 'from-orange-500 to-red-500',
      disabled: true,
    },
  ];

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
            Reports & Analytics
          </h1>
          <p className="text-gray-600 mt-2">Generate insights from your business data</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reports.map((report) => {
            const Icon = report.icon;
            const content = (
              <Card className={`p-6 h-full ${report.disabled ? 'opacity-60' : 'hover:shadow-xl transition-all duration-200 hover:-translate-y-1 cursor-pointer'}`}>
                <div className="flex items-start gap-4">
                  <div className={`bg-gradient-to-br ${report.gradient} p-4 rounded-xl shadow-lg`}>
                    <Icon className="text-white" size={32} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-2">{report.title}</h3>
                    <p className="text-gray-600 text-sm">{report.description}</p>
                  </div>
                </div>
              </Card>
            );

            return report.disabled ? (
              <div key={report.title}>{content}</div>
            ) : (
              <Link key={report.title} to={report.path}>
                {content}
              </Link>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
