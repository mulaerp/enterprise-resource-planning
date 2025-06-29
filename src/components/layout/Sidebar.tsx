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

const allMenuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/', configKey: 'modulesDashboard' },
  { icon: Calculator, label: 'Accounting', path: '/accounting', configKey: 'modulesAccounting' },
  { icon: ShoppingCart, label: 'Sales', path: '/sales', configKey: 'modulesSales' },
  { icon: Package, label: 'Inventory', path: '/inventory', configKey: 'modulesInventory' },
  { icon: FileText, label: 'Invoicing', path: '/invoicing', configKey: 'modulesInvoicing' },
  { icon: BarChart, label: 'Reports', path: '/reports', configKey: 'modulesReports' },
  { icon: Monitor, label: 'POS', path: '/pos', configKey: 'modulesPOS' },
  { icon: UserCheck, label: 'Human Resources', path: '/hr', configKey: 'modulesHR' },
  { icon: Factory, label: 'Manufacturing', path: '/manufacturing', configKey: 'modulesManufacturing' },
  { icon: ShoppingBag, label: 'Purchasing', path: '/purchasing', configKey: 'modulesPurchasing' },
  { icon: Target, label: 'CRM', path: '/crm', configKey: 'modulesCRM' },
  { icon: Users, label: 'Customers', path: '/customers', configKey: 'modulesSales' }, // Uses sales module config
  { icon: Settings, label: 'Configuration', path: '/configuration', configKey: 'modulesConfiguration' }
];

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { config } = useConfig();
  const companyName = config?.companyName || 'MulaERP';

  // Filter menu items based on enabled modules
  const enabledMenuItems = allMenuItems.filter(item => {
    if (!config) return true; // Show all items if config is not loaded yet
    
    const isEnabled = config[item.configKey as keyof typeof config];
    return isEnabled === true;
  });

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
        {enabledMenuItems.map((item) => (
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

      {/* Module Status Indicator */}
      {!collapsed && config && (
        <div className="absolute bottom-4 left-4 right-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 mb-2">Active Modules</p>
            <div className="flex flex-wrap gap-1">
              {enabledMenuItems.slice(0, 6).map((item, index) => (
                <div
                  key={index}
                  className="w-2 h-2 bg-green-400 rounded-full"
                  title={item.label}
                />
              ))}
              {enabledMenuItems.length > 6 && (
                <span className="text-xs text-gray-500">+{enabledMenuItems.length - 6}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}