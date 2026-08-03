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
      iconBg: 'bg-green-600',
    },
    {
      title: 'Inventory Report',
      description: 'View stock levels, valuations, and inventory status',
      icon: Package,
      path: '/reports/inventory',
      iconBg: 'bg-blue-600',
    },
    {
      title: 'Financial Report',
      description: 'Profit & loss, balance sheet, and financial metrics',
      icon: BarChart3,
      path: '/accounting/profit-loss',
      iconBg: 'bg-slate-600',
    },
    {
      title: 'Custom Reports',
      description: 'Coming soon - Build your own custom reports',
      icon: FileText,
      path: '#',
      iconBg: 'bg-amber-500',
      disabled: true,
    },
  ];

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Reports & Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">Generate insights from your business data</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reports.map((report) => {
            const Icon = report.icon;
            const content = (
              <Card className={`p-6 h-full ${report.disabled ? 'opacity-60' : 'hover:shadow-xl transition-all duration-200 hover:-translate-y-1 cursor-pointer'}`}>
                <div className="flex items-start gap-4">
                  <div className={`${report.iconBg} p-4 rounded-lg`}>
                    <Icon className="text-white" size={32} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-2">{report.title}</h3>
                    <p className="text-slate-600 text-sm">{report.description}</p>
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
