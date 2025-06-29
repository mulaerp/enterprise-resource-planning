import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import Dashboard from './pages/Dashboard';
import Sales from './pages/Sales';
import Customers from './pages/Customers';
import Inventory from './pages/Inventory';
import Invoicing from './pages/Invoicing';
import Reports from './pages/Reports';
import POS from './pages/POS';
import CustomerDisplay from './pages/CustomerDisplay';
import Configuration from './pages/Configuration';
import Manufacturing from './pages/Manufacturing';
import Purchasing from './pages/Purchasing';
import Accounting from './pages/Accounting';
import HumanResources from './pages/HumanResources';
import CRM from './pages/CRM';
import Notifications from './pages/Notifications';
import Login from './pages/Login';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';

function AppContent() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  // Customer display doesn't require authentication
  if (location.pathname === '/customer-display') {
    return <CustomerDisplay />;
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/invoicing" element={<Invoicing />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/pos" element={<POS />} />
            <Route path="/manufacturing" element={<Manufacturing />} />
            <Route path="/purchasing" element={<Purchasing />} />
            <Route path="/accounting" element={<Accounting />} />
            <Route path="/hr" element={<HumanResources />} />
            <Route path="/crm" element={<CRM />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/configuration" element={<Configuration />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <Router>
          <AppContent />
        </Router>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;