import { type ReactNode } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, Users, ShoppingCart, FileText, LogOut, Truck, CreditCard, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { GlobalSearch } from './GlobalSearch';
import { NotificationBell } from './NotificationBell';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/products', icon: Package, label: 'Products' },
    { path: '/customers', icon: Users, label: 'Customers' },
    { path: '/suppliers', icon: Truck, label: 'Suppliers' },
    { path: '/sales-orders', icon: ShoppingCart, label: 'Sales Orders' },
    { path: '/purchase-orders', icon: Truck, label: 'Purchase Orders' },
    { path: '/invoices', icon: FileText, label: 'Invoices' },
    { path: '/payments', icon: CreditCard, label: 'Payments' },
    { path: '/reports', icon: FileText, label: 'Reports' },
    { path: '/users', icon: Users, label: 'Users' },
    { path: '/settings/company', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-gradient-to-b from-indigo-600 via-purple-600 to-pink-600 text-white shadow-2xl">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
              <span className="text-2xl font-bold">M</span>
            </div>
            <div>
              <h1 className="text-xl font-bold">Mula ERP</h1>
              <p className="text-xs text-white/70">Enterprise System</p>
            </div>
          </div>
        </div>

        <div className="px-3 mt-4 flex items-center gap-2">
          <div className="flex-1">
            <GlobalSearch />
          </div>
          <NotificationBell />
        </div>

        <nav className="mt-4 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-all duration-200 ${
                  isActive
                    ? 'bg-white/20 backdrop-blur-sm shadow-lg scale-105'
                    : 'hover:bg-white/10 hover:translate-x-1'
                }`}
              >
                <Icon size={20} className={isActive ? 'animate-pulse' : ''} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-white/10 bg-black/10 backdrop-blur-sm">
          <div className="mb-3 px-2">
            <p className="text-xs text-white/60">Logged in as</p>
            <p className="font-semibold text-sm truncate">{user?.fullName}</p>
            <p className="text-xs text-white/70 truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors text-red-100 hover:text-white"
          >
            <LogOut size={18} />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-64 min-h-screen">
        {children}
      </div>
    </div>
  );
}
