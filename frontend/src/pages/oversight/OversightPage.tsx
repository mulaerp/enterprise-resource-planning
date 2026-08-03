import { useNavigate } from 'react-router-dom';
import { Search, LineChart, TriangleAlert, Wallet, ShoppingBag, Percent } from 'lucide-react';
import Layout from '../../components/Layout';

export default function OversightPage() {
  const navigate = useNavigate();

  const modules = [
    {
      title: 'Item Trace',
      description: 'Full chronological history for one item - by SKU, serial, or product',
      icon: Search,
      path: '/oversight/item-trace',
      color: 'bg-blue-600',
    },
    {
      title: 'Money Flow / Day Book',
      description: 'Takings by payment method, revenue, COGS, margin, and the posted-journal cross-check',
      icon: LineChart,
      path: '/oversight/money-flow',
      color: 'bg-blue-600',
    },
    {
      title: 'Exceptions',
      description: 'Deep discounts, near-floor sales, unposted drafts, unreconciled banking, stale repairs',
      icon: TriangleAlert,
      path: '/oversight/exceptions',
      color: 'bg-amber-500',
    },
    {
      title: 'Cash-up / Z-Report',
      description: 'Expected vs counted cash per payment method, with variance and approval',
      icon: Wallet,
      path: '/oversight/cash-up',
      color: 'bg-slate-600',
    },
    {
      title: 'Web Orders',
      description: 'Ready/fulfil/cancel online orders, and void a completed one (managers only)',
      icon: ShoppingBag,
      path: '/oversight/web-orders',
      color: 'bg-teal-600',
    },
    {
      title: 'Commercial Terms',
      description: 'Runtime-editable settings, e.g. guest/member warranty base-days (managers only)',
      icon: Percent,
      path: '/oversight/settings',
      color: 'bg-blue-600',
    },
  ];

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Oversight</h1>
          <p className="text-sm text-slate-500 mt-1">Branch-manager visibility across item history, cash, and exceptions</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <button
                key={module.path}
                onClick={() => navigate(module.path)}
                className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow text-left"
              >
                <div className={`w-12 h-12 rounded-lg ${module.color} flex items-center justify-center mb-4`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-lg font-semibold text-slate-900 mb-2">{module.title}</h2>
                <p className="text-slate-600 text-sm">{module.description}</p>
              </button>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
