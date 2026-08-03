import { useNavigate } from 'react-router-dom';
import { Warehouse, SlidersHorizontal, Package, Hash, ArrowLeftRight, ListTree, ClipboardCheck } from 'lucide-react';
import Layout from '../../components/Layout';

export default function InventoryPage() {
  const navigate = useNavigate();

  const modules = [
    {
      title: 'Warehouses',
      description: 'Manage warehouse locations and view stock by warehouse',
      icon: Warehouse,
      path: '/inventory/warehouses',
      color: 'bg-blue-600',
    },
    {
      title: 'Stock Adjustments',
      description: 'Track inventory quantity adjustments and corrections',
      icon: SlidersHorizontal,
      path: '/inventory/adjustments',
      color: 'bg-blue-600',
    },
    {
      title: 'Batch/Lot Tracking',
      description: 'Monitor product batches, lots, and expiry dates',
      icon: Package,
      path: '/inventory/batches',
      color: 'bg-green-600',
    },
    {
      title: 'Serial Numbers',
      description: 'Track individually serialized product units',
      icon: Hash,
      path: '/inventory/serials',
      color: 'bg-amber-500',
    },
    {
      title: 'Stock Transfers',
      description: 'Move stock between warehouses',
      icon: ArrowLeftRight,
      path: '/inventory/transfers',
      color: 'bg-slate-600',
    },
    {
      title: 'Stock Movements',
      description: 'Read-only ledger of every stock-affecting event, with reconciliation',
      icon: ListTree,
      path: '/inventory/movements',
      color: 'bg-teal-600',
    },
    {
      title: 'Stock Takes',
      description: 'Guided physical count sessions with count sheets and manager approval',
      icon: ClipboardCheck,
      path: '/inventory/stock-takes',
      color: 'bg-brand-600',
    },
  ];

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Inventory</h1>
          <p className="text-sm text-slate-500 mt-1">Manage warehouses, stock, and tracking</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                <h2 className="text-xl font-semibold text-slate-900 mb-2">{module.title}</h2>
                <p className="text-slate-600 text-sm">{module.description}</p>
              </button>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
