import { type ReactNode } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, Users, ShoppingCart, FileText, LogOut, Truck, CreditCard, Settings, Calculator, Wifi, WifiOff, Warehouse, Store, Wrench, Eye, ClipboardList, Percent } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import { GlobalSearch } from './GlobalSearch';
import { NotificationBell } from './NotificationBell';
import { branding } from '../branding';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const { connected } = useWebSocket();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // WP: five-role model (ADMIN/MANAGER/ACCOUNTANT/INVENTORY/CASHIER). `roles` is optional - an
  // item with no `roles` is visible to every authenticated user. Every item below lists exactly
  // the roles whose backend @PreAuthorize matrix (see RoleRules) can actually call at least one
  // endpoint the page depends on, so the app never surfaces a nav link that would 403:
  //  - PoS, Products, Repairs, Customers: all staff (every role has some access - reads at least,
  //    CASHIER for creates).
  //  - Inventory, Suppliers, Purchase Orders: INVENTORY/MANAGER/ADMIN (stock-writer domain).
  //  - Sales Orders: MANAGER/ADMIN only (back-office CRUD is MANAGER_UP, not owned by any staff role).
  //  - Invoices, Payments, Accounting: ACCOUNTANT/MANAGER/ADMIN.
  //  - Reports: ACCOUNTANT/MANAGER/ADMIN (financial reports are withheld from CASHIER/INVENTORY).
  //  - Users, Settings: ADMIN only (user/company/system admin).
  //  - Oversight: MANAGER/ADMIN only (RoleRules.MANAGER_UP backs every oversight endpoint - branch
  //    manager + admin visibility, not owned by any staff role).
  //  - My Day: every staff role - its backend endpoint (GET /oversight/my-day) deliberately carries
  //    no @PreAuthorize restriction (own-day scoping is enforced inside MyDayService instead), since
  //    this is the one oversight-adjacent screen a cashier is meant to reach (reconciling their own
  //    till before handover) even though the rest of Oversight stays MANAGER/ADMIN-only above.
  //  - Commercial Terms: MANAGER/ADMIN only (RoleRules.MANAGER_UP backs GET/PUT /api/v1/settings) -
  //    deliberately separate from the ADMIN-only "Settings" (Company Settings) item above: commercial
  //    terms (e.g. warranty base-days) are branch-manager territory, ADMIN is IT (see the
  //    repair-warranty skill's WARRANTY-TIERS section).
  const navItems: { path: string; icon: typeof LayoutDashboard; label: string; roles?: string[] }[] = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/pos', icon: Store, label: 'Point of Sale' },
    { path: '/products', icon: Package, label: 'Products' },
    { path: '/inventory', icon: Warehouse, label: 'Inventory', roles: ['ADMIN', 'MANAGER', 'INVENTORY'] },
    { path: '/repairs', icon: Wrench, label: 'Repairs' },
    { path: '/customers', icon: Users, label: 'Customers' },
    { path: '/suppliers', icon: Truck, label: 'Suppliers', roles: ['ADMIN', 'MANAGER', 'INVENTORY'] },
    { path: '/sales-orders', icon: ShoppingCart, label: 'Sales Orders', roles: ['ADMIN', 'MANAGER'] },
    { path: '/purchase-orders', icon: Truck, label: 'Purchase Orders', roles: ['ADMIN', 'MANAGER', 'INVENTORY'] },
    { path: '/invoices', icon: FileText, label: 'Invoices', roles: ['ADMIN', 'MANAGER', 'ACCOUNTANT'] },
    { path: '/payments', icon: CreditCard, label: 'Payments', roles: ['ADMIN', 'MANAGER', 'ACCOUNTANT'] },
    { path: '/accounting', icon: Calculator, label: 'Accounting', roles: ['ADMIN', 'MANAGER', 'ACCOUNTANT'] },
    { path: '/reports', icon: FileText, label: 'Reports', roles: ['ADMIN', 'MANAGER', 'ACCOUNTANT'] },
    { path: '/oversight', icon: Eye, label: 'Oversight', roles: ['ADMIN', 'MANAGER'] },
    { path: '/oversight/my-day', icon: ClipboardList, label: 'My Day' },
    { path: '/oversight/settings', icon: Percent, label: 'Commercial Terms', roles: ['ADMIN', 'MANAGER'] },
    { path: '/users', icon: Users, label: 'Users', roles: ['ADMIN'] },
    { path: '/settings/company', icon: Settings, label: 'Settings', roles: ['ADMIN'] },
  ];

  const visibleNavItems = navItems.filter(
    (item) => !item.roles || (user?.role != null && item.roles.includes(user.role))
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-slate-900 text-slate-300 border-r border-slate-800 flex flex-col">
        <div className="p-6 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={branding.appName} className="w-10 h-10 rounded-lg object-contain" />
            ) : (
              <div className="w-10 h-10 bg-brand-600 rounded-lg flex items-center justify-center">
                <span className="text-2xl font-bold text-white">{branding.logoInitial}</span>
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-white">{branding.appName}</h1>
              <p className="text-xs text-slate-400">{branding.tagline}</p>
            </div>
          </div>
        </div>

        <div className="px-3 mt-4 flex items-center gap-2 flex-shrink-0">
          <div className="flex-1">
            <GlobalSearch />
          </div>
          <NotificationBell />
          <div className="relative group">
            {connected ? (
              <Wifi className="w-5 h-5 text-green-500" />
            ) : (
              <WifiOff className="w-5 h-5 text-red-500" />
            )}
            <div className="absolute right-0 top-8 hidden group-hover:block bg-slate-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
              {connected ? 'Real-time updates active' : 'Disconnected'}
            </div>
          </div>
        </div>

        <nav className="mt-4 px-3 flex-1 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${
                  isActive
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon size={20} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="w-full p-4 border-t border-slate-800 bg-slate-900 flex-shrink-0">
          <div className="mb-3 px-2">
            <p className="text-xs text-slate-500">Logged in as</p>
            <p className="font-semibold text-sm truncate text-white">{user?.fullName}</p>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-4 py-2 rounded-lg bg-slate-800 hover:bg-red-600 transition-colors text-slate-300 hover:text-white"
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
