import { useNavigate } from 'react-router-dom';
import { BookOpen, FileText, BarChart3 } from 'lucide-react';
import Layout from '../../components/Layout';

export default function AccountingPage() {
  const navigate = useNavigate();

  const modules = [
    {
      title: 'Chart of Accounts',
      description: 'Manage your chart of accounts',
      icon: BookOpen,
      path: '/accounting/accounts',
      color: 'from-blue-500 to-blue-600',
    },
    {
      title: 'Journal Entries',
      description: 'Create and manage journal entries',
      icon: FileText,
      path: '/accounting/journal-entries',
      color: 'from-purple-500 to-purple-600',
    },
    {
      title: 'Trial Balance',
      description: 'View trial balance report',
      icon: BarChart3,
      path: '/accounting/trial-balance',
      color: 'from-green-500 to-green-600',
    },
  ];

  return (
    <Layout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Accounting</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <button
                key={module.path}
                onClick={() => navigate(module.path)}
                className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-all duration-200 hover:scale-105 text-left"
              >
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${module.color} flex items-center justify-center mb-4`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-xl font-semibold mb-2">{module.title}</h2>
                <p className="text-gray-600">{module.description}</p>
              </button>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
