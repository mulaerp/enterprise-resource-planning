import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Package,
  FileText,
  BarChart,
  Monitor,
  Settings,
  ChevronLeft,
  ChevronRight,
  Factory,
  ShoppingBag,
  Calculator,
  UserCheck,
  Target
} from 'lucide-react';
import { useConfig } from '../../hooks/useConfig';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: ShoppingCart, label: 'Sales', path: '/sales' },
  { icon: Users, label: 'Customers', path: '/customers' },
  { icon: Package, label: 'Inventory', path: '/inventory' },
  { icon: FileText, label: 'Invoicing', path: '/invoicing' },
  { icon: BarChart, label: 'Reports', path: '/reports' },
  { icon: Monitor, label: 'POS', path: '/pos' },
  { icon: Factory, label: 'Manufacturing', path: '/manufacturing' },
  { icon: ShoppingBag, label: 'Purchasing', path: '/purchasing' },
  { icon: Calculator, label: 'Accounting', path: '/accounting' },
  { icon: UserCheck, label: 'Human Resources', path: '/hr' },
  { icon: Target, label: 'CRM', path: '/crm' },
  { icon: Settings, label: 'Configuration', path: '/configuration' }
];

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { config } = useConfig();
  const companyName = config?.companyName || 'MulaERP';

  return (
    <div className={`bg-white shadow-lg transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
      <div className="flex items-center justify-between p-4 border-b">
        {!collapsed && (
          <h1 className="text-2xl font-bold text-blue-600">{companyName}</h1>
        )}
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>
      
      <nav className="mt-6">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors ${
                isActive ? 'bg-blue-50 text-blue-600 border-r-2 border-blue-600' : ''
              }`
            }
          >
            <item.icon size={20} />
            {!collapsed && <span className="ml-3">{item.label}</span>}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}