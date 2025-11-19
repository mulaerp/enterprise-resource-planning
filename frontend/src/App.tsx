import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/auth/LoginPage';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './components/ui';

// Lazy load pages for better performance (Phase 5.1)
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const ProductListPage = lazy(() => import('./pages/products/ProductListPage'));
const ProductFormPage = lazy(() => import('./pages/products/ProductFormPage'));
const CustomerListPage = lazy(() => import('./pages/customers/CustomerListPage'));
const CustomerFormPage = lazy(() => import('./pages/customers/CustomerFormPage'));
const SupplierListPage = lazy(() => import('./pages/suppliers/SupplierListPage'));
const SupplierFormPage = lazy(() => import('./pages/suppliers/SupplierFormPage'));
const SalesOrderListPage = lazy(() => import('./pages/sales/SalesOrderListPage'));
const SalesOrderFormPage = lazy(() => import('./pages/sales/SalesOrderFormPage'));
const SalesOrderDetailPage = lazy(() => import('./pages/sales/SalesOrderDetailPage'));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'));
const SalesReportPage = lazy(() => import('./pages/reports/SalesReportPage'));
const InventoryReportPage = lazy(() => import('./pages/reports/InventoryReportPage'));

// Loading component
const LoadingFallback = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <Suspense fallback={<LoadingFallback />}>
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
          </Suspense>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
