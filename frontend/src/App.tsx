import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/auth/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import ProductListPage from './pages/products/ProductListPage';
import ProductFormPage from './pages/products/ProductFormPage';
import CustomerListPage from './pages/customers/CustomerListPage';
import CustomerFormPage from './pages/customers/CustomerFormPage';
import SupplierListPage from './pages/suppliers/SupplierListPage';
import SupplierFormPage from './pages/suppliers/SupplierFormPage';
import SalesOrderListPage from './pages/sales/SalesOrderListPage';
import SalesOrderFormPage from './pages/sales/SalesOrderFormPage';
import SalesOrderDetailPage from './pages/sales/SalesOrderDetailPage';
import ReportsPage from './pages/reports/ReportsPage';
import SalesReportPage from './pages/reports/SalesReportPage';
import InventoryReportPage from './pages/reports/InventoryReportPage';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './components/ui';

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/products" element={<ProductListPage />} />
            <Route path="/products/new" element={<ProductFormPage />} />
            <Route path="/products/:id/edit" element={<ProductFormPage />} />
            <Route path="/customers" element={<CustomerListPage />} />
            <Route path="/customers/new" element={<CustomerFormPage />} />
            <Route path="/customers/:id/edit" element={<CustomerFormPage />} />
            <Route path="/suppliers" element={<SupplierListPage />} />
            <Route path="/suppliers/new" element={<SupplierFormPage />} />
            <Route path="/suppliers/:id/edit" element={<SupplierFormPage />} />
            <Route path="/sales-orders" element={<SalesOrderListPage />} />
            <Route path="/sales-orders/new" element={<SalesOrderFormPage />} />
            <Route path="/sales-orders/:id" element={<SalesOrderDetailPage />} />
            <Route path="/sales-orders/:id/edit" element={<SalesOrderFormPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/reports/sales" element={<SalesReportPage />} />
            <Route path="/reports/inventory" element={<InventoryReportPage />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
